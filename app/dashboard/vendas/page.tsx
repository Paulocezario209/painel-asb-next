import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth/get-user-role";

export const dynamic = "force-dynamic";

// ── Design tokens — ASB brand ───────────────────────────────────────────────
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

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

const DIA_SEMANA_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

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

  // Vendedor ve apenas seus dados
  if (ctx.isVendedor && ctx.routing_team) {
    queryDia = queryDia.eq("vendedor_routing_team", ctx.routing_team);
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

  // Global totals
  const totalRealizado = vendorTeams.reduce((s, rt) => s + (agg[rt]?.realizado ?? 0), 0);
  const totalFaturado = vendorTeams.reduce((s, rt) => s + (agg[rt]?.faturado ?? 0), 0);
  const totalPedidos = vendorTeams.reduce((s, rt) => s + (agg[rt]?.pedidos ?? 0), 0);
  const totalClientes = vendorTeams.reduce((s, rt) => s + (agg[rt]?.clientes ?? 0), 0);
  const totalMeta = vendorTeams.reduce((s, rt) => s + (agg[rt]?.meta ?? 0), 0);
  const pctMeta = totalMeta > 0 ? ((totalRealizado / totalMeta) * 100).toFixed(0) : null;

  // ── All days sorted for detail table ──────────────────────────────────────
  const allDias = [...dias].sort((a, b) => b.dia.localeCompare(a.dia));

  return (
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

      {/* KPI cards */}
      <div className="asb-grid-kpi">
        {[
          { label: "Realizado", value: fmtBRL(totalRealizado), accent: "#C8102E" },
          { label: "Faturado", value: fmtBRL(totalFaturado), accent: "#22c55e" },
          { label: "Pedidos", value: String(totalPedidos), accent: "#1B2A6B" },
          { label: pctMeta ? `Meta (${pctMeta}%)` : "Meta", value: totalMeta > 0 ? fmtBRL(totalMeta) : "\u2014", accent: "#f59e0b" },
        ].map(({ label, value, accent }) => (
          <div key={label} style={{ ...S.card, padding: "20px", borderTop: `2px solid ${accent}` }}>
            <p style={{ ...S.label, color: accent }}>{label}</p>
            <p style={{ ...S.value, marginTop: 12 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Barra de progresso meta */}
      {totalMeta > 0 && (
        <div style={{ ...S.card, padding: "16px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={S.label}>progresso da meta mensal</p>
            <p style={{ ...S.label, color: Number(pctMeta) >= 100 ? "#22c55e" : Number(pctMeta) >= 70 ? "#f59e0b" : "#C8102E" }}>
              {pctMeta}%
            </p>
          </div>
          <div style={{ height: 6, background: "#1B2A6B", borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              width: `${Math.min(Number(pctMeta), 100)}%`,
              height: "100%",
              background: Number(pctMeta) >= 100 ? "#22c55e" : Number(pctMeta) >= 70 ? "#f59e0b" : "#C8102E",
              borderRadius: 3,
              transition: "width .3s ease",
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <p style={{ ...S.muted, fontSize: 10 }}>{fmtBRL(totalRealizado)}</p>
            <p style={{ ...S.muted, fontSize: 10 }}>{fmtBRL(totalMeta)}</p>
          </div>
        </div>
      )}

      {/* Cards por vendedor */}
      <div className="asb-grid-kpi">
        {vendorTeams.map(rt => {
          const v = VENDOR_LABELS[rt];
          const a = agg[rt];
          if (!v || !a) return null;
          const pct = a.meta && a.meta > 0 ? ((a.realizado / a.meta) * 100).toFixed(0) : null;
          const accent = rt === "SETOR_CUIT" ? "#1B2A6B" : rt === "SETOR_CAMPINAS_JUNDIAI" ? "#22c55e" : "#C8102E";

          return (
            <div key={rt} style={{ ...S.card, padding: "20px", borderTop: `2px solid ${accent}` }}>
              <p style={{ ...S.label, color: accent }}>{v.name}</p>
              <p style={{ ...S.muted, fontSize: 9, marginTop: 2 }}>{v.region}</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px", marginTop: 16 }}>
                <div>
                  <p style={S.label}>Realizado</p>
                  <p style={{ ...S.value, fontSize: 20, marginTop: 4 }}>{fmtBRL(a.realizado)}</p>
                </div>
                <div>
                  <p style={S.label}>Faturado</p>
                  <p style={{ ...S.value, fontSize: 20, marginTop: 4, color: a.faturado > 0 ? "#22c55e" : "#FFFFFF" }}>{fmtBRL(a.faturado)}</p>
                </div>
                <div>
                  <p style={S.label}>Pedidos</p>
                  <p style={{ ...S.value, fontSize: 20, marginTop: 4 }}>{a.pedidos}</p>
                </div>
                <div>
                  <p style={S.label}>Clientes</p>
                  <p style={{ ...S.value, fontSize: 20, marginTop: 4 }}>{a.clientes}</p>
                </div>
                {pct && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p style={S.label}>Meta</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
                      <div style={{ flex: 1, height: 4, background: "#1B2A6B", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          width: `${Math.min(Number(pct), 100)}%`,
                          height: "100%",
                          background: Number(pct) >= 100 ? "#22c55e" : Number(pct) >= 70 ? "#f59e0b" : "#C8102E",
                          borderRadius: 2,
                        }} />
                      </div>
                      <span style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", fontWeight: 700, minWidth: 36, textAlign: "right" }}>{pct}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela diaria */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#1B2A6B", marginRight: 6 }}>{"\u25A0"}</span>
          Detalhamento Diario — {mesAtual}
        </p>
        {allDias.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
              <thead>
                <tr>
                  {["Dia", "Vendedor", "Realizado", "Faturado", "Pedidos", "Cancel.", "Clientes", "Status"].map(h => (
                    <th key={h} style={{ ...S.label, textAlign: h === "Dia" || h === "Vendedor" || h === "Status" ? "left" : "right", paddingBottom: 8, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allDias.map((d, i) => {
                  const vLabel = VENDOR_LABELS[d.vendedor_routing_team];
                  return (
                    <tr key={`${d.dia}-${d.vendedor_routing_team}-${i}`} style={{ borderTop: "1px solid rgba(27,42,107,.3)" }}>
                      <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", padding: "7px 0", whiteSpace: "nowrap" }}>
                        {fmtDate(d.dia)} <span style={{ color: "#556677" }}>{DIA_SEMANA_LABEL[d.dia_semana] ?? ""}</span>
                      </td>
                      <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", padding: "7px 8px" }}>
                        {vLabel?.name ?? d.vendedor_routing_team}
                      </td>
                      <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>
                        {fmtBRL(d.realizado_parcial_brl)}
                      </td>
                      <td style={{ color: d.valor_faturado_brl > 0 ? "#22c55e" : "#556677", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>
                        {fmtBRL(d.valor_faturado_brl)}
                      </td>
                      <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>
                        {d.pedidos_count}
                      </td>
                      <td style={{ color: d.pedidos_cancelados_count > 0 ? "#C8102E" : "#556677", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>
                        {d.pedidos_cancelados_count}
                      </td>
                      <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>
                        {d.clientes_count}
                      </td>
                      <td style={{ padding: "7px 0" }}>
                        <span style={{
                          fontSize: 9, fontFamily: "'Courier New', monospace", letterSpacing: ".08em",
                          padding: "2px 6px", borderRadius: 2,
                          color: d.dia_fechado ? "#22c55e" : "#f59e0b",
                          border: `1px solid ${d.dia_fechado ? "rgba(34,197,94,.3)" : "rgba(245,158,11,.3)"}`,
                          background: d.dia_fechado ? "rgba(34,197,94,.06)" : "rgba(245,158,11,.06)",
                        }}>
                          {d.dia_fechado ? "FECHADO" : "ABERTO"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={S.muted}>Nenhum pedido registrado em {mesAtual}</p>
        )}
      </div>

      {/* Tabela consolidada */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>
          <span style={{ color: "#1B2A6B", marginRight: 6 }}>{"\u25A0"}</span>
          Consolidado por Vendedor — {mesAtual}
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Vendedor", "Realizado", "Faturado", "Pedidos", "Cancel.", "Clientes", "Meta", "% Meta"].map(h => (
                <th key={h} style={{ ...S.label, textAlign: h === "Vendedor" ? "left" : "right", paddingBottom: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vendorTeams.map(rt => {
              const v = VENDOR_LABELS[rt];
              const a = agg[rt];
              if (!v || !a) return null;
              const pct = a.meta && a.meta > 0 ? `${((a.realizado / a.meta) * 100).toFixed(0)}%` : "\u2014";
              return (
                <tr key={rt} style={{ borderTop: "1px solid rgba(27,42,107,.3)" }}>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", padding: "7px 0" }}>{v.name}</td>
                  <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{fmtBRL(a.realizado)}</td>
                  <td style={{ color: a.faturado > 0 ? "#22c55e" : "#556677", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{fmtBRL(a.faturado)}</td>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{a.pedidos}</td>
                  <td style={{ color: a.cancelados > 0 ? "#C8102E" : "#556677", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{a.cancelados}</td>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{a.clientes}</td>
                  <td style={{ color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{a.meta ? fmtBRL(a.meta) : "\u2014"}</td>
                  <td style={{
                    color: pct !== "\u2014" ? (Number(pct.replace("%", "")) >= 100 ? "#22c55e" : Number(pct.replace("%", "")) >= 70 ? "#f59e0b" : "#C8102E") : "#556677",
                    fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700,
                  }}>{pct}</td>
                </tr>
              );
            })}
            {/* Total row */}
            <tr style={{ borderTop: "2px solid #1B2A6B" }}>
              <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "'Courier New', monospace", padding: "7px 0", fontWeight: 700 }}>TOTAL</td>
              <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{fmtBRL(totalRealizado)}</td>
              <td style={{ color: totalFaturado > 0 ? "#22c55e" : "#556677", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{fmtBRL(totalFaturado)}</td>
              <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{totalPedidos}</td>
              <td style={{ color: "#556677", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>&mdash;</td>
              <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{totalClientes}</td>
              <td style={{ color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0" }}>{totalMeta > 0 ? fmtBRL(totalMeta) : "\u2014"}</td>
              <td style={{
                color: pctMeta ? (Number(pctMeta) >= 100 ? "#22c55e" : Number(pctMeta) >= 70 ? "#f59e0b" : "#C8102E") : "#556677",
                fontSize: 11, fontFamily: "'Courier New', monospace", textAlign: "right", padding: "7px 0", fontWeight: 700,
              }}>{pctMeta ? `${pctMeta}%` : "\u2014"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
