import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth/get-user-role";
import { businessDaysInMonth, businessDaysElapsed, dateAfterNBusinessDays } from "@/lib/utils/business-days";

export const dynamic = "force-dynamic";

// ── Design tokens ───────────────────────────────────────────────────────────
const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#556677", fontFamily: "'Courier New', monospace" },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: "'Courier New', monospace", marginBottom: 12 } as React.CSSProperties,
  muted:   { color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
};

const VENDOR_LABELS: Record<string, { name: string; region: string }> = {
  SETOR_SOROCABA_SAO_PAULO: { name: "Ana Paula", region: "Sorocaba / Grande SP" },
  SETOR_CAMPINAS_JUNDIAI:   { name: "Alan", region: "Campinas / Jundiai" },
  SETOR_CUIT:               { name: "Paulo Cezario", region: "CUIT — key accounts" },
};

const VENDOR_ORDER = ["SETOR_SOROCABA_SAO_PAULO", "SETOR_CAMPINAS_JUNDIAI", "SETOR_CUIT"];

const VENDOR_ACCENT: Record<string, string> = {
  SETOR_SOROCABA_SAO_PAULO: "#C8102E",
  SETOR_CAMPINAS_JUNDIAI: "#22c55e",
  SETOR_CUIT: "#ff7b1c",
};

// ── Interfaces ──────────────────────────────────────────────────────────────
interface Meta {
  vendedor_routing_team: string;
  meta_valor_brl: number;
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pctColor(pct: number): string {
  if (pct >= 100) return "#22c55e";
  if (pct >= 50) return "#f59e0b";
  return "#C8102E";
}

function projColor(pct: number): string {
  if (pct >= 100) return "#22c55e";
  if (pct >= 80) return "#f59e0b";
  return "#C8102E";
}

export default async function GerentePage() {
  const supabase = await createClient();
  // 069c: instância SSR sem getUser() não hidrata a sessão dos cookies → não anexa o
  // access token → reads RLS (tabela `metas`) saem como anon (auth.uid() null) → 0 linhas.
  await supabase.auth.getUser();

  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "gestor") redirect("/dashboard");

  // ── Data boundaries ───────────────────────────────────────────────────────
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const mesAtual = `${year}-${String(month).padStart(2, "0")}`;
  const primeiroDiaMes = `${mesAtual}-01`;
  const ultimoDiaMes = new Date(year, month, 0).toISOString().slice(0, 10);

  // ── Boundaries mês anterior (comparativo) ─────────────────────────────────
  const diasDecorridos = await businessDaysElapsed(year, month, now);
  const mesAnterior = month === 1 ? 12 : month - 1;
  const anoMesAnterior = month === 1 ? year - 1 : year;
  const limiteAnteriorISO = await dateAfterNBusinessDays(anoMesAnterior, mesAnterior, diasDecorridos);
  const primeiroMesAnterior = `${anoMesAnterior}-${String(mesAnterior).padStart(2, "0")}-01`;

  // ── Queries paralelas ─────────────────────────────────────────────────────
  // OFICIAL = eixo de FATURAMENTO §5 (v_resumo_mes_vendedor pós DEBT-103 FASE C; MESMA fonte do /vendas;
  //   realizado por faturamento real NF+Recibo — DEBT-103 FASE C aplicada).
  // EMISSÃO (painel_dia_vendedor / data_emissao, 088c) = PRÉVIA em tempo real, NÃO-oficial.
  const [{ data: rawResumo }, { data: rawMetas }, { data: rawFat }, { data: rawEmissao }, { data: rawComp }] = await Promise.all([
    supabase
      .from("v_resumo_mes_vendedor")
      .select("vendedor_routing_team, realizado_mes_brl, meta_total_mes_brl, pct_atingido_mes"),
    supabase
      .from("metas")
      .select("vendedor_routing_team, meta_valor_brl")
      .eq("granularidade", "mensal").eq("ativo", true).eq("data_inicio", primeiroDiaMes),
    // Faturado real (NF+Recibo) MTD — MESMA fonte/recorte do /dashboard/vendas (paridade DEBT-088)
    supabase
      .from("faturamento_tipo_dia")
      .select("valor_brl").gte("dia", primeiroDiaMes).lte("dia", ultimoDiaMes),
    // EMISSÃO (prévia tempo real — data_emissao)
    supabase
      .from("painel_dia_vendedor")
      .select("vendedor_routing_team, realizado_parcial_brl").gte("dia", primeiroDiaMes).lte("dia", ultimoDiaMes),
    // COMPARATIVO mês anterior — eixo ENTREGA (mesmo do oficial)
    supabase
      .from("v_faturado_diario")
      .select("vendedor_routing_team, realizado_parcial_brl").gte("dia", primeiroMesAnterior).lte("dia", limiteAnteriorISO),
  ]);

  const resumo = (rawResumo ?? []) as unknown as { vendedor_routing_team: string; realizado_mes_brl: number; meta_total_mes_brl: number; pct_atingido_mes: number | null }[];
  const metas = (rawMetas ?? []) as unknown as Meta[];
  // Faturado total real do mês (NF+Recibo) — idêntico ao totalFaturadoReal do /vendas (NÃO tocar)
  const totalFaturadoReal = (rawFat ?? []).reduce(
    (s, r) => s + (Number((r as { valor_brl: number | null }).valor_brl) || 0), 0,
  );
  // DEBT-103 FASE D: realizado OFICIAL por vendedor = FATURADO §5 (v_resumo já está no eixo faturamento pós-FASE C).
  // Linha "não-atribuído" = card total − Σ faturado por vendedor. AO VIVO (encolhe c/ cobertura).
  const somaFatVendedores = resumo.reduce((s, r) => s + Number(r.realizado_mes_brl ?? 0), 0);
  const naoAtribuido = Math.max(0, totalFaturadoReal - somaFatVendedores);

  // ── Aggregate per vendor (realizado OFICIAL = faturamento §5; emissao = prévia) ───
  type VendorAgg = { realizado: number; emissao: number; meta: number };
  const agg: Record<string, VendorAgg> = {};
  for (const rt of VENDOR_ORDER) {
    const r = resumo.find(x => x.vendedor_routing_team === rt);
    const m = metas.find(x => x.vendedor_routing_team === rt);
    agg[rt] = {
      realizado: Number(r?.realizado_mes_brl ?? 0),            // FATURAMENTO §5 (oficial, = /vendas)
      emissao: 0,                                              // EMISSÃO (prévia tempo real)
      meta: m?.meta_valor_brl ?? Number(r?.meta_total_mes_brl ?? 0),
    };
  }
  for (const r of (rawEmissao ?? []) as unknown as { vendedor_routing_team: string; realizado_parcial_brl: number }[]) {
    const a = agg[r.vendedor_routing_team];
    if (a) a.emissao += Number(r.realizado_parcial_brl ?? 0);
  }

  // ── B1 Ranking (pior em cima) ─────────────────────────────────────────────
  const ranking = VENDOR_ORDER.map(rt => {
    const a = agg[rt];
    const v = VENDOR_LABELS[rt];
    const pct = a.meta > 0 ? (a.realizado / a.meta) * 100 : 0;
    const faltante = Math.max(0, a.meta - a.realizado);
    return { rt, name: v?.name ?? rt, region: v?.region ?? "", ...a, pct, faltante };
  }).sort((a, b) => a.pct - b.pct);

  // ── B2 Comparativo mes anterior (eixo ENTREGA, mesmo do oficial) ──────────
  const aggAnterior: Record<string, number> = {};
  for (const r of (rawComp ?? []) as unknown as { vendedor_routing_team: string; realizado_parcial_brl: number }[]) {
    aggAnterior[r.vendedor_routing_team] = (aggAnterior[r.vendedor_routing_team] ?? 0) + (r.realizado_parcial_brl ?? 0);
  }
  const totalRealizado = VENDOR_ORDER.reduce((s, rt) => s + agg[rt].realizado, 0);
  const totalEmissao = VENDOR_ORDER.reduce((s, rt) => s + agg[rt].emissao, 0);
  const totalAnterior = VENDOR_ORDER.reduce((s, rt) => s + (aggAnterior[rt] ?? 0), 0);

  const comparativo = VENDOR_ORDER.map(rt => {
    const atual = agg[rt].realizado;
    const anterior = aggAnterior[rt] ?? 0;
    const delta = atual - anterior;
    const deltaPct = anterior > 0 ? ((atual / anterior) - 1) * 100 : null;
    return { rt, name: VENDOR_LABELS[rt]?.name ?? rt, atual, anterior, delta, deltaPct };
  });

  const totalDeltaPct = totalAnterior > 0 ? ((totalRealizado / totalAnterior) - 1) * 100 : null;

  const MESES_LABEL = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // ── B6 Projecao (eixo ENTREGA) ────────────────────────────────────────────
  const totalDiasUteis = await businessDaysInMonth(year, month);
  const totalMeta = VENDOR_ORDER.reduce((s, rt) => s + agg[rt].meta, 0);
  const projecaoTotal = diasDecorridos > 0 ? (totalRealizado / diasDecorridos) * totalDiasUteis : 0;
  const projecaoVsMeta = totalMeta > 0 ? (projecaoTotal / totalMeta) * 100 : 0;
  const deltaTotal = projecaoTotal - totalMeta;

  const projVendedores = ranking.map(v => {
    const proj = diasDecorridos > 0 ? (v.realizado / diasDecorridos) * totalDiasUteis : 0;
    const projPct = v.meta > 0 ? (proj / v.meta) * 100 : 0;
    return { ...v, proj, projPct };
  });

  // Bonus Fase 3: KPI Retention Carteira
  const { data: retention } = await supabase.from("v_retention_metrics").select("*").maybeSingle();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Gerente Comercial
        </h1>
        <p style={S.muted}>
          Visao consolidada {mesAtual} &middot; {diasDecorridos}/{totalDiasUteis} dias uteis
        </p>
      </div>

      {/* Faturado total real (NF+Recibo). Σ por vendedor (§5) + não-atribuído = total. */}
      <div style={{ ...S.card, padding: "20px 24px", borderTop: "2px solid #22c55e", maxWidth: 360 }}>
        <p style={{ ...S.label, color: "#22c55e" }}>Faturado total (NF+Recibo)</p>
        <p style={{ ...S.value, marginTop: 12 }}>{fmtBRL(totalFaturadoReal)}</p>
        <p style={{ ...S.muted, fontSize: 9, marginTop: 6 }}>
          MTD &middot; por vendedor {fmtBRL(somaFatVendedores)}
          {naoAtribuido > 0 ? ` + não-atribuído ${fmtBRL(naoAtribuido)}` : ""}
        </p>
      </div>

      {/* ── Retention Carteira (Funil v2 Fase 3 — atualizado pelo worker daily) ── */}
      {retention && (
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <p style={S.section}>
            <span style={{ color: "#22C55E", marginRight: 6 }}>{"♥"}</span>
            Retention da Carteira
          </p>
          <div className="asb-grid-kpi">
            <div style={{ ...S.card, padding: 16, borderTop: "2px solid #22C55E" }}>
              <p style={{ ...S.label, color: "#22C55E" }}>Carteira Total</p>
              <p style={{ ...S.value, marginTop: 6 }}>{retention.total_carteira ?? 0}</p>
              <p style={{ ...S.muted, fontSize: 9, marginTop: 6 }}>
                {retention.em_ativacao ?? 0} em ativação · {retention.ativos ?? 0} ativos · {retention.recorrentes ?? 0} recorrentes
              </p>
            </div>
            <div style={{ ...S.card, padding: 16, borderTop: "2px solid #185FA5" }}>
              <p style={{ ...S.label, color: "#185FA5" }}>Retention Rate</p>
              <p style={{ ...S.value, marginTop: 6 }}>{retention.retention_rate_pct ?? 0}%</p>
              <p style={{ ...S.muted, fontSize: 9, marginTop: 6 }}>% da carteira já recorrente</p>
            </div>
            <div style={{ ...S.card, padding: 16, borderTop: "2px solid #BA7517" }}>
              <p style={{ ...S.label, color: "#BA7517" }}>Activation Rate</p>
              <p style={{ ...S.value, marginTop: 6 }}>{retention.activation_rate_pct ?? 0}%</p>
              <p style={{ ...S.muted, fontSize: 9, marginTop: 6 }}>% saiu de em_ativacao</p>
            </div>
            <div style={{ ...S.card, padding: 16, borderTop: "2px solid #D4A017" }}>
              <p style={{ ...S.label, color: "#D4A017" }}>Health Rate</p>
              <p style={{ ...S.value, marginTop: 6 }}>{retention.health_rate_pct ?? 0}%</p>
              <p style={{ ...S.muted, fontSize: 9, marginTop: 6 }}>
                {retention.healthy ?? 0} healthy · {retention.at_risk ?? 0} risco · {retention.inactive ?? 0} inativos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── B1 PRIORIDADES DO DIA (ranking pior em cima) ──────────────────── */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#C8102E", marginRight: 6 }}>{"\u25B2"}</span>
          Prioridades do Dia
        </p>
        <p style={{ ...S.muted, fontSize: 9, marginBottom: 16 }}>
          Ordenado por % atingido (pior em cima) &middot; realizado/meta OFICIAL por <b style={{ color: "#8899aa" }}>faturamento</b> NF+Recibo (§5, = /vendas); &ldquo;prévia emissão&rdquo; = tempo real, não-oficial
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ranking.map((v, i) => {
            const accent = VENDOR_ACCENT[v.rt] ?? "#556677";
            const barColor = pctColor(v.pct);
            return (
              <div key={v.rt} style={{
                ...S.card,
                padding: "16px 20px",
                borderLeft: `3px solid ${accent}`,
                borderTop: i === 0 ? `1px solid ${barColor}40` : undefined,
                background: i === 0 ? `${barColor}08` : "#1a1a1a",
              }}>
                {/* Top row: nome + % */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <span style={{ color: accent, fontSize: 12, fontWeight: 700, fontFamily: "'Courier New', monospace" }}>{v.name}</span>
                    <span style={{ color: "#556677", fontSize: 9, fontFamily: "'Courier New', monospace", marginLeft: 8 }}>{v.region}</span>
                  </div>
                  <span style={{ color: barColor, fontSize: 18, fontWeight: 700, fontFamily: "'Inter', system-ui, sans-serif" }}>
                    {v.pct.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 6, background: "#2a2a2a", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{
                    width: `${Math.min(v.pct, 100)}%`,
                    height: "100%",
                    background: barColor,
                    borderRadius: 3,
                    transition: "width .3s ease",
                  }} />
                </div>

                {/* Bottom row: realizado (entrega, oficial) / meta / faltante / pr\u00e9via (emiss\u00e3o) */}
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ ...S.muted, fontSize: 10 }}>
                    Realizado <span style={{ color: "#c8d8e8", fontWeight: 700 }}>{fmtBRL(v.realizado)}</span>
                  </span>
                  <span style={{ ...S.muted, fontSize: 10 }}>
                    Meta <span style={{ color: "#c8d8e8", fontWeight: 700 }}>{v.meta > 0 ? fmtBRL(v.meta) : "\u2014"}</span>
                  </span>
                  <span style={{ ...S.muted, fontSize: 10 }}>
                    Faltante <span style={{ color: v.faltante > 0 ? "#C8102E" : "#22c55e", fontWeight: 700 }}>{fmtBRL(v.faltante)}</span>
                  </span>
                  <span style={{ ...S.muted, fontSize: 10 }} title="Pr\u00e9via em tempo real por data de emiss\u00e3o (n\u00e3o-oficial). Oficial = por entrega.">
                    Pr\u00e9via emiss\u00e3o <span style={{ color: "#6a7a8a", fontWeight: 700 }}>{fmtBRL(v.emissao)}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── B2 COMPARATIVO MES ANTERIOR ──────────────────────────────────── */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#2a2a2a", marginRight: 6 }}>{"\u25C6"}</span>
          Comparativo Mes Anterior
        </p>
        <p style={{ ...S.muted, fontSize: 9, marginBottom: 16 }}>
          {MESES_LABEL[month]} ({diasDecorridos} dias uteis) vs {MESES_LABEL[mesAnterior]} (mesmos {diasDecorridos} dias uteis)
        </p>

        <div className="asb-grid-kpi">
          {[
            { label: "Total", atual: totalRealizado, anterior: totalAnterior, deltaPct: totalDeltaPct },
            ...comparativo.map(c => ({ label: c.name, atual: c.atual, anterior: c.anterior, deltaPct: c.deltaPct })),
          ].map(({ label, atual, anterior, deltaPct }) => {
            const arrow = deltaPct === null ? "" : deltaPct > 0 ? "\u2191" : deltaPct < 0 ? "\u2193" : "\u2192";
            const color = deltaPct === null ? "#556677" : deltaPct > 5 ? "#22c55e" : deltaPct < -5 ? "#C8102E" : "#c8d8e8";
            return (
              <div key={label} style={{ ...S.card, padding: "16px", borderTop: `2px solid ${color}` }}>
                <p style={{ ...S.label, color }}>{label}</p>
                <p style={{ ...S.value, fontSize: 18, marginTop: 8 }}>{fmtBRL(atual)}</p>
                <p style={{ ...S.muted, fontSize: 10, marginTop: 6 }}>vs {fmtBRL(anterior)}</p>
                <p style={{ color, fontSize: 14, fontWeight: 700, fontFamily: "'Courier New', monospace", marginTop: 4 }}>
                  {deltaPct !== null ? `${arrow} ${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "\u2014"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── B6 PROJECAO FIM DE MES ────────────────────────────────────────── */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#f59e0b", marginRight: 6 }}>{"\u25B6"}</span>
          Projecao Fim de Mes
        </p>
        <p style={{ ...S.muted, fontSize: 9, marginBottom: 16 }}>
          Run rate: realizado / {diasDecorridos} dias decorridos &times; {totalDiasUteis} dias uteis no mes
        </p>

        {/* KPI cards */}
        <div className="asb-grid-kpi" style={{ marginBottom: 20 }}>
          {[
            { label: "Dias Decorridos", value: `${diasDecorridos}/${totalDiasUteis}`, accent: "#185FA5" },
            { label: "Projecao Total", value: fmtBRL(projecaoTotal), accent: projColor(projecaoVsMeta) },
            { label: "vs Meta", value: totalMeta > 0 ? `${projecaoVsMeta.toFixed(1)}%` : "\u2014", accent: projColor(projecaoVsMeta) },
            { label: "Delta", value: totalMeta > 0 ? `${deltaTotal >= 0 ? "+" : ""}${fmtBRL(deltaTotal)}` : "\u2014", accent: deltaTotal >= 0 ? "#22c55e" : "#C8102E" },
          ].map(({ label, value, accent }) => (
            <div key={label} style={{ ...S.card, padding: "16px", borderTop: `2px solid ${accent}` }}>
              <p style={{ ...S.label, color: accent }}>{label}</p>
              <p style={{ ...S.value, fontSize: 20, marginTop: 8 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabela por vendedor */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Vendedor", "Realizado", "Projecao", "Meta", "vs Meta"].map(h => (
                <th key={h} style={{ ...S.label, textAlign: h === "Vendedor" ? "left" : "right", paddingBottom: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projVendedores.map(v => {
              const accent = VENDOR_ACCENT[v.rt] ?? "#556677";
              return (
                <tr key={v.rt} style={{ borderTop: "1px solid rgba(27,42,107,.3)" }}>
                  <td style={{ color: accent, fontSize: 11, fontFamily: "'Courier New', monospace", padding: "7px 0", fontWeight: 700 }}>{v.name}</td>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{fmtBRL(v.realizado)}</td>
                  <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{fmtBRL(v.proj)}</td>
                  <td style={{ color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{v.meta > 0 ? fmtBRL(v.meta) : "\u2014"}</td>
                  <td style={{
                    color: projColor(v.projPct),
                    fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700,
                  }}>{v.meta > 0 ? `${v.projPct.toFixed(1)}%` : "\u2014"}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "2px solid #2a2a2a" }}>
              <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "'Courier New', monospace", padding: "7px 0", fontWeight: 700 }}>TOTAL</td>
              <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{fmtBRL(totalRealizado)}</td>
              <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{fmtBRL(projecaoTotal)}</td>
              <td style={{ color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{totalMeta > 0 ? fmtBRL(totalMeta) : "\u2014"}</td>
              <td style={{
                color: projColor(projecaoVsMeta),
                fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700,
              }}>{totalMeta > 0 ? `${projecaoVsMeta.toFixed(1)}%` : "\u2014"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
