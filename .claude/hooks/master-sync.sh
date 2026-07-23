#!/usr/bin/env bash
# master-sync.sh — Stop hook: leva o trabalho VERDE a branch DEFAULT (master/main) SOZINHO,
# so por FAST-FORWARD seguro. PORTAVEL: detecta a branch default do repo (nao hardcoda master).
#
# Objetivo (Paulo 2026-07-23): "asb como bash" — o merge a default nao pode depender da memoria do
# agente. A MAQUINA faz. Cruza conscientemente a linha "so avisa" da Regra #19 SOMENTE para o caso
# 100% seguro (FF puro + tree limpo + gates verdes); em qualquer duvida, NAO age, so avisa.
#
# NUNCA usa --force, NUNCA mergeia com conflito, NUNCA mergeia tree sujo, NUNCA bloqueia a sessao. Exit 0.
set -uo pipefail
export GIT_OPTIONAL_LOCKS=0 GIT_TERMINAL_PROMPT=0
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
git rev-parse --show-toplevel >/dev/null 2>&1 || exit 0

BR="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
[ "$BR" = "?" ] && exit 0

# GATE 1: working tree limpo (ignora gitignored). Sujo -> nao age.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "🔸 master-sync: tree sujo -> nao sincronizo (commite/limpe antes)."; exit 0
fi

# refs atualizadas (bounded; sem rede confiavel nao arrisco ancestralidade)
timeout 15 git fetch origin --quiet 2>/dev/null || { echo "🔸 master-sync: sem rede p/ fetch -> nao sincronizo."; exit 0; }

# branch DEFAULT do repo (portavel): origin/HEAD -> fallback main -> master
DEF="$(git symbolic-ref --quiet refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')"
if [ -z "$DEF" ]; then
  if   git rev-parse --verify origin/main   >/dev/null 2>&1; then DEF=main
  elif git rev-parse --verify origin/master >/dev/null 2>&1; then DEF=master
  else exit 0; fi
fi
[ "$BR" = "$DEF" ] && exit 0            # ja estamos na default: nada a sincronizar
git rev-parse "origin/$DEF" >/dev/null 2>&1 || exit 0

HEAD_SHA="$(git rev-parse HEAD)"
ODEF="$(git rev-parse "origin/$DEF")"
OBRANCH="$(git rev-parse "origin/$BR" 2>/dev/null || echo '')"

# GATE 3: HEAD ja pushado na propria branch (nada se perde)
[ "$OBRANCH" = "$HEAD_SHA" ] || { echo "🔸 master-sync: HEAD nao pushado em origin/$BR -> nao sincronizo."; exit 0; }

# GATE 4: nada a fazer se default ja == HEAD
[ "$ODEF" = "$HEAD_SHA" ] && exit 0

# GATE 5: FAST-FORWARD puro (origin/DEF ancestral do HEAD). Divergiu -> so avisa.
if ! git merge-base --is-ancestor "$ODEF" "$HEAD_SHA"; then
  AH="$(git rev-list --count "$ODEF..$HEAD_SHA" 2>/dev/null || echo '?')"
  BH="$(git rev-list --count "$HEAD_SHA..$ODEF" 2>/dev/null || echo '?')"
  echo "🔸 master-sync: $DEF DIVERGIU (branch +$AH / $DEF +$BH) -> nao FF; reconcilie (git rebase origin/$DEF)."; exit 0
fi

# GATE 6: gates verdes — sintaxe dos hooks + estado .asb valido (validador inclui anti-segredo)
for h in .claude/hooks/*.sh; do [ -e "$h" ] || continue; bash -n "$h" 2>/dev/null || { echo "🔸 master-sync: $h com erro de sintaxe -> nao sincronizo."; exit 0; }; done
if [ -f scripts/asb_validate_state.py ]; then
  [ -f .asb/project.json ] && { python3 scripts/asb_validate_state.py .asb/project.json >/dev/null 2>&1 || { echo "🔸 master-sync: .asb/project.json invalido -> nao sincronizo."; exit 0; }; }
  for w in .asb/workstreams/*.json; do
    [ -e "$w" ] || continue
    python3 scripts/asb_validate_state.py "$w" >/dev/null 2>&1 || { echo "🔸 master-sync: $w invalido -> nao sincronizo."; exit 0; }
  done
fi

# TODOS OS GATES VERDES -> fast-forward da default (sem --force; corrida -> server rejeita -> exit 0)
if git push origin "$HEAD_SHA:refs/heads/$DEF" 2>/dev/null; then
  echo "✅ master-sync: $DEF avancado por FF para $(git rev-parse --short "$HEAD_SHA") (trabalho verde na default, autonomo)."
else
  echo "🔸 master-sync: push de $DEF rejeitado (corrida?) -> nao sincronizado; reconcilie no proximo boot."
fi
exit 0
