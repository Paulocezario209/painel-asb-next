"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Clock, AlertTriangle } from "lucide-react";
import {
  CADENCIA_PHASES, CADENCIA_PHASE_LABEL, CADENCIA_PHASE_DESC, CADENCIA_PHASE_COLOR,
} from "@/lib/followup/cadencia";
import { VENDOR_LABELS } from "@/lib/vendor-labels";

// CADÊNCIA BOARD (DEBT-288) — leads que a automação de follow-up está nutrindo.
// Fonte: view v_leads_cadencia (security_invoker → RLS por vendedor). O MESMO conjunto
// que a aba Ativos EXCLUI (single source). Chips por fase (default = Retomada, a mais
// acionável); cada lead na sua cadência, com próximo toque e nº de toques.

export type CadenciaLead = {
  phone: string;
  name: string | null;
  city: string | null;
  segment: string | null;
  weekly_volume_kg: number | null;
  routing_team: string | null;
  qual_stage: number | null;
  lead_temperature: string | null;
  followup_phase: string;
  followup_count: number | null;
  next_followup_at: string | null;
  vencido: boolean | null;
};

const C = { bg: "#080b14", border: "#2a2a2a", text: "#FFFFFF", muted: "#c0d0e0", label: "#e4e9f0", red: "#C8102E", green: "#22c55e", amber: "#f59e0b" };
const MONO: React.CSSProperties = { fontFamily: "'Courier New', monospace" };

function maskPhone(p: string): string {
  if (p.length >= 13) return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ****-${p.slice(-4)}`;
  return p.slice(0, 6) + "****" + p.slice(-4);
}

function abc(vol: number | null): "A" | "B" | "C" {
  if ((vol ?? 0) >= 300) return "A";
  if ((vol ?? 0) >= 100) return "B";
  return "C";
}
const ABC_COLOR: Record<string, string> = { A: "#C8102E", B: "#f59e0b", C: "#c0d0e0" };
const TEMP_COLOR: Record<string, string> = { HOT: "#C8102E", WARM: "#f59e0b", READY_TO_BUY: "#22c55e", COLD: "#c0d0e0" };

// Próximo toque: relativo + flag vencido (já devia ter disparado).
function nextTouch(ts: string | null, vencido: boolean | null): { label: string; color: string } {
  if (!ts) return { label: "—", color: C.muted };
  const diff = new Date(ts).getTime() - Date.now();
  const d = Math.round(Math.abs(diff) / 86400000);
  const h = Math.round(Math.abs(diff) / 3600000);
  const rel = d >= 1 ? `${d}d` : `${h}h`;
  if (vencido || diff <= 0) return { label: `vencido ${rel}`, color: C.red };
  return { label: `em ${rel}`, color: C.green };
}

export function CadenciaBoard({ leads }: { leads: CadenciaLead[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<string>("active"); // default: Retomada (mais acionável)
  const [search, setSearch] = useState("");

  const countByPhase = useMemo(() => {
    const c: Record<string, { total: number; vencidos: number }> = {};
    for (const p of CADENCIA_PHASES) c[p] = { total: 0, vencidos: 0 };
    for (const l of leads) {
      if (!c[l.followup_phase]) c[l.followup_phase] = { total: 0, vencidos: 0 };
      c[l.followup_phase].total++;
      if (l.vencido) c[l.followup_phase].vencidos++;
    }
    return c;
  }, [leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads
      .filter((l) => l.followup_phase === phase)
      .filter((l) => !q || l.phone.includes(q) || (l.name ?? "").toLowerCase().includes(q) || (l.city ?? "").toLowerCase().includes(q))
      // vencidos primeiro, depois o toque mais próximo
      .sort((a, b) => {
        if (!!a.vencido !== !!b.vencido) return a.vencido ? -1 : 1;
        return (a.next_followup_at ?? "").localeCompare(b.next_followup_at ?? "");
      });
  }, [leads, phase, search]);

  const cor = CADENCIA_PHASE_COLOR[phase] ?? C.amber;

  return (
    <div style={{ ...S.card, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ ...MONO, color: C.text, fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
            Cadência ativa
          </div>
          <div style={{ ...MONO, color: C.label, fontSize: 10, marginTop: 3 }}>
            {leads.length} leads sendo nutridos pela automação · cada um na sua fase
          </div>
        </div>
        <div style={{ position: "relative", minWidth: 180, maxWidth: 260 }}>
          <Search style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", width: 11, height: 11, color: C.label }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="buscar phone, restaurante, cidade..."
            style={{ width: "100%", padding: "5px 8px 5px 26px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 3, color: C.muted, fontSize: 10, ...MONO, outline: "none", boxSizing: "border-box" }}
          />
        </div>
      </div>

      {/* Chips por fase (default Retomada) */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {CADENCIA_PHASES.map((p) => {
          const active = phase === p;
          const cnt = countByPhase[p] ?? { total: 0, vencidos: 0 };
          const pc = CADENCIA_PHASE_COLOR[p];
          return (
            <button
              key={p}
              onClick={() => setPhase(p)}
              title={CADENCIA_PHASE_DESC[p]}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 3,
                border: `1px solid ${active ? pc : C.border}`, background: active ? "rgba(27,42,107,.35)" : "transparent",
                color: active ? C.text : C.muted, cursor: "pointer", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", ...MONO,
              }}
            >
              {CADENCIA_PHASE_LABEL[p] ?? p}
              <span style={{ color: pc, fontWeight: 700 }}>{cnt.total}</span>
              {cnt.vencidos > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 2, color: C.red, fontWeight: 700 }}>
                  <AlertTriangle style={{ width: 9, height: 9 }} />{cnt.vencidos}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ ...MONO, color: C.label, fontSize: 10, marginBottom: 8 }}>
        {CADENCIA_PHASE_DESC[phase]}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", ...MONO }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Restaurante", "Cidade", "Volume", "ABC", "Temp.", "Setor", "Próximo toque", "Toques"].map((h) => (
                <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontSize: 9, letterSpacing: ".13em", textTransform: "uppercase", color: C.label, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "24px 10px", textAlign: "center", color: C.label, fontSize: 11 }}>
                Nenhum lead na fase {CADENCIA_PHASE_LABEL[phase] ?? phase}.
              </td></tr>
            )}
            {filtered.map((lead, i) => {
              const nt = nextTouch(lead.next_followup_at, lead.vencido);
              const a = abc(lead.weekly_volume_kg);
              const temp = (lead.lead_temperature ?? "COLD").toUpperCase();
              return (
                <tr
                  key={lead.phone}
                  onClick={() => router.push(`/dashboard/leads/${encodeURIComponent(lead.phone)}`)}
                  style={{ borderBottom: `1px solid ${i < filtered.length - 1 ? "#0f1826" : "transparent"}`, background: i % 2 === 0 ? "transparent" : "rgba(27,42,107,.04)", cursor: "pointer", borderLeft: lead.vencido ? `3px solid ${C.red}` : "3px solid transparent" }}
                >
                  <td style={{ padding: "7px 10px", color: C.text, fontSize: 10, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lead.name || "—"}
                    <span style={{ color: C.muted, fontSize: 9, marginLeft: 6 }}>{maskPhone(lead.phone)}</span>
                  </td>
                  <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{lead.city ?? "—"}</td>
                  <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10, whiteSpace: "nowrap" }}>{lead.weekly_volume_kg ? `${lead.weekly_volume_kg} kg` : "—"}</td>
                  <td style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, color: ABC_COLOR[a] }}>{a}</td>
                  <td style={{ padding: "7px 10px", fontSize: 9, fontWeight: 700, color: TEMP_COLOR[temp] ?? C.muted, whiteSpace: "nowrap" }}>{temp}</td>
                  <td style={{ padding: "7px 10px", color: C.muted, fontSize: 9, whiteSpace: "nowrap" }}>{(VENDOR_LABELS[lead.routing_team ?? ""] ?? lead.routing_team ?? "—").replace("SETOR_", "")}</td>
                  <td style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, color: nt.color, whiteSpace: "nowrap" }}>
                    <Clock style={{ width: 10, height: 10, display: "inline", marginRight: 4, verticalAlign: "-1px" }} />{nt.label}
                  </td>
                  <td style={{ padding: "7px 10px", color: C.muted, fontSize: 10 }}>{lead.followup_count ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ color: C.label, fontSize: 9, marginTop: 12, ...MONO, letterSpacing: ".06em" }}>
        {filtered.length} em {CADENCIA_PHASE_LABEL[phase] ?? phase} · {leads.length} em cadência no total · fonte: v_leads_cadencia (RLS por vendedor). Estes leads saem da aba Ativos — a automação está cuidando.
      </p>
    </div>
  );
}

const S = { card: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties };
