// Régua ABSOLUTA de saúde de cliente (DEBT-176 3a/3b). Fonte única dos labels/cores das 6 faixas.
// customer_status vem de v_cliente_360 (fn_status_cliente). Cores = tokens do design system (theme).
import { theme } from "@/lib/theme";

export const CUSTOMER_STATUS: Record<string, { label: string; color: string; desc: string }> = {
  ativo:              { label: "ATIVO",              color: theme.colors.success,  desc: "≤7d sem comprar" },
  atencao:            { label: "ATENÇÃO",            color: theme.colors.warning,  desc: "8–14d sem comprar" },
  risco:              { label: "RISCO",              color: theme.colors.accent,   desc: "15–21d sem comprar" },
  pre_churn:          { label: "PRÉ-CHURN",          color: theme.colors.brandCnb, desc: "22–30d sem comprar" },
  churn_comercial:    { label: "CHURN COMERCIAL",    color: theme.colors.critical, desc: "31–59d sem comprar" },
  inativo_definitivo: { label: "INATIVO DEFINITIVO", color: theme.colors.neutral,  desc: "≥60d sem comprar" },
  // aba COMPLETA (carteira vinculada): cliente atribuído ao vendedor sem faturado na carteira ativa.
  sem_movimentacao:   { label: "SEM MOVIMENTAÇÃO",  color: theme.colors.textMuted, desc: "vinculado, sem faturado na carteira ativa" },
};

// estados de churn (telas de churn/risco) — ordem de severidade
export const CHURN_STATES = ["risco", "pre_churn", "churn_comercial", "inativo_definitivo"] as const;
// chips de filtro (carteira) — todos os 6 + "all"
export const STATUS_FILTER_KEYS = ["ativo", "atencao", "risco", "pre_churn", "churn_comercial", "inativo_definitivo"] as const;

export const STATUS_NEUTRO = theme.colors.textMuted; // sem vínculo ares (sem dado)

export function statusColor(s: string | null | undefined): string {
  return (s && CUSTOMER_STATUS[s]?.color) || STATUS_NEUTRO;
}
export function statusLabel(s: string | null | undefined): string {
  return (s && CUSTOMER_STATUS[s]?.label) || "—";
}
