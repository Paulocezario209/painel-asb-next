import type { CSSProperties } from "react";

// Tokens do design-system (padrão Inteligência) — camada de comando: card elevado + glow sutil.
const glow = (hex: string): CSSProperties => ({ boxShadow: `0 0 22px -8px ${hex}, inset 0 1px 0 0 ${hex}1a` });
const S = {
  card: { background: "#16161c", border: "1px solid #2a2a35", borderRadius: 8 } as CSSProperties,
  label: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#556677", fontFamily: "'Courier New', monospace" } as CSSProperties,
  value: { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 } as CSSProperties,
  muted: { color: "#8899aa", fontSize: 10, fontFamily: "'Courier New', monospace" } as CSSProperties,
};

const brl = (n: number) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export type CarteiraKpis = { total: number; atencao: number; ativos: number; cesta: number };

export function CarteiraKpisRow({ kpis }: { kpis: CarteiraKpis }) {
  const cards = [
    { label: "Na Carteira", value: String(kpis.total), accent: "#185FA5", sub: "ativos + em atenção · recorrentes" },
    { label: "Em Atenção", value: String(kpis.atencao), accent: "#f59e0b", sub: "8–14d sem comprar" },
    { label: "Cesta Projetada 90d", value: brl(kpis.cesta), accent: "#C8102E", sub: "soma das cestas" },
    { label: "Ativos", value: String(kpis.ativos), accent: "#22c55e", sub: "≤7d sem comprar" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} style={{ ...S.card, ...glow(c.accent), padding: 20, borderTop: `2px solid ${c.accent}` }}>
          <p style={{ ...S.label, color: c.accent }}>{c.label}</p>
          <p style={{ ...S.value, marginTop: 12 }}>{c.value}</p>
          <p style={{ ...S.muted, marginTop: 6 }}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
