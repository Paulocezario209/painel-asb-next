# Policy das ferramentas de segurança

> **Esta é a camada de VINCULAÇÃO, e ela nomeia fornecedor de propósito.**
> [`security-governance-contract.md`](security-governance-contract.md) descreve o *papel* que um
> detector ocupa e por mandato não cita produto, comando nem modelo. Alguém precisa dizer **qual
> ferramenta concreta ocupa qual papel, e até onde ela vai** — é este documento, e só ele.
> A contract-mãe continua trocável por adapter; trocar de ferramenta muda esta policy, nunca aquela.
>
> **Hierarquia:** se algo aqui parecer contradizer a contract-mãe ou
> [`agent-orchestration-contract.md`](agent-orchestration-contract.md), **eles vencem**. Esta policy
> só restringe; nunca amplia o que a governança já negou.

## A frase que organiza tudo

Vem da contract-mãe, e nenhuma ferramenta abaixo a dobra:

**Segurança detecta e classifica. Governança autoriza. Executor corrige. Review valida.**

```
finding → governança autoriza workstream → approved_scope → handoff canônico
        → Codex Executor → testes/gates → verificação de segurança → review → finding fechado
```

**O Codex Executor é a rota oficial e única de correção.** Nenhuma das três ferramentas escreve no
repositório. Detectar é capacidade; autorizar é decisão; corrigir é papel do Executor. As três nunca
moram no mesmo lugar.

## 1. Regra-mãe de acesso (vale para as três)

**PODE:** ler código versionado autorizado · analisar diff e commit · identificar vulnerabilidade ·
gerar finding · produzir threat model · triar · recomendar correção · verificar correção aplicada.

**NÃO PODE, por padrão — negação vale para as três sem exceção:**

| Negado | Por quê |
|---|---|
| `.env` e variações · arquivo de credencial · token · segredo real · chave privada | invariante `no_secrets` do core |
| backup, snapshot ou dump com segredo operacional | §7 |
| autenticar em serviço externo · token em URL | detector não tem identidade própria |
| alterar produção | decisão humana (contract-mãe §10) |
| alterar política de sandbox · ação destrutiva | idem |
| alterar governança | fora de workstream autorizado para isso |
| aplicar patch fora do fluxo governado | `automatic_patch_allowed: false` |

**Se encontrar referência a segredo, o finding registra apenas `caminho` + `tipo de risco` +
`severidade`. O valor nunca é impresso** — nem mascarado, nem parcial (contract-mãe §6).

## 2. Camada 1 — revisão por diff (`/security-review`, nativo do Claude Code)

**Papel:** revisão rápida e diff-aware. É **um gate a mais**, não substitui teste mecânico, code
review, threat model nem varredura completa (contract-mãe §8).

| | |
|---|---|
| **Permitido** | código versionado · diffs · commits · migrations · scripts · workflows ativos · testes · config sem segredo |
| **Negado** | `.env*` · `credentials*` · `secrets*` · chave privada · backups · dumps · sessions · venvs · caches · `.next` · artefatos gerados |
| **Escrita** | nenhuma. Não aplica correção automaticamente. |

## 3. Camada 2 — scanner especializado (`claude-security`, plugin oficial)

**Papel:** varredura estática/interativa com verificação adversarial. É o **tipo A** da contract-mãe
§5 — lê o código, **não executa o alvo**.

| | |
|---|---|
| **Permitido** | `scan-changes` · `scan-codebase` · geração de findings · threat analysis interna · `suggest-patches` · verificação de patch |
| **Exclusões padrão** | as mesmas da camada 1, mais snapshot com segredo |
| **Escrita** | nenhuma no repositório de trabalho |

**`suggest-patches` é proposta, não autorização de escrita.** O patch é um *arquivo* que alguém lê e
decide aplicar — nunca um commit, nunca um push (contract-mãe §7). Aplicar percorre o fluxo do
cabeçalho, com o Codex Executor como executor.

## 4. Camada 3 — harness de segurança profunda (`defending-code-reference-harness`, Anthropic)

**Papel:** threat modeling, vuln hunting e triagem avançada. Ferramenta externa oficial, **governada
por policy, não instalada como plugin**. Vive fora deste repositório e assim permanece: não copiar,
não mover, não instalar dependências, não vendorizar.

**LIBERADO agora — estático, read-only, sem executar o alvo:**

`quickstart` · `threat-model` · `vuln-scan` (modo estático) · `triage` · `verify`

**SOB AUTORIZAÇÃO EXPLÍCITA, caso a caso:**

`patch` — e ainda assim entrega arquivo de patch, que volta pelo fluxo do cabeçalho. Nunca escreve
direto.

**BLOQUEADO por padrão — este é o tipo B da contract-mãe §5, desligado em toda a ASB:**

`vuln-pipeline` · `dnr-pipeline` (`dnr-hunt`, `dnr-respond`) · `vp-sandboxed` · execução autônoma de
código alvo · `setup_sandbox.sh` · Docker/gVisor no host · override de política de sandbox · execução
de PoC contra produção · acesso a segredo · patch autônomo · `customize` (altera o próprio harness).

Ligar qualquer item bloqueado **não se faz editando arquivo de configuração**: exige sandbox
dedicada, design próprio e aprovação humana explícita, sem enfraquecer a arquitetura atual
(invariante `no_execution_based_scan` do core).

## 5. Hierarquia — nenhuma ferramenta acima do core

```
GOVERNANCE-CORE
  └── Planner / Orchestrator
        └── ferramentas de segurança  (camadas 1, 2 e 3)
              └── findings
                    └── workstream autorizado
                          └── Codex Executor → sandbox → testes/gates
                                └── verificação de segurança → review
```

Nenhuma ferramenta de segurança fica acima do Governance-Core. Um detector que "sabe melhor" ainda
assim propõe — quem autoriza é a governança.

## 6. O que é automático e o que não é

**Pode ser automático** — mecânico, barato, sem julgamento de valor:
`/security-review` em mudança apropriada · `scan-changes` · classificação e relatório de findings ·
verificação de segurança depois da correção.

**Não é automático por padrão** — custo alto ou decisão:
varredura completa de codebase em toda tarefa · threat model profundo · `vuln-scan` completo ·
qualquer modo autônomo do harness · aplicar patch.

## 7. Backups rastreados com segredo — bloqueio operacional conhecido

Regra geral, válida em qualquer repositório governado:

```
BACKUPS_WITH_SECRETS:        DEFAULT_SCAN_ACCESS = DENY
WORKFLOWS_ACTIVE:            ALLOWED
WORKFLOWS_BACKUP_SNAPSHOTS:  DENIED UNTIL CLEANUP
```

**Instância concreta declarada (`cursor-agentesdr-mcp`, 2026-08-08):** `workflows/` contém arquivos
de backup/snapshot **rastreados pelo git** cujo histórico carrega JWT `service_role` legado. Enquanto
a limpeza versionada já prevista não for aplicada, varredura de `workflows/` **exclui esses
subdiretórios** — os workflows ativos seguem liberados.

Consequência prática: um scan que precise de `workflows/` inteiro **para e reporta o bloqueio** em
vez de ler os backups. Cobertura perdida é declarada no relatório; segredo lido nunca é recuperável.

A limpeza é trabalho próprio, com autorização própria. Esta policy **registra a regra; não executa a
remoção**.

## 8. Herança

Esta policy vale para **todos os repositórios governados**, por herança do core — pelo mesmo
mecanismo de vendorização versionada de qualquer contrato (`MANIFEST.distribution`).

**Não se copia esta policy repositório por repositório.** Nove cópias divergindo em silêncio é
exatamente o problema que a vendorização curou. O repositório satélite consome o core vendorizado; o
que ele declara localmente é **configuração** (`.asb/security.json` — superfície e exigências), nunca
política.

## 9. Referências

| Tema | Onde |
|---|---|
| Papel do detector no fluxo (norma neutra) | `contracts/security-governance-contract.md` |
| Papéis, ciclo, thread, contenção, segredos | `contracts/agent-orchestration-contract.md` |
| Transporte do Executor remoto | `contracts/remote-executor-contract.md` |
| Configuração de superfície por repo | `.asb/security.json` + `schema/security-profile.schema.json` |
| Finding como registro de governança | `schema/security-finding.schema.json` |
| Ingestão de relatório de scanner | `adapters/<runtime>/security_review.py` |
| Acoplamentos declarados (nomes de ferramenta) | `MANIFEST.json` → `declared_soft_couplings` |
