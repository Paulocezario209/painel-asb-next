"use client";

import { useState, useMemo } from "react";

export interface Handoff {
  phone: string;
  restaurant_name: string | null;
  city: string | null;
  segment: string | null;
  weekly_volume_kg: number | null;
  routing_team: string | null;
  handoff_at: string;
  scheduled_at: string | null;
  pain_point: string | null;
  lead_temperature: string | null;
  qual_stage: number | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const VENDOR_LABELS: Record<string, string> = {
  ana_paula:  "Ana Paula",
  alan:       "Alan",
  setor_cuit: "CUIT",
};

const SEG_LABELS: Record<string, string> = {
  hamburgueria: "Hamburgueria", restaurante: "Restaurante", bar: "Bar",
  distribuidora: "Distribuidora", rede: "Rede/Franquia", churrascaria: "Churrascaria",
  food_truck: "Food Truck", dark_kitchen: "Dark Kitchen", acougue: "Açougue",
};

const DIAS_PT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MESES_PT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function elapsedMinutes(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function formatScheduled(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${DIAS_PT[d.getDay()]}, ${d.getDate()} ${MESES_PT[d.getMonth()]} ${String(d.getHours()).padStart(2,"0")}h`;
}

function TimeBadge({ handoffAt }: { handoffAt: string }) {
  const mins = elapsedMinutes(handoffAt);
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  const label = hrs > 0 ? `${hrs}h${rem > 0 ? ` ${rem}min` : ""}` : `${mins}min`;

  let color: string, bg: string, border: string, pulse = false;
  if (mins < 60) {
    color = "#22c55e"; bg = "rgba(34,197,94,.1)"; border = "rgba(34,197,94,.35)";
  } else if (mins < 240) {
    color = "#f59e0b"; bg = "rgba(245,158,11,.1)"; border = "rgba(245,158,11,.35)";
  } else {
    color = "#C8102E"; bg = "rgba(200,16,46,.1)"; border = "rgba(200,16,46,.4)"; pulse = true;
  }

  return (
    <>
      {pulse && (
        <style>{`@keyframes pulse-red{0%,100%{opacity:1}50%{opacity:.45}}.pulse-red{animation:pulse-red 1.4s ease-in-out infinite}`}</style>
      )}
      <span
        className={pulse ? "pulse-red" : undefined}
        style={{
          display: "inline-block", background: bg, border: `1px solid ${border}`,
          color, fontSize: 10, fontFamily: "'Courier New', monospace", fontWeight: 700,
          padding: "3px 8px", borderRadius: 3, whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const S = {
  label: { fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase" as const, color: "#556677", fontFamily: "'Courier New', monospace" },
  cell:  { color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", padding: "10px 12px", verticalAlign: "top" as const },
  muted: { color: "#8899aa", fontSize: 10, fontFamily: "'Courier New', monospace" },
};

export function HandoffsTable({ initial }: { initial: Handoff[] }) {
  const [rows, setRows]           = useState<Handoff[]>(initial);
  const [vendorFilter, setVendor] = useState<string>("todos");
  const [urgentOnly, setUrgent]   = useState(false);
  const [loading, setLoading]     = useState<Record<string, boolean>>({});
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (vendorFilter !== "todos" && r.routing_team !== vendorFilter) return false;
      if (urgentOnly && elapsedMinutes(r.handoff_at) < 240) return false;
      return true;
    });
  }, [rows, vendorFilter, urgentOnly]);

  async function handleConfirm(phone: string) {
    setLoading(p => ({ ...p, [phone]: true }));
    setErrors(p => { const n = { ...p }; delete n[phone]; return n; });
    try {
      const res = await fetch("/api/handoff/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro");
      setRows(prev => prev.filter(r => r.phone !== phone));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao confirmar";
      setErrors(p => ({ ...p, [phone]: msg }));
    } finally {
      setLoading(p => { const n = { ...p }; delete n[phone]; return n; });
    }
  }

  const btnFilter = (active: boolean) => ({
    padding: "5px 12px", borderRadius: 3, cursor: "pointer",
    fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase" as const,
    fontFamily: "'Courier New', monospace", fontWeight: 600,
    border: active ? "1px solid #C8102E" : "1px solid #1B2A6B",
    background: active ? "rgba(200,16,46,.12)" : "transparent",
    color: active ? "#C8102E" : "#8899aa",
    transition: "all .15s",
  });

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={S.label}>Vendedor:</span>
        {["todos", "ana_paula", "alan", "setor_cuit"].map(v => (
          <button key={v} style={btnFilter(vendorFilter === v)} onClick={() => setVendor(v)}>
            {v === "todos" ? "Todos" : VENDOR_LABELS[v]}
          </button>
        ))}
        <div style={{ width: 1, height: 18, background: "#1B2A6B", margin: "0 4px" }} />
        <button style={btnFilter(urgentOnly)} onClick={() => setUrgent(p => !p)}>
          ⚡ Só críticos (&gt; 4h)
        </button>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center" }}>
          <p style={{ color: "#22c55e", fontSize: 12, fontFamily: "'Courier New', monospace" }}>
            ✅ Nenhum handoff pendente{urgentOnly ? " crítico" : ""}{vendorFilter !== "todos" ? ` para ${VENDOR_LABELS[vendorFilter]}` : ""}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1B2A6B" }}>
                {["Lead", "Cidade / Segmento", "Volume", "Dor", "Agendado para", "Tempo", "Vendedor", ""].map(h => (
                  <th key={h} style={{ ...S.label, textAlign: "left", padding: "8px 12px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.phone} style={{ borderBottom: "1px solid rgba(27,42,107,.4)" }}>
                  {/* Lead */}
                  <td style={S.cell}>
                    <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{r.restaurant_name ?? "—"}</span>
                    <br />
                    <span style={S.muted}>{r.phone}</span>
                  </td>

                  {/* Cidade / Segmento */}
                  <td style={S.cell}>
                    {r.city ?? "—"}
                    {r.segment && (
                      <>
                        <br />
                        <span style={S.muted}>{SEG_LABELS[r.segment] ?? r.segment}</span>
                      </>
                    )}
                  </td>

                  {/* Volume */}
                  <td style={{ ...S.cell, whiteSpace: "nowrap" }}>
                    {r.weekly_volume_kg != null ? (
                      <span style={{ color: (r.weekly_volume_kg ?? 0) >= 300 ? "#C8102E" : "#c8d8e8" }}>
                        {r.weekly_volume_kg} kg
                      </span>
                    ) : "—"}
                  </td>

                  {/* Dor */}
                  <td style={{ ...S.cell, maxWidth: 160 }}>
                    <span style={{ ...S.muted, display: "block", whiteSpace: "normal", lineHeight: 1.4 }}>
                      {r.pain_point ?? "—"}
                    </span>
                  </td>

                  {/* Agendado */}
                  <td style={{ ...S.cell, whiteSpace: "nowrap" }}>
                    {r.scheduled_at ? (
                      <span style={{ color: "#c8d8e8" }}>{formatScheduled(r.scheduled_at)}</span>
                    ) : (
                      <span style={{ color: "#556677" }}>—</span>
                    )}
                  </td>

                  {/* Tempo */}
                  <td style={{ ...S.cell, whiteSpace: "nowrap" }}>
                    <TimeBadge handoffAt={r.handoff_at} />
                  </td>

                  {/* Vendedor */}
                  <td style={{ ...S.cell, whiteSpace: "nowrap" }}>
                    <span style={{
                      border: "1px solid #1B2A6B", color: "#8899aa", fontSize: 9,
                      padding: "2px 7px", borderRadius: 2, fontFamily: "'Courier New', monospace",
                    }}>
                      {VENDOR_LABELS[r.routing_team ?? ""] ?? r.routing_team ?? "—"}
                    </span>
                  </td>

                  {/* Ação */}
                  <td style={{ ...S.cell, whiteSpace: "nowrap" }}>
                    {errors[r.phone] && (
                      <p style={{ color: "#C8102E", fontSize: 9, fontFamily: "'Courier New', monospace", marginBottom: 4 }}>
                        {errors[r.phone]}
                      </p>
                    )}
                    <button
                      disabled={loading[r.phone]}
                      onClick={() => handleConfirm(r.phone)}
                      style={{
                        padding: "5px 12px", borderRadius: 3, cursor: loading[r.phone] ? "not-allowed" : "pointer",
                        fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase",
                        fontFamily: "'Courier New', monospace", fontWeight: 700,
                        border: "1px solid rgba(34,197,94,.4)",
                        background: loading[r.phone] ? "rgba(34,197,94,.04)" : "rgba(34,197,94,.1)",
                        color: loading[r.phone] ? "#556677" : "#22c55e",
                        transition: "all .15s",
                      }}
                    >
                      {loading[r.phone] ? "…" : "✓ Confirmar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
