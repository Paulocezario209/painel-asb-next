#!/usr/bin/env bash
# asb_boot_chain_test.sh — gate local da CADEIA SessionStart (invocacao -> resolver ->
# localizacao do hook -> carregamento de ALMA/governanca/Guardiao 2b).
# Extrai o comando REAL de .claude/settings.json (fonte unica) e o exercita.
# REPO-AGNOSTICO: prova a governanca do PROPRIO hook do repo (monorepo ou satelite);
# exige Guardiao 2b so onde o hook o define.
# READ-ONLY sobre o repo real; fixtures so em diretorio temporario (limpo ao fim).
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
SETTINGS="$REPO/.claude/settings.json"
HOOK="$REPO/.claude/hooks/session-start.sh"
BASE="$(basename "$REPO")"
PASS=0; FAIL=0
ok()  { printf 'PASS  %s\n' "$1"; PASS=$((PASS+1)); }
bad() { printf 'FAIL  %s\n' "$1"; FAIL=$((FAIL+1)); }

CMD="$(python3 -c "import json;print(json.load(open('$SETTINGS'))['hooks']['SessionStart'][0]['hooks'][0]['command'])")"
export CLAUDE_CODE_REMOTE=false   # sem graphify/pip no teste

run_chain() { local cwd="$1"; shift; ( cd "$cwd" && env "$@" bash -c "$CMD" ); }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mk_repo() { local d="$1"; mkdir -p "$d/scripts" "$d/.claude/hooks"
  : > "$d/scripts/asb_render_brief.py"
  cp "$REPO/scripts/asb_resolve_root.sh" "$d/scripts/asb_resolve_root.sh"
  printf '#!/bin/bash\necho "FAKE_HOOK_RAN::%s"\n' "$d" > "$d/.claude/hooks/session-start.sh"; }

# marcador universal (identidade do repo) + Guardiao 2b so se o hook o define
IDENT="PROJETO ATIVO: ${BASE}"
WANT_G2B=0; grep -q 'SINCRONIA DE ATUALIDADE' "$HOOK" && WANT_G2B=1

# valida que a saida carregou a governanca REAL deste repo (identidade + corpo + [2b])
gov_ok() { local out="$1" lines
  lines="$(printf '%s\n' "$out" | grep -c .)"
  printf '%s' "$out" | grep -qF "$IDENT" || return 1
  [ "${lines:-0}" -ge 5 ] || return 1
  [ "$WANT_G2B" = 1 ] && { printf '%s' "$out" | grep -q 'SINCRONIA DE ATUALIDADE' || return 1; }
  return 0; }

echo "== settings: $SETTINGS =="; echo "== repo: $REPO (Guardiao2b=$WANT_G2B) =="; echo

# ---- A: CLAUDE_PROJECT_DIR valido -> usa exatamente esse repo -----------------------
out="$(run_chain "$TMP" CLAUDE_PROJECT_DIR="$REPO" 2>/dev/null)"
gov_ok "$out" && ok "A CLAUDE_PROJECT_DIR valido -> governanca real do repo ($IDENT)" \
              || bad "A CLAUDE_PROJECT_DIR valido (governanca ausente)"

# ---- C: env unset + DENTRO da raiz -> governanca real (robusto em qualquer layout) --
out="$(run_chain "$REPO" -u CLAUDE_PROJECT_DIR 2>/dev/null)"
gov_ok "$out" && ok "C env unset + dentro-da-raiz -> governanca real" \
              || bad "C dentro-da-raiz (governanca ausente)"

# ---- F: env unset + CWD no PAI -> governanca (1 elegivel) OU ambiguo fail-closed ----
# (ASB_ROOT_AMBIGUOUS sai em STDERR; governanca sai em STDOUT)
fpar="$(dirname "$REPO")"
out="$(run_chain "$fpar" -u CLAUDE_PROJECT_DIR 2>/dev/null)"
err="$(run_chain "$fpar" -u CLAUDE_PROJECT_DIR 2>&1 1>/dev/null)"
if gov_ok "$out"; then ok "F env unset + PAI (1 elegivel) -> governanca real"
elif printf '%s' "$err" | grep -q 'ASB_ROOT_AMBIGUOUS'; then ok "F env unset + PAI (>1 elegivel) -> ambiguo fail-closed (nada rodou)"
else bad "F via PAI (nem governanca nem ambiguo). out:'$(printf '%s' "$out"|head -1)' err:'$(printf '%s' "$err"|head -1)'"; fi

# ---- D: dois repos elegiveis irmaos -> ambiguo, NENHUM hook roda -------------------
mkdir -p "$TMP/d"; mk_repo "$TMP/d/repoA"; mk_repo "$TMP/d/repoB"
out="$(run_chain "$TMP/d" -u CLAUDE_PROJECT_DIR 2>/dev/null)"
err="$(run_chain "$TMP/d" -u CLAUDE_PROJECT_DIR 2>&1 1>/dev/null)"
{ ! printf '%s' "$out" | grep -q 'FAKE_HOOK_RAN'; } && printf '%s' "$err" | grep -q 'ASB_ROOT_AMBIGUOUS' \
  && ok "D dois elegiveis -> fail-closed (nenhum hook rodou)" \
  || bad "D ambiguo (out='$out' err='$err')"

# ---- E: nenhum repo elegivel -> nada roda ------------------------------------------
mkdir -p "$TMP/e/tool/scripts"; cp "$REPO/scripts/asb_resolve_root.sh" "$TMP/e/tool/scripts/"
out="$(run_chain "$TMP/e" -u CLAUDE_PROJECT_DIR 2>/dev/null)"
{ ! printf '%s' "$out" | grep -q 'FAKE_HOOK_RAN'; } && { ! printf '%s' "$out" | grep -qF "$IDENT"; } \
  && ok "E nenhum elegivel -> nada roda" || bad "E unresolved (out='$out')"

# ---- H: read-only — rodar a cadeia NAO altera o worktree ---------------------------
B="$(cd "$REPO" && git status --porcelain)"
run_chain "$REPO" -u CLAUDE_PROJECT_DIR >/dev/null 2>&1 || true
A="$(cd "$REPO" && git status --porcelain)"
[ "$B" = "$A" ] && ok "H read-only (worktree inalterado)" || bad "H worktree mudou"

# ---- J: settings.json e JSON valido ------------------------------------------------
python3 -c "import json;json.load(open('$SETTINGS'))" 2>/dev/null && ok "J settings.json JSON valido" || bad "J settings.json invalido"

echo; echo "== RESUMO: PASS=$PASS FAIL=$FAIL =="
[ "$FAIL" -eq 0 ]
