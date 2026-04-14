import { createClient } from "@/lib/supabase/server";
import {
  QualificationFunnel,
  WeeklyConversions,
  VendorPerformance,
} from "@/components/dashboard/charts";

export const dynamic = "force-dynamic";

// ── Design tokens — ASB brand ───────────────────────────────────────────────
const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 4 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#666666", fontFamily: "'Courier New', monospace" },
  value:   { fontSize: 28, fontWeight: 700, color: "#F5F5F5", fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#666666", fontFamily: "'Courier New', monospace", marginBottom: 12 } as React.CSSProperties,
  text:    { color: "#CCCCCC", fontSize: 12, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
  muted:   { color: "#888888", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
};

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function abcCurve(vol: number | null): "A" | "B" | "C" {
  if ((vol ?? 0) >= 300) return "A";
  if ((vol ?? 0) >= 100) return "B";
  return "C";
}

const PRODUCT_LABELS: Record<string, string> = {
  hamburguer: "Hambúrguer", espeto: "Espeto", boteco: "Boteco",
  cortes_especiais: "Cortes Especiais", mercearia: "Mercearia",
  molhos: "Molhos", defumados: "Defumados", paes: "Pães", embalagens: "Embalagens",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalLeads },
    { count: handoffPending },
    { count: qualifiedLeads },
    { data: allLeads },
  ] = await Promise.all([
    supabase.from("ai_sdr_leads").select("*", { count: "exact", head: true }),
    supabase.from("ai_sdr_leads").select("*", { count: "exact", head: true }).not("handoff_at", "is", null).eq("handoff_confirmed", false),
    supabase.from("ai_sdr_leads").select("*", { count: "exact", head: true }).gte("qual_stage", 7),
    supabase.from("ai_sdr_leads").select("qual_stage, first_order_at, routing_team, handoff_at, handoff_confirmed, weekly_volume_kg, city, product_groups"),
  ]);

  const leads = allLeads ?? [];

  // ABC
  const abcCount = { A: 0, B: 0, C: 0 };
  for (const l of leads) abcCount[abcCurve(l.weekly_volume_kg)]++;
  const urgentA = leads.filter(l => abcCurve(l.weekly_volume_kg) === "A" && l.handoff_at && !l.handoff_confirmed).length;

  // Top cidades
  const cityMap: Record<string, number> = {};
  for (const l of leads) {
    if ((l.qual_stage ?? 0) < 7 || !l.city) continue;
    cityMap[l.city] = (cityMap[l.city] ?? 0) + 1;
  }
  const topCities = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Product groups
  const groupCount: Record<string, number> = {};
  for (const l of leads) for (const g of (l.product_groups as string[] | null) ?? []) groupCount[g] = (groupCount[g] ?? 0) + 1;
  const topGroups = Object.entries(groupCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Funnel
  const stageBuckets: Record<string, number> = { "0-2": 0, "3-4": 0, "5-6": 0, "7-8": 0, "9": 0 };
  for (const l of leads) {
    const s = l.qual_stage ?? 0;
    if (s <= 2) stageBuckets["0-2"]++;
    else if (s <= 4) stageBuckets["3-4"]++;
    else if (s <= 6) stageBuckets["5-6"]++;
    else if (s <= 8) stageBuckets["7-8"]++;
    else stageBuckets["9"]++;
  }
  const funnelData = Object.entries(stageBuckets).map(([label, count]) => ({ label, count }));

  // Weekly
  const now = new Date();
  const weekMap: Record<string, number> = {};
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekMap[getWeekLabel(d)] = 0;
  }
  for (const l of leads) {
    if (!l.first_order_at) continue;
    const label = getWeekLabel(new Date(l.first_order_at));
    if (label in weekMap) weekMap[label]++;
  }
  const weeklyData = Object.entries(weekMap).map(([week, count]) => ({ week, count }));

  // Vendor
  const VENDORS: Record<string, string> = { ana_paula: "Ana Paula", alan: "Alan", setor_cuit: "CUIT" };
  const vendorMap: Record<string, { handoffs: number; confirmed: number; converted: number }> = {};
  for (const key of Object.keys(VENDORS)) vendorMap[key] = { handoffs: 0, confirmed: 0, converted: 0 };
  for (const l of leads) {
    const v = l.routing_team;
    if (!v || !(v in vendorMap)) continue;
    if (l.handoff_at) vendorMap[v].handoffs++;
    if (l.handoff_confirmed) vendorMap[v].confirmed++;
    if (l.first_order_at) vendorMap[v].converted++;
  }
  const vendorData = Object.entries(vendorMap).map(([key, vals]) => ({ label: VENDORS[key], ...vals }));

  const convertidos = leads.filter(l => l.first_order_at).length;

  const kpis = [
    { label: "Total Leads",        value: totalLeads ?? 0,    accent: "#F5F5F5" },
    { label: "Qualificados",       value: qualifiedLeads ?? 0, accent: "#B8860B" },
    { label: "Handoffs Pendentes", value: handoffPending ?? 0, accent: "#f59e0b" },
    { label: "Convertidos",        value: convertidos,          accent: "#C8102E" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#F5F5F5", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={S.muted}>Visão geral do pipeline SDR</p>
      </div>

      {/* KPI cards */}
      <div className="asb-grid-kpi">
        {kpis.map(({ label, value, accent }) => (
          <div key={label} style={{ ...S.card, padding: "20px 20px", borderTop: `2px solid ${accent}` }}>
            <p style={S.label} translate="no">{label}</p>
            <p style={{ ...S.value, color: accent, marginTop: 12 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Onde Focar Agora */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={{ ...S.section }}>
          <span style={{ color: "#C8102E", marginRight: 6 }}>▲</span>
          Onde Focar Agora
        </p>

        {/* ABC */}
        <p style={{ ...S.label, marginBottom: 8 }}>curva abc</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
          {([
            { tier: "A", count: abcCount.A, color: "#C8102E", bg: "rgba(200,16,46,.08)", border: "rgba(200,16,46,.3)", tag: "urgente", desc: "≥ 300 kg/sem" },
            { tier: "B", count: abcCount.B, color: "#B8860B", bg: "rgba(184,134,11,.08)", border: "rgba(184,134,11,.3)", tag: "médio", desc: "100–299 kg/sem" },
            { tier: "C", count: abcCount.C, color: "#888888", bg: "rgba(136,136,136,.06)", border: "rgba(136,136,136,.2)", tag: "longo prazo", desc: "< 100 kg/sem" },
          ] as const).map(({ tier, count, color, bg, border, tag, desc }) => (
            <div key={tier} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 5, padding: "14px 16px", textAlign: "center" }}>
              <p style={{ color, fontSize: 26, fontWeight: 700, fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 }}>{count}</p>
              <p style={{ color, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", marginTop: 4, fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
                Tier {tier}
              </p>
              <p style={{ color: "#8b949e", fontSize: 9, fontFamily: "'Courier New', monospace", marginTop: 2 }}>{desc}</p>
              <span style={{
                display: "inline-block", marginTop: 8, padding: "2px 6px",
                border: `1px solid ${border}`, borderRadius: 3, color, fontSize: 9,
                letterSpacing: ".10em", textTransform: "uppercase", fontFamily: "'Courier New', monospace",
              }}>{tag}</span>
            </div>
          ))}
        </div>

        {/* Alert urgente Tier A */}
        {urgentA > 0 && (
          <div style={{
            borderLeft: "3px solid #f85149",
            background: "rgba(248,81,73,.06)",
            padding: "10px 14px",
            borderRadius: "0 4px 4px 0",
            marginBottom: 16,
          }}>
            <p style={{ color: "#E8192E", fontSize: 11, fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
              ⚡ {urgentA} lead{urgentA > 1 ? "s" : ""} Tier A aguardando confirmação de handoff
            </p>
            <p style={{ color: "#888888", fontSize: 10, fontFamily: "'Courier New', monospace", marginTop: 2 }}>
              ação imediata — alto volume, handoff não confirmado
            </p>
          </div>
        )}

        {/* Top cidades */}
        {topCities.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ ...S.label, marginBottom: 8 }}>top cidades — leads qualificados</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {topCities.map(([city, count], i) => (
                <div key={city} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#c9d1d9", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
                    <span style={{ color: "#8b949e", marginRight: 6 }}>#{i + 1}</span>{city}
                  </span>
                  <span style={{
                    background: "rgba(200,16,46,.08)", border: "1px solid rgba(200,16,46,.25)",
                    color: "#C8102E", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
                    padding: "2px 7px", borderRadius: 2, fontFamily: "'Courier New', monospace",
                  }}>{count} leads</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grupos de produto */}
        {topGroups.length > 0 && (
          <div>
            <p style={{ ...S.label, marginBottom: 8 }}>grupos de produto</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {topGroups.map(([group, count]) => (
                <div key={group} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#c9d1d9", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
                    {PRODUCT_LABELS[group] ?? group}
                  </span>
                  <span style={{
                    border: "1px solid #2a2a2a", color: "#666666", fontSize: 9,
                    padding: "2px 7px", borderRadius: 2, fontFamily: "'Courier New', monospace",
                  }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="asb-grid-charts">
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <p style={S.section}>Funil de Qualificação</p>
          <QualificationFunnel data={funnelData} />
        </div>
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <p style={S.section}>Conversões por Semana</p>
          <WeeklyConversions data={weeklyData} />
        </div>
      </div>

      {/* Vendor */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>Performance por Vendedor</p>
        <VendorPerformance data={vendorData} />
      </div>

      {/* Status */}
      <div style={{ ...S.card, padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <p style={{ ...S.label, margin: 0 }}>status</p>
        {[
          { label: "SDR Ativo",        color: "#22c55e" },
          { label: "RAG Online",       color: "#C8102E" },
          { label: "Follow-up Engine", color: "#B8860B" },
        ].map(({ label, color }) => (
          <span key={label} style={{
            border: `1px solid ${color}30`,
            background: `${color}10`,
            color,
            fontSize: 9,
            letterSpacing: ".10em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: 3,
            fontFamily: "'Courier New', monospace",
          }} translate="no">● {label}</span>
        ))}
      </div>
    </div>
  );
}
