"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { theme } from "@/lib/theme";
import { VENDOR_LABELS } from "@/lib/vendor-labels";

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
  next_followup_at: string | null;   // FIX2
};

// FIX2: diff até o próximo follow-up agendado
function fmtProximo(iso: string | null): { label: string; color: string; pulse: boolean } {
  if (!iso) return { label: "—", color: theme.colors.neutral, pulse: false };
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  if (diffMs >= 0) return { label: `em ${d}d ${h}h`, color: theme.colors.neutral, pulse: false };
  return { label: `${d}d vencido`, color: theme.colors.critical, pulse: true };
}

// ── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#1a1a1a", bg2: "#0f0f0f", border: "#2a2a2a", border2: "#2a2a2a",
  text: "#FFFFFF", muted: "#c0d0e0", link: "#c0c8d8", green: "#22c55e",
  amber: "#f59e0b", red: "#C8102E", blue: "#3a3a3a",
};

// Column/eyebrow label — canônico (igual Dashboard): SANS uppercase pequeno, nunca mono.
const LABEL: React.CSSProperties = {
  fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 700,
  color: "#83879a", fontFamily: theme.font.label,
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
        background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 8,
        color: C.muted, fontSize: 12,
        padding: "7px 11px", fontFamily: theme.font.label, cursor: "pointer", outline: "none",
        flexShrink: 0,
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
  initialAngle = "all",
  initialRespond = "all",
  initialConvertido = "all",
}: {
  rows: Row[];
  angleLabels: Record<string, string>;
  phaseLabels: Record<string, string>;
  initialAngle?: string;
  initialRespond?: string;
  initialConvertido?: string;
}) {
  const [phaseFilter,      setPhaseFilter]      = useState("all");
  const [angleFilter,      setAngleFilter]      = useState(initialAngle);
  const [vendorFilter,     setVendorFilter]     = useState("all");
  const [respondFilter,    setRespondFilter]    = useState(initialRespond);
  const [convertidoFilter, setConvertidoFilter] = useState(initialConvertido);
  const [search,           setSearch]           = useState("");
  const [expandedKey,      setExpandedKey]       = useState<string | null>(null);  // FIX1: 1 por vez
  const router = useRouter();

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
    const matchConvertido =
      convertidoFilter === "all" ||
      (convertidoFilter === "yes" && r.converted_after);
    return matchSearch && matchPhase && matchAngle && matchVendor && matchRespond && matchConvertido;
  });

  const TH: React.CSSProperties = { ...LABEL, padding: "10px 14px", textAlign: "left", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "10px 14px", color: C.text, fontSize: 11, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <style>{`@keyframes fu-pulse{0%,100%{opacity:1}50%{opacity:.4}}.fu-pulse{animation:fu-pulse 1.4s ease-in-out infinite}`}</style>
      {/* Filters — horizontal scroll on mobile */}
      <div className="asb-filters-bar">
        <div style={{ position: "relative", minWidth: 160, flexShrink: 0 }}>
          <Search style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 13, height: 13, color: "#83879a" }} />
          <input
            type="text"
            placeholder="Buscar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: 8,
              color: C.text, fontSize: 12, padding: "7px 11px 7px 30px",
              fontFamily: theme.font.label, outline: "none", boxSizing: "border-box",
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
          <option value="SETOR_SOROCABA_SAO_PAULO">Ana Paula</option>
          <option value="SETOR_CAMPINAS_JUNDIAI">Alan</option>
          <option value="SETOR_CUIT">CUIT</option>
        </NativeSelect>

        <NativeSelect value={respondFilter} onChange={setRespondFilter}>
          <option value="all">resposta: todas</option>
          <option value="yes">respondeu</option>
          <option value="no">não respondeu</option>
        </NativeSelect>
      </div>

      <p style={{ ...LABEL, margin: 0 }}>{filtered.length} registros</p>

      {/* ── Mobile cards ─────────────────────────────────────── */}
      <div className="asb-mobile-only" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ ...LABEL, textAlign: "center", padding: "32px 0", color: C.muted }}>
            nenhum registro encontrado
          </div>
        )}
        {filtered.map((row, i) => {
          const phaseCfg = {
            active:    { color: C.green,  bg: "rgba(63,185,80,.1)",    border: "rgba(63,185,80,.3)" },
            monthly:   { color: C.amber,  bg: "rgba(240,180,41,.1)",   border: "rgba(240,180,41,.3)" },
            semestral: { color: C.muted, bg: "rgba(136,153,170,.08)", border: "rgba(136,153,170,.25)" },
          }[row.phase ?? ""] ?? { color: C.muted, bg: "rgba(139,148,158,.1)", border: "rgba(139,148,158,.25)" };

          const angleColor = {
            retomada:         C.link,
            dor:              C.red,
            prova_social:     C.green,
            valor:            C.amber,
            reposicionamento: C.muted,
          }[row.angle ?? ""] ?? C.muted;

          const mRowKey = `${row.phone}-${row.followup_sequence}-${i}`;
          const mIsExp = expandedKey === mRowKey;
          const mProx = fmtProximo(row.next_followup_at);

          return (
            <Link
              key={mRowKey}
              href={`/dashboard/leads/${encodeURIComponent(row.phone)}`}
              style={{
                textDecoration: "none",
                background: C.bg,
                border: `1px solid ${C.border2}`,
                borderRadius: 6,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                cursor: "pointer",
              }}
            >
              {/* Name + phone */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <Link
                    href={`/dashboard/leads/${encodeURIComponent(row.phone)}`}
                    style={{ color: C.link, textDecoration: "none", fontWeight: 600, fontSize: 12, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                  >
                    {row.name || "—"}
                  </Link>
                  <div style={{ color: C.muted, fontSize: 10, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", marginTop: 1 }}>
                    {row.phone}
                    {row.city && <span style={{ marginLeft: 8 }}>{row.city}</span>}
                  </div>
                </div>
                {/* Responded badge */}
                {row.responded
                  ? <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 3, fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: 700, color: C.green, background: "rgba(63,185,80,.1)", border: "1px solid rgba(63,185,80,.3)" }}>sim</span>
                  : <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 3, fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: 700, color: C.red, background: "rgba(248,81,73,.1)", border: "1px solid rgba(248,81,73,.3)" }}>não</span>
                }
              </div>

              {/* Phase + angle + sequence */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{
                  display: "inline-block", padding: "2px 6px", borderRadius: 3,
                  fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: 700,
                  color: phaseCfg.color, background: phaseCfg.bg, border: `1px solid ${phaseCfg.border}`,
                }}>
                  {phaseLabels[row.phase ?? ""] ?? row.phase ?? "—"}
                </span>
                <span style={{ color: angleColor, fontSize: 10, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  {angleLabels[row.angle ?? ""] ?? row.angle ?? "—"}
                </span>
                <span style={{ color: C.muted, fontSize: 10, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  #{row.followup_sequence ?? "?"}
                </span>
              </div>

              {/* Date + vendor + próximo (FIX2) */}
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ color: C.muted, fontSize: 9, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  {fmt(row.sent_at)}
                </span>
                <span style={{ color: C.muted, fontSize: 9, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  {VENDOR_LABELS[row.routing_team ?? ""] ?? row.routing_team ?? "—"}
                </span>
                <span className={mProx.pulse ? "fu-pulse" : undefined} style={{ color: mProx.color, fontSize: 9, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  {"⏱"} {mProx.label}
                </span>
              </div>

              {/* FIX1: ver mensagem (expand inline) */}
              <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpandedKey(mIsExp ? null : mRowKey); }}
                style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${theme.colors.borderDefault}`, color: theme.colors.neutral, fontSize: 11, fontWeight: 600, fontFamily: theme.font.label, padding: "4px 10px", borderRadius: 8, cursor: "pointer" }}
              >
                {mIsExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Ver mensagem
              </button>
              {mIsExp && (
                <div style={{ background: theme.colors.bgElevated, borderRadius: 8, padding: "10px 12px" }}>
                  {row.message_sent
                    ? <span style={{ color: theme.colors.textPrimary, fontFamily: theme.font.label, fontSize: 12.5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{row.message_sent}</span>
                    : <span style={{ color: theme.colors.neutral, fontFamily: theme.font.label, fontSize: 12.5, fontStyle: "italic" }}>Mensagem não registrada</span>}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* ── Desktop table ────────────────────────────────────── */}
      <div className="asb-desktop-only" style={{ background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 6, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bg2 }}>
              {["Lead", "Cidade", "Fase", "Ângulo", "#", "Enviado em", "Próximo", "Respondeu?", "Vendedor", ""].map((h, hi) => (
                <th key={h || `exp-${hi}`} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ ...TD, textAlign: "center", color: C.muted, padding: "32px 0" }}>
                  nenhum registro encontrado
                </td>
              </tr>
            )}
            {filtered.map((row, i) => {
              const rowBg = i % 2 === 0 ? C.bg : C.bg2;
              const phaseCfg = {
                active:    { color: C.green,  bg: "rgba(63,185,80,.1)",    border: "rgba(63,185,80,.3)" },
                monthly:   { color: C.amber,  bg: "rgba(240,180,41,.1)",   border: "rgba(240,180,41,.3)" },
                semestral: { color: C.muted, bg: "rgba(136,153,170,.08)", border: "rgba(136,153,170,.25)" },
              }[row.phase ?? ""] ?? { color: C.muted, bg: "rgba(139,148,158,.1)", border: "rgba(139,148,158,.25)" };

              const angleCfg = {
                retomada:         { color: C.link },
                dor:              { color: C.red },
                prova_social:     { color: C.green },
                valor:            { color: C.amber },
                reposicionamento: { color: C.muted },
              }[row.angle ?? ""] ?? { color: C.muted };

              const rowKey = `${row.phone}-${row.followup_sequence}-${i}`;
              const isExp = expandedKey === rowKey;
              const prox = fmtProximo(row.next_followup_at);
              return (
                <Fragment key={rowKey}>
                <tr
                  style={{ background: rowBg, cursor: "pointer" }}
                  onClick={() => router.push(`/dashboard/leads/${encodeURIComponent(row.phone)}`)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#131a2e")}
                  onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                >
                  <td style={TD}>
                    <Link
                      href={`/dashboard/leads/${encodeURIComponent(row.phone)}`}
                      style={{ color: C.link, textDecoration: "none", fontWeight: 600 }}
                    >
                      {row.name || "—"}
                    </Link>
                    <br />
                    <span style={{ color: C.muted, fontSize: 10 }}>{row.phone}</span>
                  </td>
                  <td style={TD}>{row.city || "—"}</td>
                  <td style={TD}>
                    <span style={{
                      display: "inline-block", padding: "2px 6px", borderRadius: 3,
                      fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: 700,
                      color: phaseCfg.color, background: phaseCfg.bg, border: `1px solid ${phaseCfg.border}`,
                    }}>
                      {phaseLabels[row.phase ?? ""] ?? row.phase ?? "—"}
                    </span>
                  </td>
                  <td style={TD}>
                    <span style={{ color: angleCfg.color, fontSize: 10, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                      {angleLabels[row.angle ?? ""] ?? row.angle ?? "—"}
                    </span>
                  </td>
                  <td style={TD}>
                    <span style={{ color: C.muted, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontSize: 10 }}>
                      #{row.followup_sequence ?? "?"}
                    </span>
                  </td>
                  <td style={{ ...TD, color: C.muted, fontSize: 10 }}>
                    {fmt(row.sent_at)}
                  </td>
                  <td style={TD}>
                    <span className={prox.pulse ? "fu-pulse" : undefined} style={{ color: prox.color, fontSize: 10, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                      {prox.label}
                    </span>
                  </td>
                  <td style={TD}>
                    {row.responded
                      ? <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 3, fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: 700, color: C.green, background: "rgba(63,185,80,.1)", border: "1px solid rgba(63,185,80,.3)" }}>sim</span>
                      : <span style={{ display: "inline-block", padding: "2px 6px", borderRadius: 3, fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: 700, color: C.red, background: "rgba(248,81,73,.1)", border: "1px solid rgba(248,81,73,.3)" }}>não</span>
                    }
                  </td>
                  <td style={{ ...TD, color: C.muted }}>
                    {VENDOR_LABELS[row.routing_team ?? ""] ?? row.routing_team ?? "—"}
                  </td>
                  <td style={TD}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setExpandedKey(isExp ? null : rowKey); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: `1px solid ${theme.colors.borderDefault}`, color: theme.colors.neutral, fontSize: 11, fontWeight: 600, fontFamily: theme.font.label, padding: "4px 10px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Ver mensagem
                    </button>
                  </td>
                </tr>
                {isExp && (
                  <tr>
                    <td colSpan={10} style={{ background: theme.colors.bgElevated, padding: "12px 16px", borderBottom: `1px solid ${C.border}` }}>
                      {row.message_sent
                        ? <span style={{ color: theme.colors.textPrimary, fontFamily: theme.font.label, fontSize: 12.5, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{row.message_sent}</span>
                        : <span style={{ color: theme.colors.neutral, fontFamily: theme.font.label, fontSize: 12.5, fontStyle: "italic" }}>Mensagem não registrada</span>}
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
