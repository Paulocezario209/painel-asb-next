#!/usr/bin/env bash
# asb_probe.sh — REALITY PROBE (Etapa 1). ESTRITAMENTE READ-ONLY.
#
# Regras (Paulo 2026-07-23) + correções finais:
#  1) compara HEAD local × remoto por SHA COMPLETA; abrevia só na saída.
#  2) test_receipt validado com jq; exige commit/command/timestamp/exit_code/environment.
#  3) deploy só com schema EXPLÍCITO (commit_sha/build_id/deployed_at) — "version" genérico NÃO conta.
#  4) sondas de rede em PARALELO, timeout individual 5s, teto total ~6s.
#  5) exporta GIT_OPTIONAL_LOCKS=0 e GIT_TERMINAL_PROMPT=0.
#  6) confirma que ROOT é working tree git.
#  7) DEBT_LOG_TOTAL_ENTRIES (não declara débito ativo sem interpretar status).
#  8) BRIEF_LAST_COMMIT_SHA + BRIEF_LAST_COMMIT_AT (ISO 8601).
#  9) resposta externa: limitada, validada (JSON via jq) e sanitizada; nunca ecoa corpo cru.
# 10) sem jq/timeout/curl → capacidade UNKNOWN; NÃO instala nada.
#  - proibido: git add/commit/push/pull/fetch/merge, deploy, migration, alterar arquivo, log persistente.
#  - nunca expõe token/header/URL autenticada/segredo → só PRESENTE/AUSENTE.
#  - inconclusivo → UNKNOWN, nunca inferência. Escreve SÓ em stdout. Sempre exit 0 (repórter, não gate).
#  - paralelismo sem arquivo temporário: cada job emite 1 linha curta (atômica < PIPE_BUF) capturada por $( ).

set -uo pipefail
export GIT_OPTIONAL_LOCKS=0 GIT_TERMINAL_PROMPT=0
NET_TIMEOUT=5

emit(){ printf '%s=%s\n' "$1" "$2"; }
have(){ command -v "$1" >/dev/null 2>&1 && echo yes || echo no; }
HAVE_JQ="$(have jq)"; HAVE_TIMEOUT="$(have timeout)"; HAVE_CURL="$(have curl)"

# ---------- (6) ROOT é working tree git? ----------
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ] || [ "$(git rev-parse --is-inside-work-tree 2>/dev/null || echo no)" != "true" ]; then
  echo "== ASB REALITY PROBE (read-only) =="; echo "PROBE=UNKNOWN (nao e working tree git)"; exit 0
fi
cd "$ROOT" 2>/dev/null || { echo "PROBE=UNKNOWN (cd falhou)"; exit 0; }

echo "== ASB REALITY PROBE (read-only) =="
emit CAP_JQ      "$([ "$HAVE_JQ" = yes ] && echo PRESENT || echo ABSENT)"
emit CAP_TIMEOUT "$([ "$HAVE_TIMEOUT" = yes ] && echo PRESENT || echo ABSENT)"
emit CAP_CURL    "$([ "$HAVE_CURL" = yes ] && echo PRESENT || echo ABSENT)"

# ---------- GIT LOCAL (offline) ----------
HEAD_FULL="$(git rev-parse HEAD 2>/dev/null || echo '')"
HEAD_SHA="$([ -n "$HEAD_FULL" ] && echo "${HEAD_FULL:0:7}" || echo UNKNOWN)"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo UNKNOWN)"
emit BRANCH "$BRANCH"
emit HEAD_SHA "$HEAD_SHA"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  emit WORKTREE "DIRTY($(git status --porcelain 2>/dev/null | wc -l | tr -d ' '))"
else emit WORKTREE CLEAN; fi
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || echo NONE)"
emit UPSTREAM "$UPSTREAM"
if [ "$UPSTREAM" != NONE ]; then
  emit AHEAD_LOCAL  "$(git rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo UNKNOWN)"
  emit BEHIND_LOCAL "$(git rev-list --count 'HEAD..@{upstream}' 2>/dev/null || echo UNKNOWN)"
else emit AHEAD_LOCAL UNKNOWN; emit BEHIND_LOCAL UNKNOWN; fi
# AHEAD/BEHIND_LOCAL = visao da ref LOCAL (sem rede); pode defasar ate o proximo sync.

# ---------- (3)(9) deploy só com schema explícito, sanitizado ----------
fetch_deploy(){ # $1 url publica (sem auth/segredo) → "id|at" ou UNKNOWN
  [ "$HAVE_CURL" = yes ] && [ "$HAVE_JQ" = yes ] && [ "$HAVE_TIMEOUT" = yes ] || { echo UNKNOWN; return; }
  local body id at
  body="$(timeout "$NET_TIMEOUT" curl -fsS --max-time "$NET_TIMEOUT" "$1" 2>/dev/null | head -c 65536)" || { echo UNKNOWN; return; }
  [ -n "$body" ] || { echo UNKNOWN; return; }
  printf '%s' "$body" | jq -e . >/dev/null 2>&1 || { echo UNKNOWN; return; }        # valida JSON
  id="$(printf '%s' "$body" | jq -r '(.commit_sha // .build_id) // empty' 2>/dev/null | head -c 64 | tr -cd 'A-Za-z0-9_.:-')"
  at="$(printf '%s' "$body" | jq -r '.deployed_at // empty'              2>/dev/null | head -c 40 | tr -cd 'A-Za-z0-9_.:+-')"
  [ -n "$id" ] && echo "${id}|${at:-UNKNOWN}" || echo UNKNOWN                        # sem commit_sha/build_id → UNKNOWN
}

# ---------- (4) SONDAS DE REDE EM PARALELO (5s cada, teto ~6s), sem arquivo temp ----------
CP_URL="https://sdr-american-control-plane.cp0vsf.easypanel.host/version"
PN_URL="https://sdr-american-painelnext.cp0vsf.easypanel.host/version"
RB_FULL=""; RM_FULL=""; CP_RAW="UNKNOWN"; PN_RAW="UNKNOWN"
if [ "$HAVE_TIMEOUT" = yes ]; then
  NET="$( {
      ( printf 'RB %s\n' "$(timeout "$NET_TIMEOUT" git ls-remote origin "refs/heads/$BRANCH" 2>/dev/null | awk 'NR==1{print $1}')" ) &
      ( printf 'RM %s\n' "$(timeout "$NET_TIMEOUT" git ls-remote origin refs/heads/master   2>/dev/null | awk 'NR==1{print $1}')" ) &
      ( printf 'CP %s\n' "$(fetch_deploy "$CP_URL")" ) &
      ( printf 'PN %s\n' "$(fetch_deploy "$PN_URL")" ) &
      wait
    } 2>/dev/null )"
  RB_FULL="$(printf '%s\n' "$NET" | awk '$1=="RB"{print $2}')"
  RM_FULL="$(printf '%s\n' "$NET" | awk '$1=="RM"{print $2}')"
  CP_RAW="$(printf '%s\n'  "$NET" | awk '$1=="CP"{print $2}')"; CP_RAW="${CP_RAW:-UNKNOWN}"
  PN_RAW="$(printf '%s\n'  "$NET" | awk '$1=="PN"{print $2}')"; PN_RAW="${PN_RAW:-UNKNOWN}"
fi
# (1) comparação por SHA COMPLETA; abrevia só na saída
if [ -z "$RB_FULL" ]; then emit REMOTE_BRANCH_SHA UNKNOWN; emit HEAD_ON_REMOTE UNKNOWN
else
  emit REMOTE_BRANCH_SHA "${RB_FULL:0:7}"
  if [ "$RB_FULL" = "$HEAD_FULL" ] && [ -n "$HEAD_FULL" ]; then emit HEAD_ON_REMOTE YES; else emit HEAD_ON_REMOTE NO; fi
fi
emit REMOTE_MASTER_SHA "$([ -n "$RM_FULL" ] && echo "${RM_FULL:0:7}" || echo UNKNOWN)"
# deploy: só REPORTED se veio commit_sha/build_id do schema; git NUNCA conta como deploy
cp_id="${CP_RAW%%|*}"; cp_at="${CP_RAW#*|}"
if [ "$CP_RAW" = UNKNOWN ]; then emit CP_DEPLOY_STATUS UNKNOWN; emit CP_DEPLOY_ID UNKNOWN; emit CP_DEPLOYED_AT UNKNOWN
else emit CP_DEPLOY_STATUS REPORTED; emit CP_DEPLOY_ID "$cp_id"; emit CP_DEPLOYED_AT "${cp_at:-UNKNOWN}"; fi
pn_id="${PN_RAW%%|*}"; pn_at="${PN_RAW#*|}"
if [ "$PN_RAW" = UNKNOWN ]; then emit PAINEL_DEPLOY_STATUS UNKNOWN; emit PAINEL_DEPLOY_ID UNKNOWN; emit PAINEL_DEPLOYED_AT UNKNOWN
else emit PAINEL_DEPLOY_STATUS REPORTED; emit PAINEL_DEPLOY_ID "$pn_id"; emit PAINEL_DEPLOYED_AT "${pn_at:-UNKNOWN}"; fi
# Nota: enquanto as apps nao expuserem /version {commit_sha|build_id, deployed_at}, ou sem egress → UNKNOWN (correto).

# ---------- (2) TESTES: recibo validado por jq, 5 campos obrigatórios ----------
RECEIPT=".asb/test_receipt.json"   # gravado pelo RUNNER, nunca por este probe
if [ "$HAVE_JQ" != yes ]; then emit TEST_STATUS "UNKNOWN(jq_ausente)"
elif [ ! -f "$RECEIPT" ]; then emit TEST_STATUS "UNKNOWN(sem_recibo)"
elif ! jq -e 'has("commit") and has("command") and has("timestamp") and has("exit_code") and has("environment")' "$RECEIPT" >/dev/null 2>&1; then
  emit TEST_STATUS "UNKNOWN(recibo_incompleto)"
else
  TC="$(jq -r '.commit'    "$RECEIPT" 2>/dev/null | tr -cd 'A-Za-z0-9')"
  TE="$(jq -r '.exit_code' "$RECEIPT" 2>/dev/null | tr -cd '0-9')"
  if [ -z "$HEAD_FULL" ] || [ -z "$TC" ]; then emit TEST_STATUS "UNKNOWN(dados_insuficientes)"
  elif [ "$TC" != "${HEAD_FULL:0:${#TC}}" ]; then emit TEST_STATUS "STALE(testado=${TC:0:7}|head=${HEAD_SHA})"
  else emit TEST_STATUS "$([ "${TE:-x}" = 0 ] && echo PASS || echo FAIL)@${TC:0:7}"; fi
fi

# ---------- MIGRATIONS (offline; pendência real precisa do DB → não inferir) ----------
if [ -d scripts/migrations ]; then
  emit MIGRATION_FILES "$(find scripts/migrations -maxdepth 2 -name '*.sql' 2>/dev/null | wc -l | tr -d ' ')"
else emit MIGRATION_FILES UNKNOWN; fi
emit MIGRATIONS_PENDING UNKNOWN   # sem ledger de aplicadas + read do DB, nao ha como afirmar

# ---------- CONFIG (só PRESENTE/AUSENTE, nunca valor) ----------
emit ENV_FILE "$([ -f .env ] && echo PRESENT || echo ABSENT)"

# ---------- (7) DEBT / (8) BRIEF (offline, informativo) ----------
if [ -f docs/DEBT_LOG.md ]; then
  emit DEBT_LOG_TOTAL_ENTRIES "$(grep -cE '^## DEBT-[0-9]+' docs/DEBT_LOG.md 2>/dev/null || echo UNKNOWN)"
else emit DEBT_LOG_TOTAL_ENTRIES UNKNOWN; fi
if [ -f docs/SESSION_BRIEF.md ]; then
  bsha="$(git log -1 --format=%h  -- docs/SESSION_BRIEF.md 2>/dev/null || echo '')"
  bat="$(git log -1 --format=%cI -- docs/SESSION_BRIEF.md 2>/dev/null || echo '')"
  emit BRIEF_LAST_COMMIT_SHA "${bsha:-UNKNOWN}"
  emit BRIEF_LAST_COMMIT_AT  "${bat:-UNKNOWN}"
else emit BRIEF_LAST_COMMIT_SHA UNKNOWN; emit BRIEF_LAST_COMMIT_AT UNKNOWN; fi

# ---------- FLAGS FACTUAIS (só fatos locais certos — nunca inferência) ----------
FLAGS=""
[ "$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ] 2>/dev/null && FLAGS="${FLAGS}DIRTY "
_A="$(git rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo 0)"; [ "${_A:-0}" -gt 0 ] 2>/dev/null && FLAGS="${FLAGS}UNPUSHED(${_A}) "
emit PROBE_FLAGS "${FLAGS:-none}"
echo "== FIM (read-only; nada escrito/commitado/pushado) =="
exit 0
