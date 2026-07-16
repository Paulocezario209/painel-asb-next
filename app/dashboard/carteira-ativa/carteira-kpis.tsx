import { KpiCard } from "@/app/dashboard/lib/ui";
import { Wallet, AlertTriangle, ShoppingBasket, CheckCircle2 } from "lucide-react";

const brl = (n: number) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export type CarteiraKpis = { total: number; atencao: number; ativos: number; cesta: number };

export function CarteiraKpisRow({ kpis }: { kpis: CarteiraKpis }) {
  const cards = [
    { label: "Na carteira", value: String(kpis.total), accent: "#185FA5", Icon: Wallet, note: "ativos + em atenção · recorrentes" },
    { label: "Em atenção", value: String(kpis.atencao), accent: "#f59e0b", num: "#f59e0b", Icon: AlertTriangle, note: "8–14d sem comprar" },
    { label: "Cesta projetada 90d", value: brl(kpis.cesta), accent: "#C8102E", num: "#C8102E", Icon: ShoppingBasket, note: "soma das cestas" },
    { label: "Ativos", value: String(kpis.ativos), accent: "#22c55e", num: "#22c55e", Icon: CheckCircle2, note: "≤7d sem comprar" },
  ];
  return (
    <div className="asb-grid-kpi">
      {cards.map((c) => (
        <KpiCard key={c.label} {...c} />
      ))}
    </div>
  );
}
