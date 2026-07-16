import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { TrendingUp, TrendingDown, ChevronsUp } from "lucide-react";

export const dynamic = "force-dynamic";

type UpsellRow = {
  ares_pessoa_id: number;
  lead_id: string | null;
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  weekly_volume_kg: number | null;
  funnel_stage: string;
  customer_health: string | null;
  owner_seller_id: string | null;
  vendedor_nome: string | null;
  total_orders: number;
  cliente_ticket: number;
  tier_avg_ticket: number;
  gap_brl: number;
  gap_pct: number;
  customer_tier: string;
  potencial_anual_brl: number;
  pct_da_media: number;                       // v3: ticket/tier_avg × 100 (posição)
  pedidos_ano: number | null;                 // v3: 365/intervalo (cap 52, floor 4)
  avg_order_interval_days: number | null;     // v3: frequência real
};

type DownsellRow = {
  ares_pessoa_id: number;
  lead_id: string | null;
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  weekly_volume_kg: number | null;
  funnel_stage: string;
  customer_health: string | null;
  owner_seller_id: string | null;
  vendedor_nome: string | null;
  total_orders: number;
  cliente_ticket: number;
  tier_avg_ticket: number;
  excesso_brl: number;
  excesso_pct: number;
  customer_tier: string;
  revenue_em_risco_brl: number;
};

type TierUpgradeRow = {
  ares_pessoa_id: number;
  lead_id: string | null;
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  weekly_volume_kg: number | null;
  funnel_stage: string;
  customer_health: string | null;
  owner_seller_id: string | null;
  vendedor_nome: string | null;
  total_orders: number;
  tier_atual: string;
  tier_sugerido: string;
  razao: string;
  total_revenue_brl: number;
};

const TIER_COLOR: Record<string, string> = { A: "#D4A017", B: "#185FA5", C: "#9696AF" };

const fmtBRL = (n: number) =>
  `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const vend = (n: string | null) => n?.split(" ")[0] ?? "—";

export default async function UpSellPage() {
  const supabase = await createClient();
  const { data: upsell } = await supabase.from("v_upsell_oportunidades").select("*");
  const { data: downsell } = await supabase.from("v_downsell_risco_queda").select("*");
  const { data: upgrade } = await supabase.from("v_tier_upgrade_candidates").select("*");

  const upsellRows = (upsell ?? []) as UpsellRow[];
  const downsellRows = (downsell ?? []) as DownsellRow[];
  const upgradeRows = (upgrade ?? []) as TierUpgradeRow[];

  const potencialTotal = upsellRows.reduce((acc, r) => acc + Number(r.potencial_anual_brl ?? 0), 0);
  const riscoTotal = downsellRows.reduce((acc, r) => acc + Number(r.revenue_em_risco_brl ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Up-sell · Risco de Queda · Tier Upgrade"
        desc={`${upsellRows.length} up-sell · ${downsellRows.length} risco queda · ${upgradeRows.length} tier upgrade · potencial ${fmtBRL(potencialTotal)} · em risco ${fmtBRL(riscoTotal)}`}
      />

      {/* KPIs */}
      <div className="asb-grid-kpi">
        <KpiCard
          label="Up-sell Ticket"
          value={upsellRows.length}
          Icon={TrendingUp}
          accent="#BA7517"
          num="#BA7517"
          note="ticket < 80% da média do tier"
        />
        <KpiCard
          label="Risco de Queda"
          value={downsellRows.length}
          Icon={TrendingDown}
          accent="#C8102E"
          num="#C8102E"
          note="ticket > 120% da média do tier"
        />
        <KpiCard
          label="Tier Upgrade"
          value={upgradeRows.length}
          Icon={ChevronsUp}
          accent="#185FA5"
          num="#185FA5"
          note="volume justifica tier maior"
        />
        <KpiCard
          label="Potencial Anual"
          value={fmtBRL(potencialTotal)}
          Icon={TrendingUp}
          accent="#22c55e"
          num="#22c55e"
          note="gap × frequência real (pedidos/ano)"
        />
      </div>

      {/* Up-sell ticket */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={TrendingUp} color="#BA7517" title="Up-sell — Ticket Abaixo da Média do Tier" desc="Ticket 20%+ abaixo da média do tier (< 80%)" />
        {upsellRows.length === 0 ? (
          <p style={{ ...S.muted, fontStyle: "italic", textAlign: "center", padding: "12px 0", margin: 0 }}>Nenhuma oportunidade hoje.</p>
        ) : (
          <div className="space-y-1.5">
            {upsellRows.map((r) => {
              const pctMedia = Number(r.pct_da_media);          // posição vs média do tier (view v3)
              const abaixo = Math.round(100 - pctMedia);        // quanto abaixo da média
              const verificarTier = pctMedia < 30;              // ticket muito baixo p/ o tier
              const row = (
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-[var(--asb-card-hi)] hover:bg-[var(--asb-card-hi)] border border-[var(--asb-border)] hover:border-[#BA7517] rounded p-3 text-xs transition-all">
                  <div className="text-white font-semibold truncate">
                    {r.name || r.phone}
                    <span className="text-slate-200 text-[10px] font-normal ml-2">
                      {r.city ?? "—"} · Tier <span style={{ color: TIER_COLOR[r.customer_tier] }} className="font-bold">{r.customer_tier}</span>
                    </span>
                    {verificarTier && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: "#7a3b00", color: "#ffb366" }}>verificar tier</span>
                    )}
                  </div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Ticket cliente:</span>{" "}
                    <span className="text-white">{fmtBRL(r.cliente_ticket)}</span>
                  </div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Média tier:</span>{" "}
                    <span className="text-white">{fmtBRL(r.tier_avg_ticket)}</span>
                  </div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Posição:</span>{" "}
                    <span className="text-[#E0993A] font-bold">▼ {abaixo}% abaixo da média</span>
                  </div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Frequência:</span>{" "}
                    <span className="text-white">a cada {r.avg_order_interval_days ?? "—"}d</span>
                    <span className="text-slate-200 text-[10px]"> (~{r.pedidos_ano ?? "—"}×/ano)</span>
                  </div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Potencial/ano:</span>{" "}
                    <span className="text-[#22C55E] font-bold">{fmtBRL(r.potencial_anual_brl)}</span>
                  </div>
                  <div className="text-slate-200 text-right">{vend(r.vendedor_nome)}</div>
                </div>
              );
              return r.lead_id ? (
                <Link key={r.ares_pessoa_id} href={`/dashboard/cliente/${r.lead_id}`} className="block">{row}</Link>
              ) : (
                <div key={r.ares_pessoa_id}>{row}</div>
              );
            })}
          </div>
        )}
      </div>

      {/* Risco de queda (downsell) */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={TrendingDown} color="#C8102E" title="Risco de Queda — Ticket Acima da Média do Tier" desc="Ticket 20%+ acima da média do tier (> 120%)" />
        {downsellRows.length === 0 ? (
          <p style={{ ...S.muted, fontStyle: "italic", textAlign: "center", padding: "12px 0", margin: 0 }}>Nenhum cliente com ticket inflado hoje.</p>
        ) : (
          <div className="space-y-1.5">
            {downsellRows.map((r) => {
              // % da média = posição do ticket vs média do tier (client-side; view intocada)
              const pctMedia = Math.round((r.cliente_ticket / r.tier_avg_ticket) * 100);
              const row = (
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-[var(--asb-card-hi)] hover:bg-[var(--asb-card-hi)] border border-[var(--asb-border)] hover:border-[#C8102E] rounded p-3 text-xs transition-all">
                  <div className="text-white font-semibold truncate">
                    {r.name || r.phone}
                    <span className="text-slate-200 text-[10px] font-normal ml-2">
                      {r.city ?? "—"} · Tier <span style={{ color: TIER_COLOR[r.customer_tier] }} className="font-bold">{r.customer_tier}</span>
                    </span>
                  </div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Ticket cliente:</span>{" "}
                    <span className="text-white">{fmtBRL(r.cliente_ticket)}</span>
                  </div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Média tier:</span>{" "}
                    <span className="text-white">{fmtBRL(r.tier_avg_ticket)}</span>
                  </div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Ticket vs média:</span>{" "}
                    <span className="text-[#FF3B57] font-bold">{pctMedia}% da média</span>
                  </div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Revenue em risco:</span>{" "}
                    <span className="text-[#FF3B57] font-bold">{fmtBRL(r.revenue_em_risco_brl)}</span>
                  </div>
                  <div className="text-slate-200 text-right">{vend(r.vendedor_nome)}</div>
                </div>
              );
              return r.lead_id ? (
                <Link key={r.ares_pessoa_id} href={`/dashboard/cliente/${r.lead_id}`} className="block">{row}</Link>
              ) : (
                <div key={r.ares_pessoa_id}>{row}</div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tier upgrade */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={ChevronsUp} color="#185FA5" title="Tier Upgrade — Volume Justifica Reclassificação" desc="Weekly volume justifica tier maior" />
        {upgradeRows.length === 0 ? (
          <p style={{ ...S.muted, fontStyle: "italic", textAlign: "center", padding: "12px 0", margin: 0 }}>Nenhum candidato a upgrade hoje.</p>
        ) : (
          <div className="space-y-1.5">
            {upgradeRows.map((r) => {
              const row = (
                <div className="grid grid-cols-[2fr_1fr_auto_auto_1fr_auto] gap-2 items-center bg-[var(--asb-card-hi)] hover:bg-[var(--asb-card-hi)] border border-[var(--asb-border)] hover:border-[#185FA5] rounded p-3 text-xs transition-all">
                  <div className="text-white font-semibold truncate">
                    {r.name || r.phone}
                    <span className="text-slate-200 text-[10px] font-normal ml-2">{r.city ?? "—"}</span>
                  </div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Volume:</span>{" "}
                    <span className="text-white">{r.weekly_volume_kg}kg/sem</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded font-bold text-[10px]" style={{ background: TIER_COLOR[r.tier_atual], color: "#fff" }}>
                      {r.tier_atual}
                    </span>
                    <span className="text-slate-200">→</span>
                    <span className="px-2 py-0.5 rounded font-bold text-[10px]" style={{ background: TIER_COLOR[r.tier_sugerido], color: "#fff" }}>
                      {r.tier_sugerido}
                    </span>
                  </div>
                  <div className="text-slate-200 text-[10px]">{r.razao}</div>
                  <div className="text-slate-200">
                    <span className="text-slate-200 text-[10px]">Revenue:</span>{" "}
                    <span className="text-white">{fmtBRL(r.total_revenue_brl)}</span>
                  </div>
                  <div className="text-slate-200 text-right">{vend(r.vendedor_nome)}</div>
                </div>
              );
              return r.lead_id ? (
                <Link key={r.ares_pessoa_id} href={`/dashboard/cliente/${r.lead_id}`} className="block">{row}</Link>
              ) : (
                <div key={r.ares_pessoa_id}>{row}</div>
              );
            })}
          </div>
        )}
      </div>

      <p style={{ ...S.muted, fontSize: 10, textAlign: "center", marginTop: 8 }}>
        Up-sell via <code>v_upsell_oportunidades</code> (ticket 20%+ abaixo da média do tier &middot; &lt; 80%).{" "}
        Risco queda via <code>v_downsell_risco_queda</code> (ticket 20%+ acima da média do tier &middot; &gt; 120%).{" "}
        Tier upgrade via <code>v_tier_upgrade_candidates</code> (weekly_volume_kg justifica tier maior).{" "}
        Fonte: carteira real ARES (v_carteira_360).
      </p>
    </div>
  );
}
