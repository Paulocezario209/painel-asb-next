import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, PhoneCall, CheckCircle, Clock } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: totalLeads }, { count: handoffPending }, { count: qualifiedLeads }] =
    await Promise.all([
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
    ]);

  const stats = [
    { title: "Total Leads", value: totalLeads ?? 0, icon: Users, color: "text-blue-600" },
    { title: "Qualificados", value: qualifiedLeads ?? 0, icon: CheckCircle, color: "text-green-600" },
    { title: "Handoffs Pendentes", value: handoffPending ?? 0, icon: Clock, color: "text-orange-600" },
    { title: "Em Atendimento", value: "-", icon: PhoneCall, color: "text-purple-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Visão geral do pipeline SDR</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{stat.title}</CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status do Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">SDR Ativo</Badge>
            <Badge variant="outline" className="text-green-600 border-green-200">RAG Online</Badge>
            <Badge variant="outline" className="text-blue-600 border-blue-200">Follow-up Engine Ativo</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
