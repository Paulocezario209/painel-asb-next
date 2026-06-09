import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { getLeadScoreMap } from "@/lib/get-lead-scores";
import { LeadScoreBadge } from "@/components/dashboard/lead-score-badge";
import { theme } from "@/lib/theme";

export const dynamic = "force-dynamic";

// ETAPA9B: preço médio estimado por kg para valor potencial de pipeline
const PRECO_KG = 35;

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
  weekly_volume_kg: number | null;
  created_at: string | null;
  is_test: boolean;
}

// ETAPA9B: candidato de pipeline velocity
type VelocityLead = {
  phone: string; name: string; value: number; score: number;
  dias: number; velocity: number;
};

const fmtBRL0 = (n: number) =>
  `R$ ${Math.round(Number(n)).toLocaleString("pt-BR")}`;

function fmtTime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default async function VendedoresPage() {
  const supabase = await createClient();

  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/vendedores")) redirect("/dashboard");

  const [{ data: raw }, scoreMap] = await Promise.all([
    supabase
      .from("ai_sdr_leads")
      .select("phone, restaurant_name, city, routing_team, funnel_stage, handoff_at, seller_first_reply_at, first_order_at, weekly_volume_kg, created_at, is_test")
      .eq("is_test", false)
      .not("routing_team", "is", null),
    getLeadScoreMap(),  // ETAPA 4: score por phone (v_lead_score via service role)
  ]);

  const leads = (raw ?? []) as unknown as Lead[];

  // ── Compute metrics per vendor ──────────────────────────────────────────────
  type VendorMetrics = {
    handoffs: number; responded: number; hoursArr: number[];
    pipeline: number; converted: number;
    // ETAPA9B
    pipelineValue: number;          // Σ weekly_volume_kg × PRECO_KG (leads em pipeline)
    scoreSum: number; scoreCount: number;  // score médio dos em pipeline
    totalHandoffsAll: number; firstOrders: number;  // win rate (handoff→first_order)
    velCandidates: VelocityLead[];
  };
  const metrics: Record<string, VendorMetrics> = {};
  const waiting: { phone: string; name: string; city: string; rt: string; hours: number }[] = [];

  for (const rt of VENDOR_ORDER) {
    metrics[rt] = {
      handoffs: 0, responded: 0, hoursArr: [], pipeline: 0, converted: 0,
      pipelineValue: 0, scoreSum: 0, scoreCount: 0,
      totalHandoffsAll: 0, firstOrders: 0, velCandidates: [],
    };
  }

  const now = Date.now();

  for (const l of leads) {
    const rt = l.routing_team ?? "";
    if (!metrics[rt]) continue;
    const m = metrics[rt];

    // Pipeline acumulado (sem filtro data)
    if (PIPELINE_STAGES.has(l.funnel_stage ?? "")) {
      m.pipeline++;
      // ETAPA9B: valor potencial, score médio e velocity candidate
      const vol = Number(l.weekly_volume_kg ?? 0);
      const value = vol * PRECO_KG;
      m.pipelineValue += value;
      const score = scoreMap[l.phone]?.score ?? 0;
      m.scoreSum += score; m.scoreCount++;
      const baseTs = l.handoff_at ?? l.created_at;
      const dias = baseTs ? Math.max(1, (now - new Date(baseTs).getTime()) / 86400000) : 1;
      const velocity = (value * score / 100) / dias;
      if (value > 0 && score > 0) {
        m.velCandidates.push({
          phone: l.phone,
          name: l.restaurant_name || l.city || ("..." + l.phone.slice(-4)),
          value, score, dias, velocity,
        });
      }
    }
    if (l.funnel_stage === "pedido_fechado") m.converted++;

    // ETAPA9B: win rate (handoff → first_order), sem filtro de data
    if (l.handoff_at) {
      m.totalHandoffsAll++;
      if (l.first_order_at) m.firstOrders++;
    }

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

  // ── ETAPA9B: totais de equipe + velocity top-5 por vendedor ──────────────────
  let teamPipelineValue = 0, teamHandoffsAll = 0, teamFirstOrders = 0, teamScoreSum = 0, teamScoreCount = 0;
  for (const rt of VENDOR_ORDER) {
    const m = metrics[rt];
    teamPipelineValue += m.pipelineValue;
    teamHandoffsAll += m.totalHandoffsAll;
    teamFirstOrders += m.firstOrders;
    teamScoreSum += m.scoreSum;
    teamScoreCount += m.scoreCount;
    m.velCandidates.sort((a, b) => b.velocity - a.velocity);
  }
  const teamWinRate = teamHandoffsAll > 0 ? (teamFirstOrders / teamHandoffsAll) * 100 : null;
  const teamHotAvg = teamScoreCount > 0 ? teamScoreSum / teamScoreCount : null;

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

      {/* ETAPA9B: resumo de pipeline da equipe */}
      <div className="asb-grid-kpi">
        <div style={{ ...S.card, padding: "20px", borderTop: `2px solid ${theme.colors.brandAsb}` }}>
          <p style={{ ...S.label, color: theme.colors.brandAsb }}>Total em Pipeline</p>
          <p style={{ ...S.value, fontSize: 24, marginTop: 12, fontFamily: theme.font.mono }}>{fmtBRL0(teamPipelineValue)}</p>
          <p style={{ ...S.muted, marginTop: 6, fontSize: 10 }}>Σ volume × R$ {PRECO_KG}/kg (leads em pipeline)</p>
        </div>
        <div style={{ ...S.card, padding: "20px", borderTop: `2px solid ${theme.colors.success}` }}>
          <p style={{ ...S.label, color: theme.colors.success }}>Win Rate Equipe</p>
          <p style={{ ...S.value, fontSize: 24, marginTop: 12 }}>{teamWinRate !== null ? `${teamWinRate.toFixed(0)}%` : "—"}</p>
          <p style={{ ...S.muted, marginTop: 6, fontSize: 10 }}>handoffs com 1º pedido / total handoffs</p>
        </div>
        <div style={{ ...S.card, padding: "20px", borderTop: `2px solid ${theme.colors.warning}` }}>
          <p style={{ ...S.label, color: theme.colors.warning }}>Lead Médio (pipeline)</p>
          <p style={{ ...S.value, fontSize: 24, marginTop: 12 }}>{teamHotAvg !== null ? `${teamHotAvg.toFixed(0)}/100` : "—"}</p>
          <p style={{ ...S.muted, marginTop: 6, fontSize: 10 }}>score médio dos leads em handoff</p>
        </div>
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
          const winRate = m.totalHandoffsAll > 0 ? (m.firstOrders / m.totalHandoffsAll) * 100 : null;  // ETAPA9B
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
                <div>
                  <p style={S.label}>Win Rate</p>
                  <p style={{ ...S.value, fontSize: 22, marginTop: 4, color: winRate !== null ? theme.colors.success : "#FFFFFF" }}>
                    {winRate !== null ? `${winRate.toFixed(0)}%` : "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ETAPA9B: PIPELINE VELOCITY — top 5 leads por vendedor */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: theme.colors.accent, marginRight: 6 }}>{"⚡"}</span>
          Pipeline Velocity
        </p>
        <p style={{ ...S.muted, fontSize: 9, marginBottom: 16 }}>
          velocity = (volume × R$ {PRECO_KG}/kg × score/100) ÷ dias no pipeline — prioriza valor alto que converte rápido
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {VENDOR_ORDER.map(rt => {
            const v = VENDOR_LABELS[rt];
            const top = metrics[rt].velCandidates.slice(0, 5);
            return (
              <div key={rt}>
                <p style={{ ...S.label, color: theme.colors.textPrimary, marginBottom: 8 }}>{v.name}</p>
                {top.length === 0 ? (
                  <p style={{ ...S.muted, fontSize: 10, fontStyle: "italic" }}>Sem leads em pipeline com volume e score.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {top.map((c, i) => (
                      <Link
                        key={c.phone + i}
                        href={`/dashboard/leads/${encodeURIComponent(c.phone)}`}
                        style={{
                          display: "flex", alignItems: "center", gap: 8, textDecoration: "none",
                          padding: "6px 0", borderTop: i > 0 ? `1px solid ${theme.colors.borderDefault}` : "none",
                        }}
                      >
                        <span style={{ color: theme.colors.textPrimary, fontSize: 11, fontFamily: theme.font.mono, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.name}
                        </span>
                        <span style={{ color: theme.colors.neutral, fontSize: 9, fontFamily: theme.font.mono, whiteSpace: "nowrap" }}>
                          {fmtBRL0(c.value)} · {c.score}/100 · {c.dias.toFixed(0)}d
                        </span>
                        <span style={{ color: theme.colors.accent, fontSize: 11, fontWeight: 700, fontFamily: theme.font.mono, minWidth: 44, textAlign: "right" }}>
                          {Math.round(c.velocity)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
                {scoreMap[w.phone] && (
                  <LeadScoreBadge score={scoreMap[w.phone].score} tier={scoreMap[w.phone].tier} size="sm" />
                )}
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
