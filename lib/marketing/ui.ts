// lib/marketing/ui.ts — FONTE ÚNICA do workspace Marketing (auditoria 2026-07-10).
import type React from "react";
// Antes: fmtBRLc copiado em 4 clients, MESES/fmtMes em 4, CANAL_COR em 2, aliases de
// theme redeclarados nos 5, tooltip/axis em 4, th/td em 2, tipos da mesma view com
// shapes divergentes. Valores abaixo = os EXATOS que estavam duplicados (zero mudança
// visual); só ganharam os canais novos vivos no banco (google, indicacao — check 10/07).
import { theme } from "@/lib/theme";

// aliases de tema usados pelo workspace inteiro
export const RED = theme.colors.critical;       // #C8102E
export const BLUE = theme.colors.chartNavy;     // #2A3F8F
export const GREEN = theme.colors.success;      // #22c55e
export const YELLOW = theme.colors.chartYellow; // #e8b923
export const MUT = theme.colors.neutral;        // #e4e9f0
export const GRID = theme.colors.gridLine;

// canais vivos nas views (verificado no banco 2026-07-10)
export const CANAL_COR: Record<string, string> = {
  "instagram (ctwa)": RED,
  "google": theme.colors.chartNavyLight,
  "site (lp)": BLUE,
  "organico": GREEN,
  "indicacao": YELLOW,
};
export const CANAL_ORDEM = ["instagram (ctwa)", "google", "site (lp)", "organico", "indicacao"];
// canal novo/desconhecido ordena por ÚLTIMO (antes indexOf -1 jogava pra frente)
export const ordemCanal = (canal: string | null | undefined) => {
  const i = CANAL_ORDEM.indexOf(canal ?? "");
  return i === -1 ? CANAL_ORDEM.length : i;
};

export function fmtBRL(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
export function fmtBRLc(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export function fmtMes(iso: string) {
  const m = Number(iso.slice(5, 7)) - 1;
  return MESES[m] ?? iso.slice(0, 7);
}

// props Recharts compartilhadas (spread em <Tooltip {...tooltipStyle} />)
export const tooltipStyle = {
  contentStyle: { background: "#1a1a1a", border: `1px solid ${RED}`, borderRadius: 3, fontSize: 11, fontFamily: theme.font.num, color: "#c8d8e8" },
  itemStyle: { color: "#c8d8e8" },
  labelStyle: { color: MUT, fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase" as const },
};
export const axisStyle = { fontSize: 10, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const, fill: MUT };

// períodos da v_ranking_criativo (v3 — os 5 existem no banco, verificado 10/07)
export const PERIODOS_RANKING = ["30d", "60d", "90d", "6m", "12m"] as const;

// estilos de tabela compartilhados (antes duplicados em anuncios + funil-cac)
export const th: React.CSSProperties = { fontSize: 9, color: "#e4e9f0", fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", padding: "6px 10px", textAlign: "center" };
export const td: React.CSSProperties = { padding: "8px 10px", color: "#c8d8e8", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" };

// tipo único da v_cac_mensal_canal (telas usam Pick<> quando leem menos colunas)
export type CacMensalRow = {
  mes: string; canal: string;
  leads: number; convertidos: number; receita_brl: number;
  gasto_total: number; cac_por_lead: number | null; roas: number | null;
};
