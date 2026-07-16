"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MapPinOff, Search } from "lucide-react";

// FORA_DE_ROTA — bucket de leads fora da cobertura (aba "Fora de Rota" em /leads).
// Espelha o visual de HotLeadsTable (tokens C + MONO + linhas clicáveis).
// Fonte: ai_sdr_leads WHERE routing_team='fora_de_rota' (parked — NÃO lead_perdido).

export type ForaRotaLead = {
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  segment: string | null;
  weekly_volume_kg: number | null;
  last_contact: string | null;
};

const C = {
  bg: "#080b14", border: "#2a2a2a",
  text: "#FFFFFF", muted: "#c0d0e0", label: "#e4e9f0", red: "#C8102E",
};
const MONO: React.CSSProperties = { fontFamily: "var(--font-geist-sans), system-ui, sans-serif" };

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

export function ForaDeRotaTable({ leads }: { leads: ForaRotaLead[] }) {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.trim().toLowerCase();
    return leads.filter(l =>
      l.phone.includes(q) ||
      (l.restaurant_name ?? "").toLowerCase().includes(q) ||
      (l.name ?? "").toLowerCase().includes(q) ||
      (l.city ?? "").toLowerCase().includes(q)
    );
  }, [leads, search]);

  const comVolume = leads.filter(l => Number(l.weekly_volume_kg ?? 0) > 0).length;

  return (
    <div>
      {/* Controls (espelha hot-leads) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 3,
          border: `1px solid ${C.border}`, background: "rgba(27,42,107,.35)", color: C.text,
          fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", ...MONO,
        }}>
          <MapPinOff style={{ width: 11, height: 11 }} /> Fora de Rota
          <span style={{ color: C.red, marginLeft: 2 }}>{leads.length}</span>
        </span>
        <span style={{ color: C.muted, fontSize: 10, ...MONO }}>{comVolume} c/ volume · expansão futura</span>

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

      {/* Table (espelha hot-leads) */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...MONO }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Phone", "Restaurante", "Cidade", "Seg", "Volume", "Último contato"].map(h => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 9, letterSpacing: ".13em", textTransform: "uppercase", color: C.label, whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "24px 10px", textAlign: "center", color: C.label, fontSize: 11 }}>
                  Nenhum lead fora de rota.
                </td>
              </tr>
            )}
            {filtered.map((lead, i) => (
              <tr
                key={lead.phone}
                onClick={() => router.push(`/dashboard/leads/${encodeURIComponent(lead.phone)}`)}
                style={{
                  borderBottom: `1px solid ${i < filtered.length - 1 ? "#0f1826" : "transparent"}`,
                  background: i % 2 === 0 ? "transparent" : "rgba(27,42,107,.04)",
                  cursor: "pointer",
                }}
              >
                <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{maskPhone(lead.phone)}</td>
                <td style={{ padding: "7px 10px", color: C.text, fontSize: 10, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.restaurant_name ?? lead.name ?? "—"}</td>
                <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{lead.city ?? "—"}</td>
                <td style={{ padding: "7px 10px", color: C.muted, fontSize: 9, whiteSpace: "nowrap" }}>{lead.segment ?? "—"}</td>
                <td style={{ padding: "7px 10px", color: lead.weekly_volume_kg ? C.text : C.label, fontSize: 10, whiteSpace: "nowrap" }}>
                  {lead.weekly_volume_kg ? `${lead.weekly_volume_kg}kg/sem` : "—"}
                </td>
                <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{relativeTime(lead.last_contact)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: C.label, fontSize: 9, marginTop: 12, ...MONO, letterSpacing: ".08em" }}>
        {filtered.length} de {leads.length} · Limit 100 · ORDER BY weekly_volume_kg DESC, last_contact DESC
      </p>
    </div>
  );
}
