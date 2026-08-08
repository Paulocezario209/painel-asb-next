# Contrato do Executor remoto (transporte)

> **Este documento descreve TRANSPORTE, não governança.** Ele não define escopo, não define
> gate, não decide arquitetura. Tudo isso continua vindo de
> [`agent-orchestration-contract.md`](agent-orchestration-contract.md) e do estado `.asb` do
> repositório. Se algo aqui parecer contradizer aquele contrato, aquele contrato vence.

## Por que existe

O papel de Executor já funciona por um transporte: **MCP stdio local**, com o Codex rodando na
máquina do operador. Falta o segundo: um **Executor remoto por HTTP**, para runtimes que não têm
processo local — o caso do Claude Web, cuja sandbox é efêmera e cujo egress de shell é restrito,
mas cujo runtime alcança servidores MCP remotos.

O adapter lógico é **o mesmo** nos dois casos. Muda só quem carrega o payload:

```
Planner ─┬─ MCP stdio  ─→ Codex local     ─→ repo/worktree autorizado
         └─ MCP remoto ─→ Codex no host   ─→ repo/worktree autorizado
```

## Host

**O Control Plane**, e nenhum serviço novo. Ele já expõe MCP por HTTP (`FastApiMCP(app)` em
`app/main.py`), já é consumido como servidor MCP remoto e já está publicado. Criar outro host
seria fork de infraestrutura — a mesma doença que a vendorização curou no código.

## Superfície mínima

Só duas ferramentas, espelhando exatamente o que já foi validado localmente. Nada além disso.

### `codex` — abre uma unidade de trabalho

| Entrada | Origem | Obrigatório |
|---|---|---|
| `handoff` | saída literal do adapter (`handoff.py plan`) | sim |
| `repo` | identificador de um repositório/worktree **da allowlist** | sim |
| `sandbox` | `read-only` ou `workspace-write` | sim |
| `approval_policy` | `never` | sim |

Retorna `threadId` **opaco** + o bloco de retorno.

### `codex-reply` — continua a mesma unidade

| Entrada | Obrigatório |
|---|---|
| `threadId` | sim |
| `prompt` | sim — instrução de FIX ou continuação |

Retorna **o mesmo** `threadId` + o bloco de retorno.

**Não** existe ferramenta para abrir shell, ler arquivo arbitrário, listar segredo ou escolher
repositório fora da allowlist. Menor agência possível: o que não está na lista de ferramentas,
o Executor nunca tenta.

## Formato de retorno

Os 9 campos definidos em `agent-orchestration-contract.md` §4.1. **Não são repetidos aqui** —
repetir seria criar a segunda fonte que este ecossistema passou a sessão inteira eliminando.
Transcript bruto nunca é o retorno padrão.

## Invariantes de segurança

Todas obrigatórias. Violação de qualquer uma = a chamada é recusada, não degradada.

1. **Nenhum segredo no handoff.** O adapter já varre o payload com o padrão do Guardião 1 antes
   de emitir; o servidor **repete** a varredura na entrada. Defesa em profundidade: o cliente
   pode ser qualquer runtime.
2. **Nenhuma leitura de `.env`** ou de config sensível para montar contexto.
3. **Nenhum token na resposta.** A saída passa por redação antes de sair.
4. **Allowlist de repositório/worktree.** O caminho nunca vem do cliente como caminho livre.
5. **`workspace-write` só quando autorizado**; `read-only` é o padrão da fase de análise.
6. **`approval_policy: never`** — automação não pede aprovação interativa; o que exigiria
   aprovação é recusado.
7. **Sandbox em DUAS fronteiras, ambas obrigatórias.** O container isolado é a **primeira**;
   o sandbox interno do Codex é a **segunda**. Defesa em profundidade: nenhuma das duas
   substitui a outra. `danger-full-access`, `--dangerously-bypass-approvals-and-sandbox`,
   `SYS_ADMIN`, container privilegiado, `seccomp=unconfined`, namespace de host e bind do
   socket do Docker **não são estados aceitáveis** — nem temporariamente, nem para
   desbloquear funcionalidade. Se o sandbox interno não funcionar no host, o certo é
   consertar o host ou trocar de host, nunca remover a camada. *(Paulo, 2026-08-07,
   revertendo a tentativa de desligar a camada interna: segurança não se troca por
   funcionalidade.)*
8. **`execution_gate` validado antes do BUILD.** O servidor não reinterpreta o gate: quem
   decide se pode delegar é o adapter, lendo o `execution_gate` do estado `.asb`.
   O que o servidor garante é **conformidade ao formato canônico** que o adapter emite —
   os 13 blocos obrigatórios, `ROLE: EXECUTOR`, `WORKSTREAM_ID` igual ao da chamada, escopos
   não vazios e o bloco `RETURN_FORMAT` com os 9 campos. Payload fora desse formato é
   recusado com 400.
   **Isto não é prova de origem.** Não existe assinatura no ecossistema, e inventar um HMAC
   só para esta checagem criaria mecanismo paralelo — exatamente o que a vendorização curou.
   A garantia operacional é o par *adapter gera* + *servidor valida estritamente o mesmo
   formato*. Quando houver mecanismo real de proveniência no projeto, ele se reutiliza aqui;
   até lá, a promessa fica do tamanho do que se pode cumprir. *(Ajustado 2026-08-07: a
   redação anterior dizia "exige que o handoff tenha vindo do adapter", e a implementação
   checava duas substrings — promessa maior que a garantia.)*
9. **`approved_scope` e `prohibited_scope` obrigatórios** no handoff.
10. **`threadId` opaco** — sem caminho, sem host, sem identificador de conta embutido.
11. **Logs redigidos.** Nem em diagnóstico se imprime credencial.

## Persistência de thread

`threadId → sessão Codex` precisa sobreviver ao ciclo PLAN → BUILD → REVIEW → FIX.

**Reusar o armazenamento que já existe** (o Control Plane já fala com Postgres). Uma tabela de
mapeamento com TTL basta: `thread_id` opaco, referência da sessão, repo, criado/expira. Nada de
banco novo, nada de Redis novo — a Fase 7.2 de fila do CP nunca foi ativada e não é pré-requisito.

Expirado ou desconhecido → `codex-reply` **falha**. Nunca abre thread nova por baixo: abrir
thread nova em silêncio é perder o contexto que torna o FIX barato, sem ninguém perceber.

## Dependência bloqueante — autenticação do Executor no host

Para o Codex executar no servidor, o container precisa de **runtime** (Node + Codex CLI, uma
alteração mecânica de `Dockerfile`) e de **credencial**.

A credencial é o bloqueio real, e é uma decisão do Arquiteto:

- A autenticação local hoje é **sessão OAuth de conta ChatGPT pessoal** (`auth_mode` + `tokens`,
  com `OPENAI_API_KEY` nulo). Credencial pessoal **não vai para container hospedado** — nem por
  conveniência, nem "só para testar".
- O caminho legítimo é uma **credencial de serviço própria**, provisionada para esse uso, com
  escopo e custo conscientes, entrando no host como variável de ambiente e nunca versionada.

Enquanto essa decisão não for tomada, o transporte remoto fica **especificado e não implementado**.
O transporte local segue funcionando e não depende disto.

## Ordem de implementação (quando a credencial existir)

1. Variável de ambiente do Executor no host, pelo mecanismo de segredo do EasyPanel.
2. Runtime do Executor na imagem do CP (`Dockerfile`), com o smoke de import continuando verde.
3. As duas ferramentas MCP, finas: recebem, delegam ao Codex, devolvem o bloco estruturado.
4. Tabela de mapeamento de thread com TTL.
5. Allowlist de repositório/worktree, declarada em configuração do host.
6. Piloto no mesmo satélite já usado no teste local, com os mesmos gates.

## Referências

| Tema | Arquivo |
|---|---|
| Papéis, ciclo, thread, contenção, segredos | `contracts/agent-orchestration-contract.md` |
| Adapter que monta e valida o handoff | `adapters/claude/handoff.py` |
| Padrão de credencial do Guardião 1 | `hooks/preflight-gate.sh` |
| Integridade do core no consumidor | `bin/govcore.py` |
