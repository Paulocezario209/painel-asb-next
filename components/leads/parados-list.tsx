"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search } from "lucide-react";
import { stageLabel } from "@/lib/funnel/stages";

// PARADOS — aba "Parados" em /dashboard/leads (item 10 da frente do painel).
// Fonte: view v_leads_parados (security_invoker → vendor-scoped por RLS). 4 baldes de
// leads que precisam de atenção. Default = qualificacao_estagnada (o mais acionável).

export type ParadoLead = {
  balde: string;
  id: string;
  phone: string;
  restaurant_name: string | null;
  city: string | null;
  routing_team: string | null;
  funnel_stage: string | null;
  qual_stage: number | null;
  last_reply_at: string | null;
  followup_phase: string | null;
  followup_fail_count: number | null;
};

const C = {
  bg: "#080b14", border: "#2a2a2a",
  text: "#FFFFFF", muted: "#c0d0e0", label: "#e4e9f0", red: "#C8102E", amber: "#f59e0b",
};
const MONO: React.CSSProperties = { fontFamily: "'Courier New', monospace" };

// ordem = default primeiro (qualificacao_estagnada, o mais acionável)
const BALDES: { key: string; label: string; cor: string }[] = [
  { key: "qualificacao_estagnada", label: "Qualif. estagnada", cor: "#f59e0b" },
  { key: "travado_followup",       label: "Travado follow-up", cor: "#C8102E" },
  { key: "orfao_handoff",          label: "Órfão handoff",     cor: "#eab308" },
  { key: "nurturing_longo",        label: "Nurturing longo",   cor: "#6390f5" },
];
const BALDE_LABEL: Record<string, string> = Object.fromEntries(BALDES.map(b => [b.key, b.label]));

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `há ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}
function maskPhone(p: string): string {
  if (p.length >= 13) return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ****-${p.slice(-4)}`;
  return p.slice(0, 6) + "****" + p.slice(-4);
}

export function ParadosList({ leads }: { leads: ParadoLead[] }) {
  const router = useRouter();
  const [balde, setBalde] = useState("qualificacao_estagnada");   // default (item 10)
  const [search, setSearch] = useState("");

  const countByBalde = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[l.balde] = (c[l.balde] ?? 0) + 1;
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(l => {
      if (l.balde !== balde) return false;
      if (!q) return true;
      return l.phone.includes(q)
        || (l.restaurant_name ?? "").toLowerCase().includes(q)
        || (l.city ?? "").toLowerCase().includes(q);
    });
  }, [leads, balde, search]);

  return (
    <div>
      {/* Chips de balde (default = qualificacao_estagnada) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.label, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", ...MONO }}>
          <AlertTriangle style={{ width: 11, height: 11 }} /> Parados
        </span>
        {BALDES.map(b => {
          const active = balde === b.key;
          return (
            <button
              key={b.key}
              onClick={() => setBalde(b.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 3,
                border: `1px solid ${active ? b.cor : C.border}`,
                background: active ? "rgba(27,42,107,.35)" : "transparent",
                color: active ? C.text : C.muted, cursor: "pointer",
                fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", ...MONO,
              }}
            >
              {b.label}
              <span style={{ color: b.cor }}>{countByBalde[b.key] ?? 0}</span>
            </button>
          );
        })}
        <div style={{ flex: 1, minWidth: 180, maxWidth: 280, position: "relative", marginLeft: "auto" }}>
          <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, color: C.label }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="buscar phone, restaurante, cidade..."
            style={{
              width: "100%", padding: "5px 8px 5px 26px",
              background: C.bg, border: `1px solid ${C.border}`, borderRadius: 3,
              color: C.muted, fontSize: 10, ...MONO, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...MONO }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Phone", "Restaurante", "Cidade", "Setor", "Etapa", "QS", "Último reply"].map(h => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 9, letterSpacing: ".13em", textTransform: "uppercase", color: C.label, whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "24px 10px", textAlign: "center", color: C.label, fontSize: 11 }}>
                  Nenhum lead em “{BALDE_LABEL[balde] ?? balde}”.
                </td>
              </tr>
            )}
            {filtered.map((lead, i) => (
              <tr
                key={lead.id}
                onClick={() => router.push(`/dashboard/leads/${encodeURIComponent(lead.phone)}`)}
                style={{
                  borderBottom: `1px solid ${i < filtered.length - 1 ? "#0f1826" : "transparent"}`,
                  background: i % 2 === 0 ? "transparent" : "rgba(27,42,107,.04)",
                  cursor: "pointer",
                }}
              >
                <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{maskPhone(lead.phone)}</td>
                <td style={{ padding: "7px 10px", color: C.text, fontSize: 10, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.restaurant_name ?? "—"}</td>
                <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{lead.city ?? "—"}</td>
                <td style={{ padding: "7px 10px", color: C.muted, fontSize: 9, whiteSpace: "nowrap" }}>{(lead.routing_team ?? "—").replace("SETOR_", "")}</td>
                <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{stageLabel(lead.funnel_stage)}</td>
                <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{lead.qual_stage ?? "—"}</td>
                <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{relativeTime(lead.last_reply_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: C.label, fontSize: 9, marginTop: 12, ...MONO, letterSpacing: ".08em" }}>
        {filtered.length} em “{BALDE_LABEL[balde] ?? balde}” · {leads.length} parados no total · fonte: v_leads_parados (RLS por vendedor)
      </p>
    </div>
  );
}
