#!/usr/bin/env bash
# asb_resolve_root.sh — resolucao DETERMINISTICA e FAIL-CLOSED da raiz do repo ASB
# para o comando /asb, quando CLAUDE_PROJECT_DIR esta unset/invalido e o CWD inicial
# pode ser o diretorio-PAI do repo (bug de continuidade — sessao remota/web onde a env
# nao e injetada e o working dir e o pai do checkout).
#
# CONTRATO:
#   - sucesso: imprime a raiz ABSOLUTA (1 linha) em stdout, exit 0.
#   - falha:   NADA em stdout; mensagem curta em stderr; exit != 0.
#              (3 = nenhuma raiz;  4 = ambiguo;  5 = cd falhou)
#
# REGRAS (espelham os requisitos do fix):
#   1) NAO hardcodar /home/user nem caminho de container.
#   2) NAO escolher silenciosamente o primeiro diretorio: ambiguidade = FALHA (exit 4).
#   3) Preferir CLAUDE_PROJECT_DIR quando VALIDO (dir que contem o SENTINELA).
#   4) Senao, resolver por EVIDENCIA (CWD, git-toplevel do CWD, filhos depth-1) filtrando
#      pelo SENTINELA; 0 candidatos = exit 3; >1 candidatos distintos = exit 4.
#   5) A autoridade e o CWD/env — o script IGNORA a propria localizacao ($0). Assim QUALQUER
#      copia do script (em qualquer repo) da a MESMA resposta: o /asb pode bootstrapar por
#      qualquer copia sem afetar a decisao.
#
# READ-ONLY: nenhuma escrita, nenhum git de rede. Fail-closed (nunca "chuta" a raiz).
set -uo pipefail

# SENTINELA = arquivo que o /asb de fato executa. Sua presenca = evidencia da raiz correta.
SENTINEL="scripts/asb_render_brief.py"

_abs() { ( cd "$1" 2>/dev/null && pwd -P ) || return 1; }

# ---- (3) CLAUDE_PROJECT_DIR quando VALIDO -------------------------------------------
if [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -f "${CLAUDE_PROJECT_DIR%/}/$SENTINEL" ]; then
  r="$(_abs "$CLAUDE_PROJECT_DIR")" || {
    echo "ASB_ROOT_CD_FAIL: CLAUDE_PROJECT_DIR invalido ($CLAUDE_PROJECT_DIR)" >&2; exit 5; }
  printf '%s\n' "$r"; exit 0
fi

# ---- (4) Resolucao por evidencia ----------------------------------------------------
cands=""
add() { [ -n "$1" ] && [ -f "$1/$SENTINEL" ] && cands="$cands$(_abs "$1")
"; }

# a) CWD atual
[ -f "./$SENTINEL" ] && cands="$cands$(pwd -P)
"
# b) toplevel git a partir do CWD (CWD dentro do repo, num subdiretorio)
add "$(git rev-parse --show-toplevel 2>/dev/null || true)"
# c) filhos depth-1 do CWD (o caso do bug: CWD e o PAI do repo)
for d in */ ; do
  [ -d "$d" ] || continue
  add "${d%/}"
done

# dedup + contagem (fail-closed)
uniq="$(printf '%s' "$cands" | sed '/^[[:space:]]*$/d' | sort -u)"
n="$(printf '%s\n' "$uniq" | sed '/^[[:space:]]*$/d' | grep -c . || true)"

if [ "${n:-0}" -eq 0 ]; then
  echo "ASB_ROOT_UNRESOLVED: nenhum repo com $SENTINEL a partir de $(pwd -P) (CLAUDE_PROJECT_DIR unset/invalido)" >&2
  exit 3
fi
if [ "$n" -gt 1 ]; then
  echo "ASB_ROOT_AMBIGUOUS: multiplos candidatos -> $(printf '%s' "$uniq" | tr '\n' ' ')" >&2
  exit 4
fi
printf '%s\n' "$uniq"
exit 0
