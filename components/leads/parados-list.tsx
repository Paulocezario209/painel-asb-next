"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search } from "lucide-react";
import { stageLabel } from "@/lib/funnel/stages";

// PARADOS v4 (DEBT-290) — aba "Parados" em /dashboard/leads. Idade de ENTRADA no SDR.
// Fonte: view v_leads_parados (security_invoker → vendor-scoped). Lead que entrou há 1–30 dias
// e ainda está no funil (inclui os já assumidos pelo vendedor — mesmas janelas). Até o dia 30
// o vendedor deve resolver (fechar/perder). 3 faixas: 1-7 (default) · 8-14 · 15-30 dias.

export type ParadoLead = {
  id: string;
  phone: string;
  restaurant_name: string | null;
  city: string | null;
  routing_team: string | null;
  funnel_stage: string | null;
  qual_stage: number | null;
  last_reply_at: string | null;
  dias_parado: number | null;
};

const C = { bg: "#080b14", border: "#2a2a2a", text: "#FFFFFF", muted: "#c0d0e0", label: "#e4e9f0" };
const MONO: React.CSSProperties = { fontFamily: "'Courier New', monospace" };

// faixas de idade (default = a mais recente/acionável)
const FAIXAS: { key: string; label: string; cor: string; lo: number; hi: number }[] = [
  { key: "f1_7",   label: "1–7 dias",   cor: "#f59e0b", lo: 1,  hi: 7  },
  { key: "f8_14",  label: "8–14 dias",  cor: "#fb923c", lo: 8,  hi: 14 },
  { key: "f15_30", label: "15–30 dias", cor: "#C8102E", lo: 15, hi: 30 },
];
const FAIXA_LABEL: Record<string, string> = Object.fromEntries(FAIXAS.map(f => [f.key, f.label]));

function maskPhone(p: string): string {
  if (p.length >= 13) return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ****-${p.slice(-4)}`;
  return p.slice(0, 6) + "****" + p.slice(-4);
}

export function ParadosList({ leads }: { leads: ParadoLead[] }) {
  const router = useRouter();
  const [faixa, setFaixa] = useState("f1_7");   // default: travados há 1–7 dias
  const [search, setSearch] = useState("");

  const countByFaixa = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FAIXAS) c[f.key] = 0;
    for (const l of leads) {
      const d = l.dias_parado ?? 0;
      const hit = FAIXAS.find(f => d >= f.lo && d <= f.hi);
      if (hit) c[hit.key]++;
    }
    return c;
  }, [leads]);

  const sel = FAIXAS.find(f => f.key === faixa)!;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter(l => {
      const d = l.dias_parado ?? 0;
      if (!(d >= sel.lo && d <= sel.hi)) return false;
      if (!q) return true;
      return l.phone.includes(q)
        || (l.restaurant_name ?? "").toLowerCase().includes(q)
        || (l.city ?? "").toLowerCase().includes(q);
    });
  }, [leads, sel, search]);

  return (
    <div>
      {/* Chips de faixa de idade (default = 1–7 dias) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.label, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", ...MONO }}>
          <AlertTriangle style={{ width: 11, height: 11 }} /> Parado há
        </span>
        {FAIXAS.map(f => {
          const active = faixa === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFaixa(f.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 3,
                border: `1px solid ${active ? f.cor : C.border}`,
                background: active ? "rgba(27,42,107,.35)" : "transparent",
                color: active ? C.text : C.muted, cursor: "pointer",
                fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", ...MONO,
              }}
            >
              {f.label}
              <span style={{ color: f.cor }}>{countByFaixa[f.key] ?? 0}</span>
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
              {["Phone", "Restaurante", "Cidade", "Setor", "Etapa", "QS", "Parado há"].map(h => (
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
                  Nenhum lead parado há {FAIXA_LABEL[faixa] ?? faixa}.
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
                <td style={{ padding: "7px 10px", color: sel.cor, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{lead.dias_parado ?? "—"}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: C.label, fontSize: 9, marginTop: 12, ...MONO, letterSpacing: ".08em" }}>
        {filtered.length} parados há {FAIXA_LABEL[faixa] ?? faixa} · {leads.length} no total (1–30d) · fonte: v_leads_parados (RLS por vendedor)
      </p>
    </div>
  );
}
