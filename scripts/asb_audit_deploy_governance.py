#!/usr/bin/env python3
"""asb_audit_deploy_governance — verificador READ-ONLY de coerencia da governanca de deploy.

NUCLEO COMUM + CONFIG LOCAL. O script e identico entre repos; a configuracao das fontes vivas,
da canonica e do verify-workflow vem SEMPRE do proprio repositorio:
`scripts/deploy_governance.config.json`. Escaneia APENAS o proprio repo (REPO_ROOT = dois niveis
acima). NUNCA procura repositorios irmaos. NAO escreve, NAO commita, NAO instala, NAO acessa segredo.

O que valida:
  1. Fontes VIVAS (prosa-regra) sem expressoes de deploy JA SUPERADAS (deploy manual, "Paulo clica
     Deploy", CP_LIVE_SHA=UNKNOWN, EASYPANEL_DEPLOY_URL, Basic Auth afirmada). Linha marcada como
     HISTORICA/negada e permitida.
  2. Asseroes POSITIVAS ESTAVEIS na canonica (config: canon_asserts) — NUNCA um SHA de deploy volatil.
  3. (opcional) O verify-workflow do repo tem as PROPRIEDADES certas (config: verify_workflow):
     consulta o dominio custom correto; exige 200; valida JSON; compara SHA DINAMICAMENTE com
     github.sha; tem timeout/polling; NAO aceita 'unknown' como sucesso.

Principio: status computavel (SHA de deploy) NAO e fonte canonica estatica. O auditor NUNCA exige
que documentos vivos contenham um SHA de deploy.

Saida: curta. exit 0 = coerente; exit 1 = contradicao OU config/fonte ausente/ilegivel (fail-closed).
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
CONFIG_REL = "scripts/deploy_governance.config.json"

# --- NUCLEO COMUM: padroes universais (nao dependem de repo) ---------------------------------
FORBIDDEN = [
    ("deploy_manual", re.compile(r"deploy\s+é\s+manual", re.I), False),
    ("paulo_clica_deploy", re.compile(r"paulo[^\n]{0,25}?clic\w*[^\n]{0,15}?deploy", re.I), False),
    ("clicar_deploy_easypanel", re.compile(r"clic\w*[^\n]{0,18}?deploy[^\n]{0,18}?easypanel", re.I), False),
    ("push_nao_rebuilda", re.compile(r"push\s+na\s+main[^\n]{0,25}?(?:não|nao)\s+rebuild", re.I), False),
    ("deploy_nao_automatico", re.compile(r"deploy[^\n]{0,15}?(?:não|nao)\s+é\s+autom", re.I), False),
    ("push_nao_publica", re.compile(r"push[^\n]{0,25}?(?:não|nao)\s+publica", re.I), False),
    ("cp_live_sha_unknown", re.compile(r"cp_live_sha\s*=?\s*unknown", re.I), False),
    ("easypanel_deploy_url", re.compile(r"easypanel_deploy_url", re.I), True),
    ("basic_auth", re.compile(r"basic\s*auth", re.I), True),
]
HIST_MARKERS = [
    "históric", "historic", "supersed", "superad", "obsolet", "desativ", "~~",
    "regra antiga", "antes:", "(era ", "deixou de", "nunca ressuscitar",
    "hipótese morta", "hipoteses morta", "hipóteses morta", "revogad",
]
NEG_MARKERS = [
    "sem ", "não ", "nao ", "nunca", "jamais", "corrigido",
    "confirmou ausência", "confirmou ausencia", "removid", "hipotese", "hipótese",
]
# Tokens que, se co-ocorrerem com 'unknown' numa linha do verify-workflow, indicam ACEITE de unknown.
VERIFY_ACCEPT_TOKENS = ("ok=1", "::warning", "success", "best-effort", "prova completa")


def read(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def _normalize(line):
    return "".join(ch for ch in line.lower() if ch not in "*_`")


def line_allowed(line, allow_neg):
    low = _normalize(line)
    if any(m in low for m in HIST_MARKERS):
        return True
    if allow_neg and any(m in low for m in NEG_MARKERS):
        return True
    return False


def load_config():
    p = os.path.join(REPO_ROOT, CONFIG_REL)
    if not os.path.exists(p):
        print(f"FAIL-CLOSED: config local ausente: {CONFIG_REL}")
        return None
    try:
        cfg = json.loads(read(p))
    except (OSError, ValueError) as exc:
        print(f"FAIL-CLOSED: config local ilegivel/invalida ({CONFIG_REL}): {exc}")
        return None
    if not isinstance(cfg.get("canonical"), str):
        print(f"FAIL-CLOSED: config sem 'canonical' (str) em {CONFIG_REL}")
        return None
    cfg.setdefault("live_rule_files", [])
    cfg.setdefault("live_rule_globs", [])
    cfg.setdefault("canon_asserts", [])
    cfg.setdefault("verify_workflow", None)
    return cfg


def gather_files(cfg):
    files = []
    for rel in cfg["live_rule_files"]:
        if os.path.exists(os.path.join(REPO_ROOT, rel)):
            files.append(rel)
    for pair in cfg["live_rule_globs"]:
        base, ext = pair[0], pair[1]
        d = os.path.join(REPO_ROOT, base)
        if os.path.isdir(d):
            for name in sorted(os.listdir(d)):
                if name.endswith(ext):
                    files.append(os.path.join(base, name))
    return files


SHA_RE = re.compile(r"\b[0-9a-f]{7,40}\b")


def check_verify_workflow(cfg):
    """Valida as PROPRIEDADES do verify-workflow (nao um SHA). Opcional (repos sem verify pulam)."""
    vw = cfg.get("verify_workflow")
    if not vw:
        return [], []
    viol, err = [], []
    path, domain = vw.get("path"), vw.get("domain")
    if not path or not domain:
        return ["[verify] config.verify_workflow sem 'path'/'domain'"], []
    p = os.path.join(REPO_ROOT, path)
    if not os.path.exists(p):
        return [], [f"FAIL-CLOSED: verify_workflow ausente: {path}"]
    try:
        txt = read(p)
    except OSError as exc:
        return [], [f"FAIL-CLOSED: nao consegui ler verify_workflow {path}: {exc}"]
    low = txt.lower()
    if domain.lower() not in low:
        viol.append(f"[verify] {path}: nao consulta o dominio custom '{domain}'")
    if "github.sha" not in low:
        viol.append(f"[verify] {path}: nao compara DINAMICAMENTE com github.sha")
    if "timeout-minutes" not in low:
        viol.append(f"[verify] {path}: sem timeout total (timeout-minutes)")
    if "200" not in txt:
        viol.append(f"[verify] {path}: nao exige HTTP 200")
    if not any(m in txt for m in ("json.load", "['sha']", '"sha"')):
        viol.append(f"[verify] {path}: nao valida JSON (sha)")
    # rejeita unknown: nenhuma linha pode ACEITAR 'unknown' como sucesso
    for i, line in enumerate(txt.splitlines(), 1):
        ll = line.lower()
        if "unknown" in ll and any(a in ll for a in VERIFY_ACCEPT_TOKENS):
            viol.append(f"[verify] {path}:{i}: 'unknown' aceito como sucesso (permite unknown)")
    return viol, err


def main():
    cfg = load_config()
    if cfg is None:
        return 1

    canon = cfg["canonical"]
    violations, errors = [], []

    # 1) canonica local (fail-closed se faltar/ilegivel)
    canon_path = os.path.join(REPO_ROOT, canon)
    if not os.path.exists(canon_path):
        print(f"FAIL-CLOSED: fonte canonica ausente: {canon}")
        return 1
    try:
        canon_txt = read(canon_path).lower()
    except OSError as exc:
        print(f"FAIL-CLOSED: nao consegui ler {canon}: {exc}")
        return 1
    for label, needle in cfg["canon_asserts"]:
        # guarda-corpo: config NUNCA deve cravar um SHA de deploy como assercao viva
        if SHA_RE.fullmatch(needle.strip().lower()):
            violations.append(f"[canon] assert '{label}' exige um SHA fixo ('{needle}') — proibido (status computavel != fonte canonica)")
            continue
        if needle.lower() not in canon_txt:
            violations.append(f"[canon] {canon}: assercao ausente -> {label} (esperava '{needle}')")

    # 2) scan de proibidos nas fontes vivas de prosa-regra do proprio repo
    for rel in gather_files(cfg):
        try:
            text = read(os.path.join(REPO_ROOT, rel))
        except OSError as exc:
            errors.append(f"FAIL-CLOSED: nao consegui ler fonte viva {rel}: {exc}")
            continue
        for i, line in enumerate(text.splitlines(), 1):
            for name, rx, allow_neg in FORBIDDEN:
                if rx.search(line) and not line_allowed(line, allow_neg):
                    violations.append(f"[{name}] {rel}:{i}: {line.strip()[:100]}")

    # 3) verify-workflow (opcional) — valida propriedades, nunca um SHA
    vviol, verr = check_verify_workflow(cfg)
    violations += vviol
    errors += verr

    if errors:
        for e in errors:
            print(e)
        return 1
    if violations:
        print(f"CONTRADICOES: {len(violations)}")
        for v in violations:
            print(" -", v)
        print(f"\nFonte canonica local: {canon}. Corrija as fontes vivas/verify ou marque como historico.")
        return 1
    vw = " + verify-workflow" if cfg.get("verify_workflow") else ""
    print(f"OK: governanca de deploy coerente com {canon} ({len(gather_files(cfg))} fontes vivas{vw}; config local).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
