import { createClient } from "@/lib/supabase/server";
import { QualificationFunnel } from "@/components/dashboard/charts";

export const dynamic = "force-dynamic";

// ── Ordem canonica das 15 etapas (asb-funnel.md) ─────────────────────────────
const STAGE_ORDER = [
  "lead_novo",
  "atendido_sdr",
  "qualificacao_inicial",
  "cobertura_validada",
  "produto_definido",
  "volume_definido",
  "lead_qualificado",
  "handoff",
  "vendedor_assumiu",
  "diagnostico_comercial",
  "proposta_enviada",
  "negociacao",
  "pedido_fechado",
  "cliente_ativo",
  "cliente_recorrente",
] as const;

const STAGE_LABELS: Record<string, string> = {
  lead_novo:              "Lead Novo",
  atendido_sdr:           "Atendido SDR",
  qualificacao_inicial:   "Qualif. Inicial",
  cobertura_validada:     "Cobertura Valid.",
  produto_definido:       "Produto Definido",
  volume_definido:        "Volume Definido",
  lead_qualificado:       "Lead Qualificado",
  handoff:                "Handoff",
  vendedor_assumiu:       "Vendedor Assumiu",
  diagnostico_comercial:  "Diag. Comercial",
  proposta_enviada:       "Proposta Enviada",
  negociacao:             "Negociacao",
  pedido_fechado:         "Pedido Fechado",
  cliente_ativo:          "Cliente Ativo",
  cliente_recorrente:     "Cliente Recorrente",
};

const HANDOFF_PLUS = new Set([
  "lead_qualificado", "handoff", "vendedor_assumiu", "diagnostico_comercial",
  "proposta_enviada", "negociacao", "pedido_fechado", "cliente_ativo", "cliente_recorrente",
]);

const QUALIFICACAO = new Set([
  "atendido_sdr", "qualificacao_inicial", "cobertura_validada",
  "produto_definido", "volume_definido",
]);

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  card:    { background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 4 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#556677", fontFamily: "'Courier New', monospace" },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: "'Courier New', monospace", marginBottom: 12 } as React.CSSProperties,
  muted:   { color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
};

// ── Interfaces ────────────────────────────────────────────────────────────────
interface FunnelLead {
  funnel_stage: string | null;
}

interface FunnelEvent {
  from_stage: string | null;
  to_stage:   string;
  actor:      string;
  created_at: string;
  metadata:   Record<string, unknown> | null;
  ai_sdr_leads: {
    phone: string | null;
    city:  string | null;
    restaurant_name: string | null;
  } | null;
}

export default async function FunilPage() {
  const supabase = await createClient();

  // Query A — todos os leads com funnel_stage
  const { data: rawLeads } = await supabase
    .from("ai_sdr_leads")
    .select("funnel_stage");
  const leads = (rawLeads ?? []) as unknown as FunnelLead[];
  const total = leads.length;

  // Query B — ultimos 20 eventos non-backfill
  const { data: rawEvents } = await supabase
    .from("funnel_stage_events")
    .select("from_stage, to_stage, actor, created_at, metadata, ai_sdr_leads(phone, city, restaurant_name)")
    .neq("actor", "system")
    .order("created_at", { ascending: false })
    .limit(20);
  const events = (rawEvents ?? []) as unknown as FunnelEvent[];

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const stageCounts: Record<string, number> = {};
  for (const l of leads) {
    const s = l.funnel_stage ?? "lead_novo";
    stageCounts[s] = (stageCounts[s] ?? 0) + 1;
  }

  const emQualificacao = leads.filter(l => QUALIFICACAO.has(l.funnel_stage ?? "")).length;
  const emHandoffPlus  = leads.filter(l => HANDOFF_PLUS.has(l.funnel_stage ?? "")).length;
  const taxaHandoff    = total > 0 ? ((emHandoffPlus / total) * 100).toFixed(1) : null;

  // ── Chart data (15 etapas ordenadas) ──────────────────────────────────────────
  const chartData = STAGE_ORDER.map(s => ({
    label: STAGE_LABELS[s] ?? s,
    count: stageCounts[s] ?? 0,
  }));

  // ── Drop-off table ────────────────────────────────────────────────────────────
  const dropoff: { from: string; to: string; fromCount: number; toCount: number; rate: string }[] = [];
  for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
    const fromStage = STAGE_ORDER[i];
    const toStage   = STAGE_ORDER[i + 1];
    const fromCount = stageCounts[fromStage] ?? 0;
    const toCount   = stageCounts[toStage] ?? 0;
    if (fromCount === 0 && toCount === 0) continue;
    const rate = fromCount > 0 ? `${((toCount / fromCount) * 100).toFixed(0)}%` : "\u2014";
    dropoff.push({
      from: STAGE_LABELS[fromStage] ?? fromStage,
      to:   STAGE_LABELS[toStage] ?? toStage,
      fromCount,
      toCount,
      rate,
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Funil de Vendas
        </h1>
        <p style={S.muted}>15 etapas · {total} leads · atualizado agora</p>
      </div>

      {/* KPI row */}
      <div className="asb-grid-kpi">
        {[
          { label: "Total Leads",          value: String(total),                                   accent: "#1B2A6B", sub: "na base" },
          { label: "Em Qualificacao",       value: String(emQualificacao),                         accent: "#f59e0b", sub: "etapas 2-6" },
          { label: "Handoff+",             value: String(emHandoffPlus),                           accent: "#22c55e", sub: "etapas 7-15" },
          { label: "Taxa SDR \u2192 Handoff", value: taxaHandoff ? `${taxaHandoff}%` : "\u2014", accent: "#C8102E", sub: total > 0 ? `${emHandoffPlus} de ${total} leads` : "" },
        ].map(({ label, value, accent, sub }) => (
          <div key={label} style={{ ...S.card, padding: "20px", borderTop: `2px solid ${accent}` }}>
            <p style={{ ...S.label, color: accent }}>{label}</p>
            <p style={{ ...S.value, marginTop: 12 }}>{value}</p>
            <p style={{ ...S.muted, marginTop: 6, fontSize: 10 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Funnel chart */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#C8102E", marginRight: 6 }}>{"\u25BC"}</span>
          Leads por Etapa
        </p>
        <div style={{ height: 420 }}>
          <QualificationFunnel data={chartData} />
        </div>
      </div>

      {/* Drop-off table */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#f59e0b", marginRight: 6 }}>{"\u25B6"}</span>
          Drop-off entre Etapas
        </p>
        {dropoff.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["De", "Para", "Leads De", "Leads Para", "Taxa"].map(h => (
                  <th key={h} style={{ ...S.label, textAlign: h === "De" || h === "Para" ? "left" : "right", paddingBottom: 8 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dropoff.map(({ from, to, fromCount, toCount, rate }) => (
                <tr key={`${from}-${to}`} style={{ borderTop: "1px solid rgba(27,42,107,.3)" }}>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", padding: "7px 0" }}>{from}</td>
                  <td style={{ color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace", padding: "7px 0" }}>{to}</td>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{fromCount}</td>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{toCount}</td>
                  <td style={{ color: "#C8102E", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={S.muted}>Sem dados de transicao</p>
        )}
      </div>

      {/* Timeline */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#22c55e", marginRight: 6 }}>{"\u25CF"}</span>
          Timeline — Ultimas Transicoes
        </p>
        {events.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {events.map((e, i) => {
              const lead = e.ai_sdr_leads;
              const phone = lead?.phone ? `...${lead.phone.slice(-4)}` : "?";
              const nome  = lead?.restaurant_name || lead?.city || phone;
              const dt    = new Date(e.created_at);
              const hora  = `${String(dt.getUTCHours() - 3).padStart(2, "0")}:${String(dt.getUTCMinutes()).padStart(2, "0")}`;
              const dia   = `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;

              return (
                <div key={e.created_at + i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0", borderTop: i > 0 ? "1px solid rgba(27,42,107,.2)" : "none" }}>
                  <span style={{ color: "#556677", fontSize: 10, fontFamily: "'Courier New', monospace", minWidth: 80 }}>
                    {dia} {hora}
                  </span>
                  <span style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", minWidth: 100 }}>
                    {nome}
                  </span>
                  <span style={{ color: "#8899aa", fontSize: 10, fontFamily: "'Courier New', monospace" }}>
                    {e.from_stage ? `${STAGE_LABELS[e.from_stage] ?? e.from_stage} \u2192 ` : ""}{STAGE_LABELS[e.to_stage] ?? e.to_stage}
                  </span>
                  <span style={{
                    marginLeft: "auto",
                    fontSize: 9, fontFamily: "'Courier New', monospace", letterSpacing: ".08em",
                    padding: "1px 6px", borderRadius: 2,
                    color: e.actor === "vendedor" ? "#22c55e" : e.actor === "sdr" ? "#C8102E" : "#8899aa",
                    border: `1px solid ${e.actor === "vendedor" ? "rgba(34,197,94,.3)" : e.actor === "sdr" ? "rgba(200,16,46,.3)" : "rgba(136,153,170,.2)"}`,
                    background: e.actor === "vendedor" ? "rgba(34,197,94,.06)" : e.actor === "sdr" ? "rgba(200,16,46,.06)" : "transparent",
                  }}>
                    {e.actor}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={S.muted}>Nenhuma transicao registrada ainda. Eventos aparecem conforme leads avancam no funil.</p>
        )}
      </div>
    </div>
  );
}
