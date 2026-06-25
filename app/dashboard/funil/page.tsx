import { createClient } from "@/lib/supabase/server";
import { theme } from "@/lib/theme";
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
      .eq("is_test", false)
      .or("routing_team.is.null,routing_team.neq.fora_de_rota");   // DEBT-167 4: Total Leads sem fora_de_rota (cone já excluía)
    return data ?? [];
  },
  ["funil-contagem-etapas"],
  { revalidate: 300, tags: ["funil-contagem-etapas"] },
);

// ── Ordem canonica do Funil v2 (14 etapas — docs/extensao-v2/FUNIL_V2_SPEC.md) ──
// Camadas: SDR (lead_novo→handoff) · LEAD (lead_em_andamento→pedido_teste) · CLIENTE (cliente_em_ativacao→cliente_recorrente).
// Removidas da vista: cobertura_validada + diagnostico_comercial (órfãs, sem writer). lead_perdido = bucket LATERAL (abaixo).
const STAGE_ORDER = [
  // Camada SDR
  "lead_novo",
  "atendido_sdr",
  "qualificacao_inicial",
  "produto_definido",
  "volume_definido",
  "lead_qualificado",
  "handoff",
  // Camada LEAD (vendedor)
  "lead_em_andamento",
  "negociacao",
  "proposta_enviada",
  "pedido_teste",
  // Camada CLIENTE (carteira)
  "cliente_em_ativacao",
  "cliente_ativo",
  "cliente_recorrente",
] as const;

// STAGE_ALIAS — colapsa LEGACY ainda vivo no banco no equivalente v2, ANTES de contar.
// PONTE até a Fase 3 do Funil v2 (drop dos legacy do CHECK) — ver DEBT-157.
const STAGE_ALIAS: Record<string, string> = {
  vendedor_assumiu:      "lead_em_andamento",   // legacy → LEAD
  diagnostico_comercial: "lead_em_andamento",   // legacy → LEAD
  pedido_fechado:        "cliente_em_ativacao", // legacy → CLIENTE
};
const aliasStage = (s: string) => STAGE_ALIAS[s] ?? s;

// FASE A redesenho: cone de 4 FASES (agrega funnel_stage CRU, cobre legados). Perdidos = lateral.
// Cores: SÓ tokens existentes (#185FA5 ASB · #D4A017 âmbar · #22c55e sucesso).
const FASES = [
  { key: "qualificacao", label: "Em qualificação", fill: "#185FA5",
    stages: ["lead_novo", "atendido_sdr", "qualificacao_inicial", "produto_definido", "volume_definido"] },
  { key: "qualificado",  label: "Qualificado",     fill: "#185FA5",
    stages: ["lead_qualificado"] },
  { key: "com_vendedor", label: "Com vendedor",    fill: "#D4A017",
    stages: ["handoff", "lead_em_andamento", "vendedor_assumiu", "negociacao", "proposta_enviada", "pedido_teste"] },
  { key: "cliente",      label: "Cliente",         fill: "#22c55e",
    stages: ["pedido_fechado", "cliente_em_ativacao", "cliente_ativo", "cliente_recorrente"] },
] as const;
const FASE_STAGES = new Set([...FASES.flatMap(f => f.stages), "lead_perdido"]);  // lateral incluso

const STAGE_LABELS: Record<string, string> = {
  lead_novo:              "Lead Novo",
  atendido_sdr:           "Atendido SDR",
  qualificacao_inicial:   "Qualif. Inicial",
  cobertura_validada:     "Cobertura Valid.",      // legacy/órfã — fora do STAGE_ORDER (só timeline histórica)
  produto_definido:       "Produto Definido",
  volume_definido:        "Volume Definido",
  lead_qualificado:       "Lead Qualificado",
  handoff:                "Handoff",
  vendedor_assumiu:       "Vendedor Assumiu",      // legacy → aliased p/ lead_em_andamento (só timeline)
  diagnostico_comercial:  "Diag. Comercial",       // legacy → aliased (só timeline)
  lead_em_andamento:      "Lead em Andamento",     // v2 LEAD
  negociacao:             "Negociacao",
  proposta_enviada:       "Proposta Enviada",
  pedido_teste:           "Pedido Teste",          // v2 LEAD
  pedido_fechado:         "Pedido Fechado",        // legacy → aliased p/ cliente_em_ativacao (só timeline)
  cliente_em_ativacao:    "Cliente em Ativacao",   // v2 CLIENTE
  cliente_ativo:          "Cliente Ativo",
  cliente_recorrente:     "Cliente Recorrente",
  lead_perdido:           "Perdidos",              // LATERAL
};

const HANDOFF_PLUS = new Set([
  "lead_qualificado", "handoff",
  // v2 LEAD/CLIENTE
  "lead_em_andamento", "negociacao", "proposta_enviada", "pedido_teste",
  "cliente_em_ativacao", "cliente_ativo", "cliente_recorrente",
  // legacy (KPI lê funnel_stage CRU → conta certo mesmo antes do alias)
  "vendedor_assumiu", "diagnostico_comercial", "pedido_fechado",
]);

const QUALIFICACAO = new Set([
  "atendido_sdr", "qualificacao_inicial", "cobertura_validada",
  "produto_definido", "volume_definido",
]);

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#556677", fontFamily: theme.font.label },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: theme.font.label, marginBottom: 12 } as React.CSSProperties,
  muted:   { color: "#8899aa", fontSize: 11, fontFamily: theme.font.label } as React.CSSProperties,
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
    .or("routing_team.is.null,routing_team.neq.fora_de_rota")   // FASE A item 7: parados sem fora_de_rota
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
  // mesParam sempre tem default (mês corrente) → sempre RPC parametrizada; v_funil_marcos era dead branch.
  type Marcos = { criados: number; qualificados: number; handoff: number; assumidos: number; pedidos: number };
  const { data: _md } = await supabase.rpc("get_funil_marcos", { p_vendedor: vend, p_mes: mesParam });
  const _m = ((Array.isArray(_md) ? _md[0] : _md) ?? null) as Marcos | null;
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
  // stageCounts (aliased) — ainda alimenta "Leads Parados por Etapa" (STAGE_ORDER).
  const stageCounts: Record<string, number> = {};
  for (const l of leads) {
    const s = aliasStage(l.funnel_stage ?? "lead_novo");
    stageCounts[s] = (stageCounts[s] ?? 0) + 1;
  }

  // Cone de 4 FASES sobre funnel_stage CRU (cobre legados). rawCounts ANTES dos KPIs (recompute por fase).
  const rawCounts: Record<string, number> = {};
  for (const l of leads) { const s = l.funnel_stage ?? "lead_novo"; rawCounts[s] = (rawCounts[s] ?? 0) + 1; }
  const faseCount = (f: typeof FASES[number]) => f.stages.reduce((a, s) => a + (rawCounts[s] ?? 0), 0);
  const orfaos = Object.keys(rawCounts).filter(s => !FASE_STAGES.has(s));  // não silenciar (catcher)

  // Perdidos — saída LATERAL (fora do cone).
  const perdidos = leads.filter(l => l.funnel_stage === "lead_perdido").length;

  // KPIs recomputados sobre as fases (ajuste B): Em Qualificação = fase 0; Handoff+ = com_vendedor + cliente.
  const emQualificacao = faseCount(FASES[0]);
  const emHandoffPlus  = faseCount(FASES[2]) + faseCount(FASES[3]);
  const taxaHandoff    = total > 0 ? ((emHandoffPlus / total) * 100).toFixed(1) : null;

  // ── Cone: 4 fases · pct = FATIA do pipe ativo (ajuste A), não vs fase anterior ──
  const totalAtivos = FASES.reduce((a, f) => a + faseCount(f), 0);
  const N_FASES = FASES.length;
  const chartData: FunnelStage[] = FASES.map((f, i) => {
    const count = faseCount(f);
    const pct = totalAtivos > 0 ? Math.round((count / totalAtivos) * 100) : null;
    return { label: f.label, count, pct, fill: f.fill, funnelWidth: N_FASES - i };
  });

  // ── Leads parados por etapa (FIX-ETAPA2) — top 10 por etapa, etapas não-terminais ──
  const TERMINAIS = new Set(["cliente_em_ativacao", "cliente_ativo", "cliente_recorrente"]);
  const leadsPorEtapa: Record<string, typeof leadRows> = {};
  for (const r of leadRows) {
    const s = aliasStage(r.funnel_stage ?? "lead_novo");
    if (TERMINAIS.has(s) || s === "lead_perdido") continue;  // lateral, não "parado"
    (leadsPorEtapa[s] ??= []);
    if (leadsPorEtapa[s].length < 10) leadsPorEtapa[s].push(r);
  }
  const etapasComLeads = STAGE_ORDER.filter(s => (leadsPorEtapa[s]?.length ?? 0) > 0);

  // FASE A: bloco "Drop-off entre Etapas" removido (snapshot adjacente não é conversão — sem significado).

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Funil de Vendas
        </h1>
        <p style={S.muted}>14 etapas (Funil v2) · {total} leads · atualizado agora</p>
      </div>

      {/* P2 — filtro mês+vendedor (afeta SÓ a seção "Conversão por Marcos") */}
      <div style={{ ...S.card, padding: "12px 16px" }}>
        <DashboardFilters showMonth defaultMes={mesCorrente} />
        <p style={{ ...S.muted, fontSize: 9, marginTop: 8 }}>
          O filtro afeta apenas <span style={{ color: "#22c55e" }}>Conversão por Marcos</span> (coorte por mês/vendedor). O funil de 14 etapas e o drop-off abaixo são sempre globais (posição atual).
        </p>
      </div>

      {/* KPI row */}
      <div className="asb-grid-kpi">
        {[
          { label: "Total Leads",          value: String(total),                                   accent: "#185FA5", sub: "na base · inclui perdidos" },
          { label: "Em Qualificacao",       value: String(emQualificacao),                         accent: "#f59e0b", sub: "fase: em qualificação" },
          { label: "Handoff+",             value: String(emHandoffPlus),                           accent: "#22c55e", sub: "com vendedor + cliente" },
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
            Conversão da coorte de {mesParam}{vend ? " · vendedor" : ""}
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
                  <span style={{ width: 132, color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.label, flexShrink: 0 }}>{mk.label}</span>
                  <div style={{ flex: 1, background: "#0d1117", borderRadius: 3, height: 22, position: "relative", overflow: "hidden" }}>
                    <div style={{ width: `${pctTotal}%`, height: "100%", background: "linear-gradient(90deg, #1B2A6B, #2ea043)", borderRadius: 3, minWidth: mk.count > 0 ? 3 : 0 }} />
                    <span style={{ position: "absolute", left: 8, top: 3, color: "#fff", fontSize: 11, fontFamily: theme.font.num }}>{mk.count}</span>
                  </div>
                  <span style={{ width: 42, textAlign: "right", color: "#8899aa", fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{pctTotal}%</span>
                  {/* item 4: drop-off = % que NÃO avançou da etapa anterior; cor semântica (tokens existentes) */}
                  {(() => {
                    if (pctPrev == null) return <span style={{ width: 96, textAlign: "right", color: "#556677", fontSize: 10, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>—</span>;
                    const drop = Math.max(0, 100 - pctPrev);
                    const c = drop >= 50 ? "#C8102E" : drop >= 25 ? "#D4A017" : "#556677";
                    return <span style={{ width: 96, textAlign: "right", color: c, fontSize: 10, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>−{drop}% caiu</span>;
                  })()}
                </Link>
              );
            })}
          </div>
          <p style={{ color: "#556677", fontSize: 9, fontFamily: theme.font.label, marginTop: 10, lineHeight: 1.5 }}>
            Base: created_at → qual_stage≥7 → handoff_at → seller_first_reply_at → first_order_at (campos com timestamp confiável, asb-funnel §7). Cumulativo. Difere do funil de 14 etapas abaixo (posição ATUAL; legacy colapsado p/ v2 — DEBT-157).
          </p>
        </div>
      )}

      {/* Funnel chart */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#C8102E", marginRight: 6 }}>{"▼"}</span>
          Onde estão os leads agora <span style={{ color: "#556677", textTransform: "none", letterSpacing: 0 }}>· % = fatia do pipe ativo ({totalAtivos})</span>
        </p>
        {orfaos.length > 0 && (
          <p style={{ ...S.muted, color: "#D4A017", fontSize: 10, marginBottom: 8 }}>
            ⚠ {orfaos.length} funnel_stage órfão (fora das fases): {orfaos.join(", ")}
          </p>
        )}
        <div style={{ height: 460 }}>
          <FunnelVisual data={chartData} />
        </div>
      </div>

      {/* Perdidos — saída LATERAL (fora do cone). Destaque: maior balde da base. */}
      {perdidos > 0 && (
        <div style={{ ...S.card, padding: "20px 24px", borderTop: "2px solid #C8102E" }}>
          <p style={S.section}>
            <span style={{ color: "#C8102E", marginRight: 6 }}>{"✕"}</span>
            Perdidos · saída lateral
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <span style={{ ...S.value, color: "#C8102E" }}>{perdidos}</span>
            <span style={S.muted}>
              {total > 0 ? `${((perdidos / total) * 100).toFixed(1)}% da base` : ""} · não faz parte do cone — lead pode sair de qualquer etapa (lead_perdido)
            </span>
          </div>
        </div>
      )}

      {/* Leads parados por etapa (FIX-ETAPA2) — clicáveis */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#185FA5", marginRight: 6 }}>{"◉"}</span>
          Leads Parados por Etapa <span style={{ color: "#556677", textTransform: "none", letterSpacing: 0 }}>· tempo = dias na BASE (created_at), não na etapa</span>
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
                        <span style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.label, minWidth: 160 }}>{nome}</span>
                        <span style={{ color: "#556677", fontSize: 10, fontFamily: theme.font.label }}>{r.city ?? "—"}</span>
                        <span style={{ marginLeft: "auto", color: dias >= 7 ? "#C8102E" : dias >= 3 ? "#f59e0b" : "#8899aa", fontSize: 10, fontWeight: 700, fontFamily: theme.font.label }}>{dias}d na base</span>
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
                  <span style={{ color: "#556677", fontSize: 10, fontFamily: theme.font.label, minWidth: 80 }}>
                    {dia} {hora}
                  </span>
                  {lead?.phone ? (
                    <Link href={`/dashboard/leads/${encodeURIComponent(lead.phone)}`} style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.label, minWidth: 100, textDecoration: "none" }}>
                      {nome}
                    </Link>
                  ) : (
                    <span style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.label, minWidth: 100 }}>
                      {nome}
                    </span>
                  )}
                  <span style={{ color: "#8899aa", fontSize: 10, fontFamily: theme.font.label }}>
                    {e.from_stage ? `${STAGE_LABELS[e.from_stage] ?? e.from_stage} → ` : ""}{STAGE_LABELS[e.to_stage] ?? e.to_stage}
                  </span>
                  <span style={{
                    marginLeft: "auto",
                    fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".08em",
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
