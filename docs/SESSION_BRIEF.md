# SESSION BRIEF — Painel ASB (papel mínimo)

> Este arquivo NÃO é fonte de status. É o MAPA das fontes + a instrução de retomada.
> Status computável (branch, deploy, testes, ahead/behind) é consultado SEMPRE AO VIVO
> pelo Reality Probe via **/asb** — nunca escrito aqui. **Realidade vence narrativa.**

## Como retomar
Rode **/asb**. Ele renderiza o BRIEFING VIVO (intenção + progresso + realidade) e carrega a governança.
- ALMA/leis → `CLAUDE.md` (deste repo)
- Memória operacional → `.asb/project.json` + `.asb/workstreams/<id>.json`
- Realidade → `scripts/asb_probe.sh` (ao vivo, read-only)

## Fontes canônicas (nunca duplicar aqui)
| Tipo | Fonte |
|---|---|
| Leis / identidade | `CLAUDE.md` (deste repo) |
| Estado operacional ativo | `.asb/workstreams/<id>.json` |
| Identidade / missão | `.asb/project.json` |
| Status computável | `scripts/asb_probe.sh` (AO VIVO) |
| Governança/mecanismo | núcleo ASB herdado de `cursor-agentesdr-mcp` |
| Deploy | **automático** (webhook EasyPanel): merge `main` com CI verde → publica. Ver `docs/DEPLOY.md` |

## Notas humanas de handoff
_(Só o que NÃO cabe no estado estruturado. Curto. Sem status computável.)_
- (vazio no momento)

## Regra de verdade
Divergência entre qualquer nota e a realidade → a **realidade (probe) vence**.
UNKNOWN permanece UNKNOWN. Nada de deploy é "confirmado" sem fonte real.
