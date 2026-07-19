#!/usr/bin/env bash
# preflight-gate.sh — GUARDIÃO 1 (a máquina que TRAVA só o PERIGO real).
#
# MODELO NOVO (Paulo aprovou 2026-07-18) — a VIRADA que liberta o Paulo de orquestrar:
#   ANTES: pedia aprovação humana ("ask") em TODA ação sensível (editar CP, migration, push)
#          -> o Paulo virava orquestrador de cada passo.
#   AGORA: BLOQUEIA (deny) sozinho SÓ o perigo irreversível/vazamento; o resto FLUI (autonomia).
#          A rede de segurança vira: máquina trava perigo + Paulo confere no DEPLOY + git revert.
#
# TRAVA (deny) apenas:
#   - segredo/credencial hardcoded (JWT service_role, ghp_, github_pat_, sk-, service_role+eyJ)
#   - .env sendo escrito ou commitado (nunca versionar credencial)
# Placeholder mascarado (eyJ…MASK) NÃO dispara. Alta precisão = não trava trabalho legítimo.
# Fail-open: qualquer erro do próprio hook nunca aborta o trabalho.

set -uo pipefail
input=$(cat 2>/dev/null || true)
[ -z "$input" ] && exit 0
tool=$(printf '%s' "$input" | jq -r '.tool_name // ""' 2>/dev/null || echo "")

# Padrões de segredo REAL (alta precisão — JWT precisa do ponto; não pega eyJ…MASK)
SECRET_RE='(eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})|(ghp_[A-Za-z0-9]{36})|(github_pat_[A-Za-z0-9_]{22,})|(sk-[A-Za-z0-9]{20,})|(service_role[^A-Za-z0-9]{0,40}eyJ)'

emit_deny() {
  jq -cn --arg r "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
}

MSG="🛡️ GUARDIÃO 1 BLOQUEOU (segredo/credencial — DEBT-239): "

case "$tool" in
  Edit|Write|MultiEdit)
    path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // ""' 2>/dev/null || echo "")
    # nunca escrever no .env versionável (permite .env.example)
    case "$path" in
      *.env.example) : ;;
      *.env|*/.env) emit_deny "${MSG}nunca escrever/versionar .env ($path). Use \$env / variável de ambiente." ;;
    esac
    content=$(printf '%s' "$input" | jq -r '(.tool_input.content // .tool_input.new_string // "")' 2>/dev/null || echo "")
    if printf '%s' "$content" | grep -Eq "$SECRET_RE"; then
      emit_deny "${MSG}JWT/token/service_role hardcoded em $path. Use \$env.SUPABASE_SERVICE_KEY / variável, nunca o valor cru."
    fi
    ;;
  Bash)
    cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")
    if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+add[^&|;]*\.env([[:space:]]|$)'; then
      emit_deny "${MSG}tentando 'git add' no .env."
    fi
    if printf '%s' "$cmd" | grep -Eq 'git[[:space:]]+commit'; then
      staged=$(git diff --cached 2>/dev/null || true)
      if printf '%s' "$staged" | grep -Eq "$SECRET_RE"; then
        emit_deny "${MSG}há JWT/token/service_role no staged (git diff --cached). Remova/mascare antes de commitar."
      fi
      if git diff --cached --name-only 2>/dev/null | grep -Eq '(^|/)\.env$'; then
        emit_deny "${MSG}.env está no staged do commit."
      fi
    fi
    ;;
  *execute_sql|*apply_migration)
    q=$(printf '%s' "$input" | jq -r '.tool_input.query // .tool_input.sql // ""' 2>/dev/null || echo "")
    if printf '%s' "$q" | grep -Eq "$SECRET_RE"; then
      emit_deny "${MSG}JWT/token hardcoded no SQL — use \$env, não o valor cru."
    fi
    ;;
esac
exit 0
