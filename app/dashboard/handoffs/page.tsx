import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { HandoffsTable, type Handoff } from "@/components/handoffs/handoffs-table";
import { getLeadScoreMap } from "@/lib/get-lead-scores";
import { computeLeadScore, tierOf } from "@/lib/lead-score";

export const dynamic = "force-dynamic";

const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#e4e9f0", fontFamily: theme.font.label },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: theme.font.label, marginBottom: 12 } as React.CSSProperties,
  muted:   { color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label } as React.CSSProperties,
};

export default async function HandoffsPage({ searchParams }: { searchParams?: Promise<{ f?: string }> }) {
  const sp = searchParams ? await searchParams : undefined;
  const filtroKpi = sp?.f === "criticos" || sp?.f === "hoje" ? sp.f : undefined;
  const supabase = await createClient();

  const [{ data: raw, error }, scoreMap] = await Promise.all([
    supabase
      .from("ai_sdr_leads")
      .select(
        "phone, restaurant_name, city, segment, weekly_volume_kg, routing_team, " +
        "handoff_at, scheduled_at, pain_point, lead_temperature, qual_stage"
      )
      .eq("is_test", false)
      .eq("human_active", true)
      .eq("handoff_confirmed", false)
      .not("handoff_at", "is", null)
      .order("handoff_at", { ascending: true }),
    getLeadScoreMap(),  // ETAPA 4
  ]);

  if (error) throw new Error(error.message);

  // ── KPI computations (server-side) ────────────────────────────────────────────
  const now      = Date.now();
  const fourHAgo = now - 4 * 60 * 60 * 1000;

  // ETAPA 4: enriquece score (view/fallback) + ordena críticos(>4h) primeiro, depois score DESC
  const handoffs = ((raw ?? []) as unknown as Handoff[])
    .map((h) => {
      const fromView = scoreMap[h.phone];
      const score = fromView?.score ?? computeLeadScore(h);
      const tier = fromView?.tier ?? tierOf(score);
      return { ...h, lead_score: score, lead_tier: tier };
    })
    .sort((a, b) => {
      const critA = new Date(a.handoff_at).getTime() < fourHAgo ? 1 : 0;
      const critB = new Date(b.handoff_at).getTime() < fourHAgo ? 1 : 0;
      if (critA !== critB) return critB - critA;                 // críticos primeiro
      return (b.lead_score ?? 0) - (a.lead_score ?? 0);          // depois score DESC
    });

  const totalPending  = handoffs.length;
  const criticalCount = handoffs.filter(h => new Date(h.handoff_at).getTime() < fourHAgo).length;

  const todayStr  = new Date().toISOString().slice(0, 10);
  const todayCount = handoffs.filter(h =>
    h.scheduled_at && h.scheduled_at.slice(0, 10) === todayStr
  ).length;

  // Cards clicáveis fase 2 (pedido Paulo): KPI filtra a tabela via ?f= (o filtro
  // vive na própria tabela — sobrevive ao refetch do Realtime).
  const kpis = [
    { label: "Total Pendentes",    value: totalPending,  accent: "#f59e0b", sub: "aguardando confirmação · clique p/ ver todos", href: "/dashboard/handoffs" },
    { label: "Críticos (> 4h)",    value: criticalCount, accent: "#C8102E", sub: "sem confirmação há > 4h · clique p/ filtrar", href: "/dashboard/handoffs?f=criticos" },
    { label: "Agendados Hoje",     value: todayCount,    accent: "#22c55e", sub: "com horário marcado p/ hoje · clique p/ filtrar", href: "/dashboard/handoffs?f=hoje" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Fila de Handoff
        </h1>
        <p style={S.muted}>Leads aguardando confirmação do vendedor</p>
      </div>

      {/* KPIs */}
      <div className="asb-grid-kpi">
        {kpis.map(({ label, value, accent, sub, href }) => (
          <Link key={label} href={href} style={{ textDecoration: "none" }}>
            <div style={{ ...S.card, padding: "20px", borderTop: `2px solid ${accent}`, height: "100%" }}>
              <p style={{ ...S.label, color: accent }}>{label}</p>
              <p style={{ ...S.value, marginTop: 12 }}>{value}</p>
              <p style={{ ...S.muted, marginTop: 6, fontSize: 10 }}>{sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#C8102E", marginRight: 6 }}>▲</span>
          Handoffs Pendentes
        </p>
        <HandoffsTable initial={handoffs} initialFilter={filtroKpi} />
      </div>
    </div>
  );
}
