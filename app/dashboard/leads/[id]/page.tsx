import { createClient } from "@/lib/supabase/server";
import { theme } from "@/lib/theme";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Package, Thermometer, User, MessageCircle, Megaphone, ClipboardList, Repeat, Clock, StickyNote, Zap } from "lucide-react";
import { LeadActions } from "@/components/leads/lead-actions";
import { ProductGroupSelector } from "@/components/leads/product-group-selector";
import { OrigemSelector } from "@/components/leads/origem-selector";
import { ConversationWithFeedback } from "@/components/leads/conversation-with-feedback";
import { FunnelStageBadge } from "@/components/leads/funnel-stage-badge";
import { VoltarEtapaButton } from "@/components/leads/voltar-etapa-button";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { VendorConversation } from "@/components/leads/vendor-conversation";
import { LeadNotes } from "@/components/leads/lead-notes";
import { MarkAsLostButton } from "@/components/leads/mark-as-lost-button";
import { ReassignVendorButton } from "@/components/leads/reassign-vendor-button";
import { ReactivateAiButton } from "@/components/leads/reactivate-ai-button";
import { MarkProposalSentButton } from "@/components/leads/mark-proposal-sent-button";
import { FollowupCadence, type FollowupRow } from "@/components/leads/followup-cadence";
import { getUserContext } from "@/lib/auth/get-user-role";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead } from "@/app/dashboard/lib/ui";

// ── Cores semânticas (badges / texto) — superfície de card vem de S.card ──
const C = {
  text: "#c9d1d9", text2: "#e6edf3", muted: "#8b949e",
  blue: "#58a6ff", green: "#3fb950", amber: "#f0b429", red: "#f85149", purple: "#c084fc",
};

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

// P4: rótulos legíveis do canal de aquisição (origem_canal)
const CANAL_LABELS: Record<string, string> = {
  organico: "Orgânico", instagram: "Instagram (CTWA)", lp: "Landing Page",
  indicacao: "Indicação",
  site: "Site", whatsapp: "WhatsApp", sem_atribuicao: "Sem atribuição",
};

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
      fontFamily: theme.font.label, fontWeight: 700,
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

  // FIX4: cadência de follow-up via service role (followup_history é service-role-written)
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
    : supabase;
  const { data: followupRows } = await svc
    .from("followup_history")
    .select("followup_sequence, phase, angle, message_sent, sent_at, responded")
    .eq("phone", phone)
    .order("sent_at", { ascending: true });

  // Orquestração (Central de Cadências F1): estado da jornada + relógio — mesma
  // fonte dos cards do Mapa (v_orquestracao_leads). Leitura leve, 1 linha.
  const { data: orqRow } = await svc
    .from("v_orquestracao_leads")
    .select("journey_state, atrasado, eh_hoje, silencio_horas, next_followup_at")
    .eq("phone", phone)
    .maybeSingle();

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
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", fontFamily: theme.font.label, textDecoration: "none" }}
      >
        <ArrowLeft size={12} /> Leads
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHead title={lead.restaurant_name || lead.name || "Lead sem nome"} desc={lead.phone} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <FunnelStageBadge stage={lead.funnel_stage} />
          {isGestor && <VoltarEtapaButton leadId={lead.id} currentStage={lead.funnel_stage} />}
          <SmallBadge {...tempCfg} />
          <SmallBadge {...stsCfg} />
          <a href={`https://wa.me/${lead.phone}`} target="_blank" rel="noopener noreferrer">
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", border: `1px solid rgba(63,185,80,.4)`,
              color: C.green, fontSize: 10, letterSpacing: ".10em", textTransform: "uppercase",
              padding: "5px 10px", borderRadius: 4, cursor: "pointer",
              fontFamily: theme.font.label,
            }}>
              <MessageCircle size={12} /> WhatsApp
            </button>
          </a>
        </div>
      </div>

      {/* Orquestração — posição na cadência (Central de Cadências F1) */}
      {orqRow && (() => {
        const OLBL: Record<string, string> = {
          INBOUND_SEM_RESPOSTA: "Entrada (Inbound)", QUALIFICACAO_INTERROMPIDA: "Qualificação interrompida",
          QUALIFICADO_AGUARDANDO_VENDEDOR: "Qualificado · aguard. vendedor", HANDOFF_SEM_CONTATO: "Agendamento sem contato",
          EM_ANDAMENTO: "Em andamento", NEGOCIACAO: "Negociação", PROPOSTA: "Proposta enviada",
          PEDIDO_TESTE: "Pedido teste", GANHO: "Ganho (convertido)", PERDIDO_NURTURE: "Perdido · nutrição",
        };
        const longa = orqRow.journey_state === "PERDIDO_NURTURE";
        const sh = orqRow.silencio_horas;
        const sil = sh == null ? "—" : sh >= 24 ? `${Math.floor(sh / 24)}d` : `${sh}h`;
        const sitCor = orqRow.atrasado ? "#e0435c" : orqRow.eh_hoje ? "#e0a92a" : "#2fbf6b";
        const sitTxt = orqRow.atrasado ? "Atrasado" : orqRow.eh_hoje ? "Ação hoje" : "No prazo";
        let prox = "—";
        if (orqRow.next_followup_at) {
          const d = new Date(orqRow.next_followup_at);
          prox = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")} ${String((d.getUTCHours() + 21) % 24).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
        }
        const cell = (k: string, v: string, cor?: string) => (
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "#8b949e", fontFamily: theme.font.label }}>{k}</p>
            <p style={{ fontSize: 13, color: cor ?? C.text2, fontFamily: theme.font.label, marginTop: 3, whiteSpace: "nowrap" }}>{v}</p>
          </div>
        );
        return (
          <div style={{ ...S.card, padding: "13px 18px", borderLeft: `3px solid ${sitCor}`, display: "flex", flexWrap: "wrap", gap: "10px 26px", alignItems: "center" }}>
            <p style={{ fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "#8b949e", fontFamily: theme.font.label, marginRight: 4 }}>Orquestração</p>
            {cell("Estado", OLBL[orqRow.journey_state] ?? orqRow.journey_state, "#c8d8e8")}
            {cell("Cadência", longa ? "Longa (nutrição)" : "Curta")}
            {cell("Silêncio", sil)}
            {cell("Situação", sitTxt, sitCor)}
            {cell("Próximo follow-up", prox)}
            <Link href={`/dashboard/cadencias?estado=${orqRow.journey_state}`} style={{ marginLeft: "auto", color: C.muted, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", fontFamily: theme.font.label, textDecoration: "underline" }}>ver no mapa</Link>
          </div>
        );
      })()}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left: Conversation + CRM */}
        <div className="lg:col-span-2 space-y-4">

          {/* SDR Conversation — no topo para gestor ver conversa primeiro */}
          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={MessageCircle} color="#8bb4ff" title="Conversa SDR" />
            <ConversationWithFeedback rows={convRows ?? []} phone={phone} />
          </div>

          {/* CRM card */}
          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={ClipboardList} color="#c084fc" title="Dados CRM" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <CrmField icon={<MapPin size={13} />} label="Cidade" value={lead.city} />
              <CrmField icon={<Package size={13} />} label="Segmento" value={lead.segment} capitalize />
              <CrmField icon={<Package size={13} />} label="Volume semanal" value={lead.weekly_volume_kg ? `${lead.weekly_volume_kg} kg` : null} />
              <CrmField icon={<Thermometer size={13} />} label="Temperatura" value={lead.lead_temperature} />
              <CrmField icon={<User size={13} />} label="Vendedor" value={VENDOR_LABELS[lead.routing_team ?? ""] ?? lead.routing_team} />
              <CrmField icon={<User size={13} />} label="Etapa qual." value={`${lead.qual_stage ?? 0}/9`} mono />
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: "#8b949e", marginTop: 1, flexShrink: 0 }}><Megaphone size={13} /></span>
                <div>
                  <p style={{ fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "#8b949e", fontFamily: theme.font.label }}>Origem</p>
                  <div style={{ marginTop: 4 }}>
                    <OrigemSelector phone={lead.phone} initial={lead.origem_canal ?? null} />
                  </div>
                </div>
              </div>
              <CrmField icon={<Megaphone size={13} />} label="Campanha" value={lead.origem_utm_campaign || lead.ad_id || null} />
              {lead.pain_point && (
                <div className="col-span-2">
                  <p style={S.label}>Dor identificada</p>
                  <p style={{ color: C.muted, fontSize: 11, fontFamily: theme.font.label, marginTop: 4, fontStyle: "italic" }}>
                    &quot;{lead.pain_point}&quot;
                  </p>
                </div>
              )}
              <div className="col-span-2">
                <p style={{ ...S.label, marginBottom: 8 }}>Grupos de produto</p>
                <ProductGroupSelector phone={lead.phone} initial={(lead.product_groups as string[] | null) ?? []} />
              </div>
            </div>
          </div>

          {/* Vendor Conversation */}
          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={MessageCircle} color="#3fb950" title="Conversa Vendedor" desc={`${vmTotal ?? 0} mensagens`} />
            <VendorConversation messages={vendorMsgs} total={vmTotal ?? 0} />
          </div>

          {/* FIX4: Cadência de Follow-up */}
          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={Repeat} color="#f0b429" title="Cadência de Follow-up" desc={`${(followupRows ?? []).length} waves`} />
            <FollowupCadence rows={(followupRows ?? []) as FollowupRow[]} />
          </div>
        </div>

        {/* Right: timeline + notes + actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Timeline */}
          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={Clock} color="#8bb4ff" title="Timeline" />
            <LeadTimeline events={events} transitions={transitions} />
          </div>

          {/* Notes */}
          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={StickyNote} color="#58a6ff" title="Observações" />
            <LeadNotes leadId={lead.id} notes={noteEvents} />
          </div>

          {/* Actions */}
          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={Zap} color="#FF3B57" title="Ações" />
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
            {isGestor && (
              <div style={{ marginTop: 12 }}>
                <ReactivateAiButton
                  leadId={lead.id}
                  aiActive={lead.ai_active}
                  humanActive={lead.human_active}
                  funnelStage={lead.funnel_stage}
                />
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
        <p style={{ fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: "#8b949e", fontFamily: theme.font.label }}>{label}</p>
        <p style={{
          color: "#c9d1d9", fontSize: 11,
          fontFamily: mono ? theme.font.num : theme.font.label,
          fontWeight: 500, marginTop: 2,
          textTransform: capitalize ? "capitalize" : undefined,
        }}>
          {value || "\u2014"}
        </p>
      </div>
    </div>
  );
}
