export const theme = {
  colors: {
    // Semânticas — NUNCA usar hex direto, sempre via theme
    critical:   "#C8102E",
    warning:    "#D4A017",
    success:    "#22c55e",
    neutral:    "#e4e9f0",
    brandAsb:   "#185FA5",
    brandCnb:   "#D85A30",
    brandCuit:  "#9333ea",

    // Superfícies
    bgBase:     "#0f1117",
    bgElevated: "#1a1a2e",
    bgCard:     "#1a1a2e",
    bgModal:    "#0f1117",

    // Bordas
    borderSubtle:  "#1e2a35",
    borderDefault: "#2a2a2a",

    // Texto
    textPrimary:   "#c0c8d8",
    textSecondary: "#e4e9f0",
    textMuted:     "#e4e9f0",

    // Específicos já usados no painel
    accent:     "#ff7b1c",
    accentBlue: "#185FA5",

    // Gráficos / marketing (séries) — tokenizados na migração de cores marketing
    chartNavy:      "#2A3F8F",  // ex-BLUE
    chartNavyLight: "#8bb4ff",  // ex-azul claro (Leads/qualif)
    chartYellow:    "#e8b923",  // ex-YELLOW (handoffs)
    gridLine:       "rgba(27,42,107,.35)",  // linha de grade dos charts
  },
  font: {
    mono: "var(--font-geist-sans), system-ui, sans-serif",
    sans: "inherit",
    // Tipografia: número = mono Geist (tabular) · label/texto = sans Geist. Sem Courier.
    num:   "var(--font-geist-mono), ui-monospace, monospace",
    label: "var(--font-geist-sans), system-ui, sans-serif",
  },
} as const;

export type ThemeColor = keyof typeof theme.colors;
