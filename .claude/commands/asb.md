---
description: Abre a sessão ASB — renderiza o briefing vivo (estado + realidade), carrega governança e reporta. Primeiro comando de toda sessão.
allowed-tools: Bash(cd:*), Bash(git fetch:*), Bash(timeout:*), Bash(echo:*), Bash(python3 scripts/asb_render_brief.py:*)
---

# /asb — Abertura de sessão ASB (briefing vivo + governança)

> O SESSION_BRIEF NÃO é fonte de estado (é só mapa). NÃO carregar o archive de 360 KB.
> O ESTADO vem do BRIEFING VIVO abaixo: renderer read-only (intenção do `.asb` + realidade do probe).
> NUNCA fazer pull/merge/deploy automático só por abrir. Realidade vence narrativa. UNKNOWN permanece UNKNOWN.

## 1. Atualidade (read-only) + briefing vivo
Atualiza as refs (sem pull/merge; falha de rede = `FETCH_STATUS=UNKNOWN`, nunca sucesso) e renderiza o estado real:

!`cd "${CLAUDE_PROJECT_DIR:-.}" && GIT_TERMINAL_PROMPT=0 timeout 8 git fetch origin --prune --quiet >/dev/null 2>&1 && echo FETCH_STATUS=OK || echo FETCH_STATUS=UNKNOWN`

!`cd "${CLAUDE_PROJECT_DIR:-.}" && python3 scripts/asb_render_brief.py`

## 2. Governança (ALMA + guardiões)
- O hook `SessionStart` já injetou LEI ÚNICA + GENESIS + 5 perguntas + Guardião 2b (sincronia). Honrar.
- Ritual: `cat .claude/skills/asb-session-start.md` (PROC-1). **NÃO** fazer `cat` do SESSION_BRIEF antigo nem do archive.

## 3. Agir conforme a AUTONOMIA EFETIVA do briefing (linha 12)
- **blocked** → PARAR: não iniciar trabalho novo; resolver o(s) item(ns) FATAL antes.
- **requires_genesis** → nenhum workstream ativo: iniciar o fluxo GENESIS (5 perguntas) para abrir a frente.
- **execute_and_report** → reconciliação técnica reversível dentro do `approved_scope` é autônoma; commit/push só com o estado coerente e gates passando; comunicar depois.
- **requires_paulo** → apresentar SOMENTE a decisão realmente bloqueante (do state/negócio) e aguardar.
- **autonomous_within_scope** → seguir o `next_step` dentro do `approved_scope`; nunca acima do CLAUDE.md.
- Se §10/§11 mostrarem "atrás de master"/divergência → **reconciliar ANTES** de trabalho novo, de forma GATED
  (preservar trabalho não-commitado — stash/commit — antes; **nunca** pull/merge automático ao abrir).

## 4. Durante a sessão (governança viva)
- Registro no MESMO commit da entrega (Regra #17); DEBT_LOG ↔ estado juntos (Regra 11a).
- Atualizar `.asb/workstreams/<id>.json` ao concluir cada passo (nunca em silêncio).
- Pre-flight antes de efeito colateral (Regra #16). O Grafy é mantido pelo hook `Stop` (não rodar à mão aqui).

## 5. Ao encerrar
Rodar **`/asb-fim`** — nunca encerrar sem ele.
