"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, CheckCircle, TrendingUp, AlertTriangle } from "lucide-react";

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
  human_active: boolean | null;
  created_at: string;
  followup_count: number | null;
  pain_point: string | null;
  product_groups: string[] | null;
  scheduled_at: string | null;
};

// ── Design tokens ───────────────────────────────────────────────
const C = { bg: "#161b22", bg2: "#0d1117", border: "#21262d", border2: "#30363d", text: "#c9d1d9", muted: "#8b949e", blue: "#58a6ff", green: "#3fb950", amber: "#f0b429", red: "#f85149" };

const LABEL: React.CSSProperties = { fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: C.muted, fontFamily: "'Courier New', monospace" };

// ── Badge configs ────────────────────────────────────────────────
type BadgeCfg = { label: string; color: string; bg: string; border: string };

const TEMP_CFG: Record<string, BadgeCfg> = {
  HOT:          { label: "HOT",   color: C.red,   bg: "rgba(248,81,73,.1)",   border: "rgba(248,81,73,.3)" },
  WARM:         { label: "WARM",  color: C.amber, bg: "rgba(240,180,41,.1)",  border: "rgba(240,180,41,.3)" },
  COLD:         { label: "COLD",  color: C.blue,  bg: "rgba(88,166,255,.1)",  border: "rgba(88,166,255,.3)" },
  READY_TO_BUY: { label: "READY", color: "#c084fc", bg: "rgba(192,132,252,.1)", border: "rgba(192,132,252,.3)" },
};

const STATUS_CFG: Record<string, BadgeCfg> = {
  new:       { label: "Novo",         color: C.muted, bg: "rgba(139,148,158,.1)", border: "rgba(139,148,158,.25)" },
  qualified: { label: "Qualificado",  color: C.green, bg: "rgba(63,185,80,.1)",   border: "rgba(63,185,80,.3)" },
  converted: { label: "Convertido",   color: C.amber, bg: "rgba(240,180,41,.1)",  border: "rgba(240,180,41,.3)" },
  optout:    { label: "Opt-out",      color: C.red,   bg: "rgba(248,81,73,.08)",  border: "rgba(248,81,73,.25)" },
};

const ABC_CFG: Record<"A" | "B" | "C", BadgeCfg> = {
  A: { label: "A", color: C.red,   bg: "rgba(248,81,73,.1)",  border: "rgba(248,81,73,.3)" },
  B: { label: "B", color: C.amber, bg: "rgba(240,180,41,.1)", border: "rgba(240,180,41,.3)" },
  C: { label: "C", color: C.blue,  bg: "rgba(88,166,255,.1)", border: "rgba(88,166,255,.3)" },
};

const VENDOR_LABELS: Record<string, string> = { ana_paula: "Ana Paula", alan: "Alan", setor_cuit: "CUIT" };

const PRODUCT_LABELS: Record<string, string> = {
  hamburguer: "Hambúrguer", espeto: "Espeto", boteco: "Boteco",
  cortes_especiais: "Cortes Esp.", mercearia: "Mercearia",
  molhos: "Molhos", defumados: "Defumados", paes: "Pães", embalagens: "Embalagens",
};

function abcCurve(vol: number | null): "A" | "B" | "C" {
  if ((vol ?? 0) >= 300) return "A";
  if ((vol ?? 0) >= 100) return "B";
  return "C";
}

function derivedStatus(lead: Lead): string {
  if (lead.lead_status === "optout") return "optout";
  if (lead.first_order_at) return "converted";
  if ((lead.qual_stage ?? 0) >= 7) return "qualified";
  return lead.lead_status ?? "new";
}

function Badge({ cfg }: { cfg: BadgeCfg }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 5px", borderRadius: 3,
      fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
      fontFamily: "'Courier New', monospace", fontWeight: 700,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 4,
        color: C.muted, fontSize: 10, letterSpacing: ".10em", textTransform: "uppercase",
        padding: "5px 10px", fontFamily: "'Courier New', monospace", cursor: "pointer", outline: "none",
        flexShrink: 0,
      }}
    >
      {children}
    </select>
  );
}

export function LeadsTable({ leads: initialLeads, userEmail }: { leads: Lead[]; userEmail: string }) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("all");
  const [abcFilter, setAbcFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [isPending, startTransition] = useTransition();

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (l.name ?? "").toLowerCase().includes(q) || l.phone.includes(q) || (l.city ?? "").toLowerCase().includes(q);
    const matchStatus  = statusFilter === "all" || derivedStatus(l) === statusFilter;
    const matchVendor  = vendorFilter === "all" || l.routing_team === vendorFilter;
    const matchAbc     = abcFilter === "all" || abcCurve(l.weekly_volume_kg) === abcFilter;
    const matchProduct = productFilter === "all" || (l.product_groups ?? []).includes(productFilter);
    return matchSearch && matchStatus && matchVendor && matchAbc && matchProduct;
  });

  async function confirmHandoff(phone: string) {
    const now = new Date().toISOString();
    await createClient().from("ai_sdr_leads").update({ handoff_confirmed: true, handoff_confirmed_at: now }).eq("phone", phone);
    setLeads(prev => prev.map(l => l.phone === phone ? { ...l, handoff_confirmed: true, handoff_confirmed_at: now } : l));
  }

  async function convertLead(phone: string) {
    const now = new Date().toISOString();
    await createClient().from("ai_sdr_leads").update({ first_order_at: now }).eq("phone", phone);
    setLeads(prev => prev.map(l => l.phone === phone ? { ...l, first_order_at: now } : l));
  }

  const TH: React.CSSProperties = { ...LABEL, padding: "10px 14px", textAlign: "left", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "10px 14px", color: C.text, fontSize: 11, fontFamily: "'Courier New', monospace", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filters — horizontal scroll on mobile */}
      <div className="asb-filters-bar">
        <div style={{ position: "relative", minWidth: 160, flexShrink: 0 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 12 }}>›</span>
          <input
            type="text"
            placeholder="buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%", background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 4,
              color: C.text, fontSize: 11, padding: "5px 10px 5px 24px",
              fontFamily: "'Courier New', monospace", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
        <Select value={statusFilter} onChange={setStatusFilter}>
          <option value="all">status: todos</option>
          <option value="new">novo</option>
          <option value="qualified">qualificado</option>
          <option value="converted">convertido</option>
          <option value="optout">opt-out</option>
        </Select>
        <Select value={vendorFilter} onChange={setVendorFilter}>
          <option value="all">vendedor: todos</option>
          <option value="ana_paula">Ana Paula</option>
          <option value="alan">Alan</option>
          <option value="setor_cuit">CUIT</option>
        </Select>
        <Select value={abcFilter} onChange={setAbcFilter}>
          <option value="all">ABC: todos</option>
          <option value="A">Tier A ≥300 kg</option>
          <option value="B">Tier B ≥100 kg</option>
          <option value="C">Tier C &lt;100 kg</option>
        </Select>
        <Select value={productFilter} onChange={setProductFilter}>
          <option value="all">produto: todos</option>
          {Object.entries(PRODUCT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <button
          onClick={() => startTransition(() => router.refresh())}
          disabled={isPending}
          style={{
            background: "transparent", border: `1px solid ${C.border2}`, borderRadius: 4,
            color: C.muted, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
            padding: "5px 12px", cursor: "pointer", fontFamily: "'Courier New', monospace", flexShrink: 0,
          }}
        >
          {isPending ? "..." : "↺ atualizar"}
        </button>
      </div>

      <p style={{ ...LABEL, margin: 0 }}>{filtered.length} leads</p>

      {/* ── Mobile cards ─────────────────────────────────────── */}
      <div className="asb-mobile-only" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ ...LABEL, textAlign: "center", padding: "32px 0", color: C.muted }}>
            nenhum lead encontrado
          </div>
        )}
        {filtered.map((lead) => {
          const status = derivedStatus(lead);
          const abc    = abcCurve(lead.weekly_volume_kg);
          const showConfirm = !!lead.handoff_at && lead.handoff_confirmed === false;
          const showConvert = (lead.qual_stage ?? 0) >= 7 && !lead.first_order_at;
          const _now = new Date();
          const alertLevel =
            lead.scheduled_at && !lead.handoff_confirmed && new Date(lead.scheduled_at) < _now ? 'red' :
            lead.handoff_at && !lead.handoff_confirmed && !lead.scheduled_at && (_now.getTime() - new Date(lead.handoff_at).getTime()) > 4 * 3600000 ? 'amber' :
            null;

          return (
            <div
              key={lead.phone}
              style={{
                background: C.bg,
                border: `1px solid ${alertLevel === 'red' ? C.red : alertLevel === 'amber' ? C.amber : C.border2}`,
                borderRadius: 6,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* Name + phone */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <Link
                    href={`/dashboard/leads/${encodeURIComponent(lead.phone)}`}
                    style={{ color: C.blue, textDecoration: "none", fontWeight: 600, fontSize: 12, fontFamily: "'Courier New', monospace" }}
                  >
                    {lead.name || "—"}
                  </Link>
                  <div style={{ color: C.muted, fontSize: 10, fontFamily: "'Courier New', monospace", marginTop: 1 }}>
                    {lead.phone}
                  </div>
                </div>
                {/* Action buttons */}
                <div style={{ display: "flex", gap: 6 }}>
                  <Link href={`/dashboard/leads/${encodeURIComponent(lead.phone)}`}>
                    <button style={{ background: "transparent", border: "none", color: C.green, cursor: "pointer", padding: 4 }} title="Ver conversa">
                      <MessageCircle size={16} />
                    </button>
                  </Link>
                  {showConfirm && (
                    <button onClick={() => confirmHandoff(lead.phone)} style={{ background: "transparent", border: "none", color: C.amber, cursor: "pointer", padding: 4 }} title="Confirmar handoff">
                      <CheckCircle size={16} />
                    </button>
                  )}
                  {showConvert && (
                    <button onClick={() => convertLead(lead.phone)} style={{ background: "transparent", border: "none", color: C.blue, cursor: "pointer", padding: 4 }} title="Marcar convertido">
                      <TrendingUp size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Badges row */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <Badge cfg={ABC_CFG[abc]} />
                <Badge cfg={TEMP_CFG[lead.lead_temperature ?? ""] ?? TEMP_CFG.COLD} />
                <Badge cfg={STATUS_CFG[status] ?? STATUS_CFG.new} />
                {lead.city && (
                  <span style={{ color: C.muted, fontSize: 9, fontFamily: "'Courier New', monospace" }}>
                    {lead.city}
                  </span>
                )}
              </div>

              {/* Volume + vendor */}
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ color: C.muted, fontSize: 9, fontFamily: "'Courier New', monospace", letterSpacing: ".10em" }}>
                  {lead.weekly_volume_kg ? `${lead.weekly_volume_kg} kg/sem` : "vol: —"}
                </span>
                <span style={{ color: C.muted, fontSize: 9, fontFamily: "'Courier New', monospace", letterSpacing: ".10em" }}>
                  {VENDOR_LABELS[lead.routing_team ?? ""] ?? lead.routing_team ?? "—"}
                </span>
                <span style={{ color: C.muted, fontSize: 9, fontFamily: "'Courier New', monospace" }}>
                  etapa {lead.qual_stage ?? 0}/9
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop table ────────────────────────────────────── */}
      <div className="asb-desktop-only" style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 6, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#0d1117" }}>
              {["Lead", "Cidade", "Segmento", "Volume", "ABC", "Temp.", "Status", "Vendedor", "Etapa", "Handoff", "Ações"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} style={{ ...TD, textAlign: "center", color: C.muted, padding: "32px 0" }}>
                  nenhum lead encontrado
                </td>
              </tr>
            )}
            {filtered.map((lead, i) => {
              const status = derivedStatus(lead);
              const abc    = abcCurve(lead.weekly_volume_kg);
              const showConfirm = !!lead.handoff_at && lead.handoff_confirmed === false;
              const showConvert = (lead.qual_stage ?? 0) >= 7 && !lead.first_order_at;
              const rowBg = i % 2 === 0 ? C.bg : "#0d1117";
              const _now2 = new Date();
              const alertLevel =
                lead.scheduled_at && !lead.handoff_confirmed && new Date(lead.scheduled_at) < _now2 ? 'red' :
                lead.handoff_at && !lead.handoff_confirmed && !lead.scheduled_at && (_now2.getTime() - new Date(lead.handoff_at).getTime()) > 4 * 3600000 ? 'amber' :
                null;

              return (
                <tr key={lead.phone} style={{ background: rowBg, borderLeft: alertLevel ? `3px solid ${alertLevel === 'red' ? C.red : C.amber}` : undefined }} onMouseEnter={e => (e.currentTarget.style.background = "#21262d")} onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                  <td style={TD}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {alertLevel && (
                        <AlertTriangle size={12} style={{ color: alertLevel === 'red' ? C.red : C.amber, flexShrink: 0 }} />
                      )}
                      <Link href={`/dashboard/leads/${encodeURIComponent(lead.phone)}`} style={{ color: C.blue, textDecoration: "none", fontWeight: 600 }}>
                        {lead.name || "—"}
                      </Link>
                    </div>
                    <br />
                    <span style={{ color: C.muted, fontSize: 10 }}>{lead.phone}</span>
                  </td>
                  <td style={TD}>{lead.city || "—"}</td>
                  <td style={{ ...TD, textTransform: "capitalize" }}>{lead.segment || "—"}</td>
                  <td style={TD}>{lead.weekly_volume_kg ? `${lead.weekly_volume_kg} kg` : "—"}</td>
                  <td style={TD}><Badge cfg={ABC_CFG[abc]} /></td>
                  <td style={TD}><Badge cfg={TEMP_CFG[lead.lead_temperature ?? ""] ?? TEMP_CFG.COLD} /></td>
                  <td style={TD}><Badge cfg={STATUS_CFG[status] ?? STATUS_CFG.new} /></td>
                  <td style={TD}>{VENDOR_LABELS[lead.routing_team ?? ""] ?? lead.routing_team ?? "—"}</td>
                  <td style={TD}>
                    <span style={{ fontFamily: "'Courier New', monospace", color: C.muted, fontSize: 10 }}>
                      {lead.qual_stage ?? 0}/9
                    </span>
                  </td>
                  <td style={TD}>
                    {lead.handoff_at
                      ? lead.handoff_confirmed
                        ? <span style={{ color: C.green, fontSize: 10 }}>✓ confirmado</span>
                        : <span style={{ color: C.amber, fontSize: 10 }}>{new Date(lead.handoff_at).toLocaleDateString("pt-BR")}</span>
                      : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={TD}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <Link href={`/dashboard/leads/${encodeURIComponent(lead.phone)}`}>
                        <button style={{ background: "transparent", border: "none", color: C.green, cursor: "pointer", padding: 3 }} title="Ver conversa">
                          <MessageCircle size={14} />
                        </button>
                      </Link>
                      {showConfirm && (
                        <button onClick={() => confirmHandoff(lead.phone)} style={{ background: "transparent", border: "none", color: C.amber, cursor: "pointer", padding: 3 }} title="Confirmar handoff">
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {showConvert && (
                        <button onClick={() => convertLead(lead.phone)} style={{ background: "transparent", border: "none", color: C.blue, cursor: "pointer", padding: 3 }} title="Marcar convertido">
                          <TrendingUp size={14} />
                        </button>
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
