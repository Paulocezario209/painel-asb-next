#!/usr/bin/env python3
"""asb_security_gate.py — decide se a unidade pode seguir para REVIEW/MERGE.

Norma: contracts/security-governance-contract.md, secao 3. Aqui so a decisao mecanica.

O gate responde tres coisas, nessa ordem:
  1. a revisao de seguranca e obrigatoria nesta unidade?
  2. existe finding HIGH/CRITICAL aberto neste repositorio?
  3. esta unidade exige aprovacao humana antes do merge?

E bloqueia por qualquer uma. Nunca "avisa e deixa passar" — aviso que nao bloqueia vira ruido, e
ruido treina todo mundo a ignorar.

Aberto = qualquer estado antes de fix_verified/closed/false_positive/accepted_risk. E accepted_risk
em HIGH/CRITICAL so conta como fechado com aprovacao humana registrada no proprio finding — o
validador do core recusa o arquivo sem ela, e aqui a checagem se repete: defesa em profundidade,
porque o finding pode ter sido escrito sem passar pelo validador.

Uso:
  asb_security_gate.py                       # classifica sozinho e decide
  asb_security_gate.py --risk high           # risco ja classificado
  asb_security_gate.py --external-pr         # PR de origem nao confiavel
  asb_security_gate.py --review-done         # revisao de seguranca ja executada nesta unidade
  asb_security_gate.py --json

Exit: 0 liberado | 1 bloqueado | 3 uso/IO
"""
import argparse
import json
import os
import subprocess
import sys

ABERTOS = ("detected", "verified", "triaged", "remediation_planned", "fix_in_progress", "deferred")
ESTADOS = ABERTOS + ("fix_verified", "closed", "false_positive", "accepted_risk")
SEVERIDADES = ("low", "medium", "high", "critical")
BLOQUEIA_SE = ("high", "critical")


def repo_root(explicit=None):
    if explicit:
        return explicit
    try:
        p = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                           capture_output=True, text=True, timeout=10)
        return p.stdout.strip() or None
    except (OSError, subprocess.SubprocessError):
        return None


def load_profile(root):
    p = os.path.join(root, ".asb", "security.json")
    if not os.path.isfile(p):
        # Perfil ausente NAO libera (contrato, secao 2): assume o mais restritivo.
        return {"profile": "high", "security_review_required": True,
                "threat_model_required": True, "_ausente": True}
    try:
        return json.load(open(p, encoding="utf-8"))
    except (OSError, ValueError):
        return {"profile": "high", "security_review_required": True,
                "threat_model_required": True, "_ilegivel": True}


def load_findings(root):
    d = os.path.join(root, ".asb", "security-findings")
    out = []
    if not os.path.isdir(d):
        return out
    for n in sorted(os.listdir(d)):
        if not n.endswith(".json"):
            continue
        try:
            out.append(json.load(open(os.path.join(d, n), encoding="utf-8")))
        except (OSError, ValueError):
            # Finding ilegivel e bloqueio, nao item ignorado: nao da para provar que esta fechado.
            out.append({"finding_id": n, "severity": "high", "status": "detected",
                        "_ilegivel": True})
    return out


def bloqueantes(findings):
    """Findings que impedem o merge. Ver docstring do modulo para o que conta como aberto."""
    fora = []
    for f in findings:
        sev = f.get("severity")
        st = f.get("status")
        # Arquivo que nao se le como finding nao pode ser tratado como ausencia de finding: sem
        # severidade ou sem estado reconhecido, nao ha como PROVAR que esta fechado -> bloqueia.
        if sev not in SEVERIDADES or st not in ESTADOS:
            fora.append((f, "finding malformado — nao se prova fechado"))
            continue
        if sev not in BLOQUEIA_SE:
            continue
        if st in ABERTOS:
            fora.append((f, f"status '{st}'"))
        elif st == "accepted_risk":
            ha = f.get("human_approval") or {}
            if not ha.get("approver"):
                fora.append((f, "accepted_risk sem aprovacao humana registrada"))
    return fora


def classify_now(root):
    """Reusa o classificador do core — a tabela de risco tem UMA implementacao."""
    aqui = os.path.dirname(os.path.abspath(__file__))
    try:
        p = subprocess.run([sys.executable, os.path.join(aqui, "asb_security_classify.py"),
                            "--json", "--root", root],
                           capture_output=True, text=True, timeout=60, cwd=root)
        return json.loads(p.stdout).get("risk", "high")
    except (OSError, subprocess.SubprocessError, ValueError):
        return "high"                       # sem classificar, assume o pior


def decide(root, risk=None, external_pr=False, review_done=False):
    prof = load_profile(root)
    findings = load_findings(root)
    risco = risk or classify_now(root)

    review_obrigatoria = risco in ("high", "critical") and prof.get("security_review_required", True)
    humano_obrigatorio = risco == "critical" or external_pr

    motivos = []
    if external_pr:
        # Conteudo externo e dado, nunca instrucao (contrato, secao 9).
        motivos.append("PR de origem nao confiavel: revisao automatica de IA nao dispara; "
                       "aprovacao humana obrigatoria")
    if review_obrigatoria and not review_done:
        motivos.append(f"risco {risco.upper()} exige revisao de seguranca antes de REVIEW/MERGE")
    for f, porque in bloqueantes(findings):
        motivos.append(f"finding {f.get('finding_id','?')} ({f.get('severity')}) aberto: {porque}")
    if humano_obrigatorio:
        motivos.append("exige aprovacao humana explicita antes do merge")

    return {
        "risk": risco,
        "profile": prof.get("profile"),
        "profile_declared": not (prof.get("_ausente") or prof.get("_ilegivel")),
        "security_review_required": review_obrigatoria,
        "human_approval_required": humano_obrigatorio,
        "blocking_findings": [f.get("finding_id") for f, _ in bloqueantes(findings)],
        "decision": "BLOCKED" if motivos else "ALLOWED",
        "reasons": motivos,
    }


def main():
    ap = argparse.ArgumentParser(prog="asb_security_gate")
    ap.add_argument("--root")
    ap.add_argument("--risk", choices=["low", "medium", "high", "critical"])
    ap.add_argument("--external-pr", action="store_true")
    ap.add_argument("--review-done", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    root = repo_root(args.root)
    if not root:
        print("ERRO: nao estou num working tree git", file=sys.stderr)
        return 3

    r = decide(root, args.risk, args.external_pr, args.review_done)
    if args.json:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print(f"SECURITY GATE: {r['decision']}  (risco {r['risk'].upper()}, perfil {r['profile']})")
        for m in r["reasons"]:
            print("  -", m)
        if r["decision"] == "ALLOWED":
            print("  nenhum bloqueio")
    return 1 if r["decision"] == "BLOCKED" else 0


if __name__ == "__main__":
    sys.exit(main())
