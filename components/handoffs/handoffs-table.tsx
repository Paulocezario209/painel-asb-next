"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { LeadScoreBadge } from "@/components/dashboard/lead-score-badge";
import { createClient } from "@/lib/supabase/client";
import { computeLeadScore, tierOf } from "@/lib/lead-score";
import { VENDOR_LABELS } from "@/lib/vendor-labels";

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
  lead_score?: number | null;        // ETAPA 4
  lead_tier?: "A" | "B" | "C" | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────
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
  label: { fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase" as const, color: "#e4e9f0", fontFamily: "'Courier New', monospace" },
  cell:  { color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", padding: "10px 12px", verticalAlign: "top" as const },
  muted: { color: "#c0d0e0", fontSize: 10, fontFamily: "'Courier New', monospace" },
};

export function HandoffsTable({ initial }: { initial: Handoff[] }) {
  const [rows, setRows]           = useState<Handoff[]>(initial);
  const [vendorFilter, setVendor] = useState<string>("todos");
  const [urgentOnly, setUrgent]   = useState(false);
  const [loading, setLoading]     = useState<Record<string, boolean>>({});
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [live, setLive]           = useState(false);   // ETAPA7: canal Realtime conectado

  // ETAPA7 — Supabase Realtime: detecta novo/alterado handoff e re-busca a lista
  // completa (refetch é mais seguro que mutar o array). ANON key (RLS authenticated).
  // O fetch inicial continua no server component pai; aqui só reagimos a mudanças.
  useEffect(() => {
    const supabase = createClient();
    const COLS = "phone, restaurant_name, city, segment, weekly_volume_kg, routing_team, " +
                 "handoff_at, scheduled_at, pain_point, lead_temperature, qual_stage";

    async function refetch() {
      const { data } = await supabase
        .from("ai_sdr_leads")
        .select(COLS)
        .eq("is_test", false)
        .eq("human_active", true)
        .eq("handoff_confirmed", false)
        .not("handoff_at", "is", null)
        .order("handoff_at", { ascending: true });
      if (!data) return;
      const fourHAgo = Date.now() - 4 * 60 * 60 * 1000;
      const enriched = (data as unknown as Handoff[])
        .map((h) => {
          const score = computeLeadScore(h);              // fallback (view = server-only)
          return { ...h, lead_score: score, lead_tier: tierOf(score) };
        })
        .sort((a, b) => {                                 // mesma ordem do server: críticos→score
          const ca = new Date(a.handoff_at).getTime() < fourHAgo ? 1 : 0;
          const cb = new Date(b.handoff_at).getTime() < fourHAgo ? 1 : 0;
          if (ca !== cb) return cb - ca;
          return (b.lead_score ?? 0) - (a.lead_score ?? 0);
        });
      setRows(enriched);
    }

    const channel = supabase
      .channel("handoffs-fila-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ai_sdr_leads", filter: "human_active=eq.true" }, () => refetch())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ai_sdr_leads", filter: "human_active=eq.true" }, () => refetch())
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => { supabase.removeChannel(channel); };
  }, []);

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
    border: active ? "1px solid #C8102E" : "1px solid #2a2a2a",
    background: active ? "rgba(200,16,46,.12)" : "transparent",
    color: active ? "#C8102E" : "#c0d0e0",
    transition: "all .15s",
  });

  return (
    <div>
      {/* Filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={S.label}>Vendedor:</span>
        {["todos", "SETOR_SOROCABA_SAO_PAULO", "SETOR_CAMPINAS_JUNDIAI", "SETOR_CUIT"].map(v => (
          <button key={v} style={btnFilter(vendorFilter === v)} onClick={() => setVendor(v)}>
            {v === "todos" ? "Todos" : VENDOR_LABELS[v]}
          </button>
        ))}
        <div style={{ width: 1, height: 18, background: "#2a2a2a", margin: "0 4px" }} />
        <button style={btnFilter(urgentOnly)} onClick={() => setUrgent(p => !p)}>
          ⚡ Só críticos (&gt; 4h)
        </button>

        {/* ETAPA7: indicador de canal Realtime conectado */}
        {live && (
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <style>{`@keyframes asb-live{0%,100%{opacity:1}50%{opacity:.3}}.asb-live-dot{animation:asb-live 1.4s ease-in-out infinite}`}</style>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#22c55e", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
              <span className="asb-live-dot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
              AO VIVO
            </span>
          </span>
        )}
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
              <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Link
                        href={`/dashboard/leads/${encodeURIComponent(r.phone)}`}
                        style={{ color: "#FFFFFF", fontWeight: 600, textDecoration: "none" }}
                      >
                        {r.restaurant_name ?? "—"}
                      </Link>
                      {r.lead_score != null && r.lead_tier && (
                        <LeadScoreBadge score={r.lead_score} tier={r.lead_tier} size="sm" />
                      )}
                    </div>
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
                      <span style={{ color: "#e4e9f0" }}>—</span>
                    )}
                  </td>

                  {/* Tempo */}
                  <td style={{ ...S.cell, whiteSpace: "nowrap" }}>
                    <TimeBadge handoffAt={r.handoff_at} />
                  </td>

                  {/* Vendedor */}
                  <td style={{ ...S.cell, whiteSpace: "nowrap" }}>
                    <span style={{
                      border: "1px solid #2a2a2a", color: "#c0d0e0", fontSize: 9,
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
                        color: loading[r.phone] ? "#e4e9f0" : "#22c55e",
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
