---
description: Fecha a sessão ASB no ritual — atualiza SESSION_BRIEF/MASTER_STATE, varre pendências, commita e sobe pro master. Rodar como último comando de toda sessão.
---

# /asb-fim — Encerramento ritual da sessão ASB

Execute NESTA ORDEM. Objetivo: nada fica mudo, tudo registrado, zero pendência cega.

## 1. Ler o ritual
- `cat .claude/skills/asb-session-end.md` e seguir os stop gates dele.

## 2. Atualizar os registros canônicos (Regra #17 · 11a)
- `docs/SESSION_BRIEF.md` — bloco **⚡ ESTADO ATUAL** atualizado NO LUGAR (nunca anexar no fundo).
- `docs/SDR_MASTER_STATE.md` — entrada se houve mudança de estado do mundo (deploy/schema/workflow).
- `docs/DEBT_LOG.md` ↔ `SESSION_BRIEF.md` sincronizados (toda DEBT nova/mudança de status no mesmo passo).

## 3. VARREDURA DE PENDÊNCIAS (Regra #18 pilar 6) — trazer como LISTA, nunca deixar mudo
- Commits locais não pushados · branches não-mergeadas no master · PRs abertas ·
  deploys aguardando (CP/painel/n8n) · working tree sujo.
- Para cada pendência: o que é + como resolver. **Zero pendência** ao fechar, ou declarar o que ficou e por quê.

## 4. Grafo + git
- `graphify update .`
- Commit dos registros; push da branch; merge no `master`; push do master.
- Confirmar em uma linha: `✅ tudo no master (<hash>) · zero pendência` — ou a lista do que ficou.

## 5. Colisão de DEBT / atualidade
- Se o Guardião 2b (boot) sinalizou colisão de DEBT ou branch atrás, confirmar que foi reconciliado nesta sessão.
