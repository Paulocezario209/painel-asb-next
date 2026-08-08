#!/usr/bin/env bash
# pre-compact.sh — checkpoint read-only ANTES da compactacao (runtime Claude Code 2.1.218).
#
# FONTE UNICA do estado = scripts/asb_render_brief.py (ele ja faz: selecao de workstream,
#   validacao, anti-segredo, Reality Probe, classificacao de autonomia, sanitizacao e limites).
#   Este hook NAO reimplementa nada disso e NAO cria uma segunda fonte de verdade.
#
# stdin: JSON do PreCompact {session_id, transcript_path, cwd, trigger, custom_instructions}.
#   Le no maximo 65536 bytes; extrai SO trigger e session_id (rotulagem). NAO abre transcript_path.
# stdout: instrucao semantica ao compactador + briefing vivo -> vira newCustomInstructions no resumo.
#
# Invariantes: exit 0 nas falhas previsiveis (nunca emite bloqueio intencional; em 2.1.218 exit 2
#   ou decision:block bloqueariam a compactacao — nao fazemos nenhum dos dois). Zero escrita,
#   zero commit/push, zero deploy/migration, zero chamada de modelo, zero leitura de transcript.
set -u
MAX=18000            # teto do stdout TOTAL em bytes (inclui o newline final)
STDIN_CAP=65536      # le no maximo 64KB do stdin
RENDER_TIMEOUT=15    # timeout total do renderer (o probe interno tem timeout proprio)

main(){
  # 1. stdin com limite seguro; usado SO para rotulagem (nao e a fonte de estado)
  IN="$(head -c "$STDIN_CAP" 2>/dev/null)"
  TRIGGER="$(printf '%s' "$IN" | grep -oE '"trigger"[[:space:]]*:[[:space:]]*"(manual|auto)"' \
            | grep -oE 'manual|auto' | head -1)"; TRIGGER="${TRIGGER:-unknown}"
  SID="$(printf '%s' "$IN" | grep -oE '"session_id"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]{1,64}"' \
        | grep -oE '[A-Za-z0-9_-]{1,64}"$' | tr -d '"' | head -1)"; SID="${SID:-unknown}"

  # 2. instrucao semantica ao compactador (usa o proprio modelo de compactacao; sem chamada extra)
  cat <<EOF
=== ASB PRECOMPACT CHECKPOINT (trigger=${TRIGGER} session=${SID}) ===
PRESERVE no resumo, sem inventar:
- de onde viemos, onde estamos, para onde vamos (do briefing vivo abaixo);
- decisoes e aprovacoes explicitas do usuario posteriores ao ultimo state registrado;
- mudancas de escopo;
- trabalho parcialmente executado;
- falhas de ferramentas ainda nao resolvidas;
- arquivos efetivamente alterados;
- proximo passo prometido;
- bloqueios;
- debitos novos ainda nao registrados.
Marque todo conteudo ainda nao persistido no state como UNRECORDED_IN_STATE.
Nao transforme hipotese em decisao.
Nao copie segredos, credenciais ou dados sensiveis.
O briefing vivo abaixo e a fonte estruturada; realidade vence narrativa.
EOF

  # 3. briefing vivo (FONTE UNICA). timeout curto; stderr descartado; falha/timeout/vazio -> marcador.
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
  if BRIEF="$(cd "$ROOT" && timeout "$RENDER_TIMEOUT" python3 scripts/asb_render_brief.py 2>/dev/null)" \
     && [ -n "$BRIEF" ]; then
    printf -- '--- BRIEFING VIVO (asb_render_brief.py) ---\n%s\n' "$BRIEF"
  else
    printf 'BRIEFING_LIVE=UNAVAILABLE; preserve contexto diretamente do transcript\n'
  fi
}

# 4. teto do stdout TOTAL: reserva 1 byte para o newline final -> total <= MAX
main | head -c "$((MAX - 1))"
printf '\n'
exit 0
