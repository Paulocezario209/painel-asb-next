import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

const HEALTH_COLS = [
  { key: "at_risk", label: "Em Risco", color: "#BA7517", desc: "sem pedido > 1.5× freq média ou 14d" },
  { key: "inactive", label: "Inativos", color: "#BA1717", desc: "sem pedido > 3× freq média ou 60d" },
  { key: "recovered", label: "Recuperados", color: "#185FA5", desc: "voltaram após inactive (TTL 90d → healthy)" },
] as const;

type Customer = {
  id: string;
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  weekly_volume_kg: number | null;
  funnel_stage: string;
  customer_health: string;
  recovered_at: string | null;
  owner_seller_id: string | null;
};

type Vendor = { id: string; name: string };

type State = {
  lead_id: string;
  total_orders: number;
  last_order_at: string | null;
  days_since_last_order: number | null;
  avg_order_interval_days: number | null;
  total_revenue_brl: number;
  customer_tier: string | null;
};

export default async function ChurnPage() {
  const supabase = await createClient();

  const { data: customers } = await supabase
    .from("ai_sdr_leads")
    .select("id, phone, name, restaurant_name, city, weekly_volume_kg, funnel_stage, customer_health, recovered_at, owner_seller_id")
    .in("funnel_stage", ["cliente_em_ativacao", "cliente_ativo", "cliente_recorrente"])
    .in("customer_health", ["at_risk", "inactive", "recovered"])
    .eq("is_test", false)
    .order("recovered_at", { ascending: false, nullsFirst: false });

  const { data: vendors } = await supabase.from("vendors").select("id, name");
  const vendorMap = new Map<string, string>((vendors ?? []).map((v: Vendor) => [v.id, v.name]));

  const ids = (customers ?? []).map((c: Customer) => c.id);
  const { data: states } = ids.length > 0
    ? await supabase.from("customer_lifecycle_state")
        .select("lead_id, total_orders, last_order_at, days_since_last_order, avg_order_interval_days, total_revenue_brl, customer_tier")
        .in("lead_id", ids)
    : { data: [] };
  const stateMap = new Map<string, State>((states ?? []).map((s: State) => [s.lead_id, s]));

  const byHealth: Record<string, Customer[]> = { at_risk: [], inactive: [], recovered: [] };
  for (const c of (customers ?? []) as Customer[]) {
    if (byHealth[c.customer_health]) byHealth[c.customer_health].push(c);
  }

  const kpiAtRisk = byHealth.at_risk.length;
  const kpiInactive = byHealth.inactive.length;
  const kpiRecovered = byHealth.recovered.length;
  const total = kpiAtRisk + kpiInactive + kpiRecovered;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Churn — Carteira de Clientes</h1>
        <p className="text-sm text-gray-400 mt-1">
          {total} clientes em estados de risco/inatividade/recuperação · atualizado automaticamente pelo worker daily 6h BRT
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {HEALTH_COLS.map((col) => {
          const count = byHealth[col.key].length;
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
        {HEALTH_COLS.map((col) => (
          <div key={col.key} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2a2a2a]">
              <div className="w-3 h-3 rounded-full" style={{ background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">{col.label}</h2>
              <span className="text-xs text-gray-500 ml-auto">{byHealth[col.key].length} clientes</span>
            </div>

            {byHealth[col.key].length === 0 ? (
              <div className="text-xs text-gray-600 italic py-4 text-center">
                Nenhum cliente neste estado.
              </div>
            ) : (
              <div className="space-y-1.5">
                {byHealth[col.key].map((c) => {
                  const st = stateMap.get(c.id);
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
                        <span className="text-white">{st?.total_orders ?? "—"}</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500 text-[10px]">Sem comprar:</span>{" "}
                        <span className="text-white">{st?.days_since_last_order ?? "—"}d</span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500 text-[10px]">Avg:</span>{" "}
                        <span className="text-white">
                          {st?.avg_order_interval_days ? `${Number(st.avg_order_interval_days).toFixed(1)}d` : "—"}
                        </span>
                      </div>
                      <div className="text-gray-400">
                        <span className="text-gray-500 text-[10px]">Tier:</span>{" "}
                        <span className="text-white font-bold">{st?.customer_tier ?? "—"}</span>
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
        Health calculado por <code>apply_lifecycle_transitions</code> (5 regras spec §14).
        Worker SQL roda diariamente via cron n8n às 6h BRT.
      </div>
    </div>
  );
}
