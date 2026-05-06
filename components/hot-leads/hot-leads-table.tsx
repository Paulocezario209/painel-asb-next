"use client";

import { useState, useMemo } from "react";
import { Flame, ShoppingBag, Users, Search } from "lucide-react";

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

// ── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:     "#080b14",
  bg2:    "#0f1428",
  border: "#1B2A6B",
  text:   "#FFFFFF",
  muted:  "#8899aa",
  label:  "#556677",
  red:    "#C8102E",
  amber:  "#f59e0b",
  green:  "#22c55e",
  blue:   "#60a5fa",
};

const MONO: React.CSSProperties = { fontFamily: "'Courier New', monospace" };

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

  if (isHot && isClient) return { label: "Quente+Cliente", color: "#a855f7", bg: "rgba(168,85,247,.12)", icon: <><Flame style={{ width: 10, height: 10 }} /><ShoppingBag style={{ width: 10, height: 10 }} /></> };
  if (isHot)             return { label: "Quente",         color: C.red,     bg: "rgba(200,16,46,.12)", icon: <Flame style={{ width: 10, height: 10 }} /> };
  if (isClient)          return { label: "Cliente",         color: C.green,   bg: "rgba(34,197,94,.1)",  icon: <ShoppingBag style={{ width: 10, height: 10 }} /> };
  return                        { label: "—",               color: C.label,   bg: "transparent",         icon: null };
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
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "5px 12px", borderRadius: 3,
        border: `1px solid ${filter === f ? C.border : "transparent"}`,
        background: filter === f ? "rgba(27,42,107,.35)" : "transparent",
        color: filter === f ? C.text : C.muted,
        fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase",
        cursor: "pointer", ...MONO,
      }}
    >
      {icon}
      {label}
      <span style={{ color: filter === f ? C.red : C.label, marginLeft: 2 }}>{count}</span>
    </button>
  );

  return (
    <div>
      {/* Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {FILTER_BTN("all",    "Todos",    leads.length, <Users style={{ width: 11, height: 11 }} />)}
        {FILTER_BTN("hot",    "Quentes",  countHot,     <Flame style={{ width: 11, height: 11 }} />)}
        {FILTER_BTN("client", "Clientes", countClient,  <ShoppingBag style={{ width: 11, height: 11 }} />)}

        <div style={{ flex: 1, minWidth: 180, maxWidth: 280, position: "relative", marginLeft: "auto" }}>
          <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, color: C.label }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="buscar phone, restaurante..."
            style={{
              width: "100%", padding: "5px 8px 5px 26px",
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 3,
              color: C.muted, fontSize: 10, ...MONO,
              outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...MONO }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Perfil","Phone","Restaurante","Cidade","Seg","Stage","Temp","Score","Último contato","Próx. followup","Pedidos","Receita","Roteamento"].map(h => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 9, letterSpacing: ".13em", textTransform: "uppercase", color: C.label, whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} style={{ padding: "24px 10px", textAlign: "center", color: C.label, fontSize: 11 }}>
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
            {filtered.map((lead, i) => {
              const perfil = derivePerfil(lead);
              return (
                <tr
                  key={lead.phone}
                  style={{
                    borderBottom: `1px solid ${i < filtered.length - 1 ? "#0f1826" : "transparent"}`,
                    background: i % 2 === 0 ? "transparent" : "rgba(27,42,107,.04)",
                  }}
                >
                  {/* Perfil */}
                  <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 7px", borderRadius: 2,
                      background: perfil.bg, color: perfil.color,
                      fontSize: 9, letterSpacing: ".1em",
                    }}>
                      {perfil.icon}
                      {perfil.label}
                    </span>
                  </td>

                  {/* Phone */}
                  <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>
                    {maskPhone(lead.phone)}
                  </td>

                  {/* Restaurante */}
                  <td style={{ padding: "7px 10px", color: C.text, fontSize: 10, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lead.restaurant_name ?? lead.name ?? "—"}
                  </td>

                  {/* Cidade */}
                  <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>
                    {lead.city ?? "—"}
                  </td>

                  {/* Segmento */}
                  <td style={{ padding: "7px 10px", color: C.muted, fontSize: 9, whiteSpace: "nowrap" }}>
                    {lead.segment ?? "—"}
                  </td>

                  {/* Stage */}
                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                    <span style={{ color: C.muted, fontSize: 10 }}>
                      {lead.qual_stage != null ? `${lead.qual_stage}/7` : "—"}
                    </span>
                  </td>

                  {/* Temperatura */}
                  <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                    <span style={{ color: TEMP_COLOR[lead.lead_temperature ?? ""] ?? C.muted, fontSize: 9, letterSpacing: ".1em" }}>
                      {lead.lead_temperature ?? "—"}
                    </span>
                  </td>

                  {/* Score */}
                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                    <span style={{ color: C.text, fontSize: 11, fontWeight: 600 }}>
                      {lead.lead_score != null ? lead.lead_score.toFixed(0) : "—"}
                    </span>
                  </td>

                  {/* Último contato */}
                  <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>
                    {relativeTime(lead.last_contact_at)}
                  </td>

                  {/* Próx. followup */}
                  <td style={{ padding: "7px 10px", color: lead.next_followup_at ? C.amber : C.label, fontSize: 10, whiteSpace: "nowrap" }}>
                    {relativeTime(lead.next_followup_at)}
                  </td>

                  {/* Pedidos */}
                  <td style={{ padding: "7px 10px", textAlign: "center" }}>
                    {lead.orders_count > 0 ? (
                      <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, background: "rgba(34,197,94,.12)", color: C.green, fontSize: 10, fontWeight: 600 }}>
                        {lead.orders_count}
                      </span>
                    ) : (
                      <span style={{ color: C.label, fontSize: 10 }}>0</span>
                    )}
                  </td>

                  {/* Receita */}
                  <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                    <span style={{ color: lead.orders_revenue_brl > 0 ? C.green : C.label, fontSize: 10 }}>
                      {fmtBRL(lead.orders_revenue_brl)}
                    </span>
                  </td>

                  {/* Roteamento */}
                  <td style={{ padding: "7px 10px", color: C.muted, fontSize: 9, whiteSpace: "nowrap" }}>
                    {lead.routing_team?.replace("SETOR_","").replace("_"," ") ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ color: C.label, fontSize: 9, marginTop: 12, ...MONO, letterSpacing: ".08em" }}>
        {filtered.length} de {leads.length} leads · Limit 100 · ORDER BY lead_score DESC, last_contact_at DESC
      </p>
    </div>
  );
}
