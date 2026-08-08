#!/usr/bin/env python3
"""Adapter Claude/Fable -> Executor. Constroi o handoff e TRAVA quando a governanca proibe.

    handoff.py plan  --task "..." [--root DIR] [--workstream ID] [--complex]
    handoff.py gates [--root DIR]

O QUE ESTE ADAPTER NAO FAZ
  Nao decide regra. Nao guarda copia do contrato. Nao conhece repo, dominio, ID nem endpoint.
  Toda regra e LIDA em tempo de execucao das fontes que ja mandam:

    contrato   <core>/contracts/agent-orchestration-contract.md
               -> quais execution_gate.mode permitem delegar
               -> o que forca COMPLEX
               -> o formato exato do retorno do Executor
    estado     .asb/project.json + .asb/workstreams/<id>.json
               -> escopo aprovado/proibido, criterios de aceite, fase, gate
    integridade .governance-lock (quando vendorizado)

  Mudou o contrato, muda o comportamento daqui — sem editar este arquivo. Se o contrato nao
  puder ser lido ou interpretado, o adapter RECUSA (fail-closed): sem regra nao ha delegacao.

TRANSPORTE
  Este adapter e agnostico de transporte. Ele emite o payload; quem chama o Executor e o
  runtime (local: MCP stdio; remoto: MCP remoto). Trocar o transporte nao toca este arquivo.

EXIT  0 ok · 1 governanca recusa · 2 segredo · 3 uso/IO
"""
import argparse
import json
import os
import re
import subprocess
import sys

def die(code, msg):
    print(f"handoff: {msg}", file=sys.stderr)
    sys.exit(code)


def run(cmd, cwd=None, timeout=60):
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, (p.stdout or "") + (p.stderr or "")
    except (OSError, subprocess.SubprocessError) as e:
        return 127, str(e)


# ------------------------------------------------------------------ localizacao
def resolve_root(arg):
    if arg:
        r = os.path.abspath(arg)
        if os.path.isdir(r):
            return r
        die(3, f"root inexistente: {arg}")
    rc, out = run(["git", "rev-parse", "--show-toplevel"])
    if rc == 0 and out.strip():
        return out.strip()
    die(3, "root nao resolvido (fora de repo git e sem --root)")


def resolve_core(root):
    """Vendorizado (satelite) tem precedencia sobre o layout canonico."""
    for name in (".governance-core", "governance-core"):
        c = os.path.join(root, name)
        if os.path.isfile(os.path.join(c, "MANIFEST.json")):
            return c, name
    die(3, f"Governance Core nao encontrado em {root}")


# ------------------------------------------------------------------ contrato (fonte da regra)
def read_contract(core):
    p = os.path.join(core, "contracts", "agent-orchestration-contract.md")
    try:
        return open(p, encoding="utf-8").read(), p
    except OSError as e:
        die(1, f"contrato ilegivel ({p}): {e} — sem contrato nao ha delegacao")


def allowed_modes(text):
    """Allowlist vinda do contrato. Ausente/ilegivel = recusa tudo (fail-closed)."""
    m = re.search(r"[Ss][óo] se delega em ([^.\n]+)", text)
    if not m:
        die(1, "contrato nao declara quais modes permitem delegar — fail-closed")
    modes = re.findall(r"`([a-z_]+)`", m.group(1))
    if not modes:
        die(1, "contrato declara a regra mas sem modes reconheciveis — fail-closed")
    return modes


def complex_triggers(text):
    m = re.search(r"Classifica como COMPLEX sempre que houver qualquer um:\*\*(.+)", text)
    if not m:
        die(1, "contrato nao declara os gatilhos de COMPLEX — fail-closed")
    raw = m.group(1)
    out = []
    for tok in raw.split("·"):
        tok = re.sub(r"[*`]", "", tok).strip().strip(".").lower()
        if tok:
            out.append(tok)
    return out


def return_format(text):
    m = re.search(r"### 4\.1[^\n]*\n+```\n(.*?)```", text, re.S)
    if not m:
        die(1, "contrato nao declara o formato de retorno — fail-closed")
    return m.group(1).rstrip()


# ------------------------------------------------------------------ estado
def validator(core, root):
    v = os.path.join(core, "bin", "asb_validate_state.py")
    return v if os.path.isfile(v) else None


def validate_state(core, root, rel):
    v = validator(core, root)
    if not v:
        die(1, "validador do core ausente — fail-closed")
    rc, out = run(["python3", v, rel], cwd=root)
    if rc != 0:
        die(1, f"estado invalido ({rel}): {out.strip().splitlines()[0] if out.strip() else rc}")


def pick_workstream(root, wanted):
    d = os.path.join(root, ".asb", "workstreams")
    if not os.path.isdir(d):
        die(1, ".asb/workstreams ausente — sem contrato de execucao nao ha delegacao")
    found = []
    for n in sorted(os.listdir(d)):
        if not n.endswith(".json"):
            continue
        try:
            ws = json.load(open(os.path.join(d, n), encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if wanted and ws.get("id") == wanted:
            return ws, n
        if not wanted and ws.get("status") == "active":
            found.append((ws, n))
    if wanted:
        die(1, f"workstream '{wanted}' nao encontrado")
    if not found:
        die(1, "nenhum workstream active — nada a delegar")
    if len(found) > 1:
        die(1, "mais de um workstream active — ambiguo, use --workstream <id> (fail-closed): "
               + ", ".join(w["id"] for w, _ in found))
    return found[0]


# ------------------------------------------------------------------ juiz mecanico (por descoberta)
def gate_commands(root, core, core_name):
    """Descobre por EXISTENCIA. Nenhum comando de repo especifico fica hardcoded aqui."""
    cmds = []
    if os.path.isfile(os.path.join(root, ".governance-lock")):
        cmds.append(f"python3 {core_name}/bin/govcore.py verify --target .")
    v = os.path.join(core, "bin", "asb_validate_state.py")
    if os.path.isdir(os.path.join(root, ".asb")) and os.path.isfile(v):
        cmds.append(f'for f in .asb/project.json .asb/workstreams/*.json; do python3 {core_name}/bin/asb_validate_state.py "$f"; done')
    if os.path.isdir(os.path.join(root, ".claude", "hooks")):
        cmds.append('for h in .claude/hooks/*.sh; do bash -n "$h"; done')
    if os.path.isfile(os.path.join(root, ".claude", "settings.json")):
        cmds.append('python3 -c "import json;json.load(open(\'.claude/settings.json\'))"')
    for probe in ("scripts/asb_boot_chain_test.sh", "scripts/asb_resolve_root_test.sh"):
        if os.path.isfile(os.path.join(root, probe)):
            cmds.append(f"bash {probe}")
    return cmds


# ------------------------------------------------------------------ anti-segredo
def secret_re(core):
    guard = os.path.join(core, "hooks", "preflight-gate.sh")
    try:
        for line in open(guard, encoding="utf-8"):
            m = re.match(r"^SECRET_RE='(.*)'\s*$", line.rstrip("\n"))
            if m:
                return re.compile(m.group(1))
    except OSError:
        pass
    die(2, "padrao do Guardiao 1 nao encontrado no core — fail-closed")


# ------------------------------------------------------------------ comandos
def cmd_plan(args):
    root = resolve_root(args.root)
    core, core_name = resolve_core(root)
    text, contract_path = read_contract(core)

    # integridade do core vendorizado antes de qualquer delegacao
    if os.path.isfile(os.path.join(root, ".governance-lock")):
        rc, out = run(["python3", os.path.join(core, "bin", "govcore.py"), "verify", "--target", root])
        if rc != 0:
            die(1, "Governance Core com drift — reinstale antes de delegar:\n" + out.strip())

    if os.path.isfile(os.path.join(root, ".asb", "project.json")):
        validate_state(core, root, ".asb/project.json")
    ws, fname = pick_workstream(root, args.workstream)
    validate_state(core, root, os.path.join(".asb", "workstreams", fname))

    mode = (ws.get("execution_gate") or {}).get("mode")
    ok_modes = allowed_modes(text)
    if mode not in ok_modes:
        die(1, f"execution_gate.mode='{mode}' nao permite delegar "
               f"(contrato autoriza: {', '.join(ok_modes)}) — decisao e do Arquiteto")

    task = args.task.strip()
    trig = [t for t in complex_triggers(text) if t and t in task.lower()]
    route = "COMPLEX" if (args.complex or trig) else "SIMPLE"

    lines = [
        "ROLE: EXECUTOR",
        f"REPO_ROOT: {root}",
        f"WORKSTREAM_ID: {ws.get('id')}",
        f"CURRENT_PHASE: {ws.get('current_phase')}",
        f"ROUTE: {route}" + (f"  (gatilho no contrato: {', '.join(trig)})" if trig else ""),
        f"CONTRACT: {os.path.relpath(contract_path, root)}",
        "",
        f"TASK: {task}",
        "",
        "APPROVED_SCOPE:",
    ]
    lines += [f"  - {s}" for s in ws.get("approved_scope") or ["(nao declarado)"]]
    lines += ["", "PROHIBITED_SCOPE:"]
    lines += [f"  - {s}" for s in ws.get("prohibited_scope") or ["(nao declarado)"]]
    lines += ["", "COMPLETION_CRITERIA:"]
    lines += [f"  - {s}" for s in ws.get("completion_criteria") or ["(nao declarado)"]]
    lines += ["", f"EXECUTION_GATE: {mode} — {(ws.get('execution_gate') or {}).get('reason','')}"]
    lines += ["", "VALIDATION_COMMANDS:"]
    lines += [f"  {c}" for c in gate_commands(root, core, core_name)]
    lines += ["", "RETURN_FORMAT (exatamente estes campos, nada de transcript):", return_format(text)]

    payload = "\n".join(lines)
    if secret_re(core).search(payload):
        die(2, "segredo no handoff — recusado (envie nome de variavel, nunca valor)")
    print(payload)
    return 0


def cmd_gates(args):
    root = resolve_root(args.root)
    core, core_name = resolve_core(root)
    for c in gate_commands(root, core, core_name):
        print(c)
    return 0


def main():
    ap = argparse.ArgumentParser(prog="handoff", description="Adapter Claude/Fable -> Executor")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("plan", help="valida a governanca e emite o handoff (ou recusa)")
    p.add_argument("--task", required=True)
    p.add_argument("--root")
    p.add_argument("--workstream")
    p.add_argument("--complex", action="store_true", help="forca COMPLEX (na duvida, o contrato manda COMPLEX)")
    p.set_defaults(func=cmd_plan)
    p = sub.add_parser("gates", help="lista o juiz mecanico disponivel neste repo")
    p.add_argument("--root")
    p.set_defaults(func=cmd_gates)
    args = ap.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
