import { createClient } from "@/lib/supabase/server";
import { LeadsTable } from "@/components/leads/leads-table";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: leads } = await supabase
    .from("ai_sdr_leads")
    .select(
      "phone, name, city, segment, weekly_volume_kg, lead_temperature, lead_status, routing_team, qual_stage, handoff_at, handoff_confirmed, handoff_confirmed_at, first_order_at, ai_active, created_at, followup_count, pain_point, product_groups"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="text-sm text-gray-500 mt-1">
          {leads?.length ?? 0} leads encontrados
        </p>
      </div>
      <LeadsTable leads={leads ?? []} userEmail={user?.email ?? ""} />
    </div>
  );
}
