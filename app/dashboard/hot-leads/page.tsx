import { createClient } from "@/lib/supabase/server";
import { theme } from "@/lib/theme";
import { HotLeadsTable } from "@/components/hot-leads/hot-leads-table";

export const dynamic = "force-dynamic";

export default async function HotLeadsPage() {
  const supabase = await createClient();

  const { data: leads, error } = await supabase
    .from("sdr_hot_leads")
    .select(
      "phone, name, restaurant_name, city, segment, qual_stage, lead_temperature, lead_score, last_contact_at, next_followup_at, orders_count, orders_revenue_brl, routing_team, ai_active, human_active, first_order_at, churn_risk"
    )
    .order("lead_score", { ascending: false, nullsFirst: false })
    .order("last_contact_at", { ascending: false, nullsFirst: false })
    .limit(100);

  return (
    <div style={{ padding: "24px 20px" }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            color: "#FFFFFF",
            fontSize: 18,
            fontWeight: 700,
            fontFamily: theme.font.label,
            letterSpacing: ".08em",
            marginBottom: 4,
          }}
        >
          Leads Quentes
        </h1>
        <p style={{ color: "var(--asb-page-ink2)", fontSize: 11, fontFamily: theme.font.label, letterSpacing: ".1em" }}>
          {error ? "Erro ao carregar leads" : `${leads?.length ?? 0} leads · Perfil A (ativos) + Perfil B (convertidos)`}
        </p>
      </div>

      {error ? (
        <div style={{ color: "#C8102E", fontFamily: theme.font.label, fontSize: 12 }}>
          Erro: {error.message}
        </div>
      ) : (
        <HotLeadsTable leads={leads ?? []} />
      )}
    </div>
  );
}
