import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CUSTOMER_STATUS, CHURN_STATES } from "@/lib/customer-status";

export const dynamic = "force-dynamic";

const STATUS_COLS = CHURN_STATES.map((k) => ({ key: k, ...CUSTOMER_STATUS[k] }));

const brl = (n: number | null) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

type Customer = {
  ares_pessoa_id: number;
  lead_id: string | null;
  name: string | null;
  city: string | null;
  customer_status: string;
  customer_tier: string | null;
  total_orders: number | null;
  dias_sem_compra: number | null;
  total_revenue_brl: number | null;
  vendedor_nome: string | null;
};

export default async function ChurnPage() {
  const supabase = await createClient();

  // Fonte: v_carteira_360 — carteira REAL ARES (clientes faturados), não só os leads SDR.
  // RBAC: a tela hoje não escopa por vendedor logado (mostra a carteira inteira); owner_seller_id/
  // vendedor_nome vêm da view se vier a escopar.
  const { data: customers } = await supabase
    .from("v_carteira_360")
    .select("ares_pessoa_id, lead_id, name, city, customer_status, customer_tier, total_orders, dias_sem_compra, total_revenue_brl, vendedor_nome")
    .in("customer_status", ["risco", "pre_churn", "churn_comercial", "inativo_definitivo"])
    .order("total_revenue_brl", { ascending: false, nullsFirst: false });

  const byStatus: Record<string, Customer[]> = { risco: [], pre_churn: [], churn_comercial: [], inativo_definitivo: [] };
  for (const c of (customers ?? []) as Customer[]) {
    if (byStatus[c.customer_status]) byStatus[c.customer_status].push(c);
  }

  const total = (customers ?? []).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Churn — Carteira de Clientes</h1>
        <p className="text-sm text-gray-400 mt-1">
          {total} clientes em risco/pré-churn/churn/inativo · carteira real ARES (v_carteira_360) · maiores no topo
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {STATUS_COLS.map((col) => {
          const count = byStatus[col.key].length;
          return (
            <div
              key={col.key}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4"
              style={{ borderTop: `3px solid ${col.color}` }}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: col.color }}>
                {col.label}
              </div>
              <div className="text-4xl font-bold text-white mt-2">{count}</div>
              <div className="text-[10px] text-gray-500 mt-2 leading-tight">{col.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Listas por status */}
      <div className="space-y-4">
        {STATUS_COLS.map((col) => (
          <div key={col.key} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2a2a2a]">
              <div className="w-3 h-3 rounded-full" style={{ background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">{col.label}</h2>
              <span className="text-xs text-gray-500 ml-auto">{byStatus[col.key].length} clientes</span>
            </div>

            {byStatus[col.key].length === 0 ? (
              <div className="text-xs text-gray-600 italic py-4 text-center">
                Nenhum cliente neste estado.
              </div>
            ) : (
              <div className="space-y-1.5">
                {byStatus[col.key].map((c) => {
                  const row = (
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-[#0f0f0f] hover:bg-[#181818] border border-[#2a2a2a] hover:border-[#185FA5] rounded p-3 text-xs transition-all">
                      <div className="text-white font-semibold truncate">
                        {c.name || `cliente ${c.ares_pessoa_id}`}
                        <span className="text-gray-500 text-[10px] font-normal ml-2">{c.city ?? "—"}</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500 text-[10px]">Receita:</span>{" "}
                        <span className="text-white">{brl(c.total_revenue_brl)}</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500 text-[10px]">Pedidos:</span>{" "}
                        <span className="text-white">{c.total_orders ?? "—"}</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500 text-[10px]">Sem comprar:</span>{" "}
                        <span className="text-white">{c.dias_sem_compra ?? "—"}d</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500 text-[10px]">Tier:</span>{" "}
                        <span className="text-white font-bold">{c.customer_tier ?? "—"}</span>
                      </div>
                      <div className="text-gray-500">{c.vendedor_nome?.split(" ")[0] ?? "—"}</div>
                    </div>
                  );
                  return c.lead_id ? (
                    <Link key={c.ares_pessoa_id} href={`/dashboard/cliente/${c.lead_id}`} className="block">
                      {row}
                    </Link>
                  ) : (
                    <div key={c.ares_pessoa_id}>{row}</div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-[10px] text-gray-600 text-center mt-4">
        Régua absoluta (dias sem comprar): risco 15–21 · pré-churn 22–30 · churn comercial 31–59 · inativo ≥60.
        Carteira real ARES (faturados); "recuperado" volta na Fase A.2.
      </div>
    </div>
  );
}
