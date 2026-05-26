// Tokens de UI da camada Custos (alinha design system do painel).
export const C = {
  bg: "#0d1117", card: "#0f1428", card2: "#0b0f1d", borda: "#1B2A6B", azul: "#1B2A6B",
  verde: "#2ea043", texto: "#c8d8e8", branco: "#FFFFFF", mut: "#8899aa", mut2: "#556677",
  verde2: "#22C55E", amarelo: "#EAB308", laranja: "#F97316", vermelho: "#EF4444",
};
export const mono = "'Courier New', monospace";

export const sCard: React.CSSProperties = { background: C.card, border: `1px solid ${C.borda}`, borderRadius: 6 };
export const sLabel: React.CSSProperties = { fontSize: 9, color: C.mut2, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" };
export const sInput: React.CSSProperties = { background: C.card2, border: `1px solid ${C.borda}`, borderRadius: 4, color: C.branco, fontFamily: mono, fontSize: 12, padding: "7px 9px", width: "100%" };
export const btn = (on = true): React.CSSProperties => ({ background: on ? C.verde : C.azul, border: "none", color: "#fff", padding: "8px 16px", borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: mono, cursor: on ? "pointer" : "not-allowed", letterSpacing: ".05em", textTransform: "uppercase" });
export const btnGhost: React.CSSProperties = { background: "transparent", border: `1px solid ${C.borda}`, color: C.mut, padding: "8px 14px", borderRadius: 4, fontSize: 11, fontFamily: mono, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
