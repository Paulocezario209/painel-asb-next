#!/usr/bin/env python3
"""asb_security_classify.py — classifica o RISCO de uma unidade de trabalho pela superficie tocada.

A norma esta em contracts/security-governance-contract.md, secao 1. Este arquivo e a implementacao
dela — e so isso. Se a tabela do contrato mudar, muda aqui; nunca o contrario.

Duas regras que sustentam o resto:
  - **Vale o MAIOR nivel de qualquer caminho tocado.** Um PR de 40 arquivos de documentacao e um de
    migration e HIGH. Media diluiria exatamente o arquivo que importa.
  - **Fail-closed no desconhecido.** Caminho que nao casa com nada nao vira LOW por otimismo: vira
    MEDIUM. LOW e para o que se reconhece como inofensivo, nao para o que nao se reconhece.

O piso do repositorio (.asb/security.json -> profile) tambem nunca e furado: um repo declarado
`high` nao produz unidade LOW so porque o diff mexeu num README.

CRITICAL nao sai daqui. Ele descreve consequencia (bypass de auth, cross-tenant, execucao arbitraria,
exposicao de segredo, escalonamento, fuga de sandbox) e e atribuido na TRIAGEM, pela governanca —
caminho de arquivo nao prova consequencia.

Uso:
  asb_security_classify.py                      # diff da branch vs master/main
  asb_security_classify.py --paths a.py b.sql   # lista explicita
  asb_security_classify.py --json               # saida para o gate

Exit: 0 sempre que classificou (o nivel vai na saida) | 3 uso/IO
"""
import argparse
import json
import os
import re
import subprocess
import sys

NIVEIS = ["low", "medium", "high"]          # CRITICAL: so na triagem, nunca por caminho

# Ordem importa: a primeira regra que casar vence, dentro do nivel mais alto encontrado.
# Cada padrao existe por uma superficie nomeada no contrato — nada de "parece perigoso".
REGRAS = [
    ("high", "auth", r"(^|/)(auth|authn|authz|oauth|jwt|session|login|permission|rbac|acl)[^/]*\.(py|ts|tsx|js|go|rb|java)$"),
    ("high", "auth", r"(^|/)(auth0|keycloak|clerk|supabase[-_]auth)"),
    ("high", "secrets", r"(^|/)(\.env|secrets?|credentials?|keystore|vault)"),
    ("high", "migrations", r"(^|/)(migrations?|migrate)/"),
    ("high", "database", r"\.(sql|psql)$"),
    ("high", "rls", r"(^|/)[^/]*(rls|policy|policies)[^/]*\.(sql|py|ts)$"),
    ("high", "mcp", r"(^|/)[^/]*mcp[^/]*\.(py|ts|tsx|js|json)$"),
    ("high", "webhooks", r"(^|/)[^/]*(webhook|callback)[^/]*\.(py|ts|tsx|js)$"),
    ("high", "remote_execution", r"(^|/)(executor|sandbox|runner)[^/]*"),
    ("high", "ci_cd", r"(^|/)(\.github/workflows|\.gitlab-ci|Jenkinsfile|\.circleci)"),
    ("high", "docker", r"(^|/)(Dockerfile[^/]*|docker-compose[^/]*\.ya?ml)$"),
    ("high", "infrastructure", r"(^|/)(terraform|infra|deploy|k8s|helm)/"),
    ("high", "crypto", r"(^|/)[^/]*(crypto|cipher|encrypt|decrypt|hmac|signature)[^/]*\.(py|ts|tsx|js|go)$"),
    ("high", "file_upload", r"(^|/)[^/]*(upload|download|multipart)[^/]*\.(py|ts|tsx|js)$"),
    ("high", "sandbox", r"(^|/)(seccomp|apparmor|bwrap|gvisor)"),
    ("high", "ci_cd", r"(^|/)(\.claude/hooks|governance-core/hooks)/"),

    ("medium", "external_integration", r"(^|/)(integrations?|clients?|providers?|adapters?)/"),
    ("medium", "internal_api", r"(^|/)(api|routes?|controllers?|endpoints?|handlers?)/"),
    ("medium", "business_logic", r"(^|/)(services?|domain|models?|workers?|lib)/"),
    ("medium", "internal_api", r"(^|/)(requirements[^/]*\.txt|package(-lock)?\.json|pnpm-lock\.ya?ml|poetry\.lock|go\.(mod|sum)|Gemfile(\.lock)?|Cargo\.(toml|lock))$"),
    ("medium", "business_logic", r"\.(py|ts|tsx|js|jsx|go|rb|java|rs|php)$"),

    ("low", "static_content", r"\.(md|mdx|txt|rst|adoc)$"),
    ("low", "static_content", r"\.(css|scss|svg|png|jpe?g|gif|webp|ico|woff2?)$"),
    ("low", "static_content", r"(^|/)(docs?|LICENSE|CHANGELOG)"),
]


# Arvore de DEPENDENCIA nao e superficie autorada pela unidade. O que importa numa dependencia e
# o MANIFESTO (requirements.txt, package.json, go.mod) — esse continua contando, pela regra MEDIUM.
# Sem este filtro, um venv nao-ignorado transforma qualquer diff em 10 mil arquivos e afoga o sinal.
VENDOR = re.compile(r"(^|/)(node_modules|site-packages|\.?venv[^/]*|virtualenv|vendor|"
                    r"dist|build|\.next|\.nuxt|target|__pycache__|\.mypy_cache|\.pytest_cache|"
                    r"coverage|\.tox|\.gradle|Pods)(/|$)")


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(3)


def run(cmd):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return p.returncode, p.stdout
    except (OSError, subprocess.SubprocessError):
        return 1, ""


def repo_root():
    rc, out = run(["git", "rev-parse", "--show-toplevel"])
    return out.strip() if rc == 0 and out.strip() else None


def base_ref():
    """Contra o que comparar. Sem base identificavel, compara com o commit anterior."""
    for ref in ("origin/master", "origin/main", "master", "main"):
        if run(["git", "rev-parse", "--verify", "--quiet", ref])[0] == 0:
            return ref
    return "HEAD~1"


def changed_paths():
    """Tudo que a unidade toca: commitado na branch, modificado e AINDA NAO RASTREADO.

    Arquivo novo e o caso mais perigoso de todos — um `auth_novo.py` que o git ainda nao conhece
    e o classificador nao veria seria justamente o que precisa de revisao. `git diff` nao lista
    untracked; por isso a terceira consulta.
    """
    ref = base_ref()
    paths = []
    for cmd in (["git", "diff", "--name-only", f"{ref}...HEAD"],
                ["git", "diff", "--name-only", "HEAD"],
                ["git", "ls-files", "--others", "--exclude-standard"]):
        rc, out = run(cmd)
        if rc == 0:
            paths += [l.strip() for l in out.splitlines() if l.strip()]
    return sorted({p for p in set(paths) if not VENDOR.search(p)})


def profile_floor(root):
    """Piso do repositorio. Perfil ausente NAO libera: vale o mais restritivo (contrato, secao 2)."""
    p = os.path.join(root or ".", ".asb", "security.json")
    if not os.path.isfile(p):
        return "high", "perfil ausente — vale o mais restritivo"
    try:
        prof = json.load(open(p, encoding="utf-8")).get("profile")
    except (OSError, ValueError):
        return "high", "perfil ilegivel — vale o mais restritivo"
    if prof == "critical":
        return "high", "perfil do repo e critical"          # piso maximo derivavel de caminho
    if prof in NIVEIS:
        return prof, f"perfil do repo e {prof}"
    return "high", "perfil invalido — vale o mais restritivo"


def classify_path(path):
    for nivel, superficie, pat in REGRAS:
        if re.search(pat, path):
            return nivel, superficie
    return "medium", "desconhecido"        # fail-closed: nao reconhecido nunca vira LOW


def classify(paths, root=None):
    piso, motivo_piso = profile_floor(root)
    nivel = piso
    razoes = [{"path": "(piso do repositorio)", "level": piso, "surface": motivo_piso}]
    superficies = set()
    for p in paths:
        n, s = classify_path(p)
        superficies.add(s)
        razoes.append({"path": p, "level": n, "surface": s})
        if NIVEIS.index(n) > NIVEIS.index(nivel):
            nivel = n
    return {
        "risk": nivel,
        "files": len(paths),
        "surfaces": sorted(superficies),
        "reasons": [r for r in razoes if r["level"] == nivel][:12],
        "note": "CRITICAL nunca sai da classificacao por caminho — e atribuido na triagem",
    }


def main():
    ap = argparse.ArgumentParser(prog="asb_security_classify")
    ap.add_argument("--paths", nargs="*", help="caminhos explicitos (default: diff da branch)")
    ap.add_argument("--root", help="raiz do repositorio (default: git rev-parse)")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    root = args.root or repo_root()
    paths = args.paths if args.paths is not None else changed_paths()
    res = classify(paths, root)

    if args.json:
        print(json.dumps(res, ensure_ascii=False, indent=2))
    else:
        print(f"RISK: {res['risk'].upper()}  ({res['files']} arquivo(s))")
        print("superficies:", ", ".join(res["surfaces"]) or "nenhuma")
        for r in res["reasons"]:
            print(f"  {r['level']:>6}  {r['surface']:<22} {r['path']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
