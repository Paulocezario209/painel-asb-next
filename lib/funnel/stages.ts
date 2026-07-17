// lib/funnel/stages.ts — FONTE ÚNICA do vocabulário de funnel_stage (fecha DEBT-157).
//
// Antes deste módulo o vocabulário vivia copiado em 7 arquivos (funil/page,
// pipeline/page, pipeline-board, api/pipeline/move, funnel-stage-badge,
// leads-table, perdidos-list) com aliases DIVERGENTES — funil colapsava
// pedido_fechado→cliente_em_ativacao enquanto pipeline colapsava
// cliente_*→pedido_fechado. Na prática ambos projetam o MESMO conjunto
// (CONVERTIDO_STAGES) em camadas de exibição diferentes; este módulo torna
// isso explícito: aliases de LEGADO são únicos e canônicos, e cada tela
// agrupa para exibição a partir das constantes daqui.
//
// Regra de manutenção: etapa nova/renomeada/aposentada = mexer SÓ aqui.

// ── Vocabulário canônico v2 (12 etapas, ordem = jornada) ─────────────────────
export const STAGE_ORDER = [
  // Camada SDR — reconciliada com a ESCADA FERNANDO (2026-07-08): o CP só emite
  // atendido_sdr (qs1) → qualificacao_inicial (qs2-4) → lead_qualificado (qs7).
  "lead_novo",
  "atendido_sdr",
  "qualificacao_inicial",
  "lead_qualificado",
  "handoff",
  // Camada LEAD (vendedor)
  "lead_em_andamento",
  "negociacao",
  "proposta_enviada",
  "cadastro_cliente",   // Funil v3 (2026-07-16): substitui "pedido_teste" na etapa 5 (pré-pedido,
                        // documentação padrão ASB). NÃO converte — conversão fica 100% no ARES.
  // Camada CLIENTE (carteira)
  "cliente_em_ativacao",
  "cliente_ativo",
  "cliente_recorrente",
] as const;

export type Stage = (typeof STAGE_ORDER)[number];

// ── Aliases de LEGADO (direção ÚNICA e canônica — ponte até a Fase 3 do Funil v2) ──
// Só entram aqui os colapsos em que todas as telas CONCORDAM. O par contestado
// (pedido_fechado ↔ cliente_em_ativacao) NÃO é alias: é projeção de exibição —
// use CONVERTIDO_STAGES.
export const LEGACY_ALIAS: Record<string, Stage> = {
  vendedor_assumiu:      "lead_em_andamento",    // legacy → LEAD
  diagnostico_comercial: "lead_em_andamento",    // legacy → LEAD
  produto_definido:      "qualificacao_inicial", // legacy escada antiga → SDR (Fernando, 2026-07-08)
  volume_definido:       "qualificacao_inicial", // legacy escada antiga → SDR (Fernando, 2026-07-08)
};

export const aliasLegacy = (s: string | null | undefined): string | null =>
  s ? (LEGACY_ALIAS[s] ?? s) : null;

// ── Conjunto CONVERTIDO (1ª compra) — projeção compartilhada Funil×Pipeline ──
// Redesenho 2026-07-09 (decisão Paulo): pipeline TERMINA na conversão.
// pedido_fechado (legacy de fechamento) e os 3 stages de cliente contam JUNTOS
// como "Convertido" nas duas telas — a camada cliente vive na carteira real
// (v_carteira_360), não no funnel_stage.
export const CONVERTIDO_STAGES = [
  "pedido_fechado", "cliente_em_ativacao", "cliente_ativo", "cliente_recorrente",
] as const;
export const CONVERTIDO_SET = new Set<string>(CONVERTIDO_STAGES);

// ── Etapas TERMINAIS — NÃO são "lead ativo" (DEBT-287) ───────────────────────
// A aba/card "Ativos" (tela Leads) = leads AINDA no funil. Exclui os dois destinos
// terminais: CONVERTIDO (virou cliente → vive na Carteira, v_carteira_360) e
// lead_perdido (→ aba Perdidos). Sem isso, perdido conta em Ativos E em Perdidos
// (presença dupla — mesma classe do vazamento de convertido, DEBT-285/286 Fase 1.1).
export const NAO_ATIVO_STAGES = [...CONVERTIDO_STAGES, "lead_perdido"] as const;

// ── Rótulos de exibição (19 — canônicos + legados p/ timeline histórica) ─────
export const STAGE_LABELS: Record<string, string> = {
  lead_novo:              "Lead Novo",
  atendido_sdr:           "Atendido SDR",
  qualificacao_inicial:   "Qualif. Inicial",
  cobertura_validada:     "Cobertura Valid.",      // legacy/órfã — só timeline histórica
  produto_definido:       "Produto Definido",      // legacy → aliased (só timeline)
  volume_definido:        "Volume Definido",       // legacy → aliased (só timeline)
  lead_qualificado:       "Lead Qualificado",
  handoff:                "Agendamento",
  vendedor_assumiu:       "Vendedor Assumiu",      // legacy → aliased (só timeline)
  diagnostico_comercial:  "Diag. Comercial",       // legacy → aliased (só timeline)
  lead_em_andamento:      "Lead em Andamento",
  negociacao:             "Negociacao",
  proposta_enviada:       "Proposta Enviada",
  cadastro_cliente:       "Cadastro do Cliente",   // Funil v3 (etapa 5, pré-pedido)
  pedido_teste:           "Pedido Teste",          // legacy/deprecado → só timeline histórica + rollback
  pedido_fechado:         "Pedido Fechado",        // projeção: conta em CONVERTIDO
  cliente_em_ativacao:    "Cliente em Ativacao",
  cliente_ativo:          "Cliente Ativo",
  cliente_recorrente:     "Cliente Recorrente",
  lead_perdido:           "Perdidos",              // LATERAL
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
  handoff:               "#f59e0b",
  vendedor_assumiu:      "#eab308",
  diagnostico_comercial: "#eab308",
  lead_em_andamento:     "#eab308",
  negociacao:            "#a855f7",
  proposta_enviada:      "#8b5cf6",
  cadastro_cliente:      "#3b82f6",   // Funil v3 — ocupa a posição/cor da antiga "pedido_teste"
  pedido_teste:          "#3b82f6",   // legacy (timeline)
  pedido_fechado:        "#22c55e",
  cliente_em_ativacao:   "#22c55e",
  cliente_ativo:         "#22c55e",
  cliente_recorrente:    "#22c55e",
  lead_perdido:          "#C8102E",
};

// ── Pipeline (board Kanban do vendedor) ──────────────────────────────────────
// Colunas na ordem do fluxo. agendamento = origem (não-destino de drag).
export const PIPELINE_STAGES = [
  "handoff", "lead_em_andamento", "negociacao", "proposta_enviada",
  "cadastro_cliente", "pedido_fechado", "lead_perdido",
] as const;

// Destinos válidos de drag (cada um → 1 RPC). Compartilhado board ↔ API route.
export const MOVIVEIS = new Set([
  "lead_em_andamento", "negociacao", "proposta_enviada", "cadastro_cliente",
  "pedido_fechado", "lead_perdido",
]);

// Etapas "em aberto" do pipeline (base dos KPIs de ativos).
// Cadastro é PRÉ-pedido → ainda ativo (o lead não converteu; conversão vem do ARES).
export const PIPELINE_ATIVOS = new Set([
  "handoff", "lead_em_andamento", "negociacao", "proposta_enviada", "cadastro_cliente",
]);

export const LOST_REASONS = [
  "Sem orcamento", "Comprou concorrente", "Sem interesse", "Sem retorno", "Outro",
];

// ── Funil (cone de 4 fases — agrega funnel_stage CRU, cobre legados) ─────────
export const FASES = [
  { key: "qualificacao", label: "Em qualificação", fill: "#185FA5",
    stages: ["lead_novo", "atendido_sdr", "qualificacao_inicial", "produto_definido", "volume_definido"] },
  { key: "qualificado",  label: "Qualificado",     fill: "#185FA5",
    stages: ["lead_qualificado"] },
  { key: "com_vendedor", label: "Com vendedor",    fill: "#D4A017",
    stages: ["handoff", "lead_em_andamento", "vendedor_assumiu", "diagnostico_comercial", "negociacao", "proposta_enviada", "cadastro_cliente", "pedido_teste"] },
  { key: "convertido",   label: "Convertido (1ª compra)", fill: "#22c55e",
    stages: [...CONVERTIDO_STAGES] },
] as const;

// ── Alias reverso: etapa canônica → todos os funnel_stage CRUS que projetam nela ──
// Usado no drill "por etapa" (Funil → Leads): o card do Funil conta por etapa aliased
// (stageCounts), então a lista de Leads precisa filtrar pelos MESMOS stages crus p/ o
// número do card bater com a lista. Ex.: lead_em_andamento inclui os legados
// vendedor_assumiu/diagnostico_comercial. Deriva de LEGACY_ALIAS (fonte única).
export const RAW_STAGES_FOR: Record<string, string[]> = (() => {
  const m: Record<string, string[]> = {};
  for (const s of STAGE_ORDER) m[s] = [s];
  for (const [legacy, canon] of Object.entries(LEGACY_ALIAS)) {
    (m[canon] ??= [canon]).push(legacy);
  }
  return m;
})();
export const rawStagesFor = (canonical: string): string[] => RAW_STAGES_FOR[canonical] ?? [canonical];
