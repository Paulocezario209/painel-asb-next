import { createClient } from "@/lib/supabase/server";
import { theme } from "@/lib/theme";
import { createClient as createServiceClient } from "@supabase/supabase-js";
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
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#e4e9f0", fontFamily: theme.font.label },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: theme.font.label, marginBottom: 12 } as React.CSSProperties,
  muted:   { color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label } as React.CSSProperties,
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
  // 069c: instância SSR sem getUser() não hidrata a sessão dos cookies → não anexa o
  // access token → reads RLS (tabela `metas`) saem como anon (auth.uid() null) → 0 linhas.
  await supabase.auth.getUser();

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

  // (Query C / faturamento_tipo_dia NF+Recibo removida do headline do /vendas: o KPI passou a
  //  decompor o §5 em ASB+CNB — sem o NF+Recibo divergente. O fiscal NF+Recibo segue no /gerente.)

  // ── Aggregate per vendor ──────────────────────────────────────────────────
  type VendorAgg = {
    realizado: number;
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
    agg[rt] = { realizado: 0, pedidos: 0, cancelados: 0, faturados: 0, clientes: 0, meta: null, dias: [] };
    const meta = metas.find(m => m.vendedor_routing_team === rt);
    if (meta) agg[rt].meta = meta.meta_valor_brl;
  }

  for (const d of dias) {
    const rt = d.vendedor_routing_team;
    if (!agg[rt]) continue;
    const a = agg[rt];
    a.realizado += d.realizado_parcial_brl ?? 0;
    a.pedidos += d.pedidos_count ?? 0;
    a.cancelados += d.pedidos_cancelados_count ?? 0;
    a.faturados += d.pedidos_faturados_count ?? 0;
    a.clientes += d.clientes_count ?? 0;
    a.dias.push(d);
  }

  // ── REALIZADO (CICLO) por vendedor (v_emissao_ciclo_vendedor v2 — REGRA_METAS v1.2, §2) ──
  // ATRIBUIÇÃO POR DIA DE FATURAMENTO (§2 vence §3): a view soma só os pedidos ≠cancelado cuja
  // META = proxima_data_meta (dia que o card exibe). Meta = dia_fat (previsao_entrega−1 útil;
  // §9 sáb→sex) com fold: meta não-terminal (seg/ter) = só o próprio dia; meta terminal da semana
  // (Ana/CUIT qui combina QUI+SEX; Alan sex) = tudo até sexta. NÃO é mais o lump da janela —
  // entrega futura cai na meta do SEU dia, fora do card de hoje. Eixo segue emissão (lançado
  // ≠cancelado, inclui pendente; CNB fora). realizadoMes (Acumulado/Saldo mês) = MÊS CORRENTE via agg.
  // Leitura via SERVICE ROLE (server-side) — MESMA regra/leitura pros 3 setores, sem ramo
  // por vendedor. A view é security_invoker: a RLS de pedidos_espelho zera o ciclo do PRÓPRIO
  // setor do gestor (CUIT do Paulo) na sessão autenticada — assimetria DEBT-069c (igual ao
  // que v_resumo/painel já contornam por serem DEFINER). Service role bypassa só a leitura;
  // o escopo do vendedor restrito segue garantido pelo .eq abaixo. Fallback p/ a sessão.
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cicloClient = srk
    ? createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srk)
    : supabase;
  let cicloQuery = cicloClient
    .from("v_emissao_ciclo_vendedor")
    .select("vendedor_routing_team, window_start, emissao_ciclo_brl, qtd_lancamentos");
  if (isVendedorRestrito) cicloQuery = cicloQuery.eq("vendedor_routing_team", ctx.routing_team!);
  const { data: rawCiclo } = await cicloQuery;
  type CicloRow = { vendedor_routing_team: string; window_start: string; emissao_ciclo_brl: number; qtd_lancamentos: number };
  const emissaoByVendor: Record<string, { realizadoMes: number; realizadoCiclo: number; qtdCiclo: number; windowStart: string }> = {};
  for (const c of (rawCiclo ?? []) as unknown as CicloRow[]) {
    emissaoByVendor[c.vendedor_routing_team] = {
      realizadoMes: agg[c.vendedor_routing_team]?.realizado ?? 0,
      realizadoCiclo: Number(c.emissao_ciclo_brl ?? 0),
      qtdCiclo: Number(c.qtd_lancamentos ?? 0),
      windowStart: c.window_start,
    };
  }
  // PRÉVIA (topo) = Σ dos REALIZADO (CICLO) dos 3 cards (bate com os cards, mesma fonte)
  const totalCiclo = VENDOR_ORDER.reduce((s, rt) => s + (emissaoByVendor[rt]?.realizadoCiclo ?? 0), 0);

  // Global totals (KPIs hero)
  const totalRealizado = vendorTeams.reduce((s, rt) => s + (agg[rt]?.realizado ?? 0), 0);
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

  // ── Feature 2: parte CNB do realizado §5 por vendedor (mês corrente) ──────
  // Aditivo: v_cnb_mes_vendedor (rollup de v_cnb_dia_vendedor). O §5 (realizado_mes_brl)
  // JÁ inclui CNB; aqui só separamos a parcela p/ exibir. ares = §5 − cnb (escalar no card).
  let cnbQuery = supabase.from("v_cnb_mes_vendedor").select("vendedor_routing_team, cnb_mes_brl");
  if (isVendedorRestrito) cnbQuery = cnbQuery.eq("vendedor_routing_team", ctx.routing_team!);
  const { data: rawCnb } = await cnbQuery;
  const cnbByVendor: Record<string, number> = {};
  for (const c of (rawCnb ?? []) as unknown as { vendedor_routing_team: string; cnb_mes_brl: number }[]) {
    cnbByVendor[c.vendedor_routing_team] = Number(c.cnb_mes_brl ?? 0);
  }

  // ── DEBT-103 FASE D: realizado OFICIAL = FATURADO §5 (v_resumo, eixo data_faturamento) ──
  // totalRealizado (acima) = painel_dia_vendedor por data_emissao → vira PRÉVIA rotulada.
  const realizadoFatOficial = (rawRes ?? []).reduce(
    (s, r) => s + Number((r as { realizado_mes_brl: number | null }).realizado_mes_brl ?? 0), 0,
  );
  const pctFat = totalMeta > 0 ? (realizadoFatOficial / totalMeta) * 100 : null;
  const pctFatStr = pctFat !== null ? pctFat.toFixed(1) : null;
  // Decomposição do §5 p/ os KPIs (corretude: ASB + CNB === TOTAL, sem discrepância):
  //   TOTAL FATURADO = realizadoFatOficial (§5 = ARES faturamento + CNB)
  //   FATURADO CNB   = Σ cnbByVendor (parte CNB do §5, mês corrente)
  //   FATURADO ASB   = §5 − CNB (parte ARES do próprio §5 — NÃO faturamento_tipo_dia, p/ a soma fechar)
  const totalCnb = Object.values(cnbByVendor).reduce((s, v) => s + Number(v ?? 0), 0);
  const faturadoAsb = realizadoFatOficial - totalCnb;

  return (
    <VendasPrivacyShell>
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Vendas
        </h1>
        <p style={S.muted}>
          Faturamento {mesAtual} &middot; realizado OFICIAL = faturado NF+Recibo por dia de faturamento (§5) &middot; prévia por emissão (tempo real)
        </p>
      </div>

      {/* KPI cards topo (5: Meta · Faturado ASB · Faturado CNB · Total §5 · % Atingido) */}
      <div className="asb-grid-kpi-5">
        {[
          { label: "Meta Total", value: totalMeta > 0 ? <span className="priv-brl">{fmtBRL(totalMeta)}</span> : "\u2014", accent: "#f59e0b", sub: undefined as string | undefined },
          { label: "Faturado ASB", value: <span className="priv-brl">{fmtBRL(faturadoAsb)}</span>, accent: "#22c55e", sub: "ARES \u00b7 por dia de faturamento" },
          { label: "Faturado CNB", value: <span className="priv-brl">{fmtBRL(totalCnb)}</span>, accent: "#185FA5", sub: "Carnes Nobres Boutique (m\u00eas)" },
          { label: "Total Faturado (\u00a75)", value: <span className="priv-brl">{fmtBRL(realizadoFatOficial)}</span>, accent: "#C8102E", sub: `ASB + CNB \u00b7 pr\u00e9via ciclo ${fmtBRL(totalCiclo)}` },
          { label: "% Atingido", value: pctFatStr ? <span className="priv-pct">{`${pctFatStr}%`}</span> : "\u2014", accent: pctFat !== null ? (pctFat >= 100 ? "#22c55e" : pctFat >= 50 ? "#f59e0b" : "#C8102E") : "#e4e9f0", sub: undefined },
        ].map(({ label, value, accent, sub }) => (
          <div key={label} style={{ ...S.card, padding: "20px", borderTop: `2px solid ${accent}` }}>
            <p style={{ ...S.label, color: accent }}>{label}</p>
            <p style={{ ...S.value, marginTop: 12 }}>{value}</p>
            {sub && <p style={{ ...S.muted, fontSize: 9, marginTop: 6 }}>{sub}</p>}
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
        emissaoByVendor={emissaoByVendor}
        cnbByVendor={cnbByVendor}
        restrictedToVendor={isVendedorRestrito ? ctx.routing_team! : null}
        estrategias={estrategiasData}
      />

    </div>
    </VendasPrivacyShell>
  );
}
