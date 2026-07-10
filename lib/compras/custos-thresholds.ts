// lib/compras/custos-thresholds.ts — FONTE ÚNICA dos números de threshold de custo/kg (DEBT-255).
// Fonte OFICIAL em runtime é a tabela custos_alerta_config; estes valores são o FALLBACK
// quando a config não responde. Antes havia 4 cópias hardcoded (classificar.ts, nivel.ts,
// dashboard-custos.tsx, custos-template.ts) — risco de drift. Mudou o fallback? SÓ aqui.

export const CUSTO_KG_THR = { ideal: 18, atencao: 19, alerta: 20 } as const;

// Paleta única dos níveis de custo (client STATUS_COR e server COR derivam daqui).
export const CUSTO_NIVEL_COR = {
  ideal: "#22C55E",
  atencao: "#EAB308",
  alerta: "#F97316",
  critico: "#EF4444",
} as const;
