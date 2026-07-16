// Tokens de UI da camada Custos (alinha design system do painel).
import { theme } from "@/lib/theme";
// v2 (2026-07-16): elevado ao padrao grafite sobre claro (cards grafite + borda branca sutil).
export const C = {
  bg: "var(--asb-page-2)", card: "var(--asb-card)", card2: "var(--asb-card-hi)", borda: "var(--asb-border)", azul: "#2A3F8F",
  verde: "#2ea043", texto: "#c8d2e6", branco: "#FFFFFF", mut: "#aeb7cc", mut2: "#c8d2e6",
  verde2: "#22C55E", amarelo: "#EAB308", laranja: "#F97316", vermelho: "#EF4444",
};
export const mono = theme.font.num; // Geist Mono (tabular)

export const sCard: React.CSSProperties = { background: C.card, border: `1px solid ${C.borda}`, borderRadius: 14, boxShadow: "0 2px 6px rgba(20,22,40,.06), 0 20px 40px -22px rgba(20,22,40,.28)" };
export const sLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#83879a", fontFamily: theme.font.label, letterSpacing: ".06em", textTransform: "uppercase" };
export const sInput: React.CSSProperties = { background: C.card2, border: `1px solid ${C.borda}`, borderRadius: 4, color: C.branco, fontFamily: theme.font.label, fontSize: 12, padding: "7px 9px", width: "100%" };
export const btn = (on = true): React.CSSProperties => ({ background: on ? C.verde : C.azul, border: "none", color: "#fff", padding: "8px 16px", borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: theme.font.label, cursor: on ? "pointer" : "not-allowed", letterSpacing: ".05em", textTransform: "uppercase" });
export const btnGhost: React.CSSProperties = { background: "transparent", border: `1px solid ${C.borda}`, color: C.mut, padding: "8px 14px", borderRadius: 4, fontSize: 11, fontFamily: theme.font.label, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
