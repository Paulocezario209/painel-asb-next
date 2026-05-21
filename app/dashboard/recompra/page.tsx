import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

const BUCKETS = [
  { key: "atrasado", label: "Atrasados", color: "#BA1717", desc: "next_expected < hoje — recompra esperada já passou" },
  { key: "hoje", label: "Hoje", color: "#D4A017", desc: "recompra esperada para hoje" },
  { key: "proximos_3d", label: "Próximos 3 dias", color: "#BA7517", desc: "recompra esperada em 1-3 dias" },
  { key: "proximos_7d", label: "Próximos 7 dias", color: "#185FA5", desc: "recompra esperada em 4-7 dias" },
] as const;

type Row = {
  lead_id: string;
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  weekly_volume_kg: number | null;
  funnel_stage: string;
  customer_health: string | null;
  owner_seller_id: string | null;
  total_orders: number;
  last_order_at: string | null;
  next_expected_order_at: string | null;
  avg_order_interval_days: number | null;
  days_since_last_order: number | null;
  customer_tier: string | null;
  avg_ticket_brl: number | null;
  bucket: string;
  dias_pra_proximo: number;
};

type Vendor = { id: string; name: string };

export default async function RecompraPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.from("v_recompra_prevista").select("*");
  const { data: vendors } = await supabase.from("vendors").select("id, name");
  const vendorMap = new Map<string, string>((vendors ?? []).map((v: Vendor) => [v.id, v.name]));

  const byBucket: Record<string, Row[]> = { atrasado: [], hoje: [], proximos_3d: [], proximos_7d: [] };
  for (const r of (rows ?? []) as Row[]) {
    if (byBucket[r.bucket]) byBucket[r.bucket].push(r);
  }
  const total = (rows ?? []).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Recompra Prevista</h1>
        <p className="text-sm text-gray-400 mt-1">
          {total} clientes com recompra esperada nos próximos 7 dias · cálculo do worker daily 6h BRT (last_order + avg_interval)
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {BUCKETS.map((b) => (
          <div key={b.key} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4" style={{ borderTop: `3px solid ${b.color}` }}>
            <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: b.color }}>{b.label}</div>
            <div className="text-3xl font-bold text-white mt-1">{byBucket[b.key].length}</div>
            <div className="text-[10px] text-gray-500 mt-1 leading-tight">{b.desc}</div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {BUCKETS.map((b) => (
          <div key={b.key} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2a2a2a]">
              <div className="w-3 h-3 rounded-full" style={{ background: b.color, boxShadow: `0 0 6px ${b.color}` }} />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">{b.label}</h2>
              <span className="text-xs text-gray-500 ml-auto">{byBucket[b.key].length}</span>
            </div>

            {byBucket[b.key].length === 0 ? (
              <div className="text-xs text-gray-600 italic py-3 text-center">Nenhum cliente neste bucket.</div>
            ) : (
              <div className="space-y-1.5">
                {byBucket[b.key].map((r) => (
                  <Link
                    key={r.lead_id}
                    href={`/dashboard/cliente/${r.lead_id}`}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-[#0f0f0f] hover:bg-[#181818] border border-[#2a2a2a] hover:border-[#185FA5] rounded p-3 text-xs transition-all"
                  >
                    <div className="text-white font-semibold truncate">
                      {r.restaurant_name || r.name || r.phone}
                      <span className="text-gray-500 text-[10px] font-normal ml-2">
                        {r.city ?? "—"} · {r.weekly_volume_kg ? `${r.weekly_volume_kg}kg/sem` : "—"}
                      </span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-gray-500 text-[10px]">Pedidos:</span>{" "}
                      <span className="text-white">{r.total_orders}</span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-gray-500 text-[10px]">Avg:</span>{" "}
                      <span className="text-white">{r.avg_order_interval_days ? `${Number(r.avg_order_interval_days).toFixed(1)}d` : "—"}</span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-gray-500 text-[10px]">Esperada:</span>{" "}
                      <span className="text-white font-bold">
                        {r.next_expected_order_at ? new Date(r.next_expected_order_at).toLocaleDateString("pt-BR") : "—"}
                      </span>
                    </div>
                    <div className="text-gray-400">
                      <span className="text-gray-500 text-[10px]">Tier:</span>{" "}
                      <span className="text-white font-bold">{r.customer_tier ?? "—"}</span>
                    </div>
                    <div className="text-gray-500 text-right">
                      {r.owner_seller_id ? (vendorMap.get(r.owner_seller_id)?.split(" ")[0] ?? "—") : "—"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-[10px] text-gray-600 text-center mt-4">
        Previsão calculada pelo worker daily: <code>next_expected_order_at = last_order_at + avg_order_interval_days</code>.
        Granularidade depende de N pedidos: precisão melhora a partir de 3+ pedidos.
      </div>
    </div>
  );
}
