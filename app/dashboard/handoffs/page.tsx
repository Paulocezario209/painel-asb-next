import { createClient } from "@/lib/supabase/server";
import { HandoffsTable, type Handoff } from "@/components/handoffs/handoffs-table";
import { getLeadScoreMap } from "@/lib/get-lead-scores";
import { computeLeadScore, tierOf } from "@/lib/lead-score";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { theme } from "@/lib/theme";
import { PageHead, SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { handoffSituacao } from "@/lib/handoff-status";
import { VENDOR_LABELS } from "@/lib/vendor-labels";
import { PhoneCall, AlertTriangle, CalendarClock, Inbox, Gauge } from "lucide-react";

// Onda 4 — formata minutos em h/d p/ o "tempo médio até confirmar"
function fmtMinEfic(m: number | null): string {
  if (m == null) return "—";
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
type EficVendedor = {
  routing_team: string; vendor_name: string | null;
  agendamentos: number; confirmados: number; pct_confirmados: number | null;
  min_medio_confirmar: number | null; com_horario: number; no_horario: number; pct_no_horario: number | null;
};

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

  const [{ data: raw, error }, scoreMap, { count: agendadosHoje }, { data: eficRaw }] = await Promise.all([
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
    // Onda 4 — eficiência por vendedor (RLS via security_invoker: vendedor vê o seu, gestor todos)
    supabase
      .from("v_eficiencia_agendamento_vendedor")
      .select("routing_team, vendor_name, agendamentos, confirmados, pct_confirmados, min_medio_confirmar, com_horario, no_horario, pct_no_horario"),
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

  // Onda 4 — eficiência por vendedor (RLS já aplicada pela view security_invoker)
  const efic = (eficRaw ?? []) as EficVendedor[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="Agendamentos" desc="Leads agendados aguardando confirmação do vendedor" />

      {/* KPIs */}
      <div className="asb-grid-kpi">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Onda 4 — Eficiência do Atendimento (âncora: botão Confirmar). Vendedor vê o seu; gestor todos. */}
      {efic.length > 0 && (
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <SectionHead Icon={Gauge} color="#8bb4ff" title="Eficiência do Atendimento"
            desc="Como o vendedor assume os agendamentos — medido pelo botão Confirmar" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 4 }}>
            {efic.map((e) => {
              const nome = e.vendor_name ?? VENDOR_LABELS[e.routing_team] ?? e.routing_team;
              const pc = e.pct_confirmados ?? 0;
              const confCor = pc >= 90 ? "#22c55e" : pc >= 70 ? "#f59e0b" : "#C8102E";
              const stat = (label: string, value: string, cor: string, sub?: string) => (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: cor, fontSize: 18, fontFamily: theme.font.num, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value}</div>
                  <div style={{ color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, marginTop: 1 }}>{label}</div>
                  {sub ? <div style={{ color: "#6b7688", fontSize: 8, fontFamily: theme.font.label }}>{sub}</div> : null}
                </div>
              );
              return (
                <div key={e.routing_team} style={{ background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ color: "#e4e9f0", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, marginBottom: 10 }}>{nome}</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    {stat("Confirmados", `${pc}%`, confCor, `${e.confirmados}/${e.agendamentos}`)}
                    {stat("Até confirmar", fmtMinEfic(e.min_medio_confirmar), "#e4e9f0", "média")}
                    {stat("No horário", e.com_horario > 0 ? `${e.pct_no_horario ?? 0}%` : "—", "#8bb4ff", e.com_horario > 0 ? `de ${e.com_horario} c/ hora` : "sem horário ainda")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={Inbox} color="#C8102E" title="Agendamentos pendentes" desc="Ordenados por agenda e criticidade" />
        <HandoffsTable initial={handoffs} initialFilter={filtroKpi} />
      </div>
    </div>
  );
}
