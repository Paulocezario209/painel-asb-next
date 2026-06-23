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

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const view = sp.view === "perdidos" ? "perdidos" : sp.view === "fora_de_rota" ? "fora_de_rota" : "ativos";
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: rawLeads }, scoreMap] = await Promise.all([
    supabase
      .from("ai_sdr_leads")
      .select(
        "phone, name, city, segment, weekly_volume_kg, lead_temperature, lead_status, routing_team, qual_stage, handoff_at, handoff_confirmed, handoff_confirmed_at, first_order_at, ai_active, created_at, updated_at, followup_count, pain_point, product_groups, scheduled_at, human_active, origem_canal, origem_utm_source, origem_utm_campaign, ad_id"
      )
      .eq("is_test", false)
      .or("routing_team.is.null,routing_team.neq.fora_de_rota")   // DEBT-167 4: ATIVOS não lista fora_de_rota (NULL-safe)
      .order("created_at", { ascending: false })
      .limit(100)
      .range(0, 99),
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
        <p className="text-sm text-gray-500 mt-1">
          {view === "ativos" ? `${leads.length} leads encontrados`
            : view === "perdidos" ? "Fila de recuperação — perdidos nos últimos 180 dias"
            : "Fora de cobertura — registrados para expansão futura"}
        </p>
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
                fontFamily: theme.font.mono,
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
          <LeadsTable leads={leads ?? []} userEmail={user?.email ?? ""} initialStatus={sp.status ?? "all"} />
          <p style={{ color: "#556677", fontSize: 10, fontFamily: "'Courier New', monospace", textAlign: "right" }}>
            Exibindo até 100 leads — use os filtros para refinar.
          </p>
        </>
      )}
    </div>
  );
}
