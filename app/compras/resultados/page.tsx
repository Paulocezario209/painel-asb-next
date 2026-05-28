// app/compras/resultados/page.tsx — Camada Resultados (Compras × Faturamento)
// Regra Compras MTD (CLAUDE.md): status != cancelado, data_emissao, emit 1+2074, ts_delete via espelho.
import { createClient } from "@/lib/supabase/server";
import {
  CalendarDashboard,
  type DiaCalendario,
  type CompraRow,
  type DrilldownItemRow,
  type FatTipoRow,
} from "@/app/compras/_components/calendar-dashboard";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";
const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Dias úteis ASB: SEG-SÁB (exclui só domingo — ASB opera ter-sáb, sábado conta)
function bizDays(from: Date, to: Date): number {
  let n = 0;
  const d = new Date(from);
  while (d <= to) {
    if (d.getDay() !== 0) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}
function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function semaforo(pct: number): { cor: string; label: string } {
  if (pct <= 54) return { cor: "#2ea043", label: "OK" };
  if (pct <= 65) return { cor: "#d29922", label: "ALERTA" };
  return { cor: "#f85149", label: "CRÍTICO" };
}

export default async function ResultadosPage() {
  const supabase = await createClient();
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [fatRes, compRes, metaRes, calRes, itensRes, fatTipoRes] = await Promise.all([
    supabase
      .from("v_faturado_diario")
      .select("dia, faturado_brl")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(hoje)),
    supabase
      .from("compras_espelho")
      .select("data_emissao, valor_total_brl, status_compra, fornecedor_nome")
      .gte("data_emissao", iso(inicioMes))
      .lte("data_emissao", iso(hoje))
      .neq("status_compra", "cancelado")
      .in("id_pessoa_emitente", [1, 2074]),
    // meta dos vendedores (todos) por dia — base da projeção por fator de ritmo
    supabase
      .from("v_calendario_metas")
      .select("dia, meta_diaria_brl")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(fimMes)),
    // calendário/dashboard (Fase 1.5) — agregado diário + semáforo + sinalizadores
    supabase
      .from("v_calendario_compras_dia")
      .select("*")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(fimMes))
      .order("dia"),
    // Fase 1.6 — drilldown produto por dia (não-cancelado), via v_compras_itens_dia
    supabase
      .from("v_compras_itens_dia")
      .select("dia, data_emissao, fornecedor_nome, produto_nome, quantidade, preco_un, valor_brl")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(hoje))
      .neq("status_compra", "cancelado")
      .in("id_pessoa_emitente", [1, 2074]),
    // Fase 1.6 — split NF/Recibo do mês corrente
    supabase
      .from("faturamento_tipo_dia")
      .select("dia, tipo_doc, valor_brl, qtd_docs")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(hoje)),
  ]);
  const fatRows = (fatRes.data ?? []) as { dia: string; faturado_brl: number }[];
  const compRows = (compRes.data ?? []) as CompraRow[];
  const metaRows = (metaRes.data ?? []) as { dia: string; meta_diaria_brl: number }[];
  const calRows = (calRes.data ?? []) as DiaCalendario[];
  const itensRows = (itensRes.data ?? []) as DrilldownItemRow[];
  const fatTipoRows = (fatTipoRes.data ?? []) as FatTipoRow[];

  // MTD
  const faturadoMtd = fatRows.reduce((s, r) => s + Number(r.faturado_brl || 0), 0);
  const comprasMtd = compRows.reduce((s, r) => s + Number(r.valor_total_brl || 0), 0);
  // split: recebido (entregue/NF=status 4) vs a chegar (pendente+aprovado=1,2)
  const recebidoMtd = compRows
    .filter((r) => r.status_compra === "entregue")
    .reduce((s, r) => s + Number(r.valor_total_brl || 0), 0);
  const aChegarMtd = comprasMtd - recebidoMtd;

  const pct = faturadoMtd > 0 ? Math.round((comprasMtd / faturadoMtd) * 1000) / 10 : 0;
  const sem = semaforo(pct);

  // diário (para projeção)
  const fatDia: Record<string, number> = {};
  for (const r of fatRows) fatDia[r.dia] = (fatDia[r.dia] || 0) + Number(r.faturado_brl || 0);
  // compDia migrado p/ base de ENTREGA (DEBT-042): usa o agregado já keyed por `dia` da view do calendário
  const compDia: Record<string, number> = {};
  for (const r of calRows) compDia[r.dia] = Number(r.compras_brl || 0);

  // últimos 7 dias úteis (SEG-SÁB) até hoje
  const last7: Date[] = [];
  const cur = new Date(hoje);
  while (last7.length < 7 && cur >= inicioMes) {
    if (cur.getDay() !== 0) last7.push(new Date(cur));
    cur.setDate(cur.getDate() - 1);
  }
  const medCompras = median(last7.map((d) => compDia[iso(d)] || 0));

  const duDecorridos = bizDays(inicioMes, hoje);
  const duTotal = bizDays(inicioMes, fimMes);
  const duRestantes = Math.max(0, duTotal - duDecorridos);

  // Faturado: previsão pela META dos vendedores × fator de ritmo (fase_1 §D.2 — "não engessado")
  const todayISO = iso(hoje);
  const metaAteHoje = metaRows.filter((r) => r.dia <= todayISO).reduce((s, r) => s + Number(r.meta_diaria_brl || 0), 0);
  const metaRestante = metaRows.filter((r) => r.dia > todayISO).reduce((s, r) => s + Number(r.meta_diaria_brl || 0), 0);
  const fatorRitmo = metaAteHoje > 0 ? faturadoMtd / metaAteHoje : 1;

  // Compras: mediana 7 dias úteis × dias úteis restantes
  const projCompras = comprasMtd + medCompras * duRestantes;
  const projFaturado = faturadoMtd + metaRestante * fatorRitmo;
  const pctProj = projFaturado > 0 ? Math.round((projCompras / projFaturado) * 1000) / 10 : 0;
  const semProj = semaforo(pctProj);
  const gap54 = projCompras - 0.54 * projFaturado;

  const labelS: React.CSSProperties = {
    fontSize: 9,
    letterSpacing: ".15em",
    textTransform: "uppercase",
    color: "#556677",
    fontFamily: mono,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1
        style={{
          color: "#FFFFFF",
          fontSize: 16,
          fontWeight: 700,
          fontFamily: mono,
          letterSpacing: ".1em",
          textTransform: "uppercase",
        }}
      >
        Resultados · Compras × Faturamento{" "}
        <span style={{ color: "#556677", fontSize: 11 }}>
          (MTD · {duDecorridos}/{duTotal} dias úteis)
        </span>
      </h1>

      {/* Cards topo */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, padding: 18, flex: 1, minWidth: 200 }}>
          <div style={labelS}>Faturado MTD</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", fontFamily: "Inter, sans-serif", marginTop: 6 }}>{brl(faturadoMtd)}</div>
        </div>

        <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, padding: 18, flex: 1, minWidth: 200 }}>
          <div style={labelS}>Compras MTD</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", fontFamily: "Inter, sans-serif", marginTop: 6 }}>{brl(comprasMtd)}</div>
          <div style={{ ...labelS, marginTop: 8, color: "#8899aa", textTransform: "none", letterSpacing: 0 }}>
            Recebido (NF): <b style={{ color: "#2ea043" }}>{brl(recebidoMtd)}</b> · A chegar: <b style={{ color: "#d29922" }}>{brl(aChegarMtd)}</b>
          </div>
        </div>

        <div style={{ background: "#0f1428", border: `1px solid ${sem.cor}`, borderRadius: 6, padding: 18, flex: 1, minWidth: 200 }}>
          <div style={labelS}>% Compras / Faturado</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: sem.cor, fontFamily: "Inter, sans-serif", marginTop: 6 }}>
            {pct}% <span style={{ fontSize: 12, fontFamily: mono }}>{sem.label}</span>
          </div>
          <div style={{ ...labelS, marginTop: 8, color: "#556677", textTransform: "none", letterSpacing: 0 }}>teto 54% · 🟢≤54 🟡54-65 🔴&gt;65</div>
        </div>
      </div>

      {/* Projeção */}
      <div style={{ background: "#0f1428", border: `1px solid ${semProj.cor}`, borderRadius: 6, padding: 18 }}>
        <div style={{ ...labelS, marginBottom: 8 }}>
          Projeção fechamento do mês (faturado: meta × ritmo · compras: mediana 7 dias úteis)
        </div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontFamily: mono, fontSize: 13, color: "#c8d8e8" }}>
          <span>Faturado proj.: <b>{brl(projFaturado)}</b></span>
          <span>Compras proj.: <b>{brl(projCompras)}</b></span>
          <span style={{ color: semProj.cor }}>% proj.: <b>{pctProj}% {semProj.label}</b></span>
          <span>Gap vs 54%: <b style={{ color: gap54 > 0 ? "#f85149" : "#2ea043" }}>{brl(gap54)}</b></span>
          <span style={{ color: fatorRitmo >= 1 ? "#2ea043" : "#d29922" }}>
            Ritmo: <b>{Math.round(fatorRitmo * 100)}%</b> da meta {fatorRitmo >= 1 ? "↑" : "↓"}
          </span>
        </div>
      </div>

      {/* Fase 1.5 + 1.6 — calendário + gráficos + donut NF/Recibo + drawer com drilldown de produto */}
      <CalendarDashboard days={calRows} itens={itensRows} fatTipo={fatTipoRows} />
    </div>
  );
}
