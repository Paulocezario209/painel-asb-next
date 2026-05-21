import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const dynamic = "force-dynamic";

type UpsellRow = {
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
  cliente_ticket: number;
  tier_avg_ticket: number;
  gap_brl: number;
  gap_pct: number;
  customer_tier: string;
  potencial_anual_brl: number;
};

type TierUpgradeRow = {
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
  tier_atual: string;
  tier_sugerido: string;
  razao: string;
  total_revenue_brl: number;
};

type Vendor = { id: string; name: string };

const TIER_COLOR: Record<string, string> = { A: "#D4A017", B: "#185FA5", C: "#9696AF" };

const fmtBRL = (n: number) =>
  `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function UpSellPage() {
  const supabase = await createClient();
  const { data: upsell } = await supabase.from("v_upsell_oportunidades").select("*");
  const { data: upgrade } = await supabase.from("v_tier_upgrade_candidates").select("*");
  const { data: vendors } = await supabase.from("vendors").select("id, name");
  const vendorMap = new Map<string, string>((vendors ?? []).map((v: Vendor) => [v.id, v.name]));

  const upsellRows = (upsell ?? []) as UpsellRow[];
  const upgradeRows = (upgrade ?? []) as TierUpgradeRow[];

  const potencialTotal = upsellRows.reduce((acc, r) => acc + Number(r.potencial_anual_brl ?? 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Up-sell & Tier Upgrade</h1>
        <p className="text-sm text-gray-400 mt-1">
          {upsellRows.length} oportunidades up-sell · {upgradeRows.length} candidatos a tier upgrade · potencial anual {fmtBRL(potencialTotal)}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4" style={{ borderTop: "3px solid #BA7517" }}>
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#BA7517]">Up-sell Ticket</div>
          <div className="text-3xl font-bold text-white mt-1">{upsellRows.length}</div>
          <div className="text-[10px] text-gray-500 mt-1">clientes &lt; 70% da média do tier</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4" style={{ borderTop: "3px solid #185FA5" }}>
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#185FA5]">Tier Upgrade</div>
          <div className="text-3xl font-bold text-white mt-1">{upgradeRows.length}</div>
          <div className="text-[10px] text-gray-500 mt-1">volume justifica tier maior</div>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4" style={{ borderTop: "3px solid #22C55E" }}>
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#22C55E]">Potencial Anual</div>
          <div className="text-2xl font-bold text-white mt-1">{fmtBRL(potencialTotal)}</div>
          <div className="text-[10px] text-gray-500 mt-1">se up-sell subir pra média do tier</div>
        </div>
      </div>

      {/* Up-sell ticket */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#BA7517] mb-3 pb-2 border-b border-[#2a2a2a]">
          🎯 Up-sell — Ticket abaixo da média do tier
        </h2>
        {upsellRows.length === 0 ? (
          <div className="text-xs text-gray-600 italic py-3 text-center">Nenhuma oportunidade hoje.</div>
        ) : (
          <div className="space-y-1.5">
            {upsellRows.map((r) => (
              <Link
                key={r.lead_id}
                href={`/dashboard/cliente/${r.lead_id}`}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-[#0f0f0f] hover:bg-[#181818] border border-[#2a2a2a] hover:border-[#BA7517] rounded p-3 text-xs transition-all"
              >
                <div className="text-white font-semibold truncate">
                  {r.restaurant_name || r.name || r.phone}
                  <span className="text-gray-500 text-[10px] font-normal ml-2">
                    {r.city ?? "—"} · Tier <span style={{ color: TIER_COLOR[r.customer_tier] }} className="font-bold">{r.customer_tier}</span>
                  </span>
                </div>
                <div className="text-gray-400">
                  <span className="text-gray-500 text-[10px]">Ticket cliente:</span>{" "}
                  <span className="text-white">{fmtBRL(r.cliente_ticket)}</span>
                </div>
                <div className="text-gray-400">
                  <span className="text-gray-500 text-[10px]">Média tier:</span>{" "}
                  <span className="text-white">{fmtBRL(r.tier_avg_ticket)}</span>
                </div>
                <div className="text-gray-400">
                  <span className="text-gray-500 text-[10px]">Gap:</span>{" "}
                  <span className="text-[#E0993A] font-bold">{r.gap_pct}%</span>
                </div>
                <div className="text-gray-400">
                  <span className="text-gray-500 text-[10px]">Potencial/ano:</span>{" "}
                  <span className="text-[#22C55E] font-bold">{fmtBRL(r.potencial_anual_brl)}</span>
                </div>
                <div className="text-gray-500 text-right">
                  {r.owner_seller_id ? (vendorMap.get(r.owner_seller_id)?.split(" ")[0] ?? "—") : "—"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Tier upgrade */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#185FA5] mb-3 pb-2 border-b border-[#2a2a2a]">
          ⬆ Tier Upgrade — Volume justifica reclassificação
        </h2>
        {upgradeRows.length === 0 ? (
          <div className="text-xs text-gray-600 italic py-3 text-center">Nenhum candidato a upgrade hoje.</div>
        ) : (
          <div className="space-y-1.5">
            {upgradeRows.map((r) => (
              <Link
                key={r.lead_id}
                href={`/dashboard/cliente/${r.lead_id}`}
                className="grid grid-cols-[2fr_1fr_auto_auto_1fr_auto] gap-2 items-center bg-[#0f0f0f] hover:bg-[#181818] border border-[#2a2a2a] hover:border-[#185FA5] rounded p-3 text-xs transition-all"
              >
                <div className="text-white font-semibold truncate">
                  {r.restaurant_name || r.name || r.phone}
                  <span className="text-gray-500 text-[10px] font-normal ml-2">{r.city ?? "—"}</span>
                </div>
                <div className="text-gray-400">
                  <span className="text-gray-500 text-[10px]">Volume:</span>{" "}
                  <span className="text-white">{r.weekly_volume_kg}kg/sem</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded font-bold text-[10px]" style={{ background: TIER_COLOR[r.tier_atual], color: "#fff" }}>
                    {r.tier_atual}
                  </span>
                  <span className="text-gray-500">→</span>
                  <span className="px-2 py-0.5 rounded font-bold text-[10px]" style={{ background: TIER_COLOR[r.tier_sugerido], color: "#fff" }}>
                    {r.tier_sugerido}
                  </span>
                </div>
                <div className="text-gray-500 text-[10px]">{r.razao}</div>
                <div className="text-gray-400">
                  <span className="text-gray-500 text-[10px]">Revenue:</span>{" "}
                  <span className="text-white">{fmtBRL(r.total_revenue_brl)}</span>
                </div>
                <div className="text-gray-500 text-right">
                  {r.owner_seller_id ? (vendorMap.get(r.owner_seller_id)?.split(" ")[0] ?? "—") : "—"}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="text-[10px] text-gray-600 text-center mt-4">
        Up-sell calculado via <code>v_upsell_oportunidades</code> (cliente &lt; 70% média tier). Tier upgrade via <code>v_tier_upgrade_candidates</code> (weekly_volume_kg justifica tier maior).
      </div>
    </div>
  );
}
