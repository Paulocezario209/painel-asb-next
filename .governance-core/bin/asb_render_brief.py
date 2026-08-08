#!/usr/bin/env python3
# asb_render_brief.py — RENDERER READ-ONLY do briefing vivo (Modelo C, Etapa 2B1).
# Combina ALMA(ponteiro) + memoria operacional (.asb, validada) + realidade (asb_probe.sh).
# Seguranca:
#  - NUNCA carrega/imprime project/workstream antes de validacao exit 0.
#  - QUALQUER workstream invalido (validator != 0, inclui segredo/None/timeout) = FATAL; conteudo nunca impresso.
#  - examina no maximo MAX_WS arquivos; exceder = FATAL. validator com timeout curto por arquivo.
#  - sanitiza todo valor (ANSI/controle/newline/tab) + trunca por bytes.
#  - redaction ANTES de aplicar MAXLINES/MAXBYTES; limite confirmado DEPOIS da redaction.
#  - autonomia: FATAL/ambiguo=blocked; 0 workstream=requires_genesis; DIRTY/UNPUSHED=execute_and_report (piso,
#    nunca requires_paulo por motivo tecnico); rede/UNKNOWN nao rebaixa; estado so RESTRINGE (teto=CLAUDE.md).
#  - DIRTY/UNPUSHED NAO gera ordem cega de commit/push (ver texto da acao). Read-only estrito.
import sys, os, re, json, subprocess

MAXFIELD = 200        # bytes por campo
MAXLINES = 200        # teto de linhas da saida final
MAXBYTES = 16000      # teto de bytes da saida final
MAX_WS = 100          # maximo de arquivos de workstream examinados
VAL_TIMEOUT = 5       # timeout do validator por arquivo (s)
RANK = {"autonomous_within_scope": 0, "execute_and_report": 1,
        "requires_genesis": 2, "requires_paulo": 3, "blocked": 4}
ANSI = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
CTRL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
ACTION_TECH = ("Inspecionar, validar e reconciliar tecnicamente dentro do escopo aprovado. "
               "Somente commitar/pushar quando o estado estiver coerente e os gates passarem.")

def more_restrictive(a, b):
    return a if RANK.get(a, 4) >= RANK.get(b, 4) else b

def san(v):
    s = "" if v is None else str(v)
    s = ANSI.sub("", s)
    s = s.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    s = CTRL.sub("", s)
    b = s.encode("utf-8")
    if len(b) > MAXFIELD:
        s = b[:MAXFIELD].decode("utf-8", "ignore") + "…[TRUNC]"
    return s

def sh(cmd, root, timeout):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=root)
    except Exception:
        return None

def git_root():
    try:
        r = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                           capture_output=True, text=True, timeout=10)
        return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None
    except Exception:
        return None

def cur_branch(root):
    r = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"], root, 10)
    return r.stdout.strip() if r and r.returncode == 0 and r.stdout.strip() else "UNKNOWN"

def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None

def validate(root, relpath):
    r = sh(["python3", "scripts/asb_validate_state.py", relpath], root, VAL_TIMEOUT)
    if r is None:
        return "UNAVAILABLE"          # timeout/excecao => != 0 => invalido
    return r.returncode

def load_g1_regex(root):
    try:
        with open(os.path.join(root, ".claude", "hooks", "preflight-gate.sh"), encoding="utf-8") as f:
            for line in f:
                m = re.match(r"^SECRET_RE='(.*)'\s*$", line.rstrip("\n"))
                if m:
                    return re.compile(m.group(1))
    except (OSError, re.error):
        return None
    return None

def gather_workstreams(root, branch):
    wdir = os.path.join(root, ".asb", "workstreams")
    try:
        names = sorted(n for n in os.listdir(wdir) if n.endswith(".json"))
    except OSError:
        return {"valid_active": [], "invalid": [], "overflow": False}
    overflow = len(names) > MAX_WS
    names = names[:MAX_WS]
    valid_active, invalid = [], []
    for n in names:
        code = validate(root, os.path.join(".asb", "workstreams", n))
        if code != 0:                    # qualquer invalido (inclui segredo=2/None/UNAVAILABLE) = FATAL
            invalid.append(n)            # NOME so, nunca conteudo
            continue
        obj = load_json(os.path.join(wdir, n))   # so carrega o VALIDO
        if not isinstance(obj, dict):
            invalid.append(n)
            continue
        if obj.get("branch") == branch and obj.get("status") == "active":
            valid_active.append((n, obj))
    return {"valid_active": valid_active, "invalid": invalid, "overflow": overflow}

def main():
    root = git_root()
    if not root:
        print("UNKNOWN: nao estou num working tree git."); sys.exit(0)
    rx = load_g1_regex(root)
    branch = cur_branch(root)

    # validacao ANTES de qualquer load/print
    pcode = validate(root, ".asb/project.json")
    proj = load_json(os.path.join(root, ".asb", "project.json")) if pcode == 0 else None

    g = gather_workstreams(root, branch)
    valid_active, invalid, overflow = g["valid_active"], g["invalid"], g["overflow"]
    if len(valid_active) == 0:
        ws_stat, ws = "NONE", None
    elif len(valid_active) > 1:
        ws_stat, ws = "AMBIGUOUS", None
    else:
        ws_stat, ws = "OK", valid_active[0][1]

    # probe (cwd=root)
    pr = sh(["scripts/asb_probe.sh"], root, 25)
    probe = {}
    if pr and pr.stdout:
        for line in pr.stdout.splitlines():
            if "=" in line and not line.startswith("=="):
                k, v = line.split("=", 1); probe[k.strip()] = v.strip()

    # classificacao
    FATAL, TECHNICAL, INFORMATIONAL = [], [], []
    if pcode != 0:
        FATAL.append("project.json INVALID_OR_UNAVAILABLE")
    if overflow:
        FATAL.append(f"excesso de workstreams (> {MAX_WS})")
    if invalid:
        FATAL.append("workstream(s) invalido(s): " + ", ".join(invalid))
    if ws_stat == "AMBIGUOUS":
        FATAL.append("workstream AMBIGUOUS: " + ", ".join(n for n, _ in valid_active))
    dirty = probe.get("WORKTREE", "").startswith("DIRTY")
    unpushed = probe.get("HEAD_ON_REMOTE") == "NO" or (probe.get("AHEAD_LOCAL", "0").isdigit()
                                                       and int(probe.get("AHEAD_LOCAL", "0")) > 0)
    stale = probe.get("TEST_STATUS", "").startswith("STALE")
    if dirty: TECHNICAL.append("working tree DIRTY")
    if unpushed: TECHNICAL.append("HEAD nao publicado (UNPUSHED)")
    if stale: TECHNICAL.append("TEST_STATUS STALE")
    for k in ("CP_DEPLOY_STATUS", "PAINEL_DEPLOY_STATUS", "TEST_STATUS", "MIGRATIONS_PENDING"):
        val = probe.get(k, "")
        if val == "UNKNOWN" or val.startswith("UNKNOWN"):
            INFORMATIONAL.append(f"{k}=UNKNOWN (nao rebaixa autonomia)")

    # autonomia efetiva (estado so RESTRINGE)
    if FATAL:
        gate, gate_reason = "blocked", "condicao FATAL"
    elif ws_stat == "NONE":
        gate, gate_reason = "requires_genesis", "nenhum workstream ativo p/ a branch"
    else:
        base = san(ws.get("execution_gate", {}).get("mode", "blocked"))
        floor = "execute_and_report" if TECHNICAL else "autonomous_within_scope"
        gate = more_restrictive(base, floor)
        gate_reason = san(ws.get("execution_gate", {}).get("reason", ""))

    # montar linhas
    L = ["# BRIEFING VIVO — ASB (read-only, gerado)"]
    if proj:
        L.append(f"1) PROJETO: {san(proj.get('project'))} — MISSAO: {san(proj.get('mission'))}")
        L.append(f"   ALMA (suprema, teto de autoridade): {san(proj.get('authority_source'))}")
    else:
        L.append("1) PROJETO: INVALID_OR_UNAVAILABLE (project.json nao passou no validador)")
    if ws_stat == "OK":
        wid = san(valid_active[0][0])
        if wid.endswith(".json"):
            wid = wid[:-5]
        L.append(f"2) WORKSTREAM: {wid} (branch {san(ws.get('branch'))} · status {san(ws.get('status'))})")
        L.append(f"3) DE ONDE VIEMOS: {san(ws.get('origin'))}")
        L.append(f"4) ONDE ESTAMOS: {san(ws.get('current_phase'))} | ultimo: {san(ws.get('last_completed_step'))}")
        L.append(f"5) PARA ONDE VAMOS: {san(ws.get('next_step'))}")
        L.append("6) ESCOPO APROVADO:")
        for s in (ws.get("approved_scope") or [])[:12]:
            L.append(f"   + {san(s)}")
        L.append("7) ESCOPO PROIBIDO:")
        for s in (ws.get("prohibited_scope") or [])[:12]:
            L.append(f"   - {san(s)}")
        L.append("8) DECISOES ATIVAS:")
        for dd in (ws.get("decisions") or [])[:12]:
            L.append(f"   [{san(dd.get('id'))}] {san(dd.get('decision'))} (por {san(dd.get('authority'))})")
        L.append(f"9) DEBITOS: {san(', '.join(ws.get('debts') or []) or '(nenhum)')}  (detalhe em docs/DEBT_LOG.md)")
        for b in (ws.get("blockers") or [])[:8]:
            L.append(f"   BLOQUEIO [{san(b.get('id'))}·{san(b.get('severity'))}]: {san(b.get('description'))}")
    elif ws_stat == "NONE":
        L.append(f"2) WORKSTREAM: NONE — nenhum workstream valido+ativo p/ '{san(branch)}'")
    else:
        L.append("2) WORKSTREAM: AMBIGUOUS — resolver antes (ver FATAL)")
    L.append("10) REALITY PROBE (ao vivo; UNKNOWN permanece UNKNOWN):")
    for k in ("BRANCH", "HEAD_SHA", "WORKTREE", "HEAD_ON_REMOTE", "AHEAD_LOCAL", "BEHIND_LOCAL",
              "CP_DEPLOY_STATUS", "PAINEL_DEPLOY_STATUS", "TEST_STATUS", "MIGRATIONS_PENDING", "PROBE_FLAGS"):
        if k in probe:
            L.append(f"    {k}={san(probe[k])}")
    L.append("11) SINAIS (nao corrigir em silencio):")
    L.append("    FATAL: " + ("; ".join(san(x) for x in FATAL) if FATAL else "nenhum"))
    L.append("    TECHNICAL (reversivel): " + ("; ".join(san(x) for x in TECHNICAL) if TECHNICAL else "nenhum"))
    L.append("    INFORMATIONAL: " + ("; ".join(san(x) for x in INFORMATIONAL) if INFORMATIONAL else "nenhum"))
    L.append(f"12) AUTONOMIA EFETIVA: {gate}" + (f" ({san(gate_reason)})" if gate_reason else "")
             + " — teto = CLAUDE.md; o estado so RESTRINGE, nunca amplia.")
    if FATAL:
        L.append("13) ACAO: resolver condicao FATAL antes de qualquer trabalho (autonomia=blocked).")
    elif ws_stat == "NONE":
        L.append("13) ACAO: criar workstream via GENESIS antes de agir.")
    elif TECHNICAL:
        L.append("13) ACAO: " + ACTION_TECH)
    else:
        L.append(f"13) ACAO: {san(ws.get('next_step'))}  [gate: {gate}]")

    # redaction ANTES do limite; limite confirmado DEPOIS
    text = "\n".join(L)
    if rx:
        text = rx.sub("[REDACTED]", text)
    out, nb, truncated = [], 0, False
    for ln in text.split("\n"):
        enc = len(ln.encode("utf-8")) + 1
        if len(out) >= MAXLINES or nb + enc > MAXBYTES:
            truncated = True
            break
        out.append(ln)
        nb += enc
    if truncated:
        out.append("…[SAIDA TRUNCADA: teto de linhas/bytes]")
    final = "\n".join(out)
    # confirmacao dura do limite apos redaction
    if len(final.splitlines()) > MAXLINES + 1:
        final = "\n".join(final.splitlines()[:MAXLINES + 1])
    if len(final.encode("utf-8")) > MAXBYTES + 64:
        final = final.encode("utf-8")[:MAXBYTES + 64].decode("utf-8", "ignore")
    print(final)
    sys.exit(0)

if __name__ == "__main__":
    main()
