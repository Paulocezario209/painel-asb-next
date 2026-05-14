import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Package, Thermometer, User, MessageCircle } from "lucide-react";
import { LeadActions } from "@/components/leads/lead-actions";
import { ProductGroupSelector } from "@/components/leads/product-group-selector";
import { ConversationWithFeedback } from "@/components/leads/conversation-with-feedback";
import { FunnelStageBadge } from "@/components/leads/funnel-stage-badge";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { VendorConversation } from "@/components/leads/vendor-conversation";
import { LeadNotes } from "@/components/leads/lead-notes";
import { MarkAsLostButton } from "@/components/leads/mark-as-lost-button";
import { ReassignVendorButton } from "@/components/leads/reassign-vendor-button";
import { MarkProposalSentButton } from "@/components/leads/mark-proposal-sent-button";
import { getUserContext } from "@/lib/auth/get-user-role";

// ── Design tokens ────────────────────────────────────────────────
const C = {
  bg: "#161b22", bg2: "#0d1117", border: "#21262d", border2: "#30363d",
  text: "#c9d1d9", text2: "#e6edf3", muted: "#8b949e",
  blue: "#58a6ff", green: "#3fb950", amber: "#f0b429", red: "#f85149", purple: "#c084fc",
};
const LABEL: React.CSSProperties = { fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: C.muted, fontFamily: "'Courier New', monospace" };
const CARD: React.CSSProperties  = { background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 6 };

const TEMP_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  HOT:          { label: "HOT",   color: C.red,    bg: "rgba(248,81,73,.1)",   border: "rgba(248,81,73,.3)" },
  WARM:         { label: "WARM",  color: C.amber,  bg: "rgba(240,180,41,.1)",  border: "rgba(240,180,41,.3)" },
  COLD:         { label: "COLD",  color: C.blue,   bg: "rgba(88,166,255,.1)",  border: "rgba(88,166,255,.3)" },
  READY_TO_BUY: { label: "READY", color: C.purple, bg: "rgba(192,132,252,.1)", border: "rgba(192,132,252,.3)" },
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  new:       { label: "Novo",        color: C.muted, bg: "rgba(139,148,158,.1)", border: "rgba(139,148,158,.25)" },
  qualified: { label: "Qualificado", color: C.green, bg: "rgba(63,185,80,.1)",   border: "rgba(63,185,80,.3)" },
  converted: { label: "Convertido",  color: C.amber, bg: "rgba(240,180,41,.1)",  border: "rgba(240,180,41,.3)" },
  optout:    { label: "Opt-out",     color: C.red,   bg: "rgba(248,81,73,.08)",  border: "rgba(248,81,73,.25)" },
  lost:      { label: "Perdido",     color: C.red,   bg: "rgba(248,81,73,.08)",  border: "rgba(248,81,73,.25)" },
};

const VENDOR_LABELS: Record<string, string> = { SETOR_SOROCABA_SAO_PAULO: "Ana Paula", SETOR_CAMPINAS_JUNDIAI: "Alan", SETOR_CUIT: "CUIT" };

function derivedStatus(lead: { lead_status: string | null; first_order_at: string | null; qual_stage: number | null }): string {
  if (lead.lead_status === "optout") return "optout";
  if (lead.lead_status === "lost") return "lost";
  if (lead.first_order_at) return "converted";
  if ((lead.qual_stage ?? 0) >= 7) return "qualified";
  return lead.lead_status ?? "new";
}

function SmallBadge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 6px", borderRadius: 3,
      fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
      fontFamily: "'Courier New', monospace", fontWeight: 700,
      color, background: bg, border: `1px solid ${border}`,
    }}>{label}</span>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const phone = decodeURIComponent(id);
  const supabase = await createClient();

  const [{ data: lead }, { data: convRows }, { data: vmRows }, { count: vmTotal }] = await Promise.all([
    supabase.from("ai_sdr_leads").select("*").eq("phone", phone).single(),
    supabase
      .from("conversas_sdr")
      .select("id, source, message_text, response, rag_domain, request_id, created_at")
      .eq("phone", phone)
      .neq("source", "customer_paused")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("vendor_messages")
      .select("direction, content, media_type, sent_at")
      .eq("lead_phone", phone)
      .order("sent_at", { ascending: true })
      .limit(50),
    supabase
      .from("vendor_messages")
      .select("id", { count: "exact", head: true })
      .eq("lead_phone", phone),
  ]);

  if (!lead) notFound();

  const userCtx = await getUserContext();
  const isGestor = userCtx?.isGestor ?? false;
  const canMarkProposal = isGestor || (userCtx?.isVendedor && userCtx.routing_team === lead.routing_team);

  // Re-query events and fse with actual lead.id (UUID) since initial query used phone
  const [{ data: eventsById }, { data: fseById }] = await Promise.all([
    supabase
      .from("events")
      .select("id, event_type, payload, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("funnel_stage_events")
      .select("id, from_stage, to_stage, actor, metadata, created_at")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const events = (eventsById ?? []) as { id: string; event_type: string; payload: Record<string, unknown>; created_at: string }[];
  const transitions = (fseById ?? []) as { id: string; from_stage: string | null; to_stage: string; actor: string; metadata: Record<string, unknown>; created_at: string }[];
  const vendorMsgs = (vmRows ?? []) as { direction: string; content: string | null; media_type: string | null; sent_at: string }[];
  const noteEvents = events.filter(e => e.event_type === "note_added");

  const status  = derivedStatus(lead);
  const tempCfg = TEMP_CFG[lead.lead_temperature ?? ""] ?? TEMP_CFG.COLD;
  const stsCfg  = STATUS_CFG[status] ?? STATUS_CFG.new;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Back nav */}
      <Link
        href="/dashboard/leads"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", fontFamily: "'Courier New', monospace", textDecoration: "none" }}
      >
        <ArrowLeft size={12} /> Leads
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 style={{ color: C.text2, fontSize: 18, fontWeight: 700, fontFamily: "'Inter', system-ui, sans-serif", marginBottom: 2 }}>
            {lead.restaurant_name || lead.name || "Lead sem nome"}
          </h1>
          <p style={{ color: C.muted, fontSize: 11, fontFamily: "'Courier New', monospace" }}>{lead.phone}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <FunnelStageBadge stage={lead.funnel_stage} />
          <SmallBadge {...tempCfg} />
          <SmallBadge {...stsCfg} />
          <a href={`https://wa.me/${lead.phone}`} target="_blank" rel="noopener noreferrer">
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", border: `1px solid rgba(63,185,80,.4)`,
              color: C.green, fontSize: 10, letterSpacing: ".10em", textTransform: "uppercase",
              padding: "5px 10px", borderRadius: 4, cursor: "pointer",
              fontFamily: "'Courier New', monospace",
            }}>
              <MessageCircle size={12} /> WhatsApp
            </button>
          </a>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left: Conversation + CRM */}
        <div className="lg:col-span-2 space-y-4">

          {/* SDR Conversation — no topo para gestor ver conversa primeiro */}
          <div style={{ ...CARD, padding: "20px 24px" }}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Conversa SDR</p>
            <ConversationWithFeedback rows={convRows ?? []} phone={phone} />
          </div>

          {/* CRM card */}
          <div style={{ ...CARD, padding: "20px 24px" }}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Dados CRM</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <CrmField icon={<MapPin size={13} />} label="Cidade" value={lead.city} />
              <CrmField icon={<Package size={13} />} label="Segmento" value={lead.segment} capitalize />
              <CrmField icon={<Package size={13} />} label="Volume semanal" value={lead.weekly_volume_kg ? `${lead.weekly_volume_kg} kg` : null} />
              <CrmField icon={<Thermometer size={13} />} label="Temperatura" value={lead.lead_temperature} />
              <CrmField icon={<User size={13} />} label="Vendedor" value={VENDOR_LABELS[lead.routing_team ?? ""] ?? lead.routing_team} />
              <CrmField icon={<User size={13} />} label="Etapa qual." value={`${lead.qual_stage ?? 0}/9`} mono />
              {lead.pain_point && (
                <div className="col-span-2">
                  <p style={LABEL}>Dor identificada</p>
                  <p style={{ color: C.muted, fontSize: 11, fontFamily: "'Courier New', monospace", marginTop: 4, fontStyle: "italic" }}>
                    &quot;{lead.pain_point}&quot;
                  </p>
                </div>
              )}
              <div className="col-span-2">
                <p style={{ ...LABEL, marginBottom: 8 }}>Grupos de produto</p>
                <ProductGroupSelector phone={lead.phone} initial={(lead.product_groups as string[] | null) ?? []} />
              </div>
            </div>
          </div>

          {/* Vendor Conversation */}
          <div style={{ ...CARD, padding: "20px 24px" }}>
            <p style={{ ...LABEL, marginBottom: 16 }}>
              Conversa Vendedor
              <span style={{ color: "#556677", marginLeft: 8 }}>({vmTotal ?? 0} msgs)</span>
            </p>
            <VendorConversation messages={vendorMsgs} total={vmTotal ?? 0} />
          </div>
        </div>

        {/* Right: timeline + notes + actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Timeline */}
          <div style={{ ...CARD, padding: "20px 24px" }}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Timeline</p>
            <LeadTimeline events={events} transitions={transitions} />
          </div>

          {/* Notes */}
          <div style={{ ...CARD, padding: "20px 24px" }}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Observacoes</p>
            <LeadNotes leadId={lead.id} notes={noteEvents} />
          </div>

          {/* Actions */}
          <div style={{ ...CARD, padding: "20px 24px" }}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Acoes</p>
            <LeadActions lead={lead} />
            {canMarkProposal && (
              <div style={{ marginTop: 12 }}>
                <MarkProposalSentButton leadId={lead.id} currentStage={lead.funnel_stage} />
              </div>
            )}
            {isGestor && (
              <div style={{ marginTop: 12 }}>
                <ReassignVendorButton leadId={lead.id} currentTeam={lead.routing_team} />
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <MarkAsLostButton leadId={lead.id} currentStage={lead.funnel_stage} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CrmField({ icon, label, value, capitalize, mono }: { icon: React.ReactNode; label: string; value: string | null | undefined; capitalize?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ color: "#8b949e", marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "#8b949e", fontFamily: "'Courier New', monospace" }}>{label}</p>
        <p style={{
          color: "#c9d1d9", fontSize: 11,
          fontFamily: mono ? "'Courier New', monospace" : "'Inter', system-ui, sans-serif",
          fontWeight: 500, marginTop: 2,
          textTransform: capitalize ? "capitalize" : undefined,
        }}>
          {value || "\u2014"}
        </p>
      </div>
    </div>
  );
}
