import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  MessageCircle,
  MapPin,
  Package,
  Thermometer,
  User,
  Calendar,
  Clock,
} from "lucide-react";
import { LeadActions } from "@/components/leads/lead-actions";
import { ProductGroupSelector } from "@/components/leads/product-group-selector";

const TEMP_CONFIG: Record<string, { label: string; className: string }> = {
  HOT:          { label: "HOT",   className: "bg-red-100 text-red-700 border-red-200" },
  WARM:         { label: "WARM",  className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  COLD:         { label: "COLD",  className: "bg-blue-100 text-blue-700 border-blue-200" },
  READY_TO_BUY: { label: "READY", className: "bg-purple-100 text-purple-700 border-purple-200" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  new:       { label: "Novo",        className: "bg-gray-100 text-gray-600 border-gray-200" },
  qualified: { label: "Qualificado", className: "bg-green-100 text-green-700 border-green-200" },
  converted: { label: "Convertido",  className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  optout:    { label: "Opt-out",     className: "bg-red-900/10 text-red-900 border-red-300" },
};

const VENDOR_LABELS: Record<string, string> = {
  ana_paula:  "Ana Paula",
  alan:       "Alan",
  setor_cuit: "CUIT",
};

function derivedStatus(lead: {
  lead_status: string | null;
  first_order_at: string | null;
  qual_stage: number | null;
}): string {
  if (lead.lead_status === "optout") return "optout";
  if (lead.first_order_at) return "converted";
  if ((lead.qual_stage ?? 0) >= 7) return "qualified";
  return lead.lead_status ?? "new";
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const phone = decodeURIComponent(id);

  const supabase = await createClient();

  const [{ data: lead }, { data: convRows }] = await Promise.all([
    supabase
      .from("ai_sdr_leads")
      .select("*")
      .eq("phone", phone)
      .single(),
    supabase
      .from("conversas_sdr")
      .select("role, content, created_at")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  if (!lead) notFound();

  const status = derivedStatus(lead);
  const tempCfg = TEMP_CONFIG[lead.lead_temperature ?? ""] ?? TEMP_CONFIG.COLD;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div>
        <Link href="/dashboard/leads">
          <Button variant="ghost" size="sm" className="gap-1 text-gray-500 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Leads
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lead.name || "Lead sem nome"}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{lead.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-sm font-semibold ${tempCfg.className}`}>
            {tempCfg.label}
          </Badge>
          <Badge variant="outline" className={`text-sm ${statusCfg.className}`}>
            {statusCfg.label}
          </Badge>
          <a
            href={`https://wa.me/${lead.phone}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-200 hover:bg-green-50">
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CRM fields */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados CRM</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Cidade</p>
                  <p className="font-medium text-gray-900">{lead.city || "—"}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Segmento</p>
                  <p className="font-medium text-gray-900 capitalize">{lead.segment || "—"}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Volume semanal</p>
                  <p className="font-medium text-gray-900">
                    {lead.weekly_volume_kg ? `${lead.weekly_volume_kg} kg` : "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Thermometer className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Temperatura</p>
                  <p className="font-medium text-gray-900">{lead.lead_temperature || "—"}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Vendedor</p>
                  <p className="font-medium text-gray-900">
                    {VENDOR_LABELS[lead.routing_team ?? ""] ?? lead.routing_team ?? "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <User className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Etapa qual.</p>
                  <p className="font-medium text-gray-900">
                    <span className="font-mono">{lead.qual_stage ?? 0}/9</span>
                  </p>
                </div>
              </div>

              {lead.pain_point && (
                <div className="col-span-2 flex items-start gap-2">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Dor identificada</p>
                    <p className="text-gray-700 italic">"{lead.pain_point}"</p>
                  </div>
                </div>
              )}

              <div className="col-span-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Grupos de produto</p>
                <ProductGroupSelector
                  phone={lead.phone}
                  initial={(lead.product_groups as string[] | null) ?? []}
                />
              </div>
            </CardContent>
          </Card>

          {/* Follow-up timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversa</CardTitle>
            </CardHeader>
            <CardContent>
              {!convRows || convRows.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhuma mensagem registrada.</p>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-2">
                  {convRows.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-blue-600 text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg.role === "user" ? "text-gray-400" : "text-blue-200"
                          }`}
                        >
                          {fmt(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — timeline + actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative border-l border-gray-200 space-y-4 ml-3">
                <TimelineItem
                  label="Lead criado"
                  date={lead.created_at}
                  icon={<Clock className="w-3 h-3" />}
                />
                {lead.handoff_at && (
                  <TimelineItem
                    label="Handoff enviado"
                    date={lead.handoff_at}
                    icon={<Calendar className="w-3 h-3" />}
                    color="orange"
                  />
                )}
                {lead.handoff_confirmed_at && (
                  <TimelineItem
                    label="Handoff confirmado"
                    date={lead.handoff_confirmed_at}
                    icon={<Calendar className="w-3 h-3" />}
                    color="blue"
                  />
                )}
                {lead.first_order_at && (
                  <TimelineItem
                    label="Primeiro pedido"
                    date={lead.first_order_at}
                    icon={<Package className="w-3 h-3" />}
                    color="green"
                  />
                )}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ações</CardTitle>
            </CardHeader>
            <CardContent>
              <LeadActions lead={lead} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  label,
  date,
  icon,
  color = "gray",
}: {
  label: string;
  date: string | null;
  icon: React.ReactNode;
  color?: "gray" | "orange" | "blue" | "green";
}) {
  const colors: Record<string, string> = {
    gray:   "bg-gray-100 text-gray-500",
    orange: "bg-orange-100 text-orange-600",
    blue:   "bg-blue-100 text-blue-600",
    green:  "bg-green-100 text-green-600",
  };
  return (
    <li className="ml-4">
      <span
        className={`absolute -left-1.5 flex h-5 w-5 items-center justify-center rounded-full ${colors[color]}`}
      >
        {icon}
      </span>
      <p className="text-sm font-medium text-gray-800">{label}</p>
      <p className="text-xs text-gray-400">{fmt(date)}</p>
    </li>
  );
}
