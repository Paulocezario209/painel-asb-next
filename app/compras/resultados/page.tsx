// app/compras/resultados/page.tsx — Camada Resultados (Compras × Faturamento)
// Regra Compras MTD (CLAUDE.md): status != cancelado, data_emissao, emit 1+2074, ts_delete via espelho.
// Seletor de mês (?mes=YYYY-MM): corrente = MTD + projeção; passado = realizado, sem projeção.
import Link from "next/link";
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
const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type MensalRow = {
  mes: string; ano: number; mes_num: number;
  faturado_brl: number; compras_brl: number; pct_compras_faturado: number;
  semaforo: "OK" | "ALERTA" | "CRITICO" | string;
};
// cor da bolinha do semáforo da view (OK/ALERTA/CRITICO)
const semCor = (s: string) => (s === "CRITICO" ? "#f85149" : s === "ALERTA" ? "#d29922" : "#2ea043");

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

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const hoje = new Date();

  // Mês escolhido via ?mes=YYYY-MM (default: mês corrente — comportamento idêntico ao de hoje).
  const sp = await searchParams;
  const mesParam = sp?.mes;
  const m = mesParam && /^2026-(0[1-9]|1[0-2])$/.test(mesParam) ? mesParam : null;
  const anoSel = m ? Number(m.slice(0, 4)) : hoje.getFullYear();
  const mesSel = m ? Number(m.slice(5, 7)) - 1 : hoje.getMonth(); // 0-based

  const inicioMes = new Date(anoSel, mesSel, 1);
  const fimMes = new Date(anoSel, mesSel + 1, 0);
  const isMesCorrente = anoSel === hoje.getFullYear() && mesSel === hoje.getMonth();
  // janela: corrente termina HOJE (MTD); passado termina no último dia do mês (realizado).
  const fimJanela = isMesCorrente ? hoje : fimMes;
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [fatRes, compRes, metaRes, calRes, itensRes, fatTipoRes, mensalRes] = await Promise.all([
    supabase
      .from("v_faturado_emissao_diario")  // faturado por EMISSÃO (data_faturamento), não data_meta/entrega
      .select("dia, faturado_brl")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(fimJanela)),
    supabase
      .from("compras_espelho")
      .select("data_emissao, valor_total_brl, status_compra, fornecedor_nome")
      .gte("data_emissao", iso(inicioMes))
      .lte("data_emissao", iso(fimJanela))
      .neq("status_compra", "cancelado")
      .in("id_pessoa_emitente", [1, 2074]),
    // meta dos vendedores (todos) por dia — base da projeção por fator de ritmo
    supabase
      .from("v_calendario_metas")
      .select("dia, meta_diaria_brl")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(fimJanela)),
    // calendário/dashboard (Fase 1.5) — agregado diário + semáforo + sinalizadores
    supabase
      .from("v_calendario_compras_dia")
      .select("*")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(fimJanela))
      .order("dia"),
    // Fase 1.6 — drilldown produto por dia (não-cancelado), via v_compras_itens_dia
    supabase
      .from("v_compras_itens_dia")
      .select("dia, data_emissao, fornecedor_nome, produto_nome, quantidade, preco_un, valor_brl")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(fimJanela))
      .neq("status_compra", "cancelado")
      .in("id_pessoa_emitente", [1, 2074]),
    // Fase 1.6 — split NF/Recibo do mês corrente
    supabase
      .from("faturamento_tipo_dia")
      .select("dia, tipo_doc, valor_brl, qtd_docs")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(fimJanela)),
    // Painel ANO 2026 — resultado mensal agregado (faturado/compras/%/semáforo) por mês
    supabase.from("v_resultado_mensal").select("*"),
  ]);
  const fatRows = (fatRes.data ?? []) as { dia: string; faturado_brl: number }[];
  const compRows = (compRes.data ?? []) as CompraRow[];
  const metaRows = (metaRes.data ?? []) as { dia: string; meta_diaria_brl: number }[];
  const calRows = (calRes.data ?? []) as DiaCalendario[];
  const itensRows = (itensRes.data ?? []) as DrilldownItemRow[];
  const fatTipoRows = (fatTipoRes.data ?? []) as FatTipoRow[];
  const mensalRows = (mensalRes.data ?? []) as MensalRow[];

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

  // Calendário/card-do-dia: sobrescreve o faturado (que vem por data_meta na v_calendario_compras_dia)
  // pelo faturado por EMISSÃO (fatDia, v_faturado_emissao_diario) + recalcula % margem e semáforo.
  const calRowsEmissao: DiaCalendario[] = calRows.map((r) => {
    const fat = fatDia[r.dia] ?? Number(r.faturado_brl || 0);
    const compras = Number(r.compras_brl || 0);
    const pctDia = fat > 0 ? Math.round((compras / fat) * 1000) / 10 : null;
    return {
      ...r,
      faturado_brl: fat,
      pct_compras_faturado: pctDia,
      semaforo: (fat > 0
        ? (pctDia! <= 54 ? "verde" : pctDia! <= 65 ? "amarelo" : "vermelho")
        : (compras > 0 ? "sem_dado" : r.semaforo)) as DiaCalendario["semaforo"],
    };
  });
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

  const duDecorridos = bizDays(inicioMes, fimJanela); // corrente: até hoje; passado: mês inteiro
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
  const mtdLabel = isMesCorrente ? "MTD" : "Realizado";
  // Painel ANO 2026: 12 tiles. Mês corrente do calendário (para fechado/andamento/futuro).
  const mesCorrenteNum = hoje.getFullYear() === 2026 ? hoje.getMonth() + 1 : 13; // se não for 2026, todos "fechados"
  const mensalByNum = new Map(mensalRows.filter((r) => r.ano === 2026).map((r) => [r.mes_num, r]));
  const brl0 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

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
        Resultado de {MESES_PT[mesSel]}/{anoSel}{" "}
        <span style={{ color: "#556677", fontSize: 11 }}>
          {isMesCorrente ? `(em andamento · ${duDecorridos}/${duTotal} dias úteis)` : "(mês fechado)"}
        </span>
      </h1>

      {/* Painel ANO 2026 — 12 tiles (faturado/compras/% + semáforo). Navega via ?mes= */}
      <div>
        <div style={{ ...labelS, marginBottom: 8 }}>Ano 2026</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 8,
          }}
        >
          {Array.from({ length: 12 }, (_, i) => {
            const mn = i + 1; // 1-based
            const row = mensalByNum.get(mn);
            const ativo = mn === mesSel + 1 && anoSel === 2026;
            const futuro = mn > mesCorrenteNum;
            const corrente = mn === mesCorrenteNum;
            const status = futuro ? "futuro" : corrente ? "em andamento" : "fechado";
            const cor = row ? semCor(row.semaforo) : "#556677";

            const tile = (
              <div
                style={{
                  background: ativo ? "rgba(46,160,67,.10)" : "#0f1428",
                  border: `1px solid ${ativo ? "#2ea043" : "#1B2A6B"}`,
                  borderRadius: 6,
                  padding: 10,
                  opacity: futuro ? 0.45 : 1,
                  fontFamily: mono,
                  height: "100%",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: ativo ? "#FFFFFF" : "#c8d8e8", fontSize: 12, fontWeight: 700 }}>{MESES_PT[i]}</span>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor, flexShrink: 0 }} />
                </div>
                <div style={{ ...labelS, marginTop: 4, fontSize: 8, color: corrente ? "#d29922" : "#556677" }}>{status}</div>
                {row ? (
                  <div style={{ marginTop: 6, fontSize: 10, color: "#8899aa", lineHeight: 1.5 }}>
                    <div>Fat: <b style={{ color: "#c8d8e8" }}>{brl0(Number(row.faturado_brl || 0))}</b></div>
                    <div>Comp: <b style={{ color: "#c8d8e8" }}>{brl0(Number(row.compras_brl || 0))}</b></div>
                    <div style={{ color: cor, fontWeight: 700 }}>{Number(row.pct_compras_faturado ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 9, color: "#556677" }}>{futuro ? "—" : "sem dados"}</div>
                )}
              </div>
            );

            // passados e corrente clicáveis; futuros não
            return futuro ? (
              <div key={mn}>{tile}</div>
            ) : (
              <Link key={mn} href={`?mes=2026-${String(mn).padStart(2, "0")}`} style={{ textDecoration: "none" }}>
                {tile}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Cards topo */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, padding: 18, flex: 1, minWidth: 200 }}>
          <div style={labelS}>Faturado {mtdLabel}</div>
          {/* mês corrente em andamento: zerado é estado válido (R$ 0), nunca "sem dados" */}
          {!isMesCorrente && fatRows.length === 0 ? (
            <div style={{ ...labelS, marginTop: 10, textTransform: "none", letterSpacing: 0 }}>Sem dados de faturamento neste período</div>
          ) : (
            <div style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", fontFamily: "Inter, sans-serif", marginTop: 6 }}>{brl(faturadoMtd)}</div>
          )}
        </div>

        <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, padding: 18, flex: 1, minWidth: 200 }}>
          <div style={labelS}>Compras {mtdLabel}</div>
          {/* mês corrente em andamento: zerado é estado válido (R$ 0), nunca "sem dados" */}
          {!isMesCorrente && compRows.length === 0 ? (
            <div style={{ ...labelS, marginTop: 10, textTransform: "none", letterSpacing: 0 }}>Sem dados de compras neste período</div>
          ) : (
            <>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", fontFamily: "Inter, sans-serif", marginTop: 6 }}>{brl(comprasMtd)}</div>
              <div style={{ ...labelS, marginTop: 8, color: "#8899aa", textTransform: "none", letterSpacing: 0 }}>
                Recebido (NF): <b style={{ color: "#2ea043" }}>{brl(recebidoMtd)}</b> · A chegar: <b style={{ color: "#d29922" }}>{brl(aChegarMtd)}</b>
              </div>
            </>
          )}
        </div>

        <div style={{ background: "#0f1428", border: `1px solid ${sem.cor}`, borderRadius: 6, padding: 18, flex: 1, minWidth: 200 }}>
          <div style={labelS}>% Compras / Faturado</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: sem.cor, fontFamily: "Inter, sans-serif", marginTop: 6 }}>
            {pct}% <span style={{ fontSize: 12, fontFamily: mono }}>{sem.label}</span>
          </div>
          <div style={{ ...labelS, marginTop: 8, color: "#556677", textTransform: "none", letterSpacing: 0 }}>teto 54% · 🟢≤54 🟡54-65 🔴&gt;65</div>
        </div>
      </div>

      {/* Projeção — só no mês corrente; mês fechado mostra "resultado realizado" */}
      {isMesCorrente ? (
        <div style={{ background: "#0f1428", border: `1px solid ${semProj.cor}`, borderRadius: 6, padding: 18 }}>
          <div style={{ ...labelS, marginBottom: 8 }}>
            Projeção fechamento do mês (faturado: meta × ritmo · compras: mediana 7 dias úteis)
          </div>
          {metaRows.length === 0 ? (
            <div style={{ ...labelS, textTransform: "none", letterSpacing: 0 }}>Sem meta de vendedores neste período — projeção indisponível</div>
          ) : (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontFamily: mono, fontSize: 13, color: "#c8d8e8" }}>
              <span>Faturado proj.: <b>{brl(projFaturado)}</b></span>
              <span>Compras proj.: <b>{brl(projCompras)}</b></span>
              <span style={{ color: semProj.cor }}>% proj.: <b>{pctProj}% {semProj.label}</b></span>
              <span>Gap vs 54%: <b style={{ color: gap54 > 0 ? "#f85149" : "#2ea043" }}>{brl(gap54)}</b></span>
              <span style={{ color: fatorRitmo >= 1 ? "#2ea043" : "#d29922" }}>
                Ritmo: <b>{Math.round(fatorRitmo * 100)}%</b> da meta {fatorRitmo >= 1 ? "↑" : "↓"}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, padding: 14 }}>
          <span style={{ ...labelS, textTransform: "none", letterSpacing: 0 }}>Mês fechado — resultado realizado (sem projeção).</span>
        </div>
      )}

      {/* Fase 1.5 + 1.6 — calendário + gráficos + donut NF/Recibo + drawer com drilldown de produto */}
      {calRows.length === 0 && itensRows.length === 0 ? (
        <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, padding: 18 }}>
          <span style={{ ...labelS, textTransform: "none", letterSpacing: 0 }}>Sem dados de calendário/compras neste período.</span>
        </div>
      ) : (
        <CalendarDashboard days={calRowsEmissao} itens={itensRows} fatTipo={fatTipoRows} isMesCorrente={isMesCorrente} />
      )}
    </div>
  );
}
