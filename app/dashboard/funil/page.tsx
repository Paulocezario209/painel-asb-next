import { createClient } from "@/lib/supabase/server";
import { FunnelVisual, type FunnelStage } from "@/components/dashboard/funnel-visual";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import Link from "next/link";

import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
// ETAPA6 (DEBT-137): cache real da contagem global por etapa (sem auth — dado global).
import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Contagem por etapa NÃO depende do usuário (ai_sdr_leads sem RLS por routing_team).
// Service role dentro do cache; auth permanece dinâmica fora (getUserContext abaixo).
const getFunilContagem = unstable_cache(
  async () => {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data } = await supabase
      .from("ai_sdr_leads")
      .select("funnel_stage")
      .eq("is_test", false);
    return data ?? [];
  },
  ["funil-contagem-etapas"],
  { revalidate: 300, tags: ["funil-contagem-etapas"] },
);

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
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
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

export default async function FunilPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const supabase = await createClient();

  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/funil")) redirect("/dashboard");

  // Query A — todos os leads com funnel_stage (ETAPA6: cacheada, dado global)
  const rawLeads = await getFunilContagem();
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

  // Query C (FIX-ETAPA2) — leads individuais p/ bloco "Leads parados por etapa"
  const { data: rawLeadRows } = await supabase
    .from("ai_sdr_leads")
    .select("phone, restaurant_name, city, qual_stage, created_at, funnel_stage")
    .eq("is_test", false)
    .order("created_at", { ascending: false })
    .limit(1000);
  const leadRows = (rawLeadRows ?? []) as unknown as {
    phone: string | null; restaurant_name: string | null; city: string | null;
    qual_stage: number | null; created_at: string; funnel_stage: string | null;
  }[];

  // P5/P2 — funil de marcos confiáveis. Sem filtro: view v_funil_marcos (simples).
  // Com filtro (mês/vendedor): RPC get_funil_marcos (agregação parametrizada — asb-supabase-ops §7).
  const sp = await searchParams;
  const vend = sp?.vendedor && /^SETOR_[A-Z_]+$/.test(sp.vendedor) ? sp.vendedor : null;
  // Default = mês corrente (Conversão por Marcos abre no coorte do mês atual)
  const _hoje = new Date();
  const mesCorrente = `${_hoje.getFullYear()}-${String(_hoje.getMonth() + 1).padStart(2, "0")}`;
  const mesParam = sp?.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : mesCorrente;
  const temFiltro = !!(vend || mesParam);
  type Marcos = { criados: number; qualificados: number; handoff: number; assumidos: number; pedidos: number };
  let _m: Marcos | null;
  if (temFiltro) {
    const { data } = await supabase.rpc("get_funil_marcos", { p_vendedor: vend, p_mes: mesParam });
    _m = ((Array.isArray(data) ? data[0] : data) ?? null) as Marcos | null;
  } else {
    const { data: marcosRaw } = await supabase.from("v_funil_marcos").select("*").maybeSingle();
    _m = (marcosRaw ?? null) as Marcos | null;
  }
  // status: marco clicável → /dashboard/leads?status=X (deriva os mesmos estados do dropdown de /leads).
  // "Leads criados" abre sem filtro (todos). Qualificados/Handoff/Vendedor/Pedido filtram.
  const marcos = _m ? [
    { label: "Leads criados",    count: _m.criados,      status: "" },
    { label: "Qualificados",     count: _m.qualificados, status: "qualified" },
    { label: "Handoff",          count: _m.handoff,      status: "handoff" },
    { label: "Vendedor assumiu", count: _m.assumidos,    status: "vendedor_assumiu" },
    { label: "Pedido fechado",   count: _m.pedidos,      status: "pedido_fechado" },
  ] : [];

  // ── KPIs ──────────────────────────────────────────────────────────────────────
  const stageCounts: Record<string, number> = {};
  for (const l of leads) {
    const s = l.funnel_stage ?? "lead_novo";
    stageCounts[s] = (stageCounts[s] ?? 0) + 1;
  }

  const emQualificacao = leads.filter(l => QUALIFICACAO.has(l.funnel_stage ?? "")).length;
  const emHandoffPlus  = leads.filter(l => HANDOFF_PLUS.has(l.funnel_stage ?? "")).length;
  const taxaHandoff    = total > 0 ? ((emHandoffPlus / total) * 100).toFixed(1) : null;

  // ── Chart data (15 etapas ordenadas) — enriquecido p/ FunnelVisual (FIX 4) ────
  // fill semântico: handoff = âmbar; etapas pós-handoff = verde; qualificação = azul.
  // pct = conversão vs etapa anterior (null na 1ª). FunnelChart afunila por count.
  const N_STAGES = STAGE_ORDER.length;
  const chartData: FunnelStage[] = STAGE_ORDER.map((s, i) => {
    const count = stageCounts[s] ?? 0;
    const prev = i > 0 ? (stageCounts[STAGE_ORDER[i - 1]] ?? 0) : 0;
    const pct = i > 0 && prev > 0 ? Math.round((count / prev) * 100) : null;
    const fill = s === "handoff" ? "#D4A017" : HANDOFF_PLUS.has(s) ? "#22c55e" : "#185FA5";
    // FIX-ETAPA2: largura decrescente por índice → funil sempre afunila (count real fica no label)
    return { label: STAGE_LABELS[s] ?? s, count, pct, fill, funnelWidth: N_STAGES - i };
  });

  // ── Leads parados por etapa (FIX-ETAPA2) — top 10 por etapa, etapas não-terminais ──
  const TERMINAIS = new Set(["pedido_fechado", "cliente_ativo", "cliente_recorrente"]);
  const leadsPorEtapa: Record<string, typeof leadRows> = {};
  for (const r of leadRows) {
    const s = r.funnel_stage ?? "lead_novo";
    if (TERMINAIS.has(s)) continue;
    (leadsPorEtapa[s] ??= []);
    if (leadsPorEtapa[s].length < 10) leadsPorEtapa[s].push(r);
  }
  const etapasComLeads = STAGE_ORDER.filter(s => (leadsPorEtapa[s]?.length ?? 0) > 0);

  // ── Drop-off table ────────────────────────────────────────────────────────────
  const dropoff: { from: string; to: string; fromCount: number; toCount: number; rate: string }[] = [];
  for (let i = 0; i < STAGE_ORDER.length - 1; i++) {
    const fromStage = STAGE_ORDER[i];
    const toStage   = STAGE_ORDER[i + 1];
    const fromCount = stageCounts[fromStage] ?? 0;
    const toCount   = stageCounts[toStage] ?? 0;
    if (fromCount === 0 && toCount === 0) continue;
    const rate = fromCount > 0 ? `${((toCount / fromCount) * 100).toFixed(0)}%` : "—";
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

      {/* P2 — filtro mês+vendedor (afeta SÓ a seção "Conversão por Marcos") */}
      <div style={{ ...S.card, padding: "12px 16px" }}>
        <DashboardFilters showMonth defaultMes={mesCorrente} />
        <p style={{ ...S.muted, fontSize: 9, marginTop: 8 }}>
          O filtro afeta apenas <span style={{ color: "#22c55e" }}>Conversão por Marcos</span> (coorte por mês/vendedor). O funil de 15 etapas e o drop-off abaixo são sempre globais (posição atual).
        </p>
      </div>

      {/* KPI row */}
      <div className="asb-grid-kpi">
        {[
          { label: "Total Leads",          value: String(total),                                   accent: "#185FA5", sub: "na base" },
          { label: "Em Qualificacao",       value: String(emQualificacao),                         accent: "#f59e0b", sub: "etapas 2-6" },
          { label: "Handoff+",             value: String(emHandoffPlus),                           accent: "#22c55e", sub: "etapas 7-15" },
          { label: "Taxa SDR → Handoff", value: taxaHandoff ? `${taxaHandoff}%` : "—", accent: "#C8102E", sub: total > 0 ? `${emHandoffPlus} de ${total} leads` : "" },
        ].map(({ label, value, accent, sub }) => (
          <div key={label} style={{ ...S.card, padding: "20px", borderTop: `2px solid ${accent}` }}>
            <p style={{ ...S.label, color: accent }}>{label}</p>
            <p style={{ ...S.value, marginTop: 12 }}>{value}</p>
            <p style={{ ...S.muted, marginTop: 6, fontSize: 10 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* P5/P2 — Conversão por marcos (timestamps confiáveis; filtrável por mês/vendedor) */}
      {marcos.length > 0 && marcos[0].count > 0 && (
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <p style={S.section}>
            <span style={{ color: "#22c55e", marginRight: 6 }}>{"✓"}</span>
            Conversão por Marcos {temFiltro ? <span style={{ color: "#22c55e" }}>· filtrado{mesParam ? ` ${mesParam}` : ""}{vend ? " · vendedor" : ""}</span> : "(timestamps confiáveis)"}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {marcos.map((mk, i) => {
              const base = marcos[0].count;
              const prev = i > 0 ? marcos[i - 1].count : null;
              const pctTotal = base > 0 ? Math.round((mk.count / base) * 100) : 0;
              const pctPrev = prev && prev > 0 ? Math.round((mk.count / prev) * 100) : null;
              const href = mk.status ? `/dashboard/leads?status=${mk.status}` : "/dashboard/leads";
              return (
                <Link
                  key={mk.label}
                  href={href}
                  title={`Ver leads — ${mk.label}`}
                  style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", cursor: "pointer" }}
                >
                  <span style={{ width: 132, color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", flexShrink: 0 }}>{mk.label}</span>
                  <div style={{ flex: 1, background: "#0d1117", borderRadius: 3, height: 22, position: "relative", overflow: "hidden" }}>
                    <div style={{ width: `${pctTotal}%`, height: "100%", background: "linear-gradient(90deg, #1B2A6B, #2ea043)", borderRadius: 3, minWidth: mk.count > 0 ? 3 : 0 }} />
                    <span style={{ position: "absolute", left: 8, top: 3, color: "#fff", fontSize: 11, fontFamily: "'Courier New', monospace" }}>{mk.count}</span>
                  </div>
                  <span style={{ width: 42, textAlign: "right", color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace", flexShrink: 0 }}>{pctTotal}%</span>
                  <span style={{ width: 74, textAlign: "right", color: pctPrev != null ? "#22c55e" : "#556677", fontSize: 10, fontFamily: "'Courier New', monospace", flexShrink: 0 }}>
                    {pctPrev != null ? `${pctPrev}% ant.` : "—"}
                  </span>
                </Link>
              );
            })}
          </div>
          <p style={{ color: "#556677", fontSize: 9, fontFamily: "'Courier New', monospace", marginTop: 10, lineHeight: 1.5 }}>
            Base: created_at → qual_stage≥7 → handoff_at → seller_first_reply_at → first_order_at (campos com timestamp confiável, asb-funnel §7). Cumulativo. Difere do funil de 15 etapas abaixo, que reflete a posição ATUAL (snapshot, distorcido por etapas sem writer).
          </p>
        </div>
      )}

      {/* Funnel chart */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#C8102E", marginRight: 6 }}>{"▼"}</span>
          Leads por Etapa
        </p>
        <div style={{ height: 460 }}>
          <FunnelVisual data={chartData} />
        </div>
      </div>

      {/* Drop-off table */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#f59e0b", marginRight: 6 }}>{"▶"}</span>
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

      {/* Leads parados por etapa (FIX-ETAPA2) — clicáveis */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#185FA5", marginRight: 6 }}>{"◉"}</span>
          Leads Parados por Etapa
        </p>
        {etapasComLeads.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {etapasComLeads.map(s => (
              <div key={s}>
                <p style={{ ...S.muted, fontSize: 10, marginBottom: 6 }}>
                  {STAGE_LABELS[s] ?? s} <span style={{ color: "#556677" }}>· {stageCounts[s] ?? 0} no total{(stageCounts[s] ?? 0) > 10 ? " (top 10)" : ""}</span>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {leadsPorEtapa[s].map((r, i) => {
                    const nome = r.restaurant_name || r.city || (r.phone ? `...${r.phone.slice(-4)}` : "?");
                    const dias = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000);
                    const row = (
                      <>
                        <span style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", minWidth: 160 }}>{nome}</span>
                        <span style={{ color: "#556677", fontSize: 10, fontFamily: "'Courier New', monospace" }}>{r.city ?? "—"}</span>
                        <span style={{ marginLeft: "auto", color: dias >= 7 ? "#C8102E" : dias >= 3 ? "#f59e0b" : "#8899aa", fontSize: 10, fontWeight: 700, fontFamily: "'Courier New', monospace" }}>{dias}d na base</span>
                      </>
                    );
                    return r.phone ? (
                      <Link key={r.phone + i} href={`/dashboard/leads/${encodeURIComponent(r.phone)}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0", textDecoration: "none", borderTop: i > 0 ? "1px solid rgba(27,42,107,.2)" : "none" }}>{row}</Link>
                    ) : (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0", borderTop: i > 0 ? "1px solid rgba(27,42,107,.2)" : "none" }}>{row}</div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={S.muted}>Nenhum lead parado em etapas ativas.</p>
        )}
      </div>

      {/* Timeline */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#22c55e", marginRight: 6 }}>{"●"}</span>
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
                  {lead?.phone ? (
                    <Link href={`/dashboard/leads/${encodeURIComponent(lead.phone)}`} style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", minWidth: 100, textDecoration: "none" }}>
                      {nome}
                    </Link>
                  ) : (
                    <span style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", minWidth: 100 }}>
                      {nome}
                    </span>
                  )}
                  <span style={{ color: "#8899aa", fontSize: 10, fontFamily: "'Courier New', monospace" }}>
                    {e.from_stage ? `${STAGE_LABELS[e.from_stage] ?? e.from_stage} → ` : ""}{STAGE_LABELS[e.to_stage] ?? e.to_stage}
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
