"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Flame, ShoppingBag, Users, Search } from "lucide-react";
import { LeadScoreBadge } from "@/components/dashboard/lead-score-badge";
import { vendorLabel } from "@/lib/vendor-labels";
import { theme } from "@/lib/theme";

// ── Types ────────────────────────────────────────────────────────────────────

type HotLead = {
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  segment: string | null;
  qual_stage: number | null;
  lead_temperature: string | null;
  lead_score: number | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  orders_count: number;
  orders_revenue_brl: number;
  routing_team: string | null;
  ai_active: boolean;
  human_active: boolean;
  first_order_at: string | null;
  churn_risk: string | null;
};

type Filter = "all" | "hot" | "client";

// ── Design tokens (linguagem grafite do Comercial) ───────────────────────────
// Superfície via var(--asb-*). Cores de sinal preservam significado
// (verde=cliente/ok, vermelho=quente/perigo, âmbar=alerta, roxo=quente+cliente).
// TEXTO/label → sans (theme.font.label). NÚMERO → mono tabular (theme.font.num).

const C = {
  ink:    "#FFFFFF",
  text:   "#e6ebf5",
  muted:  "#aeb7cc",
  faint:  "#83879a",
  red:    "#FF3B57",
  amber:  "#f59e0b",
  green:  "#22c55e",
  blue:   "#8bb4ff",
  purple: "#a855f7",
};

// SANS = texto/label · NUM = número/valor
const SANS: React.CSSProperties = { fontFamily: theme.font.label };
const NUM: React.CSSProperties = { fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" };

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `há ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function maskPhone(phone: string): string {
  if (phone.length >= 13) {
    return `+${phone.slice(0,2)} (${phone.slice(2,4)}) ****-${phone.slice(-4)}`;
  }
  return phone.slice(0, 6) + "****" + phone.slice(-4);
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

function derivePerfil(lead: HotLead): { label: string; color: string; bg: string; icon: React.ReactNode } {
  const isHot = lead.ai_active && ["HOT","READY_TO_BUY","WARM"].includes(lead.lead_temperature ?? "");
  const isClient = lead.first_order_at !== null;

  if (isHot && isClient) return { label: "Quente + Cliente", color: C.purple, bg: "rgba(168,85,247,.14)", icon: <><Flame style={{ width: 11, height: 11 }} /><ShoppingBag style={{ width: 11, height: 11 }} /></> };
  if (isHot)             return { label: "Quente",           color: C.red,    bg: "rgba(255,59,87,.14)",  icon: <Flame style={{ width: 11, height: 11 }} /> };
  if (isClient)          return { label: "Cliente",          color: C.green,  bg: "rgba(34,197,94,.12)",  icon: <ShoppingBag style={{ width: 11, height: 11 }} /> };
  return                        { label: "—",                color: C.faint,  bg: "transparent",          icon: null };
}

const TEMP_COLOR: Record<string, string> = {
  HOT:          C.red,
  WARM:         C.amber,
  READY_TO_BUY: C.green,
  COLD:         C.muted,
};

// ── Component ────────────────────────────────────────────────────────────────

export function HotLeadsTable({ leads }: { leads: HotLead[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    let list = leads;

    if (filter === "hot") {
      list = list.filter(l => l.ai_active && ["HOT","READY_TO_BUY","WARM"].includes(l.lead_temperature ?? ""));
    } else if (filter === "client") {
      list = list.filter(l => l.first_order_at !== null);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(l =>
        l.phone.includes(q) ||
        (l.restaurant_name ?? "").toLowerCase().includes(q) ||
        (l.name ?? "").toLowerCase().includes(q) ||
        (l.city ?? "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [leads, filter, search]);

  const countHot    = leads.filter(l => l.ai_active && ["HOT","READY_TO_BUY","WARM"].includes(l.lead_temperature ?? "")).length;
  const countClient = leads.filter(l => l.first_order_at !== null).length;

  const FILTER_BTN = (f: Filter, label: string, count: number, icon: React.ReactNode) => (
    <button
      onClick={() => setFilter(f)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "6px 13px", borderRadius: 999,
        border: `1px solid ${filter === f ? "var(--asb-border)" : "transparent"}`,
        background: filter === f ? "var(--asb-card-hi)" : "transparent",
        color: filter === f ? C.ink : C.muted,
        fontSize: 12.5, fontWeight: 650,
        cursor: "pointer", ...SANS,
      }}
    >
      {icon}
      {label}
      <span style={{ color: filter === f ? C.red : C.faint, marginLeft: 2, fontSize: 12, fontWeight: 700, ...NUM }}>{count}</span>
    </button>
  );

  // Rótulo de coluna: UPPERCASE pequeno SANS (igual Dashboard) — nunca mono.
  const TH: React.CSSProperties = {
    padding: "7px 10px", textAlign: "left", fontSize: 11, letterSpacing: ".06em",
    textTransform: "uppercase", color: C.faint, fontWeight: 700, whiteSpace: "nowrap", ...SANS,
  };

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {FILTER_BTN("all",    "Todos",    leads.length, <Users style={{ width: 13, height: 13 }} />)}
        {FILTER_BTN("hot",    "Quentes",  countHot,     <Flame style={{ width: 13, height: 13 }} />)}
        {FILTER_BTN("client", "Clientes", countClient,  <ShoppingBag style={{ width: 13, height: 13 }} />)}

        <div style={{ flex: 1, minWidth: 180, maxWidth: 280, position: "relative", marginLeft: "auto" }}>
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: C.faint }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar telefone, restaurante..."
            style={{
              width: "100%", padding: "8px 11px 8px 30px",
              background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)", borderRadius: 8,
              color: C.text, fontSize: 12.5, ...SANS,
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...SANS }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--asb-border)" }}>
              {["Perfil","Telefone","Restaurante","Cidade","Segmento","Etapa","Temperatura","Score","Último contato","Próx. follow-up","Pedidos","Receita","Roteamento"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} style={{ padding: "24px 10px", textAlign: "center", color: C.muted, fontSize: 13, ...SANS }}>
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
            {filtered.map((lead, i) => {
              const perfil = derivePerfil(lead);
              return (
                <tr
                  key={lead.phone}
                  onClick={() => router.push(`/dashboard/leads/${encodeURIComponent(lead.phone)}`)}
                  style={{
                    borderBottom: `1px solid ${i < filtered.length - 1 ? "var(--asb-border)" : "transparent"}`,
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,.02)",
                    cursor: "pointer",
                  }}
                >
                  {/* Perfil */}
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "3px 9px", borderRadius: 999,
                      background: perfil.bg, color: perfil.color,
                      fontSize: 11, fontWeight: 650, ...SANS,
                    }}>
                      {perfil.icon}
                      {perfil.label}
                    </span>
                  </td>

                  {/* Telefone */}
                  <td style={{ padding: "8px 10px", color: C.muted, fontSize: 12, whiteSpace: "nowrap", ...NUM }}>
                    {maskPhone(lead.phone)}
                  </td>

                  {/* Restaurante */}
                  <td style={{ padding: "8px 10px", color: C.text, fontSize: 13, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...SANS }}>
                    {lead.restaurant_name ?? lead.name ?? "—"}
                  </td>

                  {/* Cidade */}
                  <td style={{ padding: "8px 10px", color: C.muted, fontSize: 12.5, whiteSpace: "nowrap", ...SANS }}>
                    {lead.city ?? "—"}
                  </td>

                  {/* Segmento */}
                  <td style={{ padding: "8px 10px", color: C.muted, fontSize: 12, whiteSpace: "nowrap", ...SANS }}>
                    {lead.segment ?? "—"}
                  </td>

                  {/* Etapa */}
                  <td style={{ padding: "8px 10px", textAlign: "center", color: C.muted, fontSize: 12.5, ...NUM }}>
                    {lead.qual_stage != null ? `${lead.qual_stage}/9` : "—"}
                  </td>

                  {/* Temperatura */}
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <span style={{ color: TEMP_COLOR[lead.lead_temperature ?? ""] ?? C.muted, fontSize: 11.5, fontWeight: 650, ...SANS }}>
                      {lead.lead_temperature ?? "—"}
                    </span>
                  </td>

                  {/* Score (ETAPA 4: badge com tier derivado do score nativo da sdr_hot_leads) */}
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    {lead.lead_score != null
                      ? <LeadScoreBadge score={Math.round(lead.lead_score)} tier={lead.lead_score >= 70 ? "A" : lead.lead_score >= 40 ? "B" : "C"} size="sm" />
                      : <span style={{ color: C.faint, ...NUM }}>—</span>}
                  </td>

                  {/* Último contato */}
                  <td style={{ padding: "8px 10px", color: C.muted, fontSize: 12, whiteSpace: "nowrap", ...NUM }}>
                    {relativeTime(lead.last_contact_at)}
                  </td>

                  {/* Próx. follow-up */}
                  <td style={{ padding: "8px 10px", color: lead.next_followup_at ? C.amber : C.faint, fontSize: 12, whiteSpace: "nowrap", ...NUM }}>
                    {relativeTime(lead.next_followup_at)}
                  </td>

                  {/* Pedidos */}
                  <td style={{ padding: "8px 10px", textAlign: "center" }}>
                    {lead.orders_count > 0 ? (
                      <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, background: "rgba(34,197,94,.12)", color: C.green, fontSize: 12, fontWeight: 700, ...NUM }}>
                        {lead.orders_count}
                      </span>
                    ) : (
                      <span style={{ color: C.faint, fontSize: 12, ...NUM }}>0</span>
                    )}
                  </td>

                  {/* Receita */}
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <span style={{ color: lead.orders_revenue_brl > 0 ? C.green : C.faint, fontSize: 12, fontWeight: 700, ...NUM }}>
                      {fmtBRL(lead.orders_revenue_brl)}
                    </span>
                  </td>

                  {/* Roteamento */}
                  <td style={{ padding: "8px 10px", color: C.muted, fontSize: 12, whiteSpace: "nowrap", ...SANS }}>
                    {vendorLabel(lead.routing_team)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ color: C.faint, fontSize: 12, marginTop: 14, ...SANS }}>
        <span style={NUM}>{filtered.length}</span> de <span style={NUM}>{leads.length}</span> leads · ordenado por score e último contato · limite <span style={NUM}>100</span>
      </p>
    </div>
  );
}
