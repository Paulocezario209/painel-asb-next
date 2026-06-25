import { theme } from "@/lib/theme";

// ── Design tokens — ASB brand (centralizado na Fase 3 da tipografia) ──────────
// Fonte por SIGNIFICADO: número = theme.font.num (mono + tabular) · texto = theme.font.label (sans).
// Cor/tamanho/espaçamento copiados 1:1 do S local que vivia em cada page.tsx.
export const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#e4e9f0", fontFamily: theme.font.label },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const, lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: theme.font.label, marginBottom: 12 } as React.CSSProperties,
  text:    { color: "#c8d8e8", fontSize: 12, fontFamily: theme.font.label } as React.CSSProperties,
  muted:   { color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label } as React.CSSProperties,
};
