---
title: Contrato neutro de orquestração entre agentes (Planner · Executor · Reviewer)
type: spec
status: active
version: 1.0.0
created: 2026-08-07
last_updated: 2026-08-07
owner: Paulo Cezario
related:
  - CLAUDE.md
  - docs/arquitetura/ANATOMIA_ASB.md
  - .asb/project.json
  - .asb/schema/workstream.schema.json
  - .claude/skills/asb-engenharia-agentes.md
  - .claude/skills/genesis.md
  - docs/DEPLOY_AUTONOMY.md
---

# Contrato neutro de orquestração entre agentes

## Contexto

O trabalho passou a ser dividido entre mais de uma inteligência: uma planeja e revisa, outra executa.
Este documento define **como** essa divisão acontece. Ele não é um manual do Claude nem do Codex — é a
norma comum que qualquer agente honra ao trabalhar neste repositório, hoje e quando os modelos mudarem.

---

## 1. Fonte de verdade

Esta orquestração é **subordinada**. Ela não substitui, não reinterpreta e não relaxa:

| Autoridade | Papel |
|---|---|
| `CLAUDE.md` | Teto normativo. Regras #11a/#16/#17/#18/#19, padrão de commits, segurança, deploy |
| `docs/arquitetura/ANATOMIA_ASB.md` | Constituição: LEI ÚNICA e as 5 perguntas |
| `.asb/project.json` | Missão, `global_prohibited_scope`, autonomia padrão |
| `.asb/workstreams/*.json` | Estado operacional vivo por frente |
| `.asb/schema/*.json` + validators + hooks + gates | Enforcement mecânico |

Em conflito entre este contrato e qualquer item acima, **o item acima vence**. Este documento nunca
concede permissão que a governança não conceda.

### 1.1 O workstream é o contrato de execução

O handoff Planner→Executor **não é o prompt**: é o workstream ativo em `.asb/workstreams/<id>.json`.
Toda delegação nasce dele e volta para ele.

| Campo | Função na orquestração |
|---|---|
| `approved_scope` | O que o Executor **pode** tocar |
| `prohibited_scope` | O que o Executor **não pode** tocar, em nenhuma hipótese |
| `completion_criteria` | Os critérios de aceite que o Reviewer vai cobrar |
| `current_phase` | Onde a unidade de trabalho está (PLAN · BUILD · REVIEW · FIX) |
| `next_step` | A próxima ação concreta |
| `evidence` | Prova do que foi feito (diff, saída de gate, hash) |
| `decisions` | Decisões tomadas e por quem |
| `execution_gate` | Autonomia efetiva — **fonte da permissão para delegar** |

**Regra dura:** `execution_gate.mode` igual a `blocked`, `requires_paulo` ou `requires_genesis`
**proíbe a delegação**. Só se delega em `autonomous_within_scope` ou `execute_and_report`.

Workstream ausente ou inválido = **não há contrato** = não se delega.

---

## 2. Papéis

Papéis são **funções**, não produtos. Qualquer modelo capaz pode ocupá-los.

### 2.1 Planner / Orchestrator

**Faz:** entende a demanda · consulta a governança e o estado · define o plano · define o escopo
aprovado e o proibido · define os critérios de aceite · decide se delega e para quem · consolida
evidência no workstream.

**Não faz:** trabalho mecânico delegável. Se a tarefa é executável por um Executor dentro de escopo
declarado, o Planner **não a executa** — delega.

*Ocupante padrão atual: Fable.*

### 2.2 Executor

**Faz:** implementa · edita apenas os arquivos permitidos · roda os testes · corrige o que quebrou ·
reporta no formato compacto da §4.

**Não faz:** não redefine arquitetura, não amplia o próprio escopo, não cria regra nova, não decide
o que estava fora do plano. Divergiu do plano ou faltou informação → **reporta e para**, não improvisa.

*Ocupante padrão atual: Codex.*

### 2.3 Reviewer

**Faz:** confere os `completion_criteria` um a um · lê o diff e a evidência · considera a saída dos
testes e gates · procura regressão e efeito colateral fora do escopo · **aprova** ou **pede FIX**
com defeitos nomeados.

**Não faz:** não refaz o trabalho do Executor para conferi-lo.

*Ocupante padrão atual: Fable.*

---

## 3. Roteamento

O Planner classifica a demanda **antes** de agir.

### SIMPLE — pequena, localizada, baixo risco, reversível

```
USER → CODEX BUILD → VALIDAÇÃO MECÂNICA → (REVIEW só se necessário)
```

REVIEW deixa de ser opcional e passa a obrigatório se: um gate falhou · o diff saiu do
`approved_scope` · o Executor reportou `RISKS` não triviais.

### COMPLEX — arquitetural, multi-arquivo, banco, integração, ou alto risco

```
USER → FABLE PLAN → CODEX BUILD → VALIDAÇÃO MECÂNICA → FABLE REVIEW → (CODEX FIX) → FABLE APPROVE
```

**Classifica como COMPLEX sempre que houver qualquer um:** schema/migration · workflow n8n ·
Control Plane · escada de qualificação · deploy · credencial/env · mudança de contrato entre órgãos ·
mais de um domínio tocado · efeito irreversível ou difícil de reverter.

**Na dúvida entre os dois, é COMPLEX.**

---

## 4. Economia de tokens

O Planner/Reviewer é o recurso caro. O contrato existe, em parte, para não desperdiçá-lo.

- O Planner **não acompanha o transcript bruto** do Executor.
- O Planner **não assiste comando a comando**.
- O Executor trabalha **dentro da própria thread**, com o próprio contexto.
- O retorno ao Planner é **compacto e estruturado** — nunca o log integral.

### 4.1 Formato padrão de retorno do Executor

```
Responda SOMENTE com o bloco abaixo. Os 9 campos são obrigatórios, um por linha,
no formato `CAMPO: valor`. Campo sem conteúdo recebe NONE — nunca se omite a linha.
Nada antes do bloco, nada depois dele. Nenhum transcript, nenhum log de comando.

STATUS: DONE | PARTIAL | BLOCKED | FAILED
SUMMARY: o que foi feito, em até 3 linhas
FILES_CHANGED: caminho + natureza da mudança, um por linha — NONE se não alterou nada
TESTS: comando executado → resultado (passou/falhou, contagem) — NONE se não rodou
GATES: validators/hooks/lint executados → verde ou vermelho — NONE se não rodou
ACCEPTANCE_CRITERIA: cada completion_criteria → ATENDIDO | NÃO ATENDIDO | N/A
ERRORS: erro literal (a mensagem, não o transcript) — NONE se não houve
RISKS: efeito colateral percebido, dívida deixada, incerteza — NONE se não houver
NEXT_ACTION: o que falta, ou "nada — pronto para REVIEW"
```

Transcript integral só é devolvido quando este resumo **comprovadamente não basta** — e aí só o
trecho relevante, nunca o log inteiro.

---

## 5. Thread única

Uma unidade de trabalho tem **uma thread de Executor**. PLAN → BUILD → FIX compartilham o mesmo
`threadId` sempre que possível: o contexto do BUILD é exatamente o que torna o FIX barato e preciso.

- Primeira chamada da unidade: abre a thread (`codex`).
- **Toda continuação — inclusive cada rodada de FIX — usa `codex-reply` com o mesmo `threadId`.**
- O `threadId` é registrado em `evidence` do workstream, para a próxima sessão retomar.

Abrir thread nova é exceção e exige um destes motivos, declarado:

1. a unidade de trabalho anterior foi **encerrada**;
2. o contexto **corrompeu** ou ficou inadequado à tarefa;
3. **mudou o workstream**;
4. há justificativa explícita registrada em `decisions`.

Abrir thread nova a cada correção é **violação** deste contrato.

---

## 6. Contenção

O Planner concede ao Executor a **menor capacidade que ainda completa a fase** — nunca mais.

| Fase | Escrita | Aprovação | Diretório |
|---|---|---|---|
| **PLAN** (análise) | somente leitura | `never` | fora do repo, ou o repo em leitura |
| **BUILD** | escrita no workspace | `never` | apenas o repo/worktree autorizado |
| **FIX** | idêntico ao BUILD | `never` | idêntico ao BUILD |

- **Acesso total ao sistema nunca é o padrão.** Só com autorização explícita do Arquiteto, por escrito,
  para aquela execução — e registrada em `decisions`.
- Escrita fora do `approved_scope`, ou dentro do `prohibited_scope`, é **falha de execução**, mesmo que
  o resultado pareça correto.
- FIX herda o escopo do BUILD e fica **restrito aos defeitos nomeados no REVIEW** — não é oportunidade
  de refatorar o que não foi pedido.
- As proibições globais de `.asb/project.json` valem em toda fase, sem exceção.

---

## 7. Segredos

**Nunca** sai valor real de: API key · token · JWT · senha · `service_role` · chave interna de API ·
header de autenticação · qualquer credencial.

- Quando o Executor precisar de um segredo, envia-se o **nome da variável** (`$env.NOME`), jamais o valor.
- **Não se lê nem se imprime arquivo sensível para montar handoff** (`.env`, config de MCP, dump com
  credencial). Precisa saber se existe? Verifique a existência, não o conteúdo.
- Segredo em prompt de delegação é bloqueado mecanicamente pelo Guardião 1
  (`.claude/hooks/preflight-gate.sh`) no adapter Claude Code. **O bloqueio é rede de segurança, não
  licença**: a regra vale mesmo onde o hook não roda (Codex direto, outro harness).
- Suspeita de exposição → tratar como exposta e escalar ao Arquiteto. Rotação é decisão dele.

---

## 8. Juiz mecânico

Antes de qualquer revisão por modelo, **deixa-se os scripts julgarem**. Verificação objetiva é mais
barata e mais confiável que leitura.

Aplicar o que couber à mudança, usando os mecanismos que **já existem** (nenhum novo é criado aqui):

- suíte de qualificação do SDR — obrigatória quando a escada/CP for tocada (runner e score mínimo em
  `CLAUDE.md` §VALIDAÇÃO DE QUALIFICAÇÃO);
- smoke de import do Control Plane antes de qualquer push (`CLAUDE.md` §DEPLOY CONTROL PLANE);
- validador de estado `scripts/asb_validate_state.py`;
- auditoria de governança de deploy `scripts/asb_audit_deploy_governance.py`;
- gates do `.claude/hooks/master-sync.sh`;
- `git diff` e o grafo do `graphify`.

**Um juiz só vale se reprova.** Gate que passa tanto no código certo quanto no quebrado não é gate.

O Reviewer revisa então **evidência, diff relevante, resultado dos testes e critérios de aceite** —
e não reconstrói o trabalho do Executor.

---

## 9. Portabilidade

Este contrato **não pertence** ao Claude nem ao Codex. Ele vale para:

- Claude Code local
- Claude Code Web
- Codex direto
- qualquer agente futuro que ocupe um dos três papéis

Adapters específicos por ferramenta (skill, comando, hook, config) **podem existir** — e devem conter
apenas o que é genuinamente específico daquela ferramenta: nome de tool, parâmetro, caminho.

**Adapter APONTA para este contrato. Adapter NUNCA copia o conteúdo dele.** Regra duplicada é regra que
vai divergir; quando divergir, as duas viram mentira.

---

## 10. Princípio final

> **Uma norma. Um estado. Múltiplos agentes.**
>
> A inteligência pode trocar. A governança não.

---

## Referências

| Tema | Arquivo |
|---|---|
| Teto normativo | `CLAUDE.md` |
| Constituição / LEI ÚNICA | `docs/arquitetura/ANATOMIA_ASB.md` |
| Estado e escopo por frente | `.asb/workstreams/*.json` · `.asb/schema/workstream.schema.json` |
| Proibições globais | `.asb/project.json` |
| Como construir/governar agente | `.claude/skills/asb-engenharia-agentes.md` |
| O quê / por quê construir | `.claude/skills/genesis.md` |
| Autonomia até deploy | `docs/DEPLOY_AUTONOMY.md` |
| Guardião de segredo (adapter Claude Code) | `.claude/hooks/preflight-gate.sh` |

## Changelog

- **1.0.0 (2026-08-07):** Primeira versão. Estabelece a separação Planner · Executor · Reviewer, o
  workstream como contrato de execução, o roteamento SIMPLE/COMPLEX, o retorno compacto, a thread única,
  a contenção por fase, a regra de segredos, o juiz mecânico e a portabilidade por adapters-ponteiro.
