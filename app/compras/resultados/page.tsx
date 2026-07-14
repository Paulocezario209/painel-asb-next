// app/compras/resultados/page.tsx — Camada Resultados (Compras × Faturamento)
// Regra Compras MTD (CLAUDE.md, atualizada 2026-07-08): ESTADO REAL (cards/headline/semáforo,
// corrente inclusive) = status_compra='entregue'; "tudo exceto cancelado" (comprometido, inclui
// a-chegar) vale SÓ para projeção. data_emissao, emit 1+2074, ts_delete via espelho.
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

import { theme } from "@/lib/theme";
import { EMITENTES_ASB, brl, semaforoPct, nivelSemaforo, corSemaforoLabel } from "@/lib/compras/regras";
const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type MensalRow = {
  mes: string; ano: number; mes_num: number;
  faturado_brl: number; compras_brl: number; pct_compras_faturado: number;
  semaforo: "OK" | "ALERTA" | "CRITICO" | string;
};

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

  const [fatRes, compRes, metaRes, calRes, itensRes, fatTipoRes, mensalRes, devolRes, entradaRes] = await Promise.all([
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
      .in("id_pessoa_emitente", EMITENTES_ASB),
    // meta dos vendedores (todos) por dia — base da projeção por ritmo amortecido.
    // Janela = MÊS INTEIRO (fimMes, não fimJanela): precisa da meta futura p/ metaRestante.
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
      .lte("dia", iso(fimJanela))
      .order("dia"),
    // Fase 1.6 — drilldown produto por dia (não-cancelado), via v_compras_itens_dia
    supabase
      .from("v_compras_itens_dia")
      .select("dia, data_emissao, fornecedor_nome, produto_nome, quantidade, preco_un, valor_brl")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(fimJanela))
      .neq("status_compra", "cancelado")
      .in("id_pessoa_emitente", EMITENTES_ASB),
    // Fase 1.6 — split NF/Recibo do mês corrente
    supabase
      .from("faturamento_tipo_dia")
      .select("dia, tipo_doc, valor_brl, qtd_docs")
      .gte("dia", iso(inicioMes))
      .lte("dia", iso(fimJanela)),
    // Painel ANO 2026 — resultado mensal agregado (faturado/compras/%/semáforo) por mês
    supabase.from("v_resultado_mensal").select("*"),
    // DEBT-171 F2/F3 — devolução de compra (fornecedor): abate compras (F2) + drilldown (F3)
    supabase
      .from("devolucoes_compra_espelho")
      .select("data_devolucao, valor_vnf, n_nf, fornecedor_nome, ref_nfe_chave")
      .gte("data_devolucao", iso(inicioMes))
      .lte("data_devolucao", iso(fimJanela))
      .in("id_pessoa_emitente", EMITENTES_ASB),
    // PEÇA 3 — Compras MTD = ENTRADA REAL (NF+Recibo) via v_compras_entradas_mtd (linha do mês selecionado)
    supabase
      .from("v_compras_entradas_mtd")
      .select("recebido_brl, comprometido_brl, a_chegar_brl")
      .eq("mes_num", mesSel + 1)
      .maybeSingle(),
  ]);
  const fatRows = (fatRes.data ?? []) as { dia: string; faturado_brl: number }[];
  const compRows = (compRes.data ?? []) as CompraRow[];
  const metaRows = (metaRes.data ?? []) as { dia: string; meta_diaria_brl: number }[];
  const calRows = (calRes.data ?? []) as DiaCalendario[];
  const itensRows = (itensRes.data ?? []) as DrilldownItemRow[];
  const fatTipoRows = (fatTipoRes.data ?? []) as FatTipoRow[];
  const mensalRows = (mensalRes.data ?? []) as MensalRow[];
  const devolRows = (devolRes.data ?? []) as { data_devolucao: string; valor_vnf: number; n_nf: string | null; fornecedor_nome: string | null; ref_nfe_chave: string | null }[];
  const devolucaoMtd = devolRows.reduce((s, r) => s + Number(r.valor_vnf || 0), 0);

  // MTD
  const faturadoMtd = fatRows.reduce((s, r) => s + Number(r.faturado_brl || 0), 0);
  // DEBT-171 F2: compras LÍQUIDAS = bruto − devolução de compra (fornecedor)
  const comprasBrutoMtd = compRows.reduce((s, r) => s + Number(r.valor_total_brl || 0), 0);
  const comprasMtd = comprasBrutoMtd - devolucaoMtd;
  // Compras MTD / % — regra Paulo 2026-07-14: ESTADO REAL = ENTRADA DE MERCADORIA (NF+Recibo,
  // v_compras_entradas_mtd), líquida de devolução — substitui a régua "pedido entregue" (subcontava
  // o mês corrente). "A chegar" = comprometido − recebido, exibido SÓ no mês corrente.
  // A projeção (comprasMtd = comprometido, abaixo) e as demais superfícies ficam INTOCADAS.
  const entradaRow = (entradaRes.data ?? null) as { recebido_brl: number; a_chegar_brl: number } | null;
  const recebidoEntrada = Number(entradaRow?.recebido_brl ?? 0);
  const aChegarEntrada = Number(entradaRow?.a_chegar_brl ?? 0);
  const comprasParaPct = recebidoEntrada;
  const pct = faturadoMtd > 0 ? Math.round((comprasParaPct / faturadoMtd) * 1000) / 10 : 0;
  const sem = semaforoPct(pct);

  // diário (para projeção)
  const fatDia: Record<string, number> = {};
  for (const r of fatRows) fatDia[r.dia] = (fatDia[r.dia] || 0) + Number(r.faturado_brl || 0);

  // Calendário/card-do-dia: sobrescreve o faturado (que vem por data_meta na v_calendario_compras_dia)
  // pelo faturado por EMISSÃO (fatDia, v_faturado_emissao_diario) + recalcula % margem e semáforo.
  const calRowsEmissao: DiaCalendario[] = calRows.map((r) => {
    const fat = fatDia[r.dia] ?? 0;
    const compras = Number(r.compras_brl || 0);
    const pctDia = fat > 0 ? Math.round((compras / fat) * 1000) / 10 : null;
    return {
      ...r,
      faturado_brl: fat,
      pct_compras_faturado: pctDia,
      semaforo: (compras < 0
        ? "credito"
        : fat > 0
          ? nivelSemaforo(pctDia!)
          : (compras > 0 ? "sem_dado" : r.semaforo)) as DiaCalendario["semaforo"],
    };
  });
  const duDecorridos = bizDays(inicioMes, fimJanela); // corrente: até hoje; passado: mês inteiro
  const duTotal = bizDays(inicioMes, fimMes);
  const duRestantes = Math.max(0, duTotal - duDecorridos);

  // PROJEÇÃO — regra Paulo 2026-07-10 (substitui META×ritmo-amortecido e a mediana da DEBT-220):
  // faturado projetado = RITMO DO FATURAMENTO DO PERÍODO com DIAS ÚTEIS COMPLETOS (até ontem —
  // o dia em andamento fica fora do numerador E do denominador, senão a projeção amanhece diluída
  // e sobe ao longo do dia); compras projetadas = TETO 54% desse faturado (ORÇAMENTO do mês — não
  // extrapolar o ritmo de compra: compra é grumosa, um pedido grande cobre semanas, não é tendência).
  // Backtest jun/2026: essa régua projetou acima no meio do mês e convergiu (879k vs real 878k).
  // "Disponível" = orçamento − comprometido (≠cancelado, líquido de devolução) já assumido.
  const todayISO = iso(hoje);
  const metaAcum = metaRows.filter((r) => r.dia <= todayISO).reduce((s, r) => s + Number(r.meta_diaria_brl || 0), 0);
  const metaMensal = metaRows.reduce((s, r) => s + Number(r.meta_diaria_brl || 0), 0);
  const fatorRitmo = metaAcum > 0 ? faturadoMtd / metaAcum : 1;       // "Ritmo % da meta" (indicador)

  const TETO = 0.54;
  // DEBT-082: fonte CANÔNICA da projeção = view v_projecao_fim_mes (mesma régua,
  // paridade validada na criação). O cálculo local abaixo vira FALLBACK (view
  // indisponível) — não evoluir a régua aqui sem atualizar a view junto.
  const { data: projView } = isMesCorrente
    ? await supabase
        .from("v_projecao_fim_mes")
        .select("proj_faturado, orcamento_compras, disponivel_compras, pct_comprometido")
        .maybeSingle()
    : { data: null };
  let projFaturado: number;
  let projCompras: number;
  let disponivelCompras: number;
  let pctComprometido: number;
  if (projView) {
    projFaturado = Number(projView.proj_faturado);
    projCompras = Number(projView.orcamento_compras);
    disponivelCompras = Number(projView.disponivel_compras);
    pctComprometido = Number(projView.pct_comprometido);
  } else {
    const fimCompleto = isMesCorrente ? new Date(anoSel, mesSel, hoje.getDate() - 1) : fimMes;
    const duCompletos = fimCompleto >= inicioMes ? bizDays(inicioMes, fimCompleto) : 0;
    const isoFimCompleto = iso(fimCompleto);
    const fatCompletos = fatRows
      .filter((r) => r.dia <= isoFimCompleto)
      .reduce((s, r) => s + Number(r.faturado_brl || 0), 0);
    projFaturado = duCompletos > 0
      ? (fatCompletos / duCompletos) * duTotal
      : metaMensal;                                                  // edge: dia 1 do mês sem dia completo → meta mensal
    projCompras = TETO * projFaturado;                               // orçamento 54% do projetado
    disponivelCompras = projCompras - comprasMtd;                    // o que ainda cabe comprar no mês
    pctComprometido = projFaturado > 0 ? Math.round((comprasMtd / projFaturado) * 1000) / 10 : 0;
  }
  const semProj = semaforoPct(pctComprometido);

  const labelS: React.CSSProperties = {
    fontSize: 9,
    letterSpacing: ".15em",
    textTransform: "uppercase",
    color: "#e4e9f0",
    fontFamily: theme.font.label,
  };
  const mtdLabel = isMesCorrente ? "MTD" : "Realizado";
  // Painel ANO 2026: 12 tiles. Mês corrente do calendário (para fechado/andamento/futuro).
  const mesCorrenteNum = hoje.getFullYear() === 2026 ? hoje.getMonth() + 1 : 13; // se não for 2026, todos "fechados"
  const mensalByNum = new Map(mensalRows.filter((r) => r.ano === 2026).map((r) => [r.mes_num, r]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h1
        style={{
          color: "#FFFFFF",
          fontSize: 16,
          fontWeight: 700,
          fontFamily: theme.font.label,
          letterSpacing: ".1em",
          textTransform: "uppercase",
        }}
      >
        Resultado de {MESES_PT[mesSel]}/{anoSel}{" "}
        <span style={{ color: "#e4e9f0", fontSize: 11 }}>
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
            const cor = row ? corSemaforoLabel(row.semaforo) : "#e4e9f0";

            const tile = (
              <div
                style={{
                  background: ativo ? "rgba(46,160,67,.10)" : "#0f1428",
                  border: `1px solid ${ativo ? "#2ea043" : "#1B2A6B"}`,
                  borderRadius: 6,
                  padding: 10,
                  opacity: futuro ? 0.45 : 1,
                  fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums",
                  height: "100%",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: ativo ? "#FFFFFF" : "#c8d8e8", fontSize: 12, fontWeight: 700 }}>{MESES_PT[i]}</span>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor, flexShrink: 0 }} />
                </div>
                <div style={{ ...labelS, marginTop: 4, fontSize: 8, color: corrente ? "#d29922" : "#e4e9f0" }}>{status}</div>
                {row ? (
                  <div style={{ marginTop: 6, fontSize: 10, color: "#c0d0e0", lineHeight: 1.5 }}>
                    <div>Fat: <b style={{ color: "#c8d8e8" }}>{brl(Number(row.faturado_brl || 0))}</b></div>
                    <div>Comp: <b style={{ color: "#c8d8e8" }}>{brl(Number(row.compras_brl || 0))}</b></div>
                    <div style={{ color: cor, fontWeight: 700 }}>{Number(row.pct_compras_faturado ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</div>
                  </div>
                ) : (
                  <div style={{ marginTop: 6, fontSize: 9, color: "#e4e9f0" }}>{futuro ? "—" : "sem dados"}</div>
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
            <div style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", marginTop: 6 }}>{brl(faturadoMtd)}</div>
          )}
        </div>

        <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, padding: 18, flex: 1, minWidth: 200 }}>
          <div style={labelS}>Compras {mtdLabel}</div>
          {/* mês corrente em andamento: zerado é estado válido (R$ 0), nunca "sem dados" */}
          {!isMesCorrente && compRows.length === 0 ? (
            <div style={{ ...labelS, marginTop: 10, textTransform: "none", letterSpacing: 0 }}>Sem dados de compras neste período</div>
          ) : (
            <>
              {/* Headline = ENTRADA REAL (NF+Recibo − devolução; mesmo comprasParaPct do box %). */}
              <div style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", marginTop: 6 }}>{brl(comprasParaPct)}</div>
              <div style={{ ...labelS, marginTop: 8, color: "#c0d0e0", textTransform: "none", letterSpacing: 0 }}>
                Entrada (NF+Recibo): <b style={{ color: "#2ea043" }}>{brl(recebidoEntrada)}</b>
                {isMesCorrente ? <> · A chegar: <b style={{ color: "#d29922" }}>{brl(aChegarEntrada)}</b></> : null}
              </div>
              {devolucaoMtd > 0 && (
                <div style={{ ...labelS, marginTop: 4, color: "#c0d0e0", textTransform: "none", letterSpacing: 0 }}>
                  (−) Devolução: <b style={{ color: "#d29922" }}>{brl(devolucaoMtd)}</b>
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ background: "#0f1428", border: `1px solid ${sem.cor}`, borderRadius: 6, padding: 18, flex: 1, minWidth: 200 }}>
          <div style={labelS}>% Compras / Faturado</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: sem.cor, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", marginTop: 6 }}>
            {pct}% <span style={{ fontSize: 12, fontFamily: theme.font.label }}>{sem.label}</span>
          </div>
          <div style={{ ...labelS, marginTop: 8, color: "#e4e9f0", textTransform: "none", letterSpacing: 0 }}>teto 54% · 🟢≤54 🟡54-65 🔴&gt;65</div>
        </div>
      </div>

      {/* Projeção — só no mês corrente; mês fechado mostra "resultado realizado" */}
      {isMesCorrente ? (
        <div style={{ background: "#0f1428", border: `1px solid ${semProj.cor}`, borderRadius: 6, padding: 18 }}>
          <div style={{ ...labelS, marginBottom: 8 }}>
            Projeção fechamento do mês (FATURADO: RITMO DO PERÍODO · COMPRAS: TETO 54% DO PROJETADO)
          </div>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontSize: 13, color: "#c8d8e8" }}>
            <span>Faturado proj.: <b>{brl(projFaturado)}</b></span>
            <span>Orçamento compras (54%): <b>{brl(projCompras)}</b></span>
            <span>Comprometido até hoje: <b>{brl(comprasMtd)}</b></span>
            <span>
              Disponível p/ comprar:{" "}
              <b style={{ color: disponivelCompras >= 0 ? "#2ea043" : "#f85149" }}>{brl(disponivelCompras)}</b>
            </span>
            <span style={{ color: semProj.cor }}>% comprometido do proj.: <b>{pctComprometido}% {semProj.label}</b></span>
            {metaAcum > 0 && (
              <span style={{ color: fatorRitmo >= 1 ? "#2ea043" : "#d29922" }}>
                Ritmo: <b>{Math.round(fatorRitmo * 100)}%</b> da meta {fatorRitmo >= 1 ? "↑" : "↓"}
              </span>
            )}
          </div>
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
        <CalendarDashboard days={calRowsEmissao} itens={itensRows} fatTipo={fatTipoRows} devolucoes={devolRows} isMesCorrente={isMesCorrente} />
      )}
    </div>
  );
}
