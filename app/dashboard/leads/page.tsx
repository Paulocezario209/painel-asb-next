import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { LeadsTable } from "@/components/leads/leads-table";
import { PerdidosList, type LostLead } from "@/components/leads/perdidos-list";
import { ForaDeRotaTable, type ForaRotaLead } from "@/components/leads/fora-de-rota-table";
import { EsgotadaTable, type EsgotadaLead } from "@/components/leads/esgotada-table";
import { ParadosList, type ParadoLead } from "@/components/leads/parados-list";
import { NAO_ATIVO_STAGES, STAGE_ORDER, STAGE_LABELS, CONVERTIDO_SET, rawStagesFor } from "@/lib/funnel/stages";
import { CADENCIA_PHASES } from "@/lib/followup/cadencia";
import { LeadsCards } from "@/components/leads/leads-cards";
import { getLeadScoreMap } from "@/lib/get-lead-scores";
import { computeLeadScore, tierOf } from "@/lib/lead-score";
import { theme } from "@/lib/theme";
import { PageHead } from "@/app/dashboard/lib/ui";

export const dynamic = "force-dynamic";

// ETAPA9C: abas da tela de leads
const VIEWS = [
  { key: "ativos", label: "Leads SDR" },   // "entrou hoje" — caixa de entrada do dia (Paulo 2026-07-14)
  { key: "parados", label: "Parados" },
  { key: "perdidos", label: "Perdidos" },
  { key: "fora_de_rota", label: "Fora de Rota" },
  { key: "esgotada", label: "Esgotada" },   // DEBT-318: cadência desistiu (falha envio/leak 3×)
] as const;

// Modo COORTE (link das linhas de "Conversão da coorte" do /dashboard/funil):
// ?mes=YYYY-MM&marco=X abre SÓ os leads daquele marco/mês — mesmos critérios da RPC get_funil_marcos.
const MARCOS_COORTE: Record<string, string> = {
  criados: "Leads criados",
  qualificados: "Qualificados (qual_stage ≥ 7)",
  handoff: "Agendamento",
  vendedor_assumiu: "Vendedor assumiu",
  pedido_fechado: "Pedido fechado",
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const view = sp.view === "perdidos" ? "perdidos" : sp.view === "fora_de_rota" ? "fora_de_rota" : sp.view === "esgotada" ? "esgotada" : sp.view === "parados" ? "parados" : "ativos";
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const mesCoorte = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : null;
  const marcoCoorte = sp.marco && MARCOS_COORTE[sp.marco] ? sp.marco : null;
  const vendCoorte = sp.vendedor && /^SETOR_[A-Z_]+$/.test(sp.vendedor) ? sp.vendedor : null;
  const coorteAtiva = Boolean(mesCoorte && marcoCoorte && view === "ativos");

  // Modo COORTE POR ETAPA (link dos cards "Leads por Etapa" do /dashboard/funil):
  // ?etapa=<funnel_stage canônico não-terminal> abre a lista dos leads NAQUELA etapa
  // (posição atual, global sem fora-de-rota) — mesmo recorte do card do Funil.
  const etapaCoorte = sp.etapa && STAGE_ORDER.includes(sp.etapa as (typeof STAGE_ORDER)[number]) && !CONVERTIDO_SET.has(sp.etapa) ? sp.etapa : null;
  const coorteEtapaAtiva = Boolean(etapaCoorte && !coorteAtiva && view === "ativos");

  // Item 6 / DEBT-274: busca SERVER-SIDE (ilike sobre TODAS as linhas, antes do limit)
  // — antes a lupa filtrava só os <=100 carregados (busca cega). qSafe neutraliza os
  // metachars do filtro PostgREST (vírgula/parênteses/%/*) pra não quebrar o .or().
  const qRaw = (sp.q ?? "").trim().slice(0, 60);
  const qSafe = qRaw.replace(/[,()%*\\]/g, " ").trim();

  // Régua "Leads SDR = entrou HOJE" (Paulo 2026-07-14): início do dia corrente em BRT (UTC-3),
  // convertido p/ ISO/UTC — leads criados a partir daí = a caixa de entrada do dia. Virou o dia → Parados.
  const _todayBRT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const startTodayUtc = new Date(`${_todayBRT}T00:00:00-03:00`).toISOString();

  let leadsQuery = supabase
    .from("ai_sdr_leads")
    .select(
      "phone, name, city, segment, weekly_volume_kg, lead_temperature, lead_status, routing_team, qual_stage, handoff_at, handoff_confirmed, handoff_confirmed_at, first_order_at, ai_active, created_at, updated_at, followup_count, pain_point, product_groups, scheduled_at, human_active, origem_canal, origem_utm_source, origem_utm_campaign, ad_id"
    )
    .eq("is_test", false);

  if (coorteAtiva) {
    // recorte da coorte: janela do mês + critério do marco (EM ROTA — espelha a RPC get_funil_marcos; DEBT-167, 2026-07-19)
    const [y, m] = mesCoorte!.split("-").map(Number);
    const ini = `${mesCoorte}-01`;
    const fim = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    leadsQuery = leadsQuery.gte("created_at", ini).lt("created_at", fim)
      .or("routing_team.is.null,and(routing_team.neq.fora_de_rota,routing_team.neq.fornecedor)");   // fora-de-rota tem aba própria (view=fora_de_rota)
    if (vendCoorte) leadsQuery = leadsQuery.eq("routing_team", vendCoorte);
    if (marcoCoorte === "qualificados") leadsQuery = leadsQuery.gte("qual_stage", 7);
    if (marcoCoorte === "handoff") leadsQuery = leadsQuery.not("handoff_at", "is", null);
    if (marcoCoorte === "vendedor_assumiu") leadsQuery = leadsQuery.not("seller_first_reply_at", "is", null);
    if (marcoCoorte === "pedido_fechado") leadsQuery = leadsQuery.not("first_order_at", "is", null);
  } else if (coorteEtapaAtiva) {
    // Drill por etapa (posição atual): mesmos filtros do card do Funil (sem fora-de-rota),
    // filtrando pelos stages CRUS que projetam na etapa canônica (rawStagesFor) p/ o número bater.
    leadsQuery = leadsQuery
      .or("routing_team.is.null,and(routing_team.neq.fora_de_rota,routing_team.neq.fornecedor)")
      .in("funnel_stage", rawStagesFor(etapaCoorte!));
  } else {
    leadsQuery = leadsQuery.or("routing_team.is.null,and(routing_team.neq.fora_de_rota,routing_team.neq.fornecedor)");   // DEBT-167 4: ATIVOS não lista fora_de_rota (NULL-safe)
    // Fase 1 / DEBT-286/287: convertido E perdido NÃO são lead ativo. Convertido vive
    // na Carteira (v_carteira_360); perdido vive na aba Perdidos. Sem excluir os dois,
    // contam em Ativos por presença dupla (perdido inflava 143→268). NAO_ATIVO_STAGES =
    // CONVERTIDO_STAGES ∪ lead_perdido. first_order_at cobre a marcação-painel de 1ª compra.
    leadsQuery = leadsQuery
      .is("first_order_at", null)
      .not("funnel_stage", "in", `(${NAO_ATIVO_STAGES.join(",")})`)
      // DEBT-288: lead em cadência automática NÃO é "ativo do vendedor" — vive no board
      // de Follow-up (v_leads_cadencia). Single source: CADENCIA_PHASES (lib/followup/cadencia).
      .or(`next_followup_at.is.null,followup_phase.not.in.(${CADENCIA_PHASES.join(",")})`)
      // DEBT-290 (Leads SDR): "entrou HOJE" — só o dia corrente. Virou o dia → Parados.
      .gte("created_at", startTodayUtc);
  }

  // Item 6: busca server-side aplicada ANTES do limit (superset garantido vs busca client)
  if (qSafe) {
    leadsQuery = leadsQuery.or(`name.ilike.%${qSafe}%,phone.ilike.%${qSafe}%,city.ilike.%${qSafe}%`);
  }

  const [{ data: rawLeads }, scoreMap] = await Promise.all([
    leadsQuery
      .order("created_at", { ascending: false })
      .limit(500)
      .range(0, 499),
    getLeadScoreMap(),  // ETAPA 4: score por phone (v_lead_score via service role)
  ]);

  // ETAPA 4: enriquece com lead_score/lead_tier (view, fallback fórmula) + ordena por score DESC
  const leads = (rawLeads ?? [])
    .map((l) => {
      const fromView = scoreMap[l.phone as string];
      const score = fromView?.score ?? computeLeadScore(l);
      const tier = fromView?.tier ?? tierOf(score);
      return { ...l, lead_score: score, lead_tier: tier };
    })
    .sort((a, b) => (b.lead_score ?? 0) - (a.lead_score ?? 0));

  // ETAPA9C: aba PERDIDOS — leads lead_perdido nos últimos 180 dias
  let lostLeads: LostLead[] = [];
  if (view === "perdidos") {
    const since = new Date(Date.now() - 180 * 86400000).toISOString();
    const { data } = await supabase
      .from("ai_sdr_leads")
      .select("phone, restaurant_name, name, city, segment, weekly_volume_kg, lost_reason, lost_at, routing_team")
      .eq("funnel_stage", "lead_perdido")
      .eq("is_test", false)
      .eq("is_encosto", false)  // DEBT-321: encosto tem fila própria (Contas de Encosto). Aqui = ghosts p/ reativação.
      .gte("lost_at", since)
      .order("weekly_volume_kg", { ascending: false, nullsFirst: false })
      .limit(50);
    lostLeads = (data ?? []) as LostLead[];
  }

  // FORA_DE_ROTA: routing_team='fora_de_rota' (espelha fetch do hot-leads: server busca → tabela client)
  let foraRotaLeads: ForaRotaLead[] = [];
  if (view === "fora_de_rota") {
    const { data } = await supabase
      .from("ai_sdr_leads")
      .select("phone, name, restaurant_name, city, segment, weekly_volume_kg, last_contact")
      .eq("routing_team", "fora_de_rota")
      .eq("is_test", false)
      .order("weekly_volume_kg", { ascending: false, nullsFirst: false })
      .order("last_contact", { ascending: false, nullsFirst: false })
      .limit(100);
    foraRotaLeads = (data ?? []) as ForaRotaLead[];
  }

  // Item 10: aba PARADOS — v_leads_parados (security_invoker → RLS vendor-scoped).
  let paradosLeads: ParadoLead[] = [];
  if (view === "parados") {
    const { data } = await supabase
      .from("v_leads_parados")
      .select("id, phone, restaurant_name, city, routing_team, funnel_stage, qual_stage, last_reply_at, dias_parado")
      .order("last_reply_at", { ascending: true, nullsFirst: true })
      .limit(1000);
    paradosLeads = (data ?? []) as ParadoLead[];
  }

  // DEBT-318: aba ESGOTADA — v_cadencia_esgotada (leads que a cadência desistiu: falha envio/leak 3×).
  let esgotadaLeads: EsgotadaLead[] = [];
  if (view === "esgotada") {
    const { data } = await supabase
      .from("v_cadencia_esgotada")
      .select("phone, name, restaurant_name, city, routing_team, funnel_stage, followup_fail_count, leak_retry_count, last_followup_at, contexto_resumo, motivo_esgotamento")
      .order("last_followup_at", { ascending: false, nullsFirst: false })
      .limit(200);
    esgotadaLeads = (data ?? []) as EsgotadaLead[];
  }

  // Fase 1.2 (DEBT-286): contagens das 4 abas p/ os cards de resumo (head:true = só count).
  // Ativos usa o MESMO filtro da lista (convertido já fora); Parados lê a MESMA fonte da aba
  // (v_leads_parados) → card e aba nunca divergem.
  const since180 = new Date(Date.now() - 180 * 86400000).toISOString();
  const naoAtivoInList = `(${NAO_ATIVO_STAGES.join(",")})`;
  const [cAtivos, cParados, cPerdidos, cFora, cEsgotada] = await Promise.all([
    supabase.from("ai_sdr_leads").select("phone", { count: "exact", head: true })
      .eq("is_test", false).or("routing_team.is.null,and(routing_team.neq.fora_de_rota,routing_team.neq.fornecedor)")
      .is("first_order_at", null).not("funnel_stage", "in", naoAtivoInList)
      .or(`next_followup_at.is.null,followup_phase.not.in.(${CADENCIA_PHASES.join(",")})`)  // DEBT-288: cadência vive no Follow-up
      .gte("created_at", startTodayUtc),  // DEBT-290: Leads SDR = entrou hoje
    supabase.from("v_leads_parados").select("id", { count: "exact", head: true }),
    supabase.from("ai_sdr_leads").select("phone", { count: "exact", head: true })
      .eq("is_test", false).eq("funnel_stage", "lead_perdido").eq("is_encosto", false).gte("lost_at", since180),
    supabase.from("ai_sdr_leads").select("phone", { count: "exact", head: true })
      .eq("is_test", false).eq("routing_team", "fora_de_rota"),
    supabase.from("v_cadencia_esgotada").select("phone", { count: "exact", head: true }),
  ]);
  const cardCounts = {
    ativos: cAtivos.count ?? 0,
    parados: cParados.count ?? 0,
    perdidos: cPerdidos.count ?? 0,
    fora_de_rota: cFora.count ?? 0,
    esgotada: cEsgotada.count ?? 0,
  };

  return (
    <div className="space-y-4">
      <div>
        <PageHead
          title="Leads"
          desc={
            coorteEtapaAtiva ? `${leads.length} leads na etapa ${STAGE_LABELS[etapaCoorte!] ?? etapaCoorte} — posição atual no funil`
              : view === "ativos" ? `${leads.length} leads que entraram hoje — a caixa de entrada do SDR (virou o dia → Parados)`
              : view === "parados" ? "No funil há 1–30 dias — o vendedor deve resolver (fechar ou marcar perdido com motivo) até o dia 30"
              : view === "perdidos" ? "Fila de recuperação — perdidos nos últimos 180 dias"
              : view === "esgotada" ? "Cadência esgotada — o envio falhou 3× (ou placeholder leak): a IA desistiu, o gestor decide o destino"
              : "Fora de cobertura — registrados para expansão futura"
          }
        />
        {(coorteAtiva || coorteEtapaAtiva) && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 8, background: "rgba(46,160,67,.12)", border: "1px solid #2ea043", borderRadius: 4, padding: "6px 12px" }}>
            <span style={{ color: "#2ea043", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".06em" }}>
              {coorteEtapaAtiva
                ? `ETAPA · ${STAGE_LABELS[etapaCoorte!] ?? etapaCoorte}`
                : `COORTE ${mesCoorte} · ${MARCOS_COORTE[marcoCoorte!]}${vendCoorte ? ` · ${vendCoorte.replace("SETOR_", "")}` : ""}`}
            </span>
            <Link href="/dashboard/leads" style={{ color: "#c0d0e0", fontSize: 10, fontFamily: theme.font.label, textDecoration: "underline" }}>
              limpar filtro
            </Link>
          </div>
        )}
      </div>

      {/* Fase 1.2 (DEBT-286): cards de resumo das 4 abas (total + % · clicáveis) */}
      <LeadsCards counts={cardCounts} active={view} />

      {/* ETAPA9C: toggle ATIVOS | PERDIDOS */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${theme.colors.borderDefault}` }}>
        {VIEWS.map((t) => {
          const active = view === t.key;
          return (
            <Link
              key={t.key}
              href={`/dashboard/leads?view=${t.key}`}
              style={{
                padding: "8px 16px",
                fontFamily: theme.font.label,
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: active ? "#fff" : theme.colors.neutral,
                background: active ? theme.colors.brandAsb : "transparent",
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                borderBottom: active ? `2px solid ${theme.colors.brandAsb}` : "2px solid transparent",
                textDecoration: "none",
                transition: "all .15s",
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {view === "perdidos" ? (
        <PerdidosList leads={lostLeads} />
      ) : view === "parados" ? (
        <ParadosList leads={paradosLeads} />
      ) : view === "fora_de_rota" ? (
        <ForaDeRotaTable leads={foraRotaLeads} />
      ) : view === "esgotada" ? (
        <EsgotadaTable leads={esgotadaLeads} />
      ) : (
        <>
          <LeadsTable leads={leads ?? []} userEmail={user?.email ?? ""} initialStatus={sp.status ?? "all"} initialQ={sp.q ?? ""} />
          <p style={{ color: "#e4e9f0", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
            Exibindo até 500 leads — a busca é server-side (varre todos); use os filtros para refinar.
          </p>
        </>
      )}
    </div>
  );
}
