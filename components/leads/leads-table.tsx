"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageCircle, CheckCircle, TrendingUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type Lead = {
  phone: string;
  name: string | null;
  city: string | null;
  segment: string | null;
  weekly_volume_kg: number | null;
  lead_temperature: string | null;
  lead_status: string | null;
  routing_team: string | null;
  qual_stage: number | null;
  handoff_at: string | null;
  handoff_confirmed: boolean | null;
  handoff_confirmed_at: string | null;
  first_order_at: string | null;
  ai_active: boolean | null;
  created_at: string;
  followup_count: number | null;
  pain_point: string | null;
};

const TEMP_CONFIG: Record<string, { label: string; className: string }> = {
  HOT:          { label: "HOT",  className: "bg-red-100 text-red-700 border-red-200" },
  WARM:         { label: "WARM", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  COLD:         { label: "COLD", className: "bg-blue-100 text-blue-700 border-blue-200" },
  READY_TO_BUY: { label: "READY", className: "bg-purple-100 text-purple-700 border-purple-200" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  new:       { label: "Novo",       className: "bg-gray-100 text-gray-600 border-gray-200" },
  qualified: { label: "Qualificado", className: "bg-green-100 text-green-700 border-green-200" },
  converted: { label: "Convertido", className: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  optout:    { label: "Opt-out",    className: "bg-red-900/10 text-red-900 border-red-300" },
};

const VENDOR_LABELS: Record<string, string> = {
  ana_paula:   "Ana Paula",
  alan:        "Alan",
  setor_cuit:  "CUIT",
};

function derivedStatus(lead: Lead): string {
  if (lead.lead_status === "optout") return "optout";
  if (lead.first_order_at) return "converted";
  if ((lead.qual_stage ?? 0) >= 7) return "qualified";
  return lead.lead_status ?? "new";
}

export function LeadsTable({
  leads: initialLeads,
  userEmail,
}: {
  leads: Lead[];
  userEmail: string;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      (l.name ?? "").toLowerCase().includes(q) ||
      l.phone.includes(q) ||
      (l.city ?? "").toLowerCase().includes(q);

    const matchStatus =
      statusFilter === "all" || derivedStatus(l) === statusFilter;

    const matchVendor =
      vendorFilter === "all" || l.routing_team === vendorFilter;

    return matchSearch && matchStatus && matchVendor;
  });

  async function confirmHandoff(phone: string) {
    const supabase = createClient();
    await supabase
      .from("ai_sdr_leads")
      .update({ handoff_confirmed: true, handoff_confirmed_at: new Date().toISOString() })
      .eq("phone", phone);

    setLeads((prev) =>
      prev.map((l) =>
        l.phone === phone
          ? { ...l, handoff_confirmed: true, handoff_confirmed_at: new Date().toISOString() }
          : l
      )
    );
  }

  async function convertLead(phone: string) {
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase
      .from("ai_sdr_leads")
      .update({ first_order_at: now })
      .eq("phone", phone);

    setLeads((prev) =>
      prev.map((l) => (l.phone === phone ? { ...l, first_order_at: now } : l))
    );
  }

  function refreshData() {
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome, telefone, cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="new">Novo</SelectItem>
            <SelectItem value="qualified">Qualificado</SelectItem>
            <SelectItem value="converted">Convertido</SelectItem>
            <SelectItem value="optout">Opt-out</SelectItem>
          </SelectContent>
        </Select>
        <Select value={vendorFilter} onValueChange={(v) => setVendorFilter(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            <SelectItem value="ana_paula">Ana Paula</SelectItem>
            <SelectItem value="alan">Alan</SelectItem>
            <SelectItem value="setor_cuit">CUIT</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={refreshData} disabled={isPending}>
          {isPending ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>

      <p className="text-sm text-gray-500">{filtered.length} leads</p>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Lead</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Cidade</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Segmento</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Volume</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Temp.</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Vendedor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Etapa</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Handoff</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                  Nenhum lead encontrado
                </td>
              </tr>
            )}
            {filtered.map((lead) => {
              const status = derivedStatus(lead);
              const tempCfg = TEMP_CONFIG[lead.lead_temperature ?? ""] ?? TEMP_CONFIG.COLD;
              const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.new;
              const showConfirm =
                !!lead.handoff_at && lead.handoff_confirmed === false;
              const showConvert =
                (lead.qual_stage ?? 0) >= 7 && !lead.first_order_at;

              return (
                <tr key={lead.phone} className="hover:bg-gray-50 transition-colors">
                  {/* Lead name / phone */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/leads/${encodeURIComponent(lead.phone)}`}
                      className="hover:underline"
                    >
                      <p className="font-medium text-gray-900 truncate max-w-[140px]">
                        {lead.name || "—"}
                      </p>
                    </Link>
                    <p className="text-xs text-gray-400">{lead.phone}</p>
                  </td>

                  <td className="px-4 py-3 text-gray-700">{lead.city || "—"}</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{lead.segment || "—"}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {lead.weekly_volume_kg ? `${lead.weekly_volume_kg} kg` : "—"}
                  </td>

                  {/* Temperature badge */}
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("text-xs font-semibold", tempCfg.className)}>
                      {tempCfg.label}
                    </Badge>
                  </td>

                  {/* Status badge */}
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("text-xs", statusCfg.className)}>
                      {statusCfg.label}
                    </Badge>
                  </td>

                  {/* Vendor */}
                  <td className="px-4 py-3 text-gray-700">
                    {VENDOR_LABELS[lead.routing_team ?? ""] ?? lead.routing_team ?? "—"}
                  </td>

                  {/* qual_stage */}
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">
                      {lead.qual_stage ?? 0}/9
                    </span>
                  </td>

                  {/* handoff_at */}
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {lead.handoff_at
                      ? lead.handoff_confirmed
                        ? <span className="text-green-600 font-medium">✓ Confirmado</span>
                        : new Date(lead.handoff_at).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* WhatsApp */}
                      <a
                        href={`https://wa.me/${lead.phone}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50">
                          <MessageCircle className="w-4 h-4" />
                        </Button>
                      </a>

                      {/* Confirmar handoff */}
                      {showConfirm && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          onClick={() => confirmHandoff(lead.phone)}
                          title="Confirmar atendimento"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}

                      {/* Converter */}
                      {showConvert && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                          onClick={() => convertLead(lead.phone)}
                          title="Marcar como convertido"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
