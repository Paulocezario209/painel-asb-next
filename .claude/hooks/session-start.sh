#!/bin/bash
# SessionStart — GUARDIÃO 2 (versão SATÉLITE, repos do PROJETO ASB fora do monorepo SDR).
#
# Igual ao G2 do SDR, MAS: a constituição (ANATOMIA_ASB, DEBT_LOG, SESSION_BRIEF) NÃO mora aqui —
#   mora no repo cursor-agentesdr-mcp. Aqui o boot: (1) anuncia que é um órgão do corpo ASB,
#   (2) aponta a fonte única, (3) põe a LEI ÚNICA + 5 perguntas + autonomia na frente do agente.
# G1 (trava segredo/.env) é UNIVERSAL e vale aqui igual. Idempotente + fail-open.
set -uo pipefail
# ---- Resolucao ROBUSTA da raiz (independe de CLAUDE_PROJECT_DIR e do CWD) ----
# 1) auto-localizacao pelo proprio caminho do hook ($0) — deterministica: a invocacao
#    (settings.json) passa o caminho ABSOLUTO ja resolvido pelo asb_resolve_root.sh;
# 2) fallback CLAUDE_PROJECT_DIR valido; 3) fallback resolver por evidencia (fail-closed).
# SessionStart e FAIL-OPEN: sem raiz nunca derruba a sessao (exit 0). Sem hardcode.
_hk_here="$(cd -- "$(dirname -- "$0")" 2>/dev/null && pwd -P || true)"
_hk_root=""
if [ -n "${_hk_here}" ] && [ -f "${_hk_here}/../../scripts/asb_render_brief.py" ]; then
  _hk_root="$(cd -- "${_hk_here}/../.." && pwd -P)"
elif [ -n "${CLAUDE_PROJECT_DIR:-}" ] && [ -f "${CLAUDE_PROJECT_DIR%/}/scripts/asb_render_brief.py" ]; then
  _hk_root="$(cd -- "${CLAUDE_PROJECT_DIR}" && pwd -P)"
elif [ -n "${_hk_here}" ] && [ -x "${_hk_here}/../../scripts/asb_resolve_root.sh" ]; then
  _hk_root="$("${_hk_here}/../../scripts/asb_resolve_root.sh" 2>/dev/null || true)"
fi
cd "${_hk_root:-${CLAUDE_PROJECT_DIR:-.}}" 2>/dev/null || exit 0

_REPO=$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
echo ">>> PROJETO ATIVO: ${_REPO}  (órgão do corpo ASB)  —  confira que é o repo certo antes de agir. <<<"
cat <<'GOV'
== GOVERNANCA ASB — LER ANTES DE AGIR ==
CONSTITUICAO (fonte unica): repo cursor-agentesdr-mcp -> docs/arquitetura/ANATOMIA_ASB.md
  (este repo e um ORGAO do corpo ASB; a anatomia, o DEBT_LOG e o SESSION_BRIEF vivem la, nao aqui).
LEI UNICA: todo orgao novo PLUGA no contrato e BEBE da fonte unica — nunca forka o sangue nem re-decide.
Antes de criar/alterar (agente/skill/view/tabela/tela/workflow), responder VERDE as 5 perguntas:
  1) De onde vem o dado?  (fonte unica — se cria copia, PARE)
  2) Quem decide?         (o CP — se o orgao re-decide, PARE)
  3) Ja existe?           (tabela/caminho/nome — anti-duplicacao; cheque o grafy)
  4) Quebra algo?         (varredura downstream do que ja funciona)
  5) Qual o gate?         (sem gate = NAO esta concluido)
ENFORCEMENT automatico: Guardiao 1 (hook) TRAVA segredo/.env; graphify roda sozinho ao fim do turno.
COMMIT + MERGE sao tarefas do Claude (autonomo); Paulo confere no DEPLOY.
GOV

# DEBT_LOG local (se existir neste repo; normalmente NAO existe — vive no SDR). Fail-open.
if [ -f docs/DEBT_LOG.md ]; then
  echo "DEBTs ABERTAS / prioridade (deste repo):"
  grep -hE '^## DEBT-[0-9]+ ' docs/DEBT_LOG.md 2>/dev/null \
    | grep -Eiv 'RESOLVIDA|OBSOLETA|SUPERSEDED' | grep -E 'ABERTA|P0|⏳|🔴' \
    | sed -E 's/^## /  - /' | head -8 || true
fi
echo "AO ENCERRAR: varrer pendencias (deploy/merge/PRs/branches parados) e traze-las como PERGUNTA, nunca deixar mudas."
echo "==============================================================================================="

# ============ Consumidor do tripwire do SessionEnd (Design A, efemero) ============
_FLAG="$(git rev-parse --git-path asb-session-end.flag 2>/dev/null || echo '')"
if [ -n "${_FLAG}" ] && [ -f "${_FLAG}" ]; then
  _TW="$(head -c 512 "${_FLAG}" 2>/dev/null)"
  if printf '%s' "${_TW}" | grep -qE '^schema=1$' \
     && _R=$(printf '%s\n' "${_TW}" | grep -m1 -oE '^reason=(clear|logout|prompt_input_exit|other|unknown)$' | cut -d= -f2) \
     && _D=$(printf '%s\n' "${_TW}" | grep -m1 -oE '^dirty=[0-9]{1,9}$' | cut -d= -f2) \
     && _U=$(printf '%s\n' "${_TW}" | grep -m1 -oE '^unpushed=[0-9]{1,9}$' | cut -d= -f2) \
     && [ -n "${_R}" ] && [ -n "${_D}" ] && [ -n "${_U}" ]; then
    echo "⚠️ FECHAMENTO ANTERIOR: dirty=${_D} · unpushed=${_U} · reason=${_R}. Reconcilie antes de iniciar trabalho novo."
  else
    echo "⚠️ TRIPWIRE_INVALID: flag de fechamento anterior malformado (descartado, conteudo nao exibido)."
  fi
  rm -f "${_FLAG}" 2>/dev/null || true
  echo "-----------------------------------------------------------------------------------------------"
fi

# Bootstrap do Graphify (so REMOTO; e so se o script de build existir neste repo). Fail-open.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
pip install -q graphifyy 'graphifyy[sql]' >/dev/null 2>&1 \
  || pip install -q --break-system-packages graphifyy 'graphifyy[sql]' >/dev/null 2>&1 \
  || true
if [ ! -f graphify-out/graph.json ] && [ -f scripts/build_graph_codeonly.py ] && command -v python3 >/dev/null 2>&1; then
  nohup python3 scripts/build_graph_codeonly.py >/tmp/graphify_bootstrap.log 2>&1 &
fi
exit 0
