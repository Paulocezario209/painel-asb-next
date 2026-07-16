import { theme } from "@/lib/theme";

// ── Design tokens — ASB "grafite total" (FONTE ÚNICA do Comercial) ────────────
// Fonte por SIGNIFICADO: número = theme.font.num (mono + tabular) · texto = theme.font.label (sans).
// v3 (2026-07-16): SUPERSET canônico. Toda tela do Comercial importa DESTE S —
// zero `const S` local. Card grafite elevado (float), label serigrafia (uppercase
// 11px), número grande mono, input grafite. Trocar aqui = trocar o painel inteiro.
export const S = {
  // superfície
  card:    { background: "var(--asb-card)", border: "1px solid var(--asb-border)", borderRadius: 14, boxShadow: "0 2px 6px rgba(20,22,40,.06), 0 20px 40px -22px rgba(20,22,40,.28)" } as React.CSSProperties,

  // escrita serigrafia (label uppercase) + texto
  label:   { fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase" as const, color: "#83879a", fontWeight: 700, fontFamily: theme.font.label } as React.CSSProperties,
  section: { fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#aeb7cc", fontWeight: 700, fontFamily: theme.font.label, marginBottom: 14 } as React.CSSProperties,
  text:    { color: "#c8d2e6", fontSize: 13, fontFamily: theme.font.label } as React.CSSProperties,
  muted:   { color: "#aeb7cc", fontSize: 12, fontFamily: theme.font.label } as React.CSSProperties,

  // números
  value:   { fontSize: 30, fontWeight: 850, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const, lineHeight: 1, letterSpacing: "-.02em" } as React.CSSProperties,
  num:     { fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const, color: "#FFFFFF" } as React.CSSProperties,

  // aliases KPI (compat com telas que usavam kpiLabel/kpiValue) — mesmos valores canônicos
  kpiLabel:{ fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase" as const, color: "#83879a", fontWeight: 700, fontFamily: theme.font.label } as React.CSSProperties,
  kpiValue:{ fontSize: 30, fontWeight: 850, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const, lineHeight: 1, letterSpacing: "-.02em" } as React.CSSProperties,

  // input grafite (formulários/filtros)
  input:   { width: "100%", background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)", borderRadius: 8, color: "#e6ebf5", fontSize: 12, fontFamily: theme.font.label, padding: "8px 11px", outline: "none", boxSizing: "border-box" as const } as React.CSSProperties,
};
