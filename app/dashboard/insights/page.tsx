import { SegmentChart } from "@/components/insights/segment-chart";
import { theme } from "@/lib/theme";
import { VENDOR_LABELS } from "@/lib/vendor-labels";
import { PainDonut }    from "@/components/insights/pain-donut";
import { SupplierBar }  from "@/components/insights/supplier-bar";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
// ETAPA6 (DEBT-137): cache real dos agregados históricos (dado global, sem auth).
import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const getInsightsAgregados = unstable_cache(
  async () => {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data } = await supabase
      .from("ai_sdr_leads")
      .select(
        "segment, city, pain_point, current_supplier, weekly_volume_kg, lead_temperature, " +
        "lead_status, routing_team, qual_stage, handoff_at, first_order_at, created_at"
      )
      .eq("is_test", false);
    return data ?? [];
  },
  ["insights-agregados"],
  { revalidate: 3600, tags: ["insights-agregados"] },
);

// ── Lead shape (subset dos campos usados nesta página) ────────────────────────
interface Lead {
  segment:          string | null;
  city:             string | null;
  pain_point:       string | null;
  current_supplier: string | null;
  weekly_volume_kg: number | null;
  lead_temperature: string | null;
  lead_status:      string | null;
  routing_team:     string | null;
  qual_stage:       number | null;
  handoff_at:       string | null;
  first_order_at:   string | null;
  created_at:       string | null;
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#e4e9f0", fontFamily: theme.font.label },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: theme.font.label, marginBottom: 12 } as React.CSSProperties,
  muted:   { color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label } as React.CSSProperties,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function countBy<T>(arr: T[], key: (item: T) => string | null | undefined, topN = 8) {
  const map: Record<string, number> = {};
  for (const item of arr) {
    const k = key(item);
    if (!k) continue;
    map[k] = (map[k] ?? 0) + 1;
  }
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, count]) => ({ label, count }));
}

// ── Segment labels ─────────────────────────────────────────────────────────────
const SEG_LABELS: Record<string, string> = {
  hamburgueria:    "Hamburgueria",
  restaurante:     "Restaurante",
  bar:             "Bar",
  distribuidora:   "Distribuidora",
  rede:            "Rede/Franquia",
  churrascaria:    "Churrascaria",
  hotel:           "Hotel",
  escola:          "Escola/Refeitório",
  supermercado:    "Supermercado",
  acougue:         "Açougue",
  food_truck:      "Food Truck",
  dark_kitchen:    "Dark Kitchen",
};

// ── Temperature badges ─────────────────────────────────────────────────────────
const TEMP_META: Record<string, { color: string; bg: string; border: string; label: string }> = {
  hot:  { color: "#C8102E", bg: "rgba(200,16,46,.08)", border: "rgba(200,16,46,.3)",  label: "Hot" },
  warm: { color: "#f59e0b", bg: "rgba(245,158,11,.08)", border: "rgba(245,158,11,.3)", label: "Warm" },
  cold: { color: "#c0d0e0", bg: "rgba(136,153,170,.06)", border: "rgba(136,153,170,.2)", label: "Cold" },
};

export default async function InsightsPage() {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/insights")) redirect("/dashboard");

  const raw = await getInsightsAgregados();  // ETAPA6: cacheado (dado global, revalidate 1h)
  const leads = (raw ?? []) as unknown as Lead[];
  const total = leads.length;

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const qualified = leads.filter(l => (l.qual_stage ?? 0) >= 7).length;
  const withHandoff = leads.filter(l => l.handoff_at).length;
  const withPain = leads.filter(l => l.pain_point).length;

  const volumeLeads = leads.filter(l => l.weekly_volume_kg != null);
  const avgVolume = volumeLeads.length
    ? Math.round(volumeLeads.reduce((s, l) => s + (l.weekly_volume_kg ?? 0), 0) / volumeLeads.length)
    : null;

  const taxaQual = total > 0 ? Math.round((qualified / total) * 100) : 0;
  const taxaPain = total > 0 ? Math.round((withPain  / total) * 100) : 0;

  // Avg days to handoff
  const handoffDelays = leads
    .filter(l => l.handoff_at && l.created_at)
    .map(l => (new Date(l.handoff_at!).getTime() - new Date(l.created_at!).getTime()) / 86400000);
  const avgHandoffDays = handoffDelays.length
    ? +(handoffDelays.reduce((s, v) => s + v, 0) / handoffDelays.length).toFixed(1)
    : null;

  // ── Charts data ──────────────────────────────────────────────────────────────
  const segmentData = countBy(leads, l =>
    l.segment ? (SEG_LABELS[l.segment] ?? l.segment) : null
  );

  const painData = countBy(leads, l => l.pain_point);

  const supplierData = countBy(leads, l => l.current_supplier);

  // ── Temperature carteira ─────────────────────────────────────────────────────
  const tempCount: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
  for (const l of leads) {
    const t = l.lead_temperature?.toLowerCase();
    if (t && t in tempCount) tempCount[t]++;
  }

  // ── Funil por segmento (qualificados >= 7) ───────────────────────────────────
  const funnelSeg: Record<string, { total: number; qual: number }> = {};
  for (const l of leads) {
    const s = l.segment;
    if (!s) continue;
    const label = SEG_LABELS[s] ?? s;
    if (!funnelSeg[label]) funnelSeg[label] = { total: 0, qual: 0 };
    funnelSeg[label].total++;
    if ((l.qual_stage ?? 0) >= 7) funnelSeg[label].qual++;
  }
  const funnelRows = Object.entries(funnelSeg)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  // ── Top 10 cidades ────────────────────────────────────────────────────────────
  const topCities = countBy(leads, l => l.city, 10);

  // ── Distribuição por vendedor ─────────────────────────────────────────────────
  const vendorDist: Record<string, number> = {};
  for (const l of leads) {
    const v = l.routing_team;
    if (!v) continue;
    vendorDist[v] = (vendorDist[v] ?? 0) + 1;
  }
  const vendorRows = Object.entries(vendorDist)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ label: VENDOR_LABELS[key] ?? key, count }));

  // ── Empty guard ───────────────────────────────────────────────────────────────
  const hasData = total >= 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Inteligência
        </h1>
        <p style={S.muted}>Perfil da carteira · segmento · dores · fornecedores · geo</p>
      </div>

      {!hasData ? (
        <div style={{ ...S.card, padding: "40px 24px", textAlign: "center" }}>
          <p style={{ color: "#e4e9f0", fontFamily: theme.font.label, fontSize: 12 }}>
            Nenhum lead cadastrado ainda. Os insights aparecem automaticamente conforme a base cresce.
          </p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="asb-grid-kpi">
            {[
              { label: "Taxa Qualificação",  value: `${taxaQual}%`,         accent: "#C8102E",  sub: `${qualified} de ${total} leads`, href: "/dashboard/leads?status=qualified" },
              { label: "Leads c/ Dor",       value: `${taxaPain}%`,         accent: "#f59e0b",  sub: `${withPain} identificadas`, href: undefined as string | undefined },
              { label: "Handoffs Realizados",value: String(withHandoff),     accent: "#22c55e",  sub: `${total > 0 ? Math.round(withHandoff/total*100) : 0}% da base`, href: "/dashboard/handoffs" },
              { label: "Volume Médio",        value: avgVolume ? `${avgVolume} kg` : "—", accent: "#185FA5", sub: "por semana/lead", href: undefined },
            ].map(({ label, value, accent, sub, href }) => {
              const card = (
                <div key={label} style={{ ...S.card, padding: "20px", borderTop: `2px solid ${accent}`, height: "100%" }}>
                  <p style={{ ...S.label, color: accent }}>{label}</p>
                  <p style={{ ...S.value, marginTop: 12 }}>{value}</p>
                  <p style={{ ...S.muted, marginTop: 6, fontSize: 10 }}>{sub}</p>
                </div>
              );
              return href
                ? <Link key={label} href={href} style={{ textDecoration: "none" }}>{card}</Link>
                : card;
            })}
          </div>

          {/* Temperatura da carteira */}
          <div style={{ ...S.card, padding: "20px 24px" }}>
            <p style={S.section}>
              <span style={{ color: "#C8102E", marginRight: 6 }}>▲</span>
              Temperatura da Carteira
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {(["hot", "warm", "cold"] as const).map(t => {
                const m = TEMP_META[t];
                return (
                  <div key={t} style={{ background: m.bg, border: `1px solid ${m.border}`, borderRadius: 5, padding: "14px 16px", textAlign: "center" }}>
                    <p style={{ color: m.color, fontSize: 26, fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                      {tempCount[t]}
                    </p>
                    <p style={{ color: m.color, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", marginTop: 4, fontFamily: theme.font.label, fontWeight: 700 }}>
                      {m.label}
                    </p>
                  </div>
                );
              })}
            </div>
            {avgHandoffDays !== null && (
              <p style={{ ...S.muted, marginTop: 14, fontSize: 10 }}>
                Tempo médio até handoff: <span style={{ color: "#c8d8e8" }}>{avgHandoffDays} dias</span>
              </p>
            )}
          </div>

          {/* Charts row — segmento + dores */}
          <div className="asb-grid-charts">
            <div style={{ ...S.card, padding: "20px 24px" }}>
              <p style={S.section}>Leads por Segmento</p>
              {segmentData.length > 0
                ? <SegmentChart data={segmentData} />
                : <p style={S.muted}>Sem dados de segmento</p>
              }
            </div>
            <div style={{ ...S.card, padding: "20px 24px" }}>
              <p style={S.section}>Dores Identificadas</p>
              {painData.length > 0
                ? <PainDonut data={painData} />
                : <p style={S.muted}>Sem dores registradas</p>
              }
            </div>
          </div>

          {/* Fornecedores atuais */}
          <div style={{ ...S.card, padding: "20px 24px" }}>
            <p style={S.section}>Fornecedores Atuais dos Leads</p>
            {supplierData.length > 0
              ? <SupplierBar data={supplierData} />
              : <p style={S.muted}>Nenhum fornecedor registrado</p>
            }
          </div>

          {/* Funil por segmento + top cidades + vendedor */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

            {/* Funil por segmento */}
            <div style={{ ...S.card, padding: "20px 24px" }}>
              <p style={S.section}>Funil por Segmento</p>
              {funnelRows.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Segmento", "Total", "Qualif.", "Taxa"].map(h => (
                        <th key={h} style={{ ...S.label, textAlign: h === "Segmento" ? "left" : "right", paddingBottom: 8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {funnelRows.map(([seg, { total: t, qual: q }]) => (
                      <tr key={seg} style={{ borderTop: "1px solid rgba(27,42,107,.3)" }}>
                        <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.label, padding: "7px 0" }}>{seg}</td>
                        <td style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0" }}>{t}</td>
                        <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0" }}>{q}</td>
                        <td style={{ color: "#C8102E", fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0" }}>
                          {t > 0 ? `${Math.round(q/t*100)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={S.muted}>Sem dados</p>
              )}
            </div>

            {/* Top cidades + Vendedor */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ ...S.card, padding: "20px 24px" }}>
                <p style={S.section}>Top 10 Cidades</p>
                {topCities.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {topCities.map(({ label: city, count }, i) => (
                      <div key={city} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ color: "#e0e0e0", fontSize: 11, fontFamily: theme.font.label }}>
                          <span style={{ color: "#7a9a7a", marginRight: 6 }}>#{i + 1}</span>{city}
                        </span>
                        <span style={{
                          background: "rgba(200,16,46,.08)", border: "1px solid rgba(200,16,46,.25)",
                          color: "#C8102E", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
                          padding: "2px 7px", borderRadius: 2, fontFamily: theme.font.label,
                        }}>{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={S.muted}>Sem dados</p>
                )}
              </div>

              <div style={{ ...S.card, padding: "20px 24px" }}>
                <p style={S.section}>Distribuição por Vendedor</p>
                {vendorRows.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {vendorRows.map(({ label, count }) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.label }}>{label}</span>
                        <span style={{
                          border: "1px solid #2a2a2a", color: "#c0d0e0", fontSize: 9,
                          padding: "2px 7px", borderRadius: 2, fontFamily: theme.font.label,
                        }}>{count} leads</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={S.muted}>Sem dados</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
