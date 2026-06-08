import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";

export const dynamic = "force-dynamic";

// ── Corte temporal: 11/05/2026 00:00 BRT = 03:00 UTC ─────────────────────────
const METRICS_CUTOFF = "2026-05-11T03:00:00";

const VENDOR_LABELS: Record<string, { name: string; region: string }> = {
  SETOR_SOROCABA_SAO_PAULO: { name: "Ana Paula", region: "Sorocaba / Grande SP" },
  SETOR_CAMPINAS_JUNDIAI:   { name: "Alan", region: "Campinas / Jundiai" },
  SETOR_CUIT:               { name: "Paulo Cezario", region: "CUIT — key accounts" },
};

const VENDOR_ORDER = ["SETOR_SOROCABA_SAO_PAULO", "SETOR_CAMPINAS_JUNDIAI", "SETOR_CUIT"];

const PIPELINE_STAGES = new Set([
  "handoff", "vendedor_assumiu", "diagnostico_comercial",
  "proposta_enviada", "negociacao",
]);

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#556677", fontFamily: "'Courier New', monospace" },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: "'Courier New', monospace", marginBottom: 12 } as React.CSSProperties,
  muted:   { color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Lead {
  phone: string;
  restaurant_name: string | null;
  city: string | null;
  routing_team: string | null;
  funnel_stage: string | null;
  handoff_at: string | null;
  seller_first_reply_at: string | null;
  first_order_at: string | null;
  is_test: boolean;
}

function fmtTime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default async function VendedoresPage() {
  const supabase = await createClient();

  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/vendedores")) redirect("/dashboard");

  const { data: raw } = await supabase
    .from("ai_sdr_leads")
    .select("phone, restaurant_name, city, routing_team, funnel_stage, handoff_at, seller_first_reply_at, first_order_at, is_test")
    .eq("is_test", false)
    .not("routing_team", "is", null);

  const leads = (raw ?? []) as unknown as Lead[];

  // ── Compute metrics per vendor ──────────────────────────────────────────────
  type VendorMetrics = {
    handoffs: number; responded: number; hoursArr: number[];
    pipeline: number; converted: number;
  };
  const metrics: Record<string, VendorMetrics> = {};
  const waiting: { phone: string; name: string; city: string; rt: string; hours: number }[] = [];

  for (const rt of VENDOR_ORDER) {
    metrics[rt] = { handoffs: 0, responded: 0, hoursArr: [], pipeline: 0, converted: 0 };
  }

  const now = Date.now();

  for (const l of leads) {
    const rt = l.routing_team ?? "";
    if (!metrics[rt]) continue;
    const m = metrics[rt];

    // Pipeline acumulado (sem filtro data)
    if (PIPELINE_STAGES.has(l.funnel_stage ?? "")) m.pipeline++;
    if (l.funnel_stage === "pedido_fechado") m.converted++;

    // Metricas de resposta (filtradas pos-11/05)
    if (l.handoff_at && l.handoff_at >= METRICS_CUTOFF) {
      m.handoffs++;
      if (l.seller_first_reply_at) {
        m.responded++;
        const delta = (new Date(l.seller_first_reply_at).getTime() - new Date(l.handoff_at).getTime()) / 3600000;
        if (delta > 0) m.hoursArr.push(delta);
      } else {
        const hrs = (now - new Date(l.handoff_at).getTime()) / 3600000;
        waiting.push({
          phone: l.phone,
          name: l.restaurant_name || l.city || "?",
          city: l.city || "?",
          rt,
          hours: hrs,
        });
      }
    }
  }

  waiting.sort((a, b) => b.hours - a.hours);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Vendedores
        </h1>
        <p style={S.muted}>
          Metricas desde segunda 11/05 (8h BRT) — periodo de retomada operacional
        </p>
        <p style={{ ...S.muted, fontSize: 9, marginTop: 4 }}>
          Periodo de medicao: 11/05 {"\u2192"} hoje. Janela 7 dias completa comeca 18/05. Dados anteriores excluidos: bug painel 08/05 + folga 09-10/05.
        </p>
      </div>

      {/* Vendor cards */}
      <div className="asb-grid-kpi">
        {VENDOR_ORDER.map(rt => {
          const v = VENDOR_LABELS[rt];
          const m = metrics[rt];
          const pct = m.handoffs > 0 ? ((m.responded / m.handoffs) * 100).toFixed(0) : null;
          const avgH = m.hoursArr.length > 0
            ? m.hoursArr.reduce((s, v) => s + v, 0) / m.hoursArr.length
            : null;
          const accent = rt === "SETOR_CUIT" ? "#ff7b1c" : rt === "SETOR_CAMPINAS_JUNDIAI" ? "#22c55e" : "#C8102E";

          return (
            <div key={rt} style={{ ...S.card, padding: "20px", borderTop: `2px solid ${accent}` }}>
              <p style={{ ...S.label, color: accent }}>{v.name}</p>
              <p style={{ ...S.muted, fontSize: 9, marginTop: 2 }}>{v.region}</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginTop: 16 }}>
                <div>
                  <p style={S.label}>Handoffs</p>
                  <p style={{ ...S.value, fontSize: 22, marginTop: 4 }}>{m.handoffs}</p>
                </div>
                <div>
                  <p style={S.label}>% Respondeu</p>
                  <p style={{ ...S.value, fontSize: 22, marginTop: 4 }}>{pct ? `${pct}%` : "\u2014"}</p>
                </div>
                <div>
                  <p style={S.label}>Tempo Medio</p>
                  <p style={{ ...S.value, fontSize: 22, marginTop: 4 }}>{avgH !== null ? fmtTime(avgH) : "\u2014"}</p>
                </div>
                <div>
                  <p style={S.label}>Pipeline</p>
                  <p style={{ ...S.value, fontSize: 22, marginTop: 4 }}>{m.pipeline}</p>
                </div>
                <div>
                  <p style={S.label}>Convertidos</p>
                  <p style={{ ...S.value, fontSize: 22, marginTop: 4, color: m.converted > 0 ? "#22c55e" : "#FFFFFF" }}>{m.converted}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Aguardando resposta */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: waiting.length > 0 ? "#C8102E" : "#22c55e", marginRight: 6 }}>{waiting.length > 0 ? "\u26A0" : "\u2713"}</span>
          Leads Aguardando Resposta
        </p>
        {waiting.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {waiting.map((w, i) => (
              <Link key={w.phone + i} href={`/dashboard/leads/${encodeURIComponent(w.phone)}`} style={{ display: "flex", textDecoration: "none", cursor: "pointer", alignItems: "center", gap: 10, padding: "5px 0", borderTop: i > 0 ? "1px solid rgba(27,42,107,.2)" : "none" }}>
                <span style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", minWidth: 60 }}>
                  ...{w.phone.slice(-4)}
                </span>
                <span style={{ color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace", minWidth: 120 }}>
                  {w.name}
                </span>
                <span style={{ color: "#8899aa", fontSize: 10, fontFamily: "'Courier New', monospace" }}>
                  {VENDOR_LABELS[w.rt]?.name ?? w.rt}
                </span>
                <span style={{
                  marginLeft: "auto",
                  color: w.hours >= 3 ? "#C8102E" : w.hours >= 1 ? "#f59e0b" : "#22c55e",
                  fontSize: 11, fontWeight: 700, fontFamily: "'Courier New', monospace",
                }}>
                  {fmtTime(w.hours)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p style={{ color: "#22c55e", fontSize: 12, fontFamily: "'Courier New', monospace" }}>
            Todos os handoffs respondidos {"\u2713"}
          </p>
        )}
      </div>

      {/* Tabela consolidada */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#2a2a2a", marginRight: 6 }}>{"\u25A0"}</span>
          Tabela Consolidada (desde 11/05)
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Vendedor", "Handoffs", "% Resp", "Tempo", "Pipeline", "Conv."].map(h => (
                <th key={h} style={{ ...S.label, textAlign: h === "Vendedor" ? "left" : "right", paddingBottom: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VENDOR_ORDER.map(rt => {
              const v = VENDOR_LABELS[rt];
              const m = metrics[rt];
              const pct = m.handoffs > 0 ? `${((m.responded / m.handoffs) * 100).toFixed(0)}%` : "\u2014";
              const avgH = m.hoursArr.length > 0
                ? fmtTime(m.hoursArr.reduce((s, v) => s + v, 0) / m.hoursArr.length)
                : "\u2014";

              return (
                <tr key={rt} style={{ borderTop: "1px solid rgba(27,42,107,.3)" }}>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", padding: "7px 0" }}>{v.name}</td>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{m.handoffs}</td>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{pct}</td>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{avgH}</td>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{m.pipeline}</td>
                  <td style={{ color: m.converted > 0 ? "#22c55e" : "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{m.converted}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
