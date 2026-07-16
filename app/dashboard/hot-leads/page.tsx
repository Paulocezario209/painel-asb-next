import { createClient } from "@/lib/supabase/server";
import { theme } from "@/lib/theme";
import { PageHead, SectionHead } from "@/app/dashboard/lib/ui";
import { Flame } from "lucide-react";
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Leads Quentes"
        desc={error ? "Erro ao carregar leads" : `${leads?.length ?? 0} leads · Perfil A (ativos) + Perfil B (convertidos)`}
      />

      {error ? (
        <div className="asb-card" style={{ padding: "20px 24px", color: "#C8102E", fontFamily: theme.font.label, fontSize: 13 }}>
          Erro: {error.message}
        </div>
      ) : (
        <div className="asb-card" style={{ padding: "20px 24px" }}>
          <SectionHead
            Icon={Flame}
            color="#FF3B57"
            title="Carteira quente"
            desc="Filtre por perfil e busque por telefone, restaurante ou cidade"
          />
          <HotLeadsTable leads={leads ?? []} />
        </div>
      )}
    </div>
  );
}
