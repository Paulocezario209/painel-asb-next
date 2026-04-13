"use client";

import { useState } from "react";
import Link from "next/link";

type Row = {
  phone: string;
  followup_sequence: number | null;
  phase: string | null;
  angle: string | null;
  message_sent: string | null;
  sent_at: string | null;
  responded: boolean | null;
  converted_after: boolean | null;
  // enriched
  name: string | null;
  city: string | null;
  routing_team: string | null;
  weekly_volume_kg: number | null;
};

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#161b22", bg2: "#0d1117", border: "#21262d", border2: "#30363d",
  text: "#c9d1d9", muted: "#8b949e", blue: "#58a6ff", green: "#3fb950",
  amber: "#f0b429", red: "#f85149", purple: "#c084fc",
};

const LABEL: React.CSSProperties = {
  fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
  color: C.muted, fontFamily: "'Courier New', monospace",
};

const VENDOR_LABELS: Record<string, string> = {
  ana_paula: "Ana Paula", alan: "Alan", setor_cuit: "CUIT",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function NativeSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 4,
        color: C.muted, fontSize: 10, letterSpacing: ".10em", textTransform: "uppercase",
        padding: "5px 10px", fontFamily: "'Courier New', monospace", cursor: "pointer", outline: "none",
      }}
    >
      {children}
    </select>
  );
}

export function FollowupsTable({
  rows: initialRows,
  angleLabels,
  phaseLabels,
}: {
  rows: Row[];
  angleLabels: Record<string, string>;
  phaseLabels: Record<string, string>;
}) {
  const [phaseFilter,    setPhaseFilter]    = useState("all");
  const [angleFilter,    setAngleFilter]    = useState("all");
  const [vendorFilter,   setVendorFilter]   = useState("all");
  const [respondFilter,  setRespondFilter]  = useState("all");
  const [search,         setSearch]         = useState("");

  const filtered = initialRows.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || (r.name ?? "").toLowerCase().includes(q)
      || r.phone.includes(q)
      || (r.city ?? "").toLowerCase().includes(q);
    const matchPhase   = phaseFilter  === "all" || r.phase  === phaseFilter;
    const matchAngle   = angleFilter  === "all" || r.angle  === angleFilter;
    const matchVendor  = vendorFilter === "all" || r.routing_team === vendorFilter;
    const matchRespond =
      respondFilter === "all" ||
      (respondFilter === "yes" && r.responded) ||
      (respondFilter === "no"  && !r.responded);
    return matchSearch && matchPhase && matchAngle && matchVendor && matchRespond;
  });

  const TH: React.CSSProperties = { ...LABEL, padding: "10px 14px", textAlign: "left", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "10px 14px", color: C.text, fontSize: 11, fontFamily: "'Courier New', monospace", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180, maxWidth: 260 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted, fontSize: 12 }}>›</span>
          <input
            type="text"
            placeholder="buscar nome, tel, cidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 4,
              color: C.text, fontSize: 11, padding: "5px 10px 5px 24px",
              fontFamily: "'Courier New', monospace", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        <NativeSelect value={phaseFilter} onChange={setPhaseFilter}>
          <option value="all">fase: todas</option>
          {Object.entries(phaseLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </NativeSelect>

        <NativeSelect value={angleFilter} onChange={setAngleFilter}>
          <option value="all">ângulo: todos</option>
          {Object.entries(angleLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </NativeSelect>

        <NativeSelect value={vendorFilter} onChange={setVendorFilter}>
          <option value="all">vendedor: todos</option>
          <option value="ana_paula">Ana Paula</option>
          <option value="alan">Alan</option>
          <option value="setor_cuit">CUIT</option>
        </NativeSelect>

        <NativeSelect value={respondFilter} onChange={setRespondFilter}>
          <option value="all">resposta: todas</option>
          <option value="yes">respondeu</option>
          <option value="no">não respondeu</option>
        </NativeSelect>
      </div>

      <p style={{ ...LABEL, margin: 0 }}>{filtered.length} registros</p>

      {/* Table */}
      <div style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 6, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bg2 }}>
              {["Lead", "Cidade", "Fase", "Ângulo", "#", "Enviado em", "Respondeu?", "Vendedor"].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...TD, textAlign: "center", color: C.muted, padding: "32px 0" }}>
                  nenhum registro encontrado
                </td>
              </tr>
            )}
            {filtered.map((row, i) => {
              const rowBg = i % 2 === 0 ? C.bg : C.bg2;
              const phaseCfg = {
                active:    { color: C.green,  bg: "rgba(63,185,80,.1)",    border: "rgba(63,185,80,.3)" },
                monthly:   { color: C.amber,  bg: "rgba(240,180,41,.1)",   border: "rgba(240,180,41,.3)" },
                semestral: { color: C.purple, bg: "rgba(192,132,252,.1)",  border: "rgba(192,132,252,.3)" },
              }[row.phase ?? ""] ?? { color: C.muted, bg: "rgba(139,148,158,.1)", border: "rgba(139,148,158,.25)" };

              const angleCfg = {
                retomada:         { color: C.blue },
                dor:              { color: C.red },
                prova_social:     { color: C.green },
                valor:            { color: C.amber },
                reposicionamento: { color: C.purple },
              }[row.angle ?? ""] ?? { color: C.muted };

              return (
                <tr
                  key={`${row.phone}-${row.followup_sequence}-${i}`}
                  style={{ background: rowBg }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#21262d")}
                  onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                >
                  {/* Lead */}
                  <td style={TD}>
                    <Link
                      href={`/dashboard/leads/${encodeURIComponent(row.phone)}`}
                      style={{ color: C.blue, textDecoration: "none", fontWeight: 600 }}
                    >
                      {row.name || "—"}
                    </Link>
                    <br />
                    <span style={{ color: C.muted, fontSize: 10 }}>{row.phone}</span>
                  </td>

                  {/* Cidade */}
                  <td style={TD}>{row.city || "—"}</td>

                  {/* Fase */}
                  <td style={TD}>
                    <span style={{
                      display: "inline-block", padding: "2px 6px", borderRadius: 3,
                      fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
                      fontFamily: "'Courier New', monospace", fontWeight: 700,
                      color: phaseCfg.color, background: phaseCfg.bg, border: `1px solid ${phaseCfg.border}`,
                    }}>
                      {phaseLabels[row.phase ?? ""] ?? row.phase ?? "—"}
                    </span>
                  </td>

                  {/* Ângulo */}
                  <td style={TD}>
                    <span style={{
                      color: angleCfg.color, fontSize: 10,
                      fontFamily: "'Courier New', monospace",
                    }}>
                      {angleLabels[row.angle ?? ""] ?? row.angle ?? "—"}
                    </span>
                  </td>

                  {/* Sequência */}
                  <td style={TD}>
                    <span style={{ color: C.muted, fontFamily: "'Courier New', monospace", fontSize: 10 }}>
                      #{row.followup_sequence ?? "?"}
                    </span>
                  </td>

                  {/* Enviado em */}
                  <td style={{ ...TD, color: C.muted, fontSize: 10 }}>
                    {fmt(row.sent_at)}
                  </td>

                  {/* Respondeu */}
                  <td style={TD}>
                    {row.responded
                      ? (
                        <span style={{
                          display: "inline-block", padding: "2px 6px", borderRadius: 3,
                          fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
                          fontFamily: "'Courier New', monospace", fontWeight: 700,
                          color: C.green, background: "rgba(63,185,80,.1)", border: "1px solid rgba(63,185,80,.3)",
                        }}>sim</span>
                      ) : (
                        <span style={{
                          display: "inline-block", padding: "2px 6px", borderRadius: 3,
                          fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
                          fontFamily: "'Courier New', monospace", fontWeight: 700,
                          color: C.red, background: "rgba(248,81,73,.1)", border: "1px solid rgba(248,81,73,.3)",
                        }}>não</span>
                      )
                    }
                  </td>

                  {/* Vendedor */}
                  <td style={{ ...TD, color: C.muted }}>
                    {VENDOR_LABELS[row.routing_team ?? ""] ?? row.routing_team ?? "—"}
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
