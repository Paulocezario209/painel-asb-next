#!/usr/bin/env python3
"""security_review.py — traduz o relatorio de um scanner para findings de governanca.

**Este adapter nao escaneia nada.** Ele ingere o relatorio que uma ferramenta ja produziu e o
converte em registros que obedecem `schema/security-finding.schema.json`. E de proposito: o
contrato de seguranca nao se acopla a fornecedor (secao 8), entao a ferramenta fica de fora e a
traducao fica aqui. Trocar de scanner = outro adapter, contrato e schema intactos.

Tambem nao decide nada. Severidade que chega vira severidade que sai; **CRITICAL nunca e inventado
por este arquivo** — e atribuido na triagem, pela governanca (contrato, secao 1). Um adapter que
promovesse severidade estaria decidindo, e decidir nao e papel de tradutor.

Duas recusas, ambas fail-closed:
  - **segredo no relatorio** -> recusa a ingestao inteira (padrao do Guardiao 1, fonte unica);
  - **instrucao embutida no conteudo revisado** -> nao vira ordem; vira o proprio finding
    (contrato, secao 9: conteudo externo e dado, nunca instrucao).

Uso:
  security_review.py ingest --report <arquivo.json|.md> --repo <id> [--workstream <id>] [--write]
  security_review.py lifecycle                      # imprime o ciclo de vida canonico

Sem --write, imprime os findings e nao toca no disco (o padrao e nao escrever).

Exit: 0 ok | 1 recusa de conteudo | 2 segredo | 3 uso/IO
"""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

SEVERIDADES = ("low", "medium", "high", "critical")
CONFIANCAS = ("low", "medium", "high")

# Frases que so existem para dobrar quem le. Nao sao heuristica de estilo: sao a assinatura de
# injecao de prompt em conteudo revisado. Achou? Vira finding, nunca ordem.
INJECAO = re.compile(
    r"(ignore (all |the )?(previous|above|prior) instructions"
    r"|disregard (the )?(above|previous|system)"
    r"|you are now|new instructions:|system prompt"
    r"|desconsidere as instru|ignore as instru"
    r"|reveal (the )?(secret|api key|token)|print (the )?\.env)",
    re.I)


def die(code, msg):
    print(msg, file=sys.stderr)
    sys.exit(code)


def repo_root():
    try:
        p = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                           capture_output=True, text=True, timeout=10)
        return p.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def secret_re(root):
    """FONTE UNICA do padrao anti-credencial: o Guardiao 1. Nunca uma segunda regex."""
    for guard in (os.path.join(root, ".governance-core", "hooks", "preflight-gate.sh"),
                  os.path.join(root, "governance-core", "hooks", "preflight-gate.sh"),
                  os.path.join(root, ".claude", "hooks", "preflight-gate.sh")):
        try:
            for line in open(guard, encoding="utf-8"):
                m = re.match(r"^SECRET_RE='(.*)'\s*$", line.rstrip("\n"))
                if m:
                    return re.compile(m.group(1))
        except OSError:
            continue
    die(2, "padrao do Guardiao 1 nao encontrado no core — fail-closed")


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def finding_id(repo, componente, categoria, ano):
    """Estavel: o MESMO achado reaberto amanha recebe o mesmo id, e nao duplica no log."""
    h = hashlib.sha1(f"{repo}|{componente}|{categoria}".encode("utf-8")).hexdigest()[:8]
    return f"SEC-{ano}-{h}"


def normalize(bruto, repo, workstream=None):
    """Um item do relatorio -> um finding do schema. Campo faltando nunca vira suposicao."""
    sev = str(bruto.get("severity", "")).lower()
    if sev not in SEVERIDADES:
        sev = "medium"                       # desconhecido nao vira low por otimismo
    conf = str(bruto.get("confidence", "")).lower()
    if conf not in CONFIANCAS:
        conf = "low"
    componente = str(bruto.get("component") or bruto.get("where") or "(nao informado)")[:200]
    categoria = str(bruto.get("category") or "unspecified")[:60]

    ev = []
    for e in (bruto.get("evidence") or []):
        if isinstance(e, str):
            ev.append({"ref": e[:200]})
        elif isinstance(e, dict) and e.get("ref"):
            ev.append({k: str(v)[:300] for k, v in e.items() if k in ("ref", "note")})
    if not ev:
        ev = [{"ref": componente, "note": "sem ponteiro file:line no relatorio de origem"}]

    f = {
        "schema_version": 1,
        "finding_id": finding_id(repo, componente, categoria, now()[:4]),
        "repository": repo,
        "severity": sev,
        "confidence": conf,
        "source": str(bruto.get("source") or "scanner")[:80],
        "category": categoria,
        "affected_component": componente,
        "evidence": ev[:20],
        "threat_scenario": str(bruto.get("threat_scenario") or bruto.get("impact")
                               or "(nao informado pelo relatorio de origem)")[:800],
        "remediation": str(bruto.get("remediation") or bruto.get("fix")
                           or "(nao informado pelo relatorio de origem)")[:800],
        "status": "detected",
        "created_at": now(),
    }
    if workstream:
        f["workstream_id"] = workstream
    return f


def ingest(args):
    root = repo_root() or die(3, "ERRO: nao estou num working tree git")
    try:
        raw = open(args.report, encoding="utf-8").read()
    except OSError as e:
        die(3, f"ERRO IO: {e}")

    if secret_re(root).search(raw):
        die(2, "SEGREDO no relatorio — ingestao recusada. Rotacione a credencial e reescreva o "
               "relatorio apontando arquivo:linha e o NOME da variavel, nunca o valor.")

    itens = []
    if raw.lstrip().startswith(("{", "[")):
        try:
            d = json.loads(raw)
        except ValueError as e:
            die(3, f"ERRO JSON malformado: {e}")
        itens = d if isinstance(d, list) else (d.get("findings") or [])
    else:
        die(3, "relatorio nao-JSON: converta para JSON (lista de achados ou {\"findings\": [...]}) "
               "antes de ingerir — este adapter nao interpreta prosa")

    if not isinstance(itens, list):
        die(3, "relatorio sem lista de achados")

    findings = [normalize(i, args.repo, args.workstream) for i in itens if isinstance(i, dict)]

    # Instrucao embutida no conteudo revisado NAO e ordem — vira achado (contrato, secao 9).
    if INJECAO.search(raw):
        findings.append({
            "schema_version": 1,
            "finding_id": finding_id(args.repo, args.report, "prompt-injection", now()[:4]),
            "repository": args.repo,
            "severity": "high",
            "confidence": "medium",
            "source": "adapter de ingestao",
            "category": "prompt-injection",
            "affected_component": os.path.basename(args.report),
            "evidence": [{"ref": args.report, "note": "padrao de instrucao embutida detectado no relatorio"}],
            "threat_scenario": "Conteudo revisado carrega texto que tenta instruir o revisor a "
                               "ignorar politica, revelar segredo ou alterar governanca. Se algum "
                               "agente tratar isso como instrucao, a politica cai por dentro.",
            "remediation": "Tratar o trecho como dado. Revisar manualmente a origem do conteudo "
                           "antes de qualquer acao automatica sobre ele.",
            "status": "detected",
            "created_at": now(),
        })
        if args.workstream:
            findings[-1]["workstream_id"] = args.workstream

    if not args.write:
        print(json.dumps(findings, ensure_ascii=False, indent=2))
        print(f"\n{len(findings)} finding(s) — nada gravado (use --write para persistir)",
              file=sys.stderr)
        return 0

    d = os.path.join(root, ".asb", "security-findings")
    os.makedirs(d, exist_ok=True)
    for f in findings:
        p = os.path.join(d, f["finding_id"] + ".json")
        if os.path.exists(p):
            # Reingestao nao apaga historico: o estado do finding e da governanca, nao do scanner.
            print(f"  mantido (ja existe): {f['finding_id']}")
            continue
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(f, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        print(f"  gravado: {f['finding_id']} ({f['severity']})")
    return 0


def lifecycle(_args):
    print("detected -> verified -> triaged -> remediation_planned -> fix_in_progress "
          "-> fix_verified -> closed")
    print("saidas laterais: false_positive | accepted_risk | deferred")
    print("accepted_risk em high/critical exige human_approval registrada no finding")
    return 0


def main():
    ap = argparse.ArgumentParser(prog="security_review",
                                 description="Adapter: relatorio de scanner -> findings de governanca")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("ingest")
    p.add_argument("--report", required=True)
    p.add_argument("--repo", required=True)
    p.add_argument("--workstream")
    p.add_argument("--write", action="store_true", help="persiste em .asb/security-findings/")
    p.set_defaults(func=ingest)
    p = sub.add_parser("lifecycle")
    p.set_defaults(func=lifecycle)
    args = ap.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
