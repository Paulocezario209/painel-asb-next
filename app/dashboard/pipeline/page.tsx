// app/dashboard/pipeline/page.tsx — P1: Pipeline Kanban por vendedor (Server Component).
// asb-crm: role-based — vendedor vê só o seu routing_team; gestor vê todos (+ filtro opcional).
// asb-dashboard-elite: 1 pergunta — "onde está cada lead do vendedor agora?" + KPIs de topo.
// Fonte: query direta (LISTA de leads pós-handoff, não agregação numérica — cada lead 1x, limit explícito).
import { redirect } from "next/navigation";
import { PRECO_KG } from "@/lib/pricing";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { PIPELINE_STAGES, PIPELINE_ATIVOS, LEGACY_ALIAS, CONVERTIDO_STAGES } from "@/lib/funnel/stages";
import { VENDOR_LABELS } from "@/lib/vendor-labels";
import { createClient } from "@/lib/supabase/server";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { PipelineBoard, PipelineKpis, type PipelineLead, type PipelineCtx } from "./pipeline-board";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead } from "@/app/dashboard/lib/ui";

export const dynamic = "force-dynamic";

// Vocabulário: FONTE ÚNICA em lib/funnel/stages.ts (DEBT-157 fechada).
// Projeção desta tela: board TERMINA na conversão — stages de cliente (legado em
// ai_sdr_leads) colapsam na coluna "Convertido" (pedido_fechado). Redesenho 2026-07-09.
const LEGACY_STAGES = [
  ...Object.keys(LEGACY_ALIAS),
  ...CONVERTIDO_STAGES.filter(s => s !== "pedido_fechado"),
] as const;
const BOARD_ALIAS: Record<string, string> = {
  ...LEGACY_ALIAS,
  // Item 5 / MODELO OPERACIONAL (Paulo 2026-07-13): lead 'vendedor_assumiu' aterrissa
  // na coluna HANDOFF (não "Em Andamento"). Override board-specific — NÃO mexe no
  // LEGACY_ALIAS global (funil/timeline seguem vendo vendedor_assumiu→lead_em_andamento).
  // Daí o vendedor arrasta Handoff→Em Andamento (mark_lead_em_andamento, que aceita
  // from='vendedor_assumiu' desde a migration 2026-07-14 / DEBT-272 1b). Destrava os 55.
  vendedor_assumiu: "handoff",
  ...Object.fromEntries(CONVERTIDO_STAGES.filter(s => s !== "pedido_fechado").map(s => [s, "pedido_fechado"])),
};
const aliasStage = (s: string | null) => (s && BOARD_ALIAS[s]) || s || "handoff";

// Ativos = em aberto (exclui fechado/perdido). Base dos KPIs.
const ATIVOS = PIPELINE_ATIVOS;

const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/pipeline")) redirect("/dashboard");

  const supabase = await createClient();
  const sp = await searchParams;

  // Role-based: vendedor é travado no seu routing_team; gestor escolhe via ?vendedor= (default: todos).
  const spVend = sp?.vendedor && /^SETOR_[A-Z_]+$/.test(sp.vendedor) ? sp.vendedor : null;
  const vendFiltro = ctx.isVendedor ? ctx.routing_team : spVend;

  // Busca (lupa): server-side ilike sobre nome/cidade/telefone, ANTES do limit 500
  // (varre toda a base pós-handoff do filtro atual). qSafe neutraliza metachars do .or().
  const qRaw = (sp?.q ?? "").trim().slice(0, 60);
  const qSafe = qRaw.replace(/[,()%*\\]/g, " ").trim();

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
    .select("id, phone, restaurant_name, city, weekly_volume_kg, funnel_stage, routing_team, handoff_at, seller_first_reply_at, created_at, motivo_handoff, interesse_preco, pediu_catalogo")
    .eq("is_test", false)
    .in("funnel_stage", [...PIPELINE_STAGES, ...LEGACY_STAGES] as unknown as string[])
    .order("handoff_at", { ascending: false, nullsFirst: false })
    .limit(500);
  if (vendFiltro) q = q.eq("routing_team", vendFiltro);
  if (mesIni && mesFimEx) q = q.gte("handoff_at", mesIni).lt("handoff_at", mesFimEx);
  if (qSafe) q = q.or(`restaurant_name.ilike.%${qSafe}%,city.ilike.%${qSafe}%,phone.ilike.%${qSafe}%`);

  // Ponte lead→ARES (redesenho 2026-07-09): lead presente em v_carteira_360 já FATUROU →
  // conversão CONFIRMADA. Agrupa em "Convertido" mesmo sem o vendedor arrastar o card.
  const [{ data: rawLeads }, { data: rawPonte }] = await Promise.all([
    q,
    supabase.from("v_carteira_360").select("lead_id").not("lead_id", "is", null),
  ]);
  const aresLeadIds = new Set(((rawPonte ?? []) as { lead_id: string }[]).map((r) => r.lead_id));
  const leads = ((rawLeads ?? []) as PipelineLead[]).map((l) => ({
    ...l, ares_confirmado: aresLeadIds.has(l.id),
  }));

  // Etapa efetiva: ARES vence o funnel_stage manual (badge ✓ ARES no card).
  const stageEfetiva = (l: PipelineLead) => (l.ares_confirmado ? "pedido_fechado" : aliasStage(l.funnel_stage));

  // Agrupa por etapa (server-side, sobre a lista já filtrada; alias colapsa legados)
  const byStage: Record<string, PipelineLead[]> = {};
  for (const s of PIPELINE_STAGES) byStage[s] = [];
  for (const l of leads) (byStage[stageEfetiva(l)] ??= []).push(l);

  // KPIs (sobre os ATIVOS — em aberto; alias inclui legados em "em andamento")
  const ativos = leads.filter((l) => ATIVOS.has(stageEfetiva(l)));
  const valorEstimado = ativos.reduce((s, l) => s + (l.weekly_volume_kg ?? 0) * PRECO_KG, 0);
  const seteDiasMs = 7 * 86400000;
  const parados7d = ativos.filter((l) => l.handoff_at && Date.now() - new Date(l.handoff_at).getTime() > seteDiasMs).length;

  const boardCtx: PipelineCtx = { isGestor: ctx.isGestor, routing_team: ctx.routing_team, canMoveAll: ctx.isGestor };

  const paradosList = ativos.filter((l) => l.handoff_at && Date.now() - new Date(l.handoff_at).getTime() > seteDiasMs);
  const kpis = [
    { label: "Leads ativos", value: String(ativos.length), accent: "#185FA5", sub: "em aberto (exclui convertido/perdido)", leads: ativos },
    { label: "Valor estimado", value: brl(valorEstimado), accent: "#22c55e", sub: `${ativos.length} leads × R$${PRECO_KG}/kg`, leads: ativos },
    { label: "Parados >7d", value: String(parados7d), accent: parados7d > 0 ? "#f59e0b" : "#e4e9f0", sub: "sem mover desde o agendamento", leads: paradosList },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Header */}
      <PageHead
        title={`Pipeline${ctx.isVendedor && ctx.routing_team ? ` · ${VENDOR_LABELS[ctx.routing_team] ?? ctx.routing_team}` : ""}${mesParam ? ` · ${mesParam}` : ""}`}
        desc={`${leads.length} lead(s) no pipeline · clique no card para abrir · arraste para mover · clique no topo da coluna para a lista`}
      />

      {/* KPIs de topo (3 cards, clicáveis → lista no modal) */}
      <PipelineKpis kpis={kpis} />

      {/* Filtro: busca (lupa) + mês (todos) + vendedor (só gestor — vendedor é travado no seu) */}
      <div style={{ ...S.card, padding: "12px 16px" }}>
        <DashboardFilters showSearch showMonth showVendedor={ctx.isGestor} />
      </div>

      {/* key = assinatura do filtro: troca de vendedor/mês/busca REMONTA o board com os
          dados filtrados do server (senão o useState(byStage) fica preso no "Todos").
          Dentro do mesmo filtro o key não muda → drag otimista segue funcionando. */}
      <PipelineBoard
        key={`${vendFiltro ?? "todos"}|${mesParam ?? ""}|${qSafe}`}
        byStage={byStage} stages={PIPELINE_STAGES as unknown as string[]} ctx={boardCtx}
      />
    </div>
  );
}
