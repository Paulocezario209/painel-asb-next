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
// Pipeline V3 (Passo 10, Paulo 2026-08-06): board TERMINA em "Aguardando 1º Pedido" — a
// última transição MANUAL do vendedor. Leads já convertidos (pedido_1+/cliente_recorrente,
// incl. legado pedido_fechado/cliente_*) não aparecem MAIS no board — "graduam" direto pra
// Carteira (v_carteira_360) assim que o ARES confirma, sem passar por uma coluna própria
// (substitui a antiga coluna "Convertido"/pedido_fechado do redesenho 2026-07-09).
const LEGACY_STAGES = [
  ...Object.keys(LEGACY_ALIAS).filter(s => !CONVERTIDO_STAGES.includes(s as (typeof CONVERTIDO_STAGES)[number])),
  "pedido_teste", // Funil v3: etapa deprecada (substituída por cadastro_cliente). Mantida no
                  // fetch p/ um lead legado eventual aterrissar em "Cadastro" via BOARD_ALIAS.
] as const;
const BOARD_ALIAS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(LEGACY_ALIAS).filter(([, v]) => !CONVERTIDO_STAGES.includes(v as (typeof CONVERTIDO_STAGES)[number]))),
  // Funil v3 (2026-07-16): "pedido_teste" era conversão manual imediata (→ cliente_em_ativacao).
  // Deprecada. Qualquer lead legado ainda nela vira "Cadastro do Cliente" no board.
  pedido_teste: "cadastro_cliente",
  // Item 5 / MODELO OPERACIONAL (Paulo 2026-07-13): lead 'vendedor_assumiu' aterrissa
  // na coluna AGENDAMENTO (não "Em Andamento"). Override board-specific — NÃO mexe no
  // LEGACY_ALIAS global (funil/timeline seguem vendo vendedor_assumiu→agendamento, que já
  // é o mesmo destino aqui — mantido explícito por clareza histórica do Item 5).
  // Daí o vendedor arrasta Agendamento→Em Andamento (mark_lead_em_andamento, que aceita
  // from='vendedor_assumiu' desde a migration 2026-07-14 / DEBT-272 1b). Destrava os 55.
  vendedor_assumiu: "agendamento",
};
const aliasStage = (s: string | null) => (s && BOARD_ALIAS[s]) || s || "agendamento";

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
    .select("id, phone, restaurant_name, city, weekly_volume_kg, funnel_stage, routing_team, handoff_at, seller_first_reply_at, created_at, motivo_handoff, interesse_preco, pediu_catalogo, cnpj, ares_pessoa_id")
    .eq("is_test", false)
    .in("funnel_stage", [...PIPELINE_STAGES, ...LEGACY_STAGES] as unknown as string[])
    .order("handoff_at", { ascending: false, nullsFirst: false })
    .limit(500);
  if (vendFiltro) q = q.eq("routing_team", vendFiltro);
  if (mesIni && mesFimEx) q = q.gte("handoff_at", mesIni).lt("handoff_at", mesFimEx);
  if (qSafe) q = q.or(`restaurant_name.ilike.%${qSafe}%,city.ilike.%${qSafe}%,phone.ilike.%${qSafe}%`);

  // Ponte lead→ARES (redesenho 2026-07-09): lead presente em v_carteira_360 já FATUROU →
  // conversão CONFIRMADA. Agrupa em "Convertido" mesmo sem o vendedor arrastar o card.
  const [{ data: rawLeads }, { data: rawPonte }, { data: rawTop }] = await Promise.all([
    q,
    // Ponte lead→ARES: lead_id + first_order_at (data da 1ª compra na carteira real).
    // first_order_at decide a GRADUAÇÃO (convertido do mês fica × recorrente antigo sai).
    supabase.from("v_carteira_360").select("lead_id, first_order_at").not("lead_id", "is", null),
    // Onda 4b A.2 — catálogo COMPLETO de produtos pro orçamento (todos já vendidos, do espelho),
    // ordenado por mais vendido. "Quem puxa 10 puxa tudo" — mesma fonte, sem o corte de top-10.
    supabase.from("v_produtos_catalogo").select("descricao_produto, grupo_nome").order("valor_total", { ascending: false }),
  ]);
  const ponte = (rawPonte ?? []) as { lead_id: string; first_order_at: string | null }[];
  const aresLeadIds = new Set(ponte.map((r) => r.lead_id));
  // GRADUAÇÃO (Passo 10, Paulo 2026-08-06 — substitui a régua por mês do DEBT-325): quem já
  // tem funnel_stage pós-1º-pedido (pedido_1+/cliente_recorrente, legado pedido_fechado/
  // cliente_*) SOME do Pipeline direto — a própria query acima já exclui (LEGACY_STAGES não
  // inclui esses valores, ver lib/funnel/stages.ts). Não existe mais coluna "Convertido" pra
  // aguardar o fim do mês. ares_confirmado (ponte v_carteira_360) fica só como BADGE
  // informativo "✓ ARES" pro caso de a cascata automática (Passo 4, cron 15min) ainda não
  // ter promovido o funnel_stage — o lead segue visível na coluna real até a promoção.
  const leads = ((rawLeads ?? []) as PipelineLead[])
    .map((l) => ({ ...l, ares_confirmado: aresLeadIds.has(l.id) }));

  // Etapa efetiva: alias de legado + override do board (agendamento origem etc.).
  const stageEfetiva = (l: PipelineLead) => aliasStage(l.funnel_stage);

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
        produtos={(rawTop ?? []) as { descricao_produto: string | null; grupo_nome: string | null }[]}
      />
    </div>
  );
}
