// app/dashboard/pipeline/page.tsx — P1: Pipeline Kanban por vendedor (Server Component).
// asb-crm: role-based — vendedor vê só o seu routing_team; gestor vê todos (+ filtro opcional).
// asb-dashboard-elite: 1 pergunta — "onde está cada lead do vendedor agora?" + KPIs de topo.
// Fonte: query direta (LISTA de leads pós-handoff, não agregação numérica — cada lead 1x, limit explícito).
import { redirect } from "next/navigation";
import { theme } from "@/lib/theme";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { createClient } from "@/lib/supabase/server";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { PipelineBoard, type PipelineLead, type PipelineCtx } from "./pipeline-board";

export const dynamic = "force-dynamic";

// Etapas-coluna do pipeline do VENDEDOR (pós-handoff). Ordem = fluxo. handoff = origem (não-destino).
export const PIPELINE_STAGES = [
  "handoff", "lead_em_andamento", "negociacao", "proposta_enviada", "pedido_teste", "pedido_fechado", "lead_perdido",
] as const;

// Ativos = em aberto (exclui fechado/perdido). Base dos KPIs.
const ATIVOS = new Set(["handoff", "lead_em_andamento", "negociacao", "proposta_enviada", "pedido_teste"]);
const PRECO_KG = 25; // R$/kg medio (definicao Paulo) para valor estimado de pipeline

const VENDOR_LABELS: Record<string, string> = {
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula", SETOR_CAMPINAS_JUNDIAI: "Alan", SETOR_CUIT: "CUIT",
};

const S = {
  card: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  muted: { color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label } as React.CSSProperties,
  kpiLabel: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#e4e9f0", fontFamily: theme.font.label },
  kpiValue: { fontSize: 24, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
};

const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/pipeline")) redirect("/dashboard");

  const supabase = await createClient();
  const sp = await searchParams;

  // Role-based: vendedor é travado no seu routing_team; gestor escolhe via ?vendedor= (default: todos).
  const spVend = sp?.vendedor && /^SETOR_[A-Z_]+$/.test(sp.vendedor) ? sp.vendedor : null;
  const vendFiltro = ctx.isVendedor ? ctx.routing_team : spVend;

  // Filtro de mês por handoff_at (coorte de entrada no pipeline do vendedor)
  const mesParam = sp?.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : null;
  let mesIni: string | null = null, mesFimEx: string | null = null;
  if (mesParam) {
    const [y, m] = mesParam.split("-").map(Number);
    mesIni = `${mesParam}-01`;
    mesFimEx = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  }

  let q = supabase
    .from("ai_sdr_leads")
    .select("id, phone, restaurant_name, city, weekly_volume_kg, funnel_stage, routing_team, handoff_at, seller_first_reply_at, created_at")
    .eq("is_test", false)
    .in("funnel_stage", PIPELINE_STAGES as unknown as string[])
    .order("handoff_at", { ascending: false, nullsFirst: false })
    .limit(500);
  if (vendFiltro) q = q.eq("routing_team", vendFiltro);
  if (mesIni && mesFimEx) q = q.gte("handoff_at", mesIni).lt("handoff_at", mesFimEx);

  const { data: rawLeads } = await q;
  const leads = (rawLeads ?? []) as PipelineLead[];

  // Agrupa por etapa (server-side, sobre a lista já filtrada)
  const byStage: Record<string, PipelineLead[]> = {};
  for (const s of PIPELINE_STAGES) byStage[s] = [];
  for (const l of leads) (byStage[l.funnel_stage ?? "handoff"] ??= []).push(l);

  // KPIs (sobre os ATIVOS — em aberto)
  const ativos = leads.filter((l) => ATIVOS.has(l.funnel_stage ?? ""));
  const valorEstimado = ativos.reduce((s, l) => s + (l.weekly_volume_kg ?? 0) * PRECO_KG, 0);
  const seteDiasMs = 7 * 86400000;
  const parados7d = ativos.filter((l) => l.handoff_at && Date.now() - new Date(l.handoff_at).getTime() > seteDiasMs).length;

  const boardCtx: PipelineCtx = { isGestor: ctx.isGestor, routing_team: ctx.routing_team, canMoveAll: ctx.isGestor };

  const kpis = [
    { label: "Leads ativos", value: String(ativos.length), accent: "#185FA5", sub: "em aberto (exclui fechado/perdido)" },
    { label: "Valor estimado", value: brl(valorEstimado), accent: "#22c55e", sub: `${ativos.length} leads × R$${PRECO_KG}/kg` },
    { label: "Parados >7d", value: String(parados7d), accent: parados7d > 0 ? "#f59e0b" : "#e4e9f0", sub: "sem mover desde o handoff" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Pipeline {ctx.isVendedor && ctx.routing_team ? `· ${VENDOR_LABELS[ctx.routing_team] ?? ctx.routing_team}` : ""}
          {mesParam ? ` · ${mesParam}` : ""}
        </h1>
        <p style={S.muted}>{leads.length} lead(s) no pipeline · clique no card para abrir · arraste para mover · clique no topo da coluna para a lista</p>
      </div>

      {/* KPIs de topo (3 cards) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...S.card, padding: "16px 18px", borderTop: `2px solid ${k.accent}` }}>
            <p style={{ ...S.kpiLabel, marginBottom: 8 }}>{k.label}</p>
            <p style={S.kpiValue}>{k.value}</p>
            <p style={{ ...S.muted, fontSize: 9, marginTop: 6 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Filtro: mês (todos) + vendedor (só gestor — vendedor é travado no seu) */}
      <div style={{ ...S.card, padding: "12px 16px" }}>
        <DashboardFilters showMonth showVendedor={ctx.isGestor} />
      </div>

      <PipelineBoard byStage={byStage} stages={PIPELINE_STAGES as unknown as string[]} ctx={boardCtx} />
    </div>
  );
}
