import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Package, Thermometer, User, Calendar, Clock, MessageCircle } from "lucide-react";
import { LeadActions } from "@/components/leads/lead-actions";
import { ProductGroupSelector } from "@/components/leads/product-group-selector";

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
};

const VENDOR_LABELS: Record<string, string> = { ana_paula: "Ana Paula", alan: "Alan", setor_cuit: "CUIT" };

function derivedStatus(lead: { lead_status: string | null; first_order_at: string | null; qual_stage: number | null }): string {
  if (lead.lead_status === "optout") return "optout";
  if (lead.first_order_at) return "converted";
  if ((lead.qual_stage ?? 0) >= 7) return "qualified";
  return lead.lead_status ?? "new";
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

  const [{ data: lead }, { data: convRows }] = await Promise.all([
    supabase.from("ai_sdr_leads").select("*").eq("phone", phone).single(),
    supabase.from("conversas_sdr").select("role, content, created_at").eq("phone", phone).order("created_at", { ascending: true }).limit(100),
  ]);

  if (!lead) notFound();

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
            {lead.name || "Lead sem nome"}
          </h1>
          <p style={{ color: C.muted, fontSize: 11, fontFamily: "'Courier New', monospace" }}>{lead.phone}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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

      {/* Main grid: single col on mobile, 3 cols on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left: CRM + conversation */}
        <div className="lg:col-span-2 space-y-4">

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
                    "{lead.pain_point}"
                  </p>
                </div>
              )}

              <div className="col-span-2">
                <p style={{ ...LABEL, marginBottom: 8 }}>Grupos de produto</p>
                <ProductGroupSelector
                  phone={lead.phone}
                  initial={(lead.product_groups as string[] | null) ?? []}
                />
              </div>
            </div>
          </div>

          {/* Conversation card */}
          <div style={{ ...CARD, padding: "20px 24px" }}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Conversa</p>
            {!convRows || convRows.length === 0 ? (
              <p style={{ color: C.muted, fontSize: 11, fontFamily: "'Courier New', monospace" }}>Nenhuma mensagem registrada.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
                {convRows.map((msg, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-start" : "flex-end" }}
                  >
                    <div style={{
                      maxWidth: "85%",
                      borderRadius: 8,
                      padding: "8px 12px",
                      background: msg.role === "user" ? C.bg2 : "rgba(88,166,255,.15)",
                      border: `1px solid ${msg.role === "user" ? C.border : "rgba(88,166,255,.3)"}`,
                    }}>
                      <p style={{ color: msg.role === "user" ? C.text : C.blue, fontSize: 11, fontFamily: "'Courier New', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {msg.content}
                      </p>
                      <p style={{ color: C.muted, fontSize: 9, fontFamily: "'Courier New', monospace", marginTop: 4, letterSpacing: ".08em" }}>
                        {fmt(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: timeline + actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Timeline */}
          <div style={{ ...CARD, padding: "20px 24px" }}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Timeline</p>
            <ol style={{ position: "relative", borderLeft: `1px solid ${C.border}`, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <TimelineItem label="Lead criado" date={lead.created_at} icon={<Clock size={10} />} color={C.muted} />
              {lead.handoff_at && <TimelineItem label="Handoff enviado" date={lead.handoff_at} icon={<Calendar size={10} />} color={C.amber} />}
              {lead.handoff_confirmed_at && <TimelineItem label="Handoff confirmado" date={lead.handoff_confirmed_at} icon={<Calendar size={10} />} color={C.blue} />}
              {lead.first_order_at && <TimelineItem label="Primeiro pedido" date={lead.first_order_at} icon={<Package size={10} />} color={C.green} />}
            </ol>
          </div>

          {/* Actions */}
          <div style={{ ...CARD, padding: "20px 24px" }}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Ações</p>
            <LeadActions lead={lead} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CrmField({ icon, label, value, capitalize, mono }: { icon: React.ReactNode; label: string; value: string | null | undefined; capitalize?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ color: C.muted, marginTop: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <p style={LABEL}>{label}</p>
        <p style={{
          color: C.text,
          fontSize: 11,
          fontFamily: mono ? "'Courier New', monospace" : "'Inter', system-ui, sans-serif",
          fontWeight: 500,
          marginTop: 2,
          textTransform: capitalize ? "capitalize" : undefined,
        }}>
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

function TimelineItem({ label, date, icon, color }: { label: string; date: string | null; icon: React.ReactNode; color: string }) {
  return (
    <li style={{ position: "relative" }}>
      <span style={{
        position: "absolute", left: -26, top: 2,
        width: 18, height: 18, borderRadius: "50%",
        background: `${color}20`, border: `1px solid ${color}50`,
        display: "flex", alignItems: "center", justifyContent: "center", color,
      }}>{icon}</span>
      <p style={{ color: C.text, fontSize: 11, fontFamily: "'Courier New', monospace", fontWeight: 600 }}>{label}</p>
      <p style={{ color: C.muted, fontSize: 9, fontFamily: "'Courier New', monospace", marginTop: 1 }}>{fmt(date)}</p>
    </li>
  );
}
