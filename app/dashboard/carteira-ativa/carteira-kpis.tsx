import { S } from "@/app/dashboard/lib/dashboard-tokens";

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
        <div key={c.label} style={{ ...S.card, padding: "20px 24px", borderTop: `3px solid ${c.accent}` }}>
          <p style={{ ...S.label, color: c.accent }}>{c.label}</p>
          <p style={{ ...S.value, marginTop: 12 }}>{c.value}</p>
          <p style={{ ...S.muted, marginTop: 6 }}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}
