import { createClient } from "@/lib/supabase/server";
import { HandoffsTable, type Handoff } from "@/components/handoffs/handoffs-table";

export const dynamic = "force-dynamic";

const S = {
  card:    { background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 4 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#556677", fontFamily: "'Courier New', monospace" },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: "'Courier New', monospace", marginBottom: 12 } as React.CSSProperties,
  muted:   { color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
};

export default async function HandoffsPage() {
  const supabase = await createClient();

  const { data: raw, error } = await supabase
    .from("ai_sdr_leads")
    .select(
      "phone, restaurant_name, city, segment, weekly_volume_kg, routing_team, " +
      "handoff_at, scheduled_at, pain_point, lead_temperature, qual_stage"
    )
    .eq("human_active", true)
    .eq("handoff_confirmed", false)
    .not("handoff_at", "is", null)
    .order("handoff_at", { ascending: true });

  if (error) throw new Error(error.message);
  const handoffs = (raw ?? []) as unknown as Handoff[];

  // ── KPI computations (server-side) ────────────────────────────────────────────
  const now      = Date.now();
  const fourHAgo = now - 4 * 60 * 60 * 1000;

  const totalPending  = handoffs.length;
  const criticalCount = handoffs.filter(h => new Date(h.handoff_at).getTime() < fourHAgo).length;

  const todayStr  = new Date().toISOString().slice(0, 10);
  const todayCount = handoffs.filter(h =>
    h.scheduled_at && h.scheduled_at.slice(0, 10) === todayStr
  ).length;

  const kpis = [
    { label: "Total Pendentes",    value: totalPending,  accent: "#f59e0b", sub: "aguardando confirmação" },
    { label: "Críticos (> 4h)",    value: criticalCount, accent: "#C8102E", sub: "sem confirmação há > 4h" },
    { label: "Agendados Hoje",     value: todayCount,    accent: "#22c55e", sub: "scheduled_at = hoje" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Fila de Handoff
        </h1>
        <p style={S.muted}>Leads aguardando confirmação do vendedor</p>
      </div>

      {/* KPIs */}
      <div className="asb-grid-kpi">
        {kpis.map(({ label, value, accent, sub }) => (
          <div key={label} style={{ ...S.card, padding: "20px", borderTop: `2px solid ${accent}` }}>
            <p style={{ ...S.label, color: accent }}>{label}</p>
            <p style={{ ...S.value, marginTop: 12 }}>{value}</p>
            <p style={{ ...S.muted, marginTop: 6, fontSize: 10 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#C8102E", marginRight: 6 }}>▲</span>
          Handoffs Pendentes
        </p>
        <HandoffsTable initial={handoffs} />
      </div>
    </div>
  );
}
