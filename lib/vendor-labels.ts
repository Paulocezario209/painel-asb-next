// lib/vendor-labels.ts — FONTE ÚNICA do mapa routing_team → nome de exibição.
//
// Antes vivia copiado/hardcoded em 10+ arquivos (home, pipeline, leads-table,
// agendamentos-table, followups-table, insights, card-reconciliar-ares,
// dashboard-filters, vendas/*, gerente, vendedores) — e o hot-leads fazia
// replace("SETOR_","") manual. Vendedor novo/troca de nome = mexer SÓ aqui.
//
// Futuro (opcional): buscar da tabela `vendors` (source of truth de roteamento)
// via cache — hoje o time muda raro o suficiente para constante compartilhada.

export const VENDOR_LABELS: Record<string, string> = {
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula",
  SETOR_CAMPINAS_JUNDIAI:   "Alan",
  SETOR_CUIT:               "CUIT",
};

// Ordem canônica de exibição (cards/rankings).
export const VENDOR_ORDER = [
  "SETOR_SOROCABA_SAO_PAULO",
  "SETOR_CAMPINAS_JUNDIAI",
  "SETOR_CUIT",
] as const;

// Nome de exibição com fallback legível para setores desconhecidos/novos.
export const vendorLabel = (routingTeam: string | null | undefined): string => {
  if (!routingTeam) return "—";
  return VENDOR_LABELS[routingTeam] ?? routingTeam.replace(/^SETOR_/, "").replaceAll("_", " ");
};
