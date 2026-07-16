import { createClient } from "@/lib/supabase/server";
import { HandoffsTable, type Handoff } from "@/components/handoffs/handoffs-table";
import { getLeadScoreMap } from "@/lib/get-lead-scores";
import { computeLeadScore, tierOf } from "@/lib/lead-score";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { handoffSituacao } from "@/lib/handoff-status";
import { PhoneCall, AlertTriangle, CalendarClock, Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

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
  // DEBT-308: "vencido" = passou do horário AGENDADO (não pelo tempo desde a criação).
  // Agendado pro futuro nunca conta como vencido.
  const overdueCount  = handoffs.filter(h => handoffSituacao(h.scheduled_at, h.handoff_at, now).overdue).length;

  // Item 7: contagem vem da query independente da fila (janela BRT), não mais do slice UTC da fila.
  const todayCount = agendadosHoje ?? 0;

  // Cards clicáveis fase 2 (pedido Paulo): KPI filtra a tabela via ?f= (o filtro
  // vive na própria tabela — sobrevive ao refetch do Realtime).
  const kpis = [
    { label: "Total pendentes", value: totalPending, Icon: PhoneCall,     accent: "#f59e0b", num: "#f59e0b", note: "aguardando confirmação · clique p/ ver todos", href: "/dashboard/handoffs" },
    { label: "Vencidos",        value: overdueCount, Icon: AlertTriangle, accent: "#C8102E", num: "#C8102E", note: "passaram do horário agendado · clique p/ filtrar", href: "/dashboard/handoffs?f=criticos" },
    { label: "Agendados hoje",  value: todayCount,   Icon: CalendarClock, accent: "#22c55e", num: "#22c55e", note: "com horário p/ hoje (todos, não só a fila) · clique p/ ver os pendentes", href: "/dashboard/handoffs?f=hoje" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="Agendamentos" desc="Leads agendados aguardando confirmação do vendedor" />

      {/* KPIs */}
      <div className="asb-grid-kpi">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Table */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={Inbox} color="#C8102E" title="Agendamentos pendentes" desc="Ordenados por agenda e criticidade" />
        <HandoffsTable initial={handoffs} initialFilter={filtroKpi} />
      </div>
    </div>
  );
}
