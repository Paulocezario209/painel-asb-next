import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { LeadsTable } from "@/components/leads/leads-table";
import { PerdidosList, type LostLead } from "@/components/leads/perdidos-list";
import { ForaDeRotaTable, type ForaRotaLead } from "@/components/leads/fora-de-rota-table";
import { getLeadScoreMap } from "@/lib/get-lead-scores";
import { computeLeadScore, tierOf } from "@/lib/lead-score";
import { theme } from "@/lib/theme";

export const dynamic = "force-dynamic";

// ETAPA9C: abas da tela de leads
const VIEWS = [
  { key: "ativos", label: "Ativos" },
  { key: "perdidos", label: "Perdidos" },
  { key: "fora_de_rota", label: "Fora de Rota" },
] as const;

// Modo COORTE (link das linhas de "Conversão da coorte" do /dashboard/funil):
// ?mes=YYYY-MM&marco=X abre SÓ os leads daquele marco/mês — mesmos critérios da RPC get_funil_marcos.
const MARCOS_COORTE: Record<string, string> = {
  criados: "Leads criados",
  qualificados: "Qualificados (qual_stage ≥ 7)",
  handoff: "Handoff",
  vendedor_assumiu: "Vendedor assumiu",
  pedido_fechado: "Pedido fechado",
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const view = sp.view === "perdidos" ? "perdidos" : sp.view === "fora_de_rota" ? "fora_de_rota" : "ativos";
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const mesCoorte = sp.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : null;
  const marcoCoorte = sp.marco && MARCOS_COORTE[sp.marco] ? sp.marco : null;
  const vendCoorte = sp.vendedor && /^SETOR_[A-Z_]+$/.test(sp.vendedor) ? sp.vendedor : null;
  const coorteAtiva = Boolean(mesCoorte && marcoCoorte && view === "ativos");

  // Item 6 / DEBT-274: busca SERVER-SIDE (ilike sobre TODAS as linhas, antes do limit)
  // — antes a lupa filtrava só os <=100 carregados (busca cega). qSafe neutraliza os
  // metachars do filtro PostgREST (vírgula/parênteses/%/*) pra não quebrar o .or().
  const qRaw = (sp.q ?? "").trim().slice(0, 60);
  const qSafe = qRaw.replace(/[,()%*\\]/g, " ").trim();

  let leadsQuery = supabase
    .from("ai_sdr_leads")
    .select(
      "phone, name, city, segment, weekly_volume_kg, lead_temperature, lead_status, routing_team, qual_stage, handoff_at, handoff_confirmed, handoff_confirmed_at, first_order_at, ai_active, created_at, updated_at, followup_count, pain_point, product_groups, scheduled_at, human_active, origem_canal, origem_utm_source, origem_utm_campaign, ad_id"
    )
    .eq("is_test", false);

  if (coorteAtiva) {
    // recorte da coorte: janela do mês + critério do marco (SEM excluir fora_de_rota — espelha a RPC)
    const [y, m] = mesCoorte!.split("-").map(Number);
    const ini = `${mesCoorte}-01`;
    const fim = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    leadsQuery = leadsQuery.gte("created_at", ini).lt("created_at", fim);
    if (vendCoorte) leadsQuery = leadsQuery.eq("routing_team", vendCoorte);
    if (marcoCoorte === "qualificados") leadsQuery = leadsQuery.gte("qual_stage", 7);
    if (marcoCoorte === "handoff") leadsQuery = leadsQuery.not("handoff_at", "is", null);
    if (marcoCoorte === "vendedor_assumiu") leadsQuery = leadsQuery.not("seller_first_reply_at", "is", null);
    if (marcoCoorte === "pedido_fechado") leadsQuery = leadsQuery.not("first_order_at", "is", null);
  } else {
    leadsQuery = leadsQuery.or("routing_team.is.null,routing_team.neq.fora_de_rota");   // DEBT-167 4: ATIVOS não lista fora_de_rota (NULL-safe)
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="text-sm text-slate-200 mt-1">
          {view === "ativos" ? `${leads.length} leads encontrados`
            : view === "perdidos" ? "Fila de recuperação — perdidos nos últimos 180 dias"
            : "Fora de cobertura — registrados para expansão futura"}
        </p>
        {coorteAtiva && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 8, background: "rgba(46,160,67,.12)", border: "1px solid #2ea043", borderRadius: 4, padding: "6px 12px" }}>
            <span style={{ color: "#2ea043", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".06em" }}>
              COORTE {mesCoorte} · {MARCOS_COORTE[marcoCoorte!]}{vendCoorte ? ` · ${vendCoorte.replace("SETOR_", "")}` : ""}
            </span>
            <Link href="/dashboard/leads" style={{ color: "#c0d0e0", fontSize: 10, fontFamily: theme.font.label, textDecoration: "underline" }}>
              limpar filtro
            </Link>
          </div>
        )}
      </div>

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
      ) : view === "fora_de_rota" ? (
        <ForaDeRotaTable leads={foraRotaLeads} />
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
