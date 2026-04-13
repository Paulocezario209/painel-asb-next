import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, PhoneCall, CheckCircle, Clock, Zap, MapPin, Package } from "lucide-react";
import {
  QualificationFunnel,
  WeeklyConversions,
  VendorPerformance,
} from "@/components/dashboard/charts";

export const dynamic = "force-dynamic";

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function abcCurve(vol: number | null): "A" | "B" | "C" {
  if ((vol ?? 0) >= 300) return "A";
  if ((vol ?? 0) >= 100) return "B";
  return "C";
}

const PRODUCT_LABELS: Record<string, string> = {
  hamburguer:      "Hambúrguer",
  espeto:          "Espeto",
  boteco:          "Boteco",
  cortes_especiais:"Cortes Especiais",
  mercearia:       "Mercearia",
  molhos:          "Molhos",
  defumados:       "Defumados",
  paes:            "Pães",
  embalagens:      "Embalagens",
};

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
        "qual_stage, first_order_at, routing_team, handoff_at, handoff_confirmed, weekly_volume_kg, city, product_groups"
      ),
  ]);

  const leads = allLeads ?? [];

  // ── Curva ABC ────────────────────────────────────────────────────────────
  const abcCount = { A: 0, B: 0, C: 0 };
  for (const l of leads) abcCount[abcCurve(l.weekly_volume_kg)]++;

  // Leads Tier A sem handoff confirmado → ação imediata
  const urgentA = leads.filter(
    (l) => abcCurve(l.weekly_volume_kg) === "A" && l.handoff_at && !l.handoff_confirmed
  ).length;

  // ── Top 5 cidades com leads qualificados ─────────────────────────────────
  const cityMap: Record<string, number> = {};
  for (const l of leads) {
    if ((l.qual_stage ?? 0) < 7 || !l.city) continue;
    cityMap[l.city] = (cityMap[l.city] ?? 0) + 1;
  }
  const topCities = Object.entries(cityMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ── Distribuição de grupos de produto ────────────────────────────────────
  const groupCount: Record<string, number> = {};
  for (const l of leads) {
    for (const g of (l.product_groups as string[] | null) ?? []) {
      groupCount[g] = (groupCount[g] ?? 0) + 1;
    }
  }
  const hasProductData = Object.keys(groupCount).length > 0;
  const topGroups = Object.entries(groupCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ── Qualification funnel ─────────────────────────────────────────────────
  const stageBuckets: Record<string, number> = { "0-2": 0, "3-4": 0, "5-6": 0, "7-8": 0, "9": 0 };
  for (const l of leads) {
    const s = l.qual_stage ?? 0;
    if (s <= 2) stageBuckets["0-2"]++;
    else if (s <= 4) stageBuckets["3-4"]++;
    else if (s <= 6) stageBuckets["5-6"]++;
    else if (s <= 8) stageBuckets["7-8"]++;
    else stageBuckets["9"]++;
  }
  const funnelData = Object.entries(stageBuckets).map(([label, count]) => ({ label, count }));

  // ── Weekly conversions ───────────────────────────────────────────────────
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
  const weeklyData = Object.entries(weekMap).map(([week, count]) => ({ week, count }));

  // ── Vendor performance ───────────────────────────────────────────────────
  const VENDORS: Record<string, string> = { ana_paula: "Ana Paula", alan: "Alan", setor_cuit: "CUIT" };
  const vendorMap: Record<string, { handoffs: number; confirmed: number; converted: number }> = {};
  for (const key of Object.keys(VENDORS)) vendorMap[key] = { handoffs: 0, confirmed: 0, converted: 0 };
  for (const l of leads) {
    const v = l.routing_team;
    if (!v || !(v in vendorMap)) continue;
    if (l.handoff_at) vendorMap[v].handoffs++;
    if (l.handoff_confirmed) vendorMap[v].confirmed++;
    if (l.first_order_at) vendorMap[v].converted++;
  }
  const vendorData = Object.entries(vendorMap).map(([key, vals]) => ({ label: VENDORS[key], ...vals }));

  const stats = [
    { title: "Total Leads",         value: totalLeads ?? 0,                              icon: Users,        color: "text-blue-600" },
    { title: "Qualificados",        value: qualifiedLeads ?? 0,                          icon: CheckCircle,  color: "text-green-600" },
    { title: "Handoffs Pendentes",  value: handoffPending ?? 0,                          icon: Clock,        color: "text-orange-600" },
    { title: "Convertidos",         value: leads.filter((l) => l.first_order_at).length, icon: PhoneCall,    color: "text-purple-600" },
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
              <CardTitle className="text-sm font-medium text-gray-600" translate="no">{stat.title}</CardTitle>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Onde Focar Agora ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Zap className="w-4 h-4 text-yellow-500" />
          <CardTitle className="text-base">Onde Focar Agora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Curva ABC */}
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Curva ABC</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{abcCount.A}</p>
                <p className="text-xs font-semibold text-red-600 mt-0.5">Tier A</p>
                <p className="text-xs text-red-400">≥ 300 kg/sem</p>
                <Badge variant="outline" className="mt-1.5 text-xs bg-red-100 text-red-700 border-red-200">urgente</Badge>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{abcCount.B}</p>
                <p className="text-xs font-semibold text-yellow-600 mt-0.5">Tier B</p>
                <p className="text-xs text-yellow-400">100–299 kg/sem</p>
                <Badge variant="outline" className="mt-1.5 text-xs bg-yellow-100 text-yellow-700 border-yellow-200">médio prazo</Badge>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{abcCount.C}</p>
                <p className="text-xs font-semibold text-blue-600 mt-0.5">Tier C</p>
                <p className="text-xs text-blue-400">&lt; 100 kg/sem</p>
                <Badge variant="outline" className="mt-1.5 text-xs bg-blue-100 text-blue-700 border-blue-200">longo prazo</Badge>
              </div>
            </div>
          </div>

          {/* Indicador de energia */}
          {urgentA > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <Zap className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">
                  {urgentA} lead{urgentA > 1 ? "s" : ""} Tier A aguardando confirmação de handoff
                </p>
                <p className="text-xs text-red-500">Ação imediata — alto volume, handoff não confirmado</p>
              </div>
            </div>
          )}

          {/* Top cidades */}
          {topCities.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Top cidades — leads qualificados
              </p>
              <div className="space-y-1.5">
                {topCities.map(([city, count], i) => (
                  <div key={city} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      <span className="text-xs text-gray-400 mr-1">#{i + 1}</span>
                      {city}
                    </span>
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {count} leads
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grupos de produto */}
          {hasProductData && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Package className="w-3 h-3" /> Grupos de produto
              </p>
              <div className="space-y-1.5">
                {topGroups.map(([group, count]) => (
                  <div key={group} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{PRODUCT_LABELS[group] ?? group}</span>
                    <Badge variant="outline" className="text-xs">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
            <Badge variant="outline" className="text-green-600 border-green-200">RAG Online</Badge>
            <Badge variant="outline" className="text-blue-600 border-blue-200">Follow-up Engine Ativo</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
