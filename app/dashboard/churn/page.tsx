import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CUSTOMER_STATUS, CHURN_STATES } from "@/lib/customer-status";

export const dynamic = "force-dynamic";

const STATUS_COLS = CHURN_STATES.map((k) => ({ key: k, ...CUSTOMER_STATUS[k] }));

type Customer = {
  id: string;
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  weekly_volume_kg: number | null;
  funnel_stage: string;
  customer_status: string;
  customer_tier: string | null;
  total_orders: number | null;
  dias_sem_compra: number | null;
  avg_order_interval_days: number | null;
  owner_seller_id: string | null;
};

type Vendor = { id: string; name: string };

export default async function ChurnPage() {
  const supabase = await createClient();

  // Fonte única: v_cliente_360 (customer_state ⋈ leads por ares_pessoa_id). Tier+health vivos.
  const { data: customers } = await supabase
    .from("v_cliente_360")
    .select("id:lead_id, phone, name, restaurant_name, city, weekly_volume_kg, funnel_stage, customer_status, customer_tier, total_orders, dias_sem_compra, avg_order_interval_days, last_order_at, owner_seller_id")
    .in("funnel_stage", ["cliente_em_ativacao", "cliente_ativo", "cliente_recorrente"])
    .in("customer_status", ["risco", "pre_churn", "churn_comercial", "inativo_definitivo"])
    .order("dias_sem_compra", { ascending: false, nullsFirst: false });

  const { data: vendors } = await supabase.from("vendors").select("id, name");
  const vendorMap = new Map<string, string>((vendors ?? []).map((v: Vendor) => [v.id, v.name]));

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
          {total} clientes em risco/pré-churn/churn/inativo · régua absoluta por dias sem comprar (v_cliente_360)
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

      {/* Listas por health */}
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
                  return (
                    <Link
                      key={c.id}
                      href={`/dashboard/cliente/${c.id}`}
                      className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-[#0f0f0f] hover:bg-[#181818] border border-[#2a2a2a] hover:border-[#185FA5] rounded p-3 text-xs transition-all"
                    >
                      <div className="text-white font-semibold truncate">
                        {c.restaurant_name || c.name || c.phone}
                        <span className="text-gray-500 text-[10px] font-normal ml-2">
                          {c.city ?? "—"} · {c.weekly_volume_kg ? `${c.weekly_volume_kg}kg/sem` : "—"}
                        </span>
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
                        <span className="text-gray-500 text-[10px]">Avg:</span>{" "}
                        <span className="text-white">
                          {c.avg_order_interval_days ? `${Number(c.avg_order_interval_days).toFixed(1)}d` : "—"}
                        </span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500 text-[10px]">Tier:</span>{" "}
                        <span className="text-white font-bold">{c.customer_tier ?? "—"}</span>
                      </div>
                      <div className="text-gray-500">
                        {c.owner_seller_id ? (vendorMap.get(c.owner_seller_id)?.split(" ")[0] ?? "—") : "—"}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-[10px] text-gray-600 text-center mt-4">
        Régua absoluta (dias sem comprar): risco 15–21 · pré-churn 22–30 · churn comercial 31–59 · inativo ≥60.
        "Recuperado" volta na Fase A.2.
      </div>
    </div>
  );
}
