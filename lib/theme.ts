export const theme = {
  colors: {
    // Semânticas — NUNCA usar hex direto, sempre via theme
    critical:   "#C8102E",
    warning:    "#D4A017",
    success:    "#22c55e",
    neutral:    "#556677",
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
    textSecondary: "#556677",
    textMuted:     "#3a4a5a",

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
    mono: "'Courier New', monospace",
    sans: "inherit",
    // Fase 1 tipografia (token-driven): número = mono Geist · label/texto = sans Geist.
    num:   "var(--font-geist-mono), 'Courier New', monospace",
    label: "var(--font-geist-sans), system-ui, sans-serif",
  },
} as const;

export type ThemeColor = keyof typeof theme.colors;
