#!/usr/bin/env bash
# session-end.sh — tripwire tecnico EFEMERO de pendencias no fechamento gracioso (runtime 2.1.218).
#
# O stdout do SessionEnd e DESCARTADO no sucesso e o hook NAO pode bloquear/injetar contexto.
# Por isso o unico canal util e um efeito colateral minimo: gravar UM flag efemero que o
# proximo SessionStart le, anuncia e apaga. O flag vive nos metadados locais do Git
# (git rev-parse --git-path) -> NUNCA entra em commit; morre com o container.
#
# NAO e fonte de estado/decisao/missao/escopo. So diagnostico: dirty, unpushed, reason, ts.
# Local-only: zero rede, zero renderer, zero probe completo, zero validador, zero modelo,
# zero selecao de workstream, zero leitura de transcript. Nunca commita/pusha. Exit SEMPRE 0.
set -u
export GIT_OPTIONAL_LOCKS=0 GIT_TERMINAL_PROMPT=0

# 1. stdin com limite seguro; extrai SO reason e session_id via whitelist rigida
IN="$(head -c 65536 2>/dev/null)"
REASON="$(printf '%s' "$IN" | grep -oE '"reason"[[:space:]]*:[[:space:]]*"(clear|logout|prompt_input_exit|other)"' \
         | grep -oE 'clear|logout|prompt_input_exit|other' | head -1)"; REASON="${REASON:-unknown}"
SID="$(printf '%s' "$IN" | grep -oE '"session_id"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]{1,64}"' \
      | grep -oE '[A-Za-z0-9_-]{1,64}"$' | tr -d '"' | head -1)"; SID="${SID:-unknown}"

# 2. repositorio + caminho do flag (metadados locais do Git; nunca commitavel; respeita worktree)
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
cd "$ROOT" || exit 0
FLAG="$(git rev-parse --git-path asb-session-end.flag 2>/dev/null)" || exit 0
[ -n "$FLAG" ] || exit 0

# 3. fatos Git LOCAIS (sem rede)
DIRTY="$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')"; DIRTY="${DIRTY:-0}"
UNPUSHED="$(git rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo 0)"; UNPUSHED="${UNPUSHED:-0}"

# 4. so grava se ha pendencia factual (nunca por hipotese/UNKNOWN)
if [ "$DIRTY" -eq 0 ] && [ "$UNPUSHED" -eq 0 ]; then
  exit 0
fi

# 5. escrita atomica, permissao restrita, conteudo <=512 bytes; falha na escrita -> exit 0
ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)"
DIR="$(dirname "$FLAG")"
( umask 077
  TMP="$(mktemp "${DIR}/asb-se.XXXXXX" 2>/dev/null)" || exit 0
  {
    printf 'schema=1\n'
    printf 'reason=%s\n' "$REASON"
    printf 'session=%s\n' "$SID"
    printf 'dirty=%s\n' "$DIRTY"
    printf 'unpushed=%s\n' "$UNPUSHED"
    printf 'ended_at=%s\n' "$ENDED_AT"
  } | head -c 512 > "$TMP" 2>/dev/null || { rm -f "$TMP" 2>/dev/null; exit 0; }
  mv -f "$TMP" "$FLAG" 2>/dev/null || rm -f "$TMP" 2>/dev/null
)
exit 0
