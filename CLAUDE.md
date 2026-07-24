# CLAUDE.md — Painel ASB (Next.js) · ALMA local

> ALMA mínima e **própria** deste repositório. NÃO importa a missão do monorepo
> `cursor-agentesdr-mcp` nem do repo de LPs — o painel tem identidade própria.

## Missão
**Superfície de leitura e gestão** do ecossistema ASB: workspaces Comercial, Compras e Marketing
renderizados sobre o **espelho Supabase** (não o ARES ao vivo). O painel **mostra** e **opera** —
não é o SDR nem o backend de decisão.

## Papel do repositório
App Next.js (submodule do monorepo). Telas/KPIs/gráficos sobre o KIT compartilhado (`app/dashboard/lib`).
Fonte de verdade dos dados é o **espelho** (sync do backend), não este repo.

## Limites de autonomia
- Governança/estado (`.claude/`, `.asb/`, `scripts/asb_*`) = livre para manutenção técnica.
- Tela/KPI/número: **nunca desenhar à mão** — compor com o KIT (`app/dashboard/lib/ui.tsx`).
- **Deploy do painel é AUTOMÁTICO** (webhook GitHub do EasyPanel): `feature → PR → CI verde → merge main → auto-deploy`. Push na `main` **publica** (sem clique manual). **Verificação AUTOMÁTICA** do SHA vivo pelo GitHub Actions no domínio custom `painel.americansteakbrasil.com/api/version` (DEBT-334 RESOLVIDA). Fonte: `docs/DEPLOY.md` + `docs/DEPLOY_AUTONOMY.md` do monorepo.

## Fontes canônicas
- Governança/mecanismo: núcleo ASB herdado de `cursor-agentesdr-mcp` (guardiões, continuidade).
- Estado operacional: `.asb/project.json` + `.asb/workstreams/<id>.json` (deste repo).
- Retomada: **`/asb`** · encerramento: **`/asb-fim`** · mapa: `docs/SESSION_BRIEF.md`.

## Proibição de segredo
🚫 Nunca commitar `.env`, `SUPABASE_*`, `INTERNAL_API_KEY`, token ou qualquer segredo.
O guardião `PreToolUse` (`preflight-gate.sh`) trava isso antes do write.

## Guardiões (mecanismo, não memória)
`SessionStart` (governança + sincronia) · `PreToolUse` (trava segredo) ·
`Stop` (`graphify-auto`) · `PreCompact` · `SessionEnd` (tripwire). *(master-sync DESATIVADO neste repo: push na `main` já dispara produção — integração só por PR com CI verde, ver `docs/DEPLOY.md`.)*

## Regra de verdade
**Realidade vence narrativa.** Divergência nota × Git/probe → a realidade vence. UNKNOWN permanece UNKNOWN.

## Graphify — knowledge graph

Antes de responder qualquer pergunta sobre arquitetura, dependencias ou
"onde esta X", leia `graphify-out/GRAPH_REPORT.md` PRIMEIRO.
Ele tem os god nodes e a estrutura de comunidades — navegue por ele
em vez de grepar arquivo por arquivo.

Apos mudancas no codigo: `graphify update .` (sem custo de API).
