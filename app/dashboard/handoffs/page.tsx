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

  // Item 7/DEBT-275: janela do dia comercial BRT (UTC-3) convertida p/ UTC. Antes o card
  // usava toISOString().slice(0,10) (dia UTC) → fronteira errada até 3h perto da meia-noite.
  const nowMs = Date.now();
  const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
  const nowBrt = new Date(nowMs - BRT_OFFSET_MS);
  const startBrtUtc = new Date(Date.UTC(nowBrt.getUTCFullYear(), nowBrt.getUTCMonth(), nowBrt.getUTCDate(), 0, 0, 0) + BRT_OFFSET_MS);
  const endBrtUtc   = new Date(startBrtUtc.getTime() + 24 * 60 * 60 * 1000);

  const [{ data: raw, error }, scoreMap, { count: agendadosHoje }] = await Promise.all([
    // DEBT-208: fila lê a definição CANÔNICA (v_handoff_pendentes, security_invoker
    // preserva RLS por vendedor). Resolver por qualquer via (confirmar / resposta do
    // vendedor / funnel_stage) remove daqui, do card e do detector do CP juntos.
    supabase
      .from("v_handoff_pendentes")
      .select(
        "phone, restaurant_name, city, segment, weekly_volume_kg, routing_team, " +
        "handoff_at, scheduled_at, pain_point, lead_temperature, qual_stage"
      )
      .order("handoff_at", { ascending: true }),
    getLeadScoreMap(),  // ETAPA 4
    // Item 7: "Agendados Hoje" conta sobre ai_sdr_leads (INDEPENDENTE da fila — agendados
    // já assumidos saíam de v_handoff_pendentes e zeravam o card) na janela BRT. RLS
    // (cookie do vendedor) mantém o número vendor-scoped, igual à fila.
    supabase
      .from("ai_sdr_leads")
      .select("phone", { count: "exact", head: true })
      .eq("is_test", false)
      .gte("scheduled_at", startBrtUtc.toISOString())
      .lt("scheduled_at", endBrtUtc.toISOString()),
  ]);

  if (error) throw new Error(error.message);

  // ── KPI computations (server-side) ────────────────────────────────────────────
  const now      = nowMs;
  const fourHAgo = now - 4 * 60 * 60 * 1000;

  // ETAPA 4 + DEBT-308 item 3: enriquece score e ordena por AGENDA (scheduled_at ASC, nulls last) =
  // prioridade de atendimento (mais cedo primeiro); sem agenda vai pro fim. Empate/tail: críticos(>4h) → score DESC.
  const handoffs = ((raw ?? []) as unknown as Handoff[])
    .map((h) => {
      const fromView = scoreMap[h.phone];
      const score = fromView?.score ?? computeLeadScore(h);
      const tier = fromView?.tier ?? tierOf(score);
      return { ...h, lead_score: score, lead_tier: tier };
    })
    .sort((a, b) => {
      const sa = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
      const sb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
      if (sa !== sb) return sa - sb;                             // agenda ASC, nulls last
      const critA = new Date(a.handoff_at).getTime() < fourHAgo ? 1 : 0;
      const critB = new Date(b.handoff_at).getTime() < fourHAgo ? 1 : 0;
      if (critA !== critB) return critB - critA;                 // tail sem agenda: críticos primeiro
      return (b.lead_score ?? 0) - (a.lead_score ?? 0);          // depois score DESC
    });

  const totalPending  = handoffs.length;
  const criticalCount = handoffs.filter(h => new Date(h.handoff_at).getTime() < fourHAgo).length;

  // Item 7: contagem vem da query independente da fila (janela BRT), não mais do slice UTC da fila.
  const todayCount = agendadosHoje ?? 0;

  // Cards clicáveis fase 2 (pedido Paulo): KPI filtra a tabela via ?f= (o filtro
  // vive na própria tabela — sobrevive ao refetch do Realtime).
  const kpis = [
    { label: "Total Pendentes",    value: totalPending,  accent: "#f59e0b", sub: "aguardando confirmação · clique p/ ver todos", href: "/dashboard/handoffs" },
    { label: "Críticos (> 4h)",    value: criticalCount, accent: "#C8102E", sub: "sem confirmação há > 4h · clique p/ filtrar", href: "/dashboard/handoffs?f=criticos" },
    { label: "Agendados Hoje",     value: todayCount,    accent: "#22c55e", sub: "com horário p/ hoje (todos, não só a fila) · clique p/ ver os pendentes", href: "/dashboard/handoffs?f=hoje" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "var(--asb-page-ink)", fontSize: 20, fontWeight: 800, fontFamily: theme.font.label, letterSpacing: "-.01em", textTransform: "none", marginBottom: 4 }}>
          Fila de Handoff
        </h1>
        <p style={{ ...S.muted, color: "var(--asb-page-ink2)" }}>Leads aguardando confirmação do vendedor</p>
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
