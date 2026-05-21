import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth/get-user-role";
import { CalendarSection } from "./calendar-section";
import { VendasPrivacyShell } from "./vendas-privacy-shell";
import { AlertasComerciais } from "./alertas-comerciais";
import { RankingVendedores } from "./ranking-vendedores";
import { getAlertasComerciais, getRankingVendedores, getEstrategiasComerciais } from "./actions";

export const dynamic = "force-dynamic";

// ── Design tokens — ASB brand ───────────────────────────────────────────────
const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#556677", fontFamily: "'Courier New', monospace" },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: "'Courier New', monospace", marginBottom: 12 } as React.CSSProperties,
  muted:   { color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
};

const VENDOR_ORDER = ["SETOR_SOROCABA_SAO_PAULO", "SETOR_CAMPINAS_JUNDIAI", "SETOR_CUIT"];

// ── Interfaces ────────────────────────────────────────────────────────────────
interface DiaVendedor {
  vendedor_routing_team: string;
  dia: string;
  dia_semana: number;
  ano: number;
  mes: number;
  semana: number;
  realizado_parcial_brl: number;
  valor_faturado_brl: number;
  pedidos_count: number;
  pedidos_cancelados_count: number;
  pedidos_faturados_count: number;
  clientes_count: number;
  dia_fechado: boolean;
}

interface Meta {
  vendedor_routing_team: string;
  data_inicio: string;
  data_fim: string;
  meta_valor_brl: number;
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default async function VendasPage() {
  const supabase = await createClient();

  const ctx = await getUserContext();
  if (!ctx) redirect("/dashboard");

  // ── Data boundaries ───────────────────────────────────────────────────────
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const primeiroDiaMes = `${mesAtual}-01`;
  const ultimoDiaMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  // ── Query A: painel_dia_vendedor (mes atual) ──────────────────────────────
  let queryDia = supabase
    .from("painel_dia_vendedor")
    .select("*")
    .gte("dia", primeiroDiaMes)
    .lte("dia", ultimoDiaMes)
    .order("dia", { ascending: false });

  // Vendedor restrito ve apenas seus dados — EXCETO SETOR_CUIT (Paulo) que ve tudo
  const isVendedorRestrito = ctx.isVendedor && !!ctx.routing_team && ctx.routing_team !== "SETOR_CUIT";
  if (isVendedorRestrito) {
    queryDia = queryDia.eq("vendedor_routing_team", ctx.routing_team!);
  }

  const { data: rawDia } = await queryDia;
  const dias = (rawDia ?? []) as unknown as DiaVendedor[];

  // ── Query B: metas do mes atual ───────────────────────────────────────────
  const { data: rawMetas } = await supabase
    .from("metas")
    .select("vendedor_routing_team, data_inicio, data_fim, meta_valor_brl")
    .eq("granularidade", "mensal")
    .eq("ativo", true)
    .eq("data_inicio", primeiroDiaMes);
  const metas = (rawMetas ?? []) as unknown as Meta[];

  // ── Aggregate per vendor ──────────────────────────────────────────────────
  type VendorAgg = {
    realizado: number;
    faturado: number;
    pedidos: number;
    cancelados: number;
    faturados: number;
    clientes: number;
    meta: number | null;
    dias: DiaVendedor[];
  };

  const vendorTeams = ctx.isVendedor && ctx.routing_team
    ? [ctx.routing_team]
    : VENDOR_ORDER;

  const agg: Record<string, VendorAgg> = {};
  for (const rt of vendorTeams) {
    agg[rt] = { realizado: 0, faturado: 0, pedidos: 0, cancelados: 0, faturados: 0, clientes: 0, meta: null, dias: [] };
    const meta = metas.find(m => m.vendedor_routing_team === rt);
    if (meta) agg[rt].meta = meta.meta_valor_brl;
  }

  for (const d of dias) {
    const rt = d.vendedor_routing_team;
    if (!agg[rt]) continue;
    const a = agg[rt];
    a.realizado += d.realizado_parcial_brl ?? 0;
    a.faturado += d.valor_faturado_brl ?? 0;
    a.pedidos += d.pedidos_count ?? 0;
    a.cancelados += d.pedidos_cancelados_count ?? 0;
    a.faturados += d.pedidos_faturados_count ?? 0;
    a.clientes += d.clientes_count ?? 0;
    a.dias.push(d);
  }

  // Global totals (KPIs hero)
  const totalRealizado = vendorTeams.reduce((s, rt) => s + (agg[rt]?.realizado ?? 0), 0);
  const totalFaturado = vendorTeams.reduce((s, rt) => s + (agg[rt]?.faturado ?? 0), 0);
  const totalMeta = vendorTeams.reduce((s, rt) => s + (agg[rt]?.meta ?? 0), 0);
  const pctAtingido = totalMeta > 0 ? ((totalRealizado / totalMeta) * 100) : null;
  const pctAtingidoStr = pctAtingido !== null ? pctAtingido.toFixed(1) : null;

  // ── Alertas + Ranking (substituem detalhamento diário + consolidado) ──────
  const alertasData = isVendedorRestrito
    ? { total: 0, alertas: [], contadores: { vermelho: 0, laranja: 0, amarelo: 0 } }
    : await getAlertasComerciais();
  const rankingData = isVendedorRestrito ? [] : await getRankingVendedores();
  const estrategiasData = await getEstrategiasComerciais();

  // ── F4: calendario com meta diaria + resumo mes vendedor (views novas) ────
  let calQuery = supabase.from("v_calendario_metas").select("*");
  let resQuery = supabase.from("v_resumo_mes_vendedor").select("*");
  if (isVendedorRestrito) {
    calQuery = calQuery.eq("vendedor_routing_team", ctx.routing_team!);
    resQuery = resQuery.eq("vendedor_routing_team", ctx.routing_team!);
  }
  const { data: rawCal } = await calQuery;
  const { data: rawRes } = await resQuery;
  const calendarioData = (rawCal ?? []) as never[];
  const resumosData = (rawRes ?? []) as never[];

  return (
    <VendasPrivacyShell>
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Vendas
        </h1>
        <p style={S.muted}>
          Faturamento {mesAtual} &middot; fonte: pedidos_espelho via painel_dia_vendedor
        </p>
      </div>

      {/* KPI cards topo */}
      <div className="asb-grid-kpi">
        {[
          { label: "Meta Total", value: totalMeta > 0 ? <span className="priv-brl">{fmtBRL(totalMeta)}</span> : "\u2014", accent: "#f59e0b" },
          { label: "Realizado", value: <span className="priv-brl">{fmtBRL(totalRealizado)}</span>, accent: "#C8102E" },
          { label: "Faturado", value: <span className="priv-brl">{fmtBRL(totalFaturado)}</span>, accent: "#22c55e" },
          { label: "% Atingido", value: pctAtingidoStr ? <span className="priv-pct">{`${pctAtingidoStr}%`}</span> : "\u2014", accent: pctAtingido !== null ? (pctAtingido >= 100 ? "#22c55e" : pctAtingido >= 50 ? "#f59e0b" : "#C8102E") : "#556677" },
        ].map(({ label, value, accent }) => (
          <div key={label} style={{ ...S.card, padding: "20px", borderTop: `2px solid ${accent}` }}>
            <p style={{ ...S.label, color: accent }}>{label}</p>
            <p style={{ ...S.value, marginTop: 12 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Alertas comerciais + Ranking — escondidos pra vendedor restrito */}
      {!isVendedorRestrito && (
        <>
          <AlertasComerciais data={alertasData} />
          <RankingVendedores ranking={rankingData} />
        </>
      )}

      {/* F4: Cards individuais + calendario ✓/✗ + detalhe lateral */}
      <CalendarSection
        calendario={calendarioData}
        resumos={resumosData}
        restrictedToVendor={isVendedorRestrito ? ctx.routing_team! : null}
        estrategias={estrategiasData}
      />

    </div>
    </VendasPrivacyShell>
  );
}
