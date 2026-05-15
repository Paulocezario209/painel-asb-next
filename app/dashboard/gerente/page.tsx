import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth/get-user-role";
import { businessDaysInMonth, businessDaysElapsed, dateAfterNBusinessDays } from "@/lib/utils/business-days";

export const dynamic = "force-dynamic";

// ── Design tokens ───────────────────────────────────────────────────────────
const S = {
  card:    { background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 4 } as React.CSSProperties,
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
interface DiaVendedor {
  vendedor_routing_team: string;
  realizado_parcial_brl: number;
  valor_faturado_brl: number;
  pedidos_count: number;
  clientes_count: number;
}

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

  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "gestor") redirect("/dashboard");

  // ── Data boundaries ───────────────────────────────────────────────────────
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const mesAtual = `${year}-${String(month).padStart(2, "0")}`;
  const primeiroDiaMes = `${mesAtual}-01`;
  const ultimoDiaMes = new Date(year, month, 0).toISOString().slice(0, 10);

  // ── Queries paralelas ─────────────────────────────────────────────────────
  const [{ data: rawDia }, { data: rawMetas }] = await Promise.all([
    supabase
      .from("painel_dia_vendedor")
      .select("vendedor_routing_team, realizado_parcial_brl, valor_faturado_brl, pedidos_count, clientes_count")
      .gte("dia", primeiroDiaMes)
      .lte("dia", ultimoDiaMes),
    supabase
      .from("metas")
      .select("vendedor_routing_team, meta_valor_brl")
      .eq("granularidade", "mensal")
      .eq("ativo", true)
      .eq("data_inicio", primeiroDiaMes),
  ]);

  const dias = (rawDia ?? []) as unknown as DiaVendedor[];
  const metas = (rawMetas ?? []) as unknown as Meta[];

  // ── Aggregate per vendor ──────────────────────────────────────────────────
  type VendorAgg = { realizado: number; faturado: number; pedidos: number; clientes: number; meta: number };

  const agg: Record<string, VendorAgg> = {};
  for (const rt of VENDOR_ORDER) {
    const meta = metas.find(m => m.vendedor_routing_team === rt);
    agg[rt] = { realizado: 0, faturado: 0, pedidos: 0, clientes: 0, meta: meta?.meta_valor_brl ?? 0 };
  }

  for (const d of dias) {
    const a = agg[d.vendedor_routing_team];
    if (!a) continue;
    a.realizado += d.realizado_parcial_brl ?? 0;
    a.faturado += d.valor_faturado_brl ?? 0;
    a.pedidos += d.pedidos_count ?? 0;
    a.clientes += d.clientes_count ?? 0;
  }

  // ── B1 Ranking (pior em cima) ─────────────────────────────────────────────
  const ranking = VENDOR_ORDER.map(rt => {
    const a = agg[rt];
    const v = VENDOR_LABELS[rt];
    const pct = a.meta > 0 ? (a.realizado / a.meta) * 100 : 0;
    const faltante = Math.max(0, a.meta - a.realizado);
    return { rt, name: v?.name ?? rt, region: v?.region ?? "", ...a, pct, faltante };
  }).sort((a, b) => a.pct - b.pct);

  // ── B2 Comparativo mes anterior ────────────────────────────────────────────
  const diasDecorridos = await businessDaysElapsed(year, month, now);
  const mesAnterior = month === 1 ? 12 : month - 1;
  const anoMesAnterior = month === 1 ? year - 1 : year;
  const limiteAnteriorISO = await dateAfterNBusinessDays(anoMesAnterior, mesAnterior, diasDecorridos);
  const primeiroMesAnterior = `${anoMesAnterior}-${String(mesAnterior).padStart(2, "0")}-01`;

  const { data: rawComp } = await supabase
    .from("painel_dia_vendedor")
    .select("vendedor_routing_team, realizado_parcial_brl")
    .gte("dia", primeiroMesAnterior)
    .lte("dia", limiteAnteriorISO);

  const aggAnterior: Record<string, number> = {};
  for (const r of (rawComp ?? []) as unknown as { vendedor_routing_team: string; realizado_parcial_brl: number }[]) {
    aggAnterior[r.vendedor_routing_team] = (aggAnterior[r.vendedor_routing_team] ?? 0) + (r.realizado_parcial_brl ?? 0);
  }

  const totalRealizado = VENDOR_ORDER.reduce((s, rt) => s + agg[rt].realizado, 0);
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

  // ── B6 Projecao ───────────────────────────────────────────────────────────
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

      {/* ── B1 PRIORIDADES DO DIA (ranking pior em cima) ──────────────────── */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#C8102E", marginRight: 6 }}>{"\u25B2"}</span>
          Prioridades do Dia
        </p>
        <p style={{ ...S.muted, fontSize: 9, marginBottom: 16 }}>
          Ordenado por % atingido (pior em cima)
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
                background: i === 0 ? `${barColor}08` : "#0f1428",
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
                <div style={{ height: 6, background: "#1B2A6B", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{
                    width: `${Math.min(v.pct, 100)}%`,
                    height: "100%",
                    background: barColor,
                    borderRadius: 3,
                    transition: "width .3s ease",
                  }} />
                </div>

                {/* Bottom row: realizado / meta / faltante */}
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
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── B2 COMPARATIVO MES ANTERIOR ──────────────────────────────────── */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#1B2A6B", marginRight: 6 }}>{"\u25C6"}</span>
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
            { label: "Dias Decorridos", value: `${diasDecorridos}/${totalDiasUteis}`, accent: "#1B2A6B" },
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
            <tr style={{ borderTop: "2px solid #1B2A6B" }}>
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
