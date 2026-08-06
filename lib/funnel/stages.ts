// lib/funnel/stages.ts — FONTE ÚNICA do vocabulário de funnel_stage (fecha DEBT-157).
//
// Pipeline Canônica V3 (Passo 10, 2026-08-06 — docs/decisoes/2026_08_06_pipeline_canonica_v3_
// decisao_final.md §12.2/§12.4 no monorepo cursor-agentesdr-mcp): vocabulário renomeado
// (handoff→agendamento, lead_em_andamento→em_andamento, proposta_enviada→proposta) +
// conversão granular (pedido_1..4→cliente_recorrente, substitui o catch-all pedido_fechado).
//
// REGRA DE OURO (Paulo): a última transição MANUAL do vendedor é cadastro_cliente →
// aguardando_primeiro_pedido. A partir daí, pedido_1/pedido_2/pedido_3/pedido_4/
// cliente_recorrente são EXCLUSIVAMENTE automáticos via ARES (recompute_customer_stage,
// Passo 4) — nenhum botão, RPC ou drag do painel escreve esses valores. O board TERMINA
// em "Aguardando 1º Pedido" (antes terminava em "Convertido"/pedido_fechado).
//
// Regra de manutenção: etapa nova/renomeada/aposentada = mexer SÓ aqui.

// ── Vocabulário canônico V3 (15 etapas, ordem = jornada) ─────────────────────
export const STAGE_ORDER = [
  // Camada SDR — reconciliada com a ESCADA FERNANDO (2026-07-08): o CP só emite
  // atendido_sdr (qs1) → qualificacao_inicial (qs2-4) → lead_qualificado (qs7).
  "lead_novo",
  "atendido_sdr",
  "qualificacao_inicial",
  "lead_qualificado",
  // Camada LEAD (vendedor) — Pipeline V3 §12.2, bloco Pré-conversão
  "agendamento",
  "em_andamento",
  "negociacao",
  "proposta",
  "cadastro_cliente",
  "aguardando_primeiro_pedido",   // ÚLTIMA transição manual do vendedor (Paulo, Passo 10)
  // Camada CLIENTE (carteira) — Pipeline V3 §12.2, bloco Pós-conversão — 100% AUTOMÁTICO via ARES
  "pedido_1",
  "pedido_2",
  "pedido_3",
  "pedido_4",
  "cliente_recorrente",
] as const;
// Nota: "perda_solicitada" (Passo 11, §12.7) e "perdido" NÃO entram em STAGE_ORDER de
// propósito — são saídas/governança, não jornada de avanço (mesmo padrão de "perdido",
// que também nunca esteve aqui). Rótulo/cor/exclusão via STAGE_LABELS/STAGE_COLORS/NAO_ATIVO_STAGES.

export type Stage = (typeof STAGE_ORDER)[number];

// ── Aliases de LEGADO (direção ÚNICA e canônica — leitura apenas, nunca escritos) ──
// Cobre tanto os aliases pré-V3 (produto_definido/volume_definido) quanto os renomes
// da Pipeline V3 (handoff→agendamento etc. — Passo 4/5/6/7 já garantem que nenhum fluxo
// vivo escreve o valor antigo; aqui é só a ponte de LEITURA para timeline/funil histórico).
export const LEGACY_ALIAS: Record<string, Stage> = {
  // pré-V3
  produto_definido:      "qualificacao_inicial", // legacy escada antiga → SDR (Fernando, 2026-07-08)
  volume_definido:       "qualificacao_inicial", // legacy escada antiga → SDR (Fernando, 2026-07-08)
  cobertura_validada:    "qualificacao_inicial", // legacy/órfã
  pedido_teste:          "cadastro_cliente",     // Funil v3 (2026-07-16): substituído por cadastro_cliente
  // Pipeline V3 (Passo 10) — renomes
  handoff:               "agendamento",
  vendedor_assumiu:      "agendamento",          // alias técnico transitório (D5/§12.11) — mesma posição de handoff
  lead_em_andamento:     "em_andamento",
  diagnostico_comercial: "em_andamento",
  proposta_enviada:      "proposta",
  // Legado de conversão (pedido_fechado era o catch-all "1º pedido"; cliente_em_ativacao/
  // cliente_ativo eram a faixa "2º+ pedido → recorrência" — sem contraparte 1:1 exata no
  // esquema granular novo, mapeados no espírito de cada um: pedido_fechado = "já tem 1º
  // pedido" (fidelidade histórica, mesma decisão da migration SQL Passo 8); cliente_ativo/
  // cliente_em_ativacao = mesma faixa "recorrência" de cliente_recorrente).
  pedido_fechado:        "pedido_1",
  cliente_em_ativacao:   "cliente_recorrente",
  cliente_ativo:         "cliente_recorrente",
};

export const aliasLegacy = (s: string | null | undefined): string | null =>
  s ? (LEGACY_ALIAS[s] ?? s) : null;

// ── Conjunto CONVERTIDO (1ª compra confirmada) — projeção compartilhada Funil×Pipeline ──
// Pipeline V3 (Passo 10): "Convertido" não é mais 1 valor único (pedido_fechado) — é
// QUALQUER estágio pós-1º-pedido (pedido_1..4 + cliente_recorrente), automático via ARES.
// Legado (pedido_fechado/cliente_ativo/cliente_em_ativacao) mantido para fidelidade
// histórica de leads antigos — nenhum fluxo vivo escreve esses 3 valores há Passo 4/5.
export const CONVERTIDO_STAGES = [
  "pedido_1", "pedido_2", "pedido_3", "pedido_4", "cliente_recorrente",
  "pedido_fechado", "cliente_em_ativacao", "cliente_ativo",
] as const;
export const CONVERTIDO_SET = new Set<string>(CONVERTIDO_STAGES);

// ── Etapas TERMINAIS — NÃO são "lead ativo" (DEBT-287) ───────────────────────
// A aba/card "Ativos" (tela Leads) = leads AINDA no funil. Exclui os dois destinos
// terminais: CONVERTIDO (virou cliente → vive na Carteira, v_carteira_360) e
// lead_perdido/perdido (→ aba Perdidos). Sem isso, perdido conta em Ativos E em Perdidos.
// perda_solicitada (Passo 11): nem "ativo" no sentido de trabalho comercial normal (está
// congelado, aguardando decisão do gerente), nem "convertido"/"perdido" ainda — mesmo
// bucket de exclusão por ora (não conta como lead ativo trabalhável pelo vendedor).
export const NAO_ATIVO_STAGES = [...CONVERTIDO_STAGES, "lead_perdido", "perdido", "perda_solicitada"] as const;

// ── Rótulos de exibição (canônicos V3 + legados p/ timeline histórica) ──────
export const STAGE_LABELS: Record<string, string> = {
  lead_novo:              "Lead Novo",
  atendido_sdr:           "Atendido SDR",
  qualificacao_inicial:   "Qualif. Inicial",
  cobertura_validada:     "Cobertura Valid.",      // legacy/órfã — só timeline histórica
  produto_definido:       "Produto Definido",      // legacy → aliased (só timeline)
  volume_definido:        "Volume Definido",       // legacy → aliased (só timeline)
  lead_qualificado:       "Lead Qualificado",
  agendamento:            "Agendamento",
  handoff:                "Agendamento",           // legacy → aliased (só timeline)
  vendedor_assumiu:       "Vendedor Assumiu",      // legacy → aliased (só timeline)
  diagnostico_comercial:  "Diag. Comercial",       // legacy → aliased (só timeline)
  em_andamento:           "Em Andamento",
  lead_em_andamento:      "Em Andamento",          // legacy → aliased (só timeline)
  negociacao:             "Negociação",
  proposta:               "Proposta",
  proposta_enviada:       "Proposta",              // legacy → aliased (só timeline)
  cadastro_cliente:       "Cadastro do Cliente",
  pedido_teste:           "Pedido Teste",          // legacy/deprecado → só timeline histórica + rollback
  aguardando_primeiro_pedido: "Aguardando 1º Pedido",
  pedido_1:               "1º Pedido",
  pedido_2:               "2º Pedido",
  pedido_3:               "3º Pedido",
  pedido_4:               "4º Pedido",
  cliente_recorrente:     "Cliente Recorrente",
  pedido_fechado:         "1º Pedido (legado)",    // legacy → aliased (só timeline)
  cliente_em_ativacao:    "Recorrente (legado)",   // legacy → aliased (só timeline)
  cliente_ativo:          "Recorrente (legado)",   // legacy → aliased (só timeline)
  lead_perdido:           "Perdidos",              // LATERAL
  perdido:                "Perdidos",              // LATERAL — Pipeline V3, mesmo destino
  perda_solicitada:       "Aguardando Aprovação",  // Passo 11 — fila do gerente, §12.7
};

export const stageLabel = (s: string | null | undefined): string =>
  (s && STAGE_LABELS[s]) || s || "?";

// ── Cores semânticas por etapa (badge + board — cor com propósito) ───────────
export const STAGE_COLORS: Record<string, string> = {
  lead_novo:             "#c0d0e0",
  atendido_sdr:          "#c0d0e0",
  qualificacao_inicial:  "#6390f5",
  cobertura_validada:    "#6390f5",
  produto_definido:      "#6390f5",
  volume_definido:       "#6390f5",
  lead_qualificado:      "#f59e0b",
  agendamento:           "#f59e0b",
  handoff:               "#f59e0b",
  vendedor_assumiu:      "#eab308",
  diagnostico_comercial: "#eab308",
  em_andamento:          "#eab308",
  lead_em_andamento:     "#eab308",
  negociacao:            "#a855f7",
  proposta:              "#8b5cf6",
  proposta_enviada:      "#8b5cf6",
  cadastro_cliente:      "#3b82f6",   // Funil v3 — ocupa a posição/cor da antiga "pedido_teste"
  pedido_teste:          "#3b82f6",   // legacy (timeline)
  aguardando_primeiro_pedido: "#0ea5e9",
  pedido_1:              "#22c55e",
  pedido_2:              "#22c55e",
  pedido_3:              "#22c55e",
  pedido_4:              "#22c55e",
  cliente_recorrente:    "#22c55e",
  pedido_fechado:        "#22c55e",
  cliente_em_ativacao:   "#22c55e",
  cliente_ativo:         "#22c55e",
  lead_perdido:          "#C8102E",
  perdido:               "#C8102E",
  perda_solicitada:      "#f59e0b",  // amarelo — pendente, distinto do vermelho de perdido confirmado
};

// ── Pipeline (board Kanban do vendedor) ──────────────────────────────────────
// Colunas na ordem do fluxo. agendamento = origem (não-destino de drag).
// TERMINA em aguardando_primeiro_pedido (Passo 10) — nunca em pedido_1+ (automático via ARES,
// o lead SAI do board assim que ares_confirmado=true — ver pipeline/page.tsx "graduação").
export const PIPELINE_STAGES = [
  "agendamento", "em_andamento", "negociacao", "proposta",
  "cadastro_cliente", "aguardando_primeiro_pedido", "lead_perdido",
] as const;

// Destinos válidos de drag (cada um → 1 RPC). Compartilhado board ↔ API route.
export const MOVIVEIS = new Set([
  "em_andamento", "negociacao", "proposta", "cadastro_cliente",
  "aguardando_primeiro_pedido", "lead_perdido",
]);

// Etapas "em aberto" do pipeline (base dos KPIs de ativos).
// Cadastro/Aguardando são PRÉ-pedido → ainda ativos (conversão real vem do ARES).
export const PIPELINE_ATIVOS = new Set([
  "agendamento", "em_andamento", "negociacao", "proposta", "cadastro_cliente", "aguardando_primeiro_pedido",
]);

// DEBT-318 (SDR): taxonomia única de motivo (ficha + pipeline). Os "quentes" (sabor,
// concorrente, lealdade, pagamento) auto-sugerem ENCOSTO no modal de encerramento.
export const LOST_REASONS = [
  "Preço", "Pagamento / prazo", "Sabor / produto", "Comprou concorrente",
  "Lealdade / incumbente", "Logística", "Sem orcamento", "Sem interesse",
  "Sem retorno", "Fora de rota", "Outro",
];
export const ENCOSTO_SUGERIDO = new Set([
  "Sabor / produto", "Comprou concorrente", "Lealdade / incumbente", "Pagamento / prazo",
]);

// ── Trava sequencial da Pipeline (Paulo 2026-07-17, atualizada Passo 10) ─────
// Vendedor move MANUAL, mas só 1 passo por vez (sem PULAR e sem VOLTAR). Marcar
// "Perdido" é sempre permitido (saída de qualquer etapa, com motivo). GESTOR move
// livre (frente/trás/pula) — é o override. TERMINA em aguardando_primeiro_pedido —
// não existe "próxima etapa" manual depois disso (pedido_1+ é 100% automático via ARES).
export const PROXIMA_ETAPA: Record<string, string> = {
  agendamento: "em_andamento",
  em_andamento: "negociacao",
  negociacao: "proposta",
  proposta: "cadastro_cliente",
  cadastro_cliente: "aguardando_primeiro_pedido",
};
// Alias de etapas legadas → etapa do board (mesma régua que o BOARD_ALIAS do pipeline).
const _SEQ_ALIAS: Record<string, string> = {
  handoff: "agendamento",
  vendedor_assumiu: "agendamento",
  lead_em_andamento: "em_andamento",
  diagnostico_comercial: "em_andamento",
  proposta_enviada: "proposta",
  pedido_teste: "cadastro_cliente",
};
/** Vendedor pode mover de `from` → `to`? (trava sequencial; gestor NÃO passa por aqui). */
export function vendedorPodeMover(fromStage: string | null | undefined, toStage: string): boolean {
  if (toStage === "lead_perdido") return true;                 // perdido: saída sempre liberada (com motivo)
  const from = _SEQ_ALIAS[fromStage ?? ""] ?? fromStage ?? "agendamento";
  return PROXIMA_ETAPA[from] === toStage;                       // só o PRÓXIMO passo
}

// Ordem linear do pipeline (p/ detectar RETROCESSO). lead_perdido não entra (é saída).
const _SEQ_ORDER = ["agendamento", "em_andamento", "negociacao", "proposta", "cadastro_cliente", "aguardando_primeiro_pedido"];
/** É movimento pra TRÁS? (gestor volta via RPC própria — as de avanço são forward-only). */
export function ehRetrocesso(fromStage: string | null | undefined, toStage: string): boolean {
  if (toStage === "lead_perdido") return false;
  const from = _SEQ_ALIAS[fromStage ?? ""] ?? fromStage ?? "";
  const to = _SEQ_ALIAS[toStage] ?? toStage;
  const i = _SEQ_ORDER.indexOf(from), j = _SEQ_ORDER.indexOf(to);
  return i >= 0 && j >= 0 && j < i;
}

// ── Funil (cone de 4 fases — agrega funnel_stage CRU, cobre legados) ─────────
export const FASES = [
  { key: "qualificacao", label: "Em qualificação", fill: "#185FA5",
    stages: ["lead_novo", "atendido_sdr", "qualificacao_inicial", "produto_definido", "volume_definido"] },
  { key: "qualificado",  label: "Qualificado",     fill: "#185FA5",
    stages: ["lead_qualificado"] },
  { key: "com_vendedor", label: "Com vendedor",    fill: "#D4A017",
    stages: [
      "agendamento", "handoff", "em_andamento", "lead_em_andamento", "vendedor_assumiu",
      "diagnostico_comercial", "negociacao", "proposta", "proposta_enviada",
      "cadastro_cliente", "pedido_teste", "aguardando_primeiro_pedido",
    ] },
  { key: "convertido",   label: "Convertido (1ª compra)", fill: "#22c55e",
    stages: [...CONVERTIDO_STAGES] },
] as const;

// ── Alias reverso: etapa canônica → todos os funnel_stage CRUS que projetam nela ──
// Usado no drill "por etapa" (Funil → Leads): o card do Funil conta por etapa aliased
// (stageCounts), então a lista de Leads precisa filtrar pelos MESMOS stages crus p/ o
// número do card bater com a lista. Ex.: em_andamento inclui os legados
// lead_em_andamento/vendedor_assumiu/diagnostico_comercial. Deriva de LEGACY_ALIAS (fonte única).
export const RAW_STAGES_FOR: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {};
  for (const s of STAGE_ORDER) m[s] = [s];
  for (const [legacy, canon] of Object.entries(LEGACY_ALIAS)) {
    (m[canon] ??= [canon]).push(legacy);
  }
  return m;
})();
export const rawStagesFor = (canonical: string): string[] => RAW_STAGES_FOR[canonical] ?? [canonical];
