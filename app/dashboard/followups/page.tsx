import { createClient } from "@/lib/supabase/server";
import { FollowupsTable } from "@/components/followups/followups-table";

export const dynamic = "force-dynamic";

// ── Design tokens ────────────────────────────────────────────────────────────
const S = {
  card:    { background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 4 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#556677", fontFamily: "'Courier New', monospace" },
  value:   { fontSize: 22, fontWeight: 700, fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 } as React.CSSProperties,
  muted:   { color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
};

const ANGLE_LABELS: Record<string, string> = {
  retomada:       "Retomada",
  dor:            "Dor",
  prova_social:   "Prova Social",
  valor:          "Valor",
  reposicionamento: "Reposicionamento",
};

const PHASE_LABELS: Record<string, string> = {
  active:    "Active",
  monthly:   "Monthly",
  semestral: "Semestral",
};

export default async function FollowupsPage() {
  const supabase = await createClient();

  const [{ data: followups }, { data: leads }] = await Promise.all([
    supabase
      .from("followup_history")
      .select("phone, followup_sequence, phase, angle, message_sent, sent_at, responded, converted_after")
      .order("sent_at", { ascending: false }),
    supabase
      .from("ai_sdr_leads")
      .select("phone, name, city, routing_team, weekly_volume_kg"),
  ]);

  const rows = followups ?? [];
  const leadsMap = Object.fromEntries((leads ?? []).map(l => [l.phone, l]));

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const total     = rows.length;
  const responded = rows.filter(r => r.responded).length;
  const converted = rows.filter(r => r.converted_after).length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  // Ângulo com mais resposta (absolute count)
  const angleResponded: Record<string, number> = {};
  for (const r of rows) {
    if (r.responded && r.angle) {
      angleResponded[r.angle] = (angleResponded[r.angle] ?? 0) + 1;
    }
  }
  const topAngle = Object.entries(angleResponded).sort((a, b) => b[1] - a[1])[0];
  const topAngleLabel = topAngle ? (ANGLE_LABELS[topAngle[0]] ?? topAngle[0]) : "—";

  const kpis = [
    { label: "Total Enviados",     value: total,          accent: "#FFFFFF",  suffix: "" },
    { label: "Taxa de Resposta",   value: responseRate,   accent: "#22c55e",  suffix: "%" },
    { label: "Convertidos Após",   value: converted,      accent: "#f59e0b",  suffix: "" },
    { label: "Ângulo Top",         value: topAngleLabel,  accent: "#C8102E",  suffix: "", isText: true },
  ];

  // Enrich rows with lead data for the table
  const enriched = rows.map(r => ({
    ...r,
    name:         leadsMap[r.phone]?.name ?? null,
    city:         leadsMap[r.phone]?.city ?? null,
    routing_team: leadsMap[r.phone]?.routing_team ?? null,
    weekly_volume_kg: leadsMap[r.phone]?.weekly_volume_kg ?? null,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Follow-ups
        </h1>
        <p style={S.muted}>Histórico de follow-ups automáticos</p>
      </div>

      {/* KPI cards */}
      <div className="asb-grid-kpi">
        {kpis.map(({ label, value, accent, suffix, isText }) => (
          <div key={label} style={{ ...S.card, padding: "20px 20px", borderTop: `2px solid ${accent}` }}>
            <p style={{ ...S.label, color: accent }}>{label}</p>
            <p style={{ ...S.value, color: accent, marginTop: 12, fontSize: isText ? 14 : 28 }}>
              {value}{suffix}
            </p>
          </div>
        ))}
      </div>

      {/* Table (client component — handles filters) */}
      <FollowupsTable rows={enriched} angleLabels={ANGLE_LABELS} phaseLabels={PHASE_LABELS} />
    </div>
  );
}
