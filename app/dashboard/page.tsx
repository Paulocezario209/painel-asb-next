import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, PhoneCall, CheckCircle, Clock } from "lucide-react";
import {
  QualificationFunnel,
  WeeklyConversions,
  VendorPerformance,
} from "@/components/dashboard/charts";

export const dynamic = "force-dynamic";

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: totalLeads },
    { count: handoffPending },
    { count: qualifiedLeads },
    { data: allLeads },
  ] = await Promise.all([
    supabase.from("ai_sdr_leads").select("*", { count: "exact", head: true }),
    supabase
      .from("ai_sdr_leads")
      .select("*", { count: "exact", head: true })
      .not("handoff_at", "is", null)
      .eq("handoff_confirmed", false),
    supabase
      .from("ai_sdr_leads")
      .select("*", { count: "exact", head: true })
      .gte("qual_stage", 7),
    supabase
      .from("ai_sdr_leads")
      .select(
        "qual_stage, first_order_at, routing_team, handoff_at, handoff_confirmed"
      ),
  ]);

  const leads = allLeads ?? [];

  // Qualification funnel — group by qual_stage bucket
  const stageBuckets: Record<string, number> = {
    "0-2": 0,
    "3-4": 0,
    "5-6": 0,
    "7-8": 0,
    "9": 0,
  };
  for (const l of leads) {
    const s = l.qual_stage ?? 0;
    if (s <= 2) stageBuckets["0-2"]++;
    else if (s <= 4) stageBuckets["3-4"]++;
    else if (s <= 6) stageBuckets["5-6"]++;
    else if (s <= 8) stageBuckets["7-8"]++;
    else stageBuckets["9"]++;
  }
  const funnelData = Object.entries(stageBuckets).map(([label, count]) => ({
    label,
    count,
  }));

  // Weekly conversions — last 4 weeks
  const now = new Date();
  const weekMap: Record<string, number> = {};
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekMap[getWeekLabel(d)] = 0;
  }
  for (const l of leads) {
    if (!l.first_order_at) continue;
    const label = getWeekLabel(new Date(l.first_order_at));
    if (label in weekMap) weekMap[label]++;
  }
  const weeklyData = Object.entries(weekMap).map(([week, count]) => ({
    week,
    count,
  }));

  // Vendor performance
  const VENDORS: Record<string, string> = {
    ana_paula: "Ana Paula",
    alan: "Alan",
    setor_cuit: "CUIT",
  };
  const vendorMap: Record<
    string,
    { handoffs: number; confirmed: number; converted: number }
  > = {};
  for (const key of Object.keys(VENDORS)) {
    vendorMap[key] = { handoffs: 0, confirmed: 0, converted: 0 };
  }
  for (const l of leads) {
    const v = l.routing_team;
    if (!v || !(v in vendorMap)) continue;
    if (l.handoff_at) vendorMap[v].handoffs++;
    if (l.handoff_confirmed) vendorMap[v].confirmed++;
    if (l.first_order_at) vendorMap[v].converted++;
  }
  const vendorData = Object.entries(vendorMap).map(([key, vals]) => ({
    label: VENDORS[key],
    ...vals,
  }));

  const stats = [
    { title: "Total Leads", value: totalLeads ?? 0, icon: Users, color: "text-blue-600" },
    { title: "Qualificados", value: qualifiedLeads ?? 0, icon: CheckCircle, color: "text-green-600" },
    { title: "Handoffs Pendentes", value: handoffPending ?? 0, icon: Clock, color: "text-orange-600" },
    {
      title: "Convertidos",
      value: leads.filter((l) => l.first_order_at).length,
      icon: PhoneCall,
      color: "text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral do pipeline SDR</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Funil de Qualificação</CardTitle>
          </CardHeader>
          <CardContent>
            <QualificationFunnel data={funnelData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversões por Semana</CardTitle>
          </CardHeader>
          <CardContent>
            <WeeklyConversions data={weeklyData} />
          </CardContent>
        </Card>
      </div>

      {/* Vendor performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Performance por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <VendorPerformance data={vendorData} />
        </CardContent>
      </Card>

      {/* Pipeline status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status do Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">SDR Ativo</Badge>
            <Badge variant="outline" className="text-green-600 border-green-200">
              RAG Online
            </Badge>
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              Follow-up Engine Ativo
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
