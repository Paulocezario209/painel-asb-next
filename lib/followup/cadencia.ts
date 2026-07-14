// lib/followup/cadencia.ts — FONTE ÚNICA do vocabulário de cadência de follow-up.
//
// "Em cadência" = automação de follow-up nutrindo o lead, com próximo toque agendado.
// O board de Follow-up (components/followups/cadencia-board) LISTA este conjunto;
// a aba Ativos (tela Leads) o EXCLUI — os dois derivam da MESMA definição (a view
// v_leads_cadencia no banco + estas fases aqui na UI), sem drift. DEBT-288.
//
// Fase 'confirmed' (vendedor assumiu) NÃO é cadência automática → fica em Ativos/Pipeline.

// Fases da cadência automática, na ordem da jornada (recente → nutrição longa).
export const CADENCIA_PHASES = ["active", "post_active", "monthly", "semestral"] as const;
export type CadenciaPhase = (typeof CADENCIA_PHASES)[number];

// Rótulo humano por fase (board + filtros).
export const CADENCIA_PHASE_LABEL: Record<string, string> = {
  active:      "Retomada",
  post_active: "Pós-ativo",
  monthly:     "Mensal",
  semestral:   "Semestral",
};

// Descrição curta (o que cada fase significa — usado no board e no manual).
export const CADENCIA_PHASE_DESC: Record<string, string> = {
  active:      "Reengajamento recente — sumiu, cadência tentando retomar",
  post_active: "Logo após a fase ativa — última leva antes da nutrição longa",
  monthly:     "Nutrição mensal — mantém aquecido sem pressionar",
  semestral:   "Nutrição semestral — presença de longo prazo",
};

// Cor de acento por fase (mesma paleta ASB — recente = âmbar, longo = azul frio).
export const CADENCIA_PHASE_COLOR: Record<string, string> = {
  active:      "#f59e0b",
  post_active: "#fb923c",
  monthly:     "#38bdf8",
  semestral:   "#6390f5",
};
