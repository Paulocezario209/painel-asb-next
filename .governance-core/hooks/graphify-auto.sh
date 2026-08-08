#!/usr/bin/env bash
# graphify-auto.sh — Stop hook: mantém o grafo do código atualizado SOZINHO ao fim de cada turno.
#
# Resolve a queixa do Paulo (2026-07-18): "duvido que atualizou o grafy em tempo real desde o início".
# Antes: dependia de o agente LEMBRAR de rodar `graphify update` (falhava). Agora: a MÁQUINA roda.
# Background (não atrasa a resposta) + fail-open (nunca trava a sessão) + só roda se houve mudança de código.

set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
command -v graphify >/dev/null 2>&1 || exit 0

# Roda só se código mudou no working tree OU no último commit (evita rebuild em turno de só-conversa).
changed=""
if git status --porcelain 2>/dev/null | grep -Eq '\.(py|ts|tsx|js|jsx|sql)$'; then changed="1"; fi
if [ -z "$changed" ] && git diff --name-only HEAD~1..HEAD 2>/dev/null | grep -Eq '\.(py|ts|tsx|js|jsx|sql)$'; then changed="1"; fi
[ -z "$changed" ] && exit 0

nohup graphify update . >/tmp/graphify_auto.log 2>&1 &
exit 0
