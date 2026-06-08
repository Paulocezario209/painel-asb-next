import { createClient } from "@/lib/supabase/server";
import { LeadsTable } from "@/components/leads/leads-table";

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const { data: leads } = await supabase
    .from("ai_sdr_leads")
    .select(
      "phone, name, city, segment, weekly_volume_kg, lead_temperature, lead_status, routing_team, qual_stage, handoff_at, handoff_confirmed, handoff_confirmed_at, first_order_at, ai_active, created_at, followup_count, pain_point, product_groups, scheduled_at, human_active"
    )
    .eq("is_test", false)
    .order("created_at", { ascending: false })
    .limit(100)
    .range(0, 99);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
        <p className="text-sm text-gray-500 mt-1">
          {leads?.length ?? 0} leads encontrados
        </p>
      </div>
      <LeadsTable leads={leads ?? []} userEmail={user?.email ?? ""} initialStatus={sp.status ?? "all"} />
      <p style={{ color: "#556677", fontSize: 10, fontFamily: "'Courier New', monospace", textAlign: "right" }}>
        Exibindo até 100 leads — use os filtros para refinar.
      </p>
    </div>
  );
}
