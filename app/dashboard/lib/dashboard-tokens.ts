import { theme } from "@/lib/theme";

// ── Design tokens — ASB brand (centralizado na Fase 3 da tipografia) ──────────
// Fonte por SIGNIFICADO: número = theme.font.num (mono + tabular) · texto = theme.font.label (sans).
// Cor/tamanho/espaçamento copiados 1:1 do S local que vivia em cada page.tsx.
// v2 (2026-07-16): tokens elevados ao padrao "grafite sobre claro" (Dashboard = referencia).
// Card grafite com float; labels/section maiores e legiveis; numero grande.
export const S = {
  card:    { background: "var(--asb-card)", border: "1px solid var(--asb-border)", borderRadius: 14, boxShadow: "0 2px 6px rgba(20,22,40,.06), 0 20px 40px -22px rgba(20,22,40,.28)" } as React.CSSProperties,
  label:   { fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase" as const, color: "#83879a", fontWeight: 700, fontFamily: theme.font.label },
  value:   { fontSize: 30, fontWeight: 850, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const, lineHeight: 1, letterSpacing: "-.02em" },
  section: { fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#aeb7cc", fontWeight: 700, fontFamily: theme.font.label, marginBottom: 14 } as React.CSSProperties,
  text:    { color: "#c8d2e6", fontSize: 13, fontFamily: theme.font.label } as React.CSSProperties,
  muted:   { color: "#aeb7cc", fontSize: 12, fontFamily: theme.font.label } as React.CSSProperties,
};
