#!/usr/bin/env bash
# asb_resolve_root_test.sh — gate local do resolver de raiz do /asb.
# READ-ONLY sobre o repo real; cria fixtures SO em diretorio temporario (limpo ao fim).
# Exit 0 = todos os cenarios passaram; !=0 = alguma falha (bloqueia o gate).
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd -P)"
RESOLVER="$REPO/scripts/asb_resolve_root.sh"
PASS=0; FAIL=0

ok()   { printf 'PASS  %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf 'FAIL  %s\n' "$1"; FAIL=$((FAIL+1)); }

# run_resolver <cwd> : ecoa "<exit>|<stdout>"; roda SEMPRE com CLAUDE_PROJECT_DIR unset
run_resolver() {
  local cwd="$1"; shift
  local out rc
  out="$(cd "$cwd" && env -u CLAUDE_PROJECT_DIR bash "$RESOLVER" 2>/dev/null)"; rc=$?
  printf '%s|%s' "$rc" "$out"
}

# fixture: cria N repos-fake, cada um com o SENTINELA
mk_fixture() {
  local base="$1"; shift
  for name in "$@"; do
    mkdir -p "$base/$name/scripts"
    : > "$base/$name/scripts/asb_render_brief.py"
  done
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "== resolver: $RESOLVER =="
echo "== repo real: $REPO =="
echo

# ---- Cenario 1: PREFER CLAUDE_PROJECT_DIR quando valido ----------------------------
# (unico cenario que seta a env de proposito)
mk_fixture "$TMP/c1" alpha beta
out="$(cd "$TMP" && CLAUDE_PROJECT_DIR="$TMP/c1/alpha" bash "$RESOLVER" 2>/dev/null)"; rc=$?
exp="$(cd "$TMP/c1/alpha" && pwd -P)"
if [ "$rc" = 0 ] && [ "$out" = "$exp" ]; then ok "1 prefer CLAUDE_PROJECT_DIR -> $out"
else bad "1 prefer CLAUDE_PROJECT_DIR (rc=$rc out=$out exp=$exp)"; fi

# CLAUDE_PROJECT_DIR invalido (sem sentinela) NAO deve ser aceito: cai na evidencia
out="$(cd "$TMP/c1" && CLAUDE_PROJECT_DIR="$TMP/nao-existe" bash "$RESOLVER" 2>/dev/null)"; rc=$?
# em $TMP/c1 ha 2 filhos com sentinela -> ambiguo (exit 4), prova que env invalida foi ignorada
if [ "$rc" = 4 ]; then ok "1b CLAUDE_PROJECT_DIR invalido ignorado -> cai na evidencia (ambiguo=4)"
else bad "1b CLAUDE_PROJECT_DIR invalido (esperava rc=4, veio rc=$rc out=$out)"; fi

# ---- Cenario 2: BUG REAL — CWD e o PAI, 1 repo com sentinela -----------------------
mk_fixture "$TMP/c2" onlyrepo
mkdir -p "$TMP/c2/decoy"   # irmao SEM sentinela (ex.: control-plane) nao conta
r="$(run_resolver "$TMP/c2")"; rc="${r%%|*}"; out="${r#*|}"
exp="$(cd "$TMP/c2/onlyrepo" && pwd -P)"
if [ "$rc" = 0 ] && [ "$out" = "$exp" ]; then ok "2 parent-dir + 1 sentinela -> $out"
else bad "2 parent-dir (rc=$rc out=$out exp=$exp)"; fi

# ---- Cenario 3: FALLBACK dentro da raiz --------------------------------------------
mk_fixture "$TMP/c3" root
r="$(run_resolver "$TMP/c3/root")"; rc="${r%%|*}"; out="${r#*|}"
exp="$(cd "$TMP/c3/root" && pwd -P)"
if [ "$rc" = 0 ] && [ "$out" = "$exp" ]; then ok "3 dentro-da-raiz -> $out"
else bad "3 dentro-da-raiz (rc=$rc out=$out exp=$exp)"; fi

# ---- Cenario 4: AMBIGUO — CWD e o PAI de 2+ repos com sentinela ---------------------
mk_fixture "$TMP/c4" repoA repoB
r="$(run_resolver "$TMP/c4")"; rc="${r%%|*}"; out="${r#*|}"
if [ "$rc" = 4 ] && [ -z "$out" ]; then ok "4 ambiguo -> fail-closed (exit 4, stdout vazio)"
else bad "4 ambiguo (esperava rc=4 stdout-vazio; veio rc=$rc out=$out)"; fi

# ---- Cenario 5: UNRESOLVED — nenhum repo com sentinela -----------------------------
mkdir -p "$TMP/c5/nada"
r="$(run_resolver "$TMP/c5")"; rc="${r%%|*}"; out="${r#*|}"
if [ "$rc" = 3 ] && [ -z "$out" ]; then ok "5 sem sentinela -> fail-closed (exit 3, stdout vazio)"
else bad "5 unresolved (esperava rc=3 stdout-vazio; veio rc=$rc out=$out)"; fi

# ---- Cenario 6: repo REAL, CWD no seu PAI (prova ponta-a-ponta no ambiente real) ----
# So roda se o pai do repo real nao tiver OUTRO repo com sentinela (senao seria ambiguo — ok).
parent="$(dirname "$REPO")"
r="$(run_resolver "$parent")"; rc="${r%%|*}"; out="${r#*|}"
if [ "$rc" = 0 ] && [ "$out" = "$REPO" ]; then ok "6 repo real via PAI -> $out"
elif [ "$rc" = 4 ]; then ok "6 repo real via PAI -> ambiguo (>1 repo ASB no pai) — fail-closed OK"
else bad "6 repo real via PAI (rc=$rc out=$out exp=$REPO)"; fi

echo
echo "== RESUMO: PASS=$PASS FAIL=$FAIL =="
[ "$FAIL" -eq 0 ]
