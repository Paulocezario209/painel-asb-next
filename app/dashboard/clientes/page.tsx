import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STAGE_COLS = [
  { key: "cliente_em_ativacao", label: "Em Ativação", color: "#22C55E" },
  { key: "cliente_ativo", label: "Cliente Ativo", color: "#0F6E56" },
  { key: "cliente_recorrente", label: "Recorrente", color: "#064E3B" },
] as const;

const HEALTH_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "healthy", label: "Healthy" },
  { key: "at_risk", label: "At Risk" },
  { key: "inactive", label: "Inactive" },
  { key: "recovered", label: "Recovered" },
] as const;

const HEALTH_COLORS: Record<string, string> = {
  healthy: "#22C55E",
  at_risk: "#BA7517",
  inactive: "#BA1717",
  recovered: "#185FA5",
};

type Customer = {
  id: string;
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  weekly_volume_kg: number | null;
  funnel_stage: string;
  customer_health: string | null;
  routing_team: string | null;
  owner_seller_id: string | null;
  first_order_at: string | null;
  handoff_at: string | null;
};

type Vendor = { id: string; name: string };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const healthFilter = sp.health ?? "all";
  const supabase = await createClient();

  let query = supabase
    .from("ai_sdr_leads")
    .select(
      "id, phone, name, restaurant_name, city, weekly_volume_kg, funnel_stage, customer_health, routing_team, owner_seller_id, first_order_at, handoff_at"
    )
    .in("funnel_stage", ["cliente_em_ativacao", "cliente_ativo", "cliente_recorrente"])
    .eq("is_test", false)
    .order("first_order_at", { ascending: false, nullsFirst: false });

  if (healthFilter !== "all") {
    query = query.eq("customer_health", healthFilter);
  }

  const { data: customers } = await query;
  const { data: vendors } = await supabase.from("vendors").select("id, name");
  const vendorMap = new Map<string, string>((vendors ?? []).map((v: Vendor) => [v.id, v.name]));

  const byStage: Record<string, Customer[]> = {
    cliente_em_ativacao: [],
    cliente_ativo: [],
    cliente_recorrente: [],
  };
  for (const c of (customers ?? []) as Customer[]) {
    byStage[c.funnel_stage]?.push(c);
  }

  const totalCount = customers?.length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Carteira de Clientes</h1>
          <p className="text-sm text-gray-400 mt-1">
            {totalCount} clientes na carteira
          </p>
        </div>
        <div className="flex gap-2">
          {HEALTH_OPTIONS.map((opt) => {
            const active = healthFilter === opt.key;
            return (
              <Link
                key={opt.key}
                href={`/dashboard/clientes?health=${opt.key}`}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                  active
                    ? "bg-[#193264] text-white"
                    : "bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Kanban 3 colunas */}
      <div className="grid grid-cols-3 gap-4">
        {STAGE_COLS.map((col) => (
          <div key={col.key} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: col.color, boxShadow: `0 0 6px ${col.color}` }}
                />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  {col.label}
                </h2>
              </div>
              <span className="text-xs text-gray-500 font-semibold">
                {byStage[col.key].length}
              </span>
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {byStage[col.key].length === 0 && (
                <div className="text-xs text-gray-600 italic py-4 text-center">
                  Nenhum cliente nesta coluna
                </div>
              )}
              {byStage[col.key].map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/cliente/${c.id}`}
                  className="block bg-[#0f0f0f] border border-[#2a2a2a] hover:border-[#185FA5] rounded-md p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-sm font-semibold text-white truncate flex-1">
                      {c.restaurant_name || c.name || c.phone}
                    </div>
                    {c.customer_health && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background: HEALTH_COLORS[c.customer_health] ?? "#9696AF",
                          color: "#fff",
                        }}
                      >
                        {c.customer_health}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {[c.city, c.weekly_volume_kg ? `${c.weekly_volume_kg}kg/sem` : null, c.phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1">
                    Vendor: {c.owner_seller_id ? vendorMap.get(c.owner_seller_id) ?? "—" : "—"}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
