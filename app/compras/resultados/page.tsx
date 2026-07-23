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
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { CalendarDays, LineChart } from "lucide-react";
import { EMITENTES_ASB, brl, semaforoPct, nivelSemaforo, corSemaforoLabel } from "@/lib/compras/regras";

// Pill de detalhe (breakdown): rótulo sans + número mono, cor de sinal preservada.
function Pill({ label, value, color }: { label?: string; value: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: color + "1f", color, fontFamily: theme.font.label }}>
      {label ? <span>{label}</span> : null}
      <b style={{ fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{value}</b>
    </span>
  );
}
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
    // Drawer "Fornecedores do dia" — ENTRADA real (NF/Recibo) via v_compras_itens_dia (entrada-based
    // desde 2026-07-23, DEBT-296): reconcilia centavo com a célula; pendente/aprovado/cancelado/deletado
    // não entram. produto_nome = "NF/Recibo <num>"; status_compra sempre 'entregue' (o .neq abaixo é no-op seguro).
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
        .select("proj_faturado, orcamento_compras, disponivel_compras, pct_comprometido, compras_comprometido_mtd")
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
  // "Comprometido Até Hoje" = fonte ÚNICA = view v_projecao_fim_mes (régua ENTREGA-no-mês + is_deleted,
  // DEBT-333). NÃO usar comprasMtd (compras_espelho por data_emissao) aqui, senão o tile diverge de
  // Disponível/% (que já vêm da view). Fallback (view indisponível) = comprasMtd.
  const comprometidoAteHoje = projView ? Number(projView.compras_comprometido_mtd) : comprasMtd;

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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title={`Resultado de ${MESES_PT[mesSel]}/${anoSel}`}
        desc={isMesCorrente ? `Em andamento · ${duDecorridos}/${duTotal} dias úteis` : "Mês fechado — resultado realizado"}
      />

      {/* Painel ANO 2026 — 12 tiles (faturado/compras/% + semáforo). Navega via ?mes= */}
      <div className="asb-card" style={{ padding: "20px 24px" }}>
        <SectionHead Icon={CalendarDays} color="#8bb4ff" title="Ano 2026" desc="Resultado mês a mês · clique para abrir um mês" />
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
                  background: ativo ? "rgba(46,160,67,.10)" : "var(--asb-card-hi)",
                  border: `1px solid ${ativo ? "#2ea043" : "var(--asb-border)"}`,
                  borderRadius: 6,
                  padding: 10,
                  opacity: futuro ? 0.45 : 1,
                  fontFamily: theme.font.label,
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
                    <div>Fat: <b style={{ color: "#c8d8e8", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{brl(Number(row.faturado_brl || 0))}</b></div>
                    <div>Comp: <b style={{ color: "#c8d8e8", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{brl(Number(row.compras_brl || 0))}</b></div>
                    <div style={{ color: cor, fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{Number(row.pct_compras_faturado ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</div>
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

      {/* Cards topo — resumo do mês (faturado · compras entrada real · % semáforo) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {/* mês corrente em andamento: zerado é estado válido (R$ 0), nunca "sem dados" */}
        <StatTile
          label={`Faturado ${mtdLabel}`}
          accent="#8bb4ff"
          value={!isMesCorrente && fatRows.length === 0 ? "—" : brl(faturadoMtd)}
          sub={!isMesCorrente && fatRows.length === 0 ? "Sem dados de faturamento neste período" : undefined}
        />

        {/* Headline = ENTRADA REAL (NF+Recibo − devolução; mesmo comprasParaPct do box %). */}
        <StatTile
          label={`Compras ${mtdLabel}`}
          accent="#8bb4ff"
          value={!isMesCorrente && compRows.length === 0 ? "—" : brl(comprasParaPct)}
          sub={!isMesCorrente && compRows.length === 0 ? "Sem dados de compras neste período" : undefined}
          badges={
            !isMesCorrente && compRows.length === 0 ? undefined : (
              <>
                <Pill label="Entrada (NF+Recibo):" value={brl(recebidoEntrada)} color="#2ea043" />
                {isMesCorrente ? <Pill label="A chegar:" value={brl(aChegarEntrada)} color="#d29922" /> : null}
                {devolucaoMtd > 0 ? <Pill label="(−) Devolução:" value={brl(devolucaoMtd)} color="#d29922" /> : null}
              </>
            )
          }
        />

        <StatTile
          label="% Compras / Faturado"
          accent={sem.cor}
          num={sem.cor}
          value={`${pct}%`}
          badges={<Pill label="" value={sem.label} color={sem.cor} />}
          sub="teto 54% · 🟢≤54 🟡54-65 🔴>65"
        />
      </div>

      {/* Projeção — só no mês corrente; mês fechado mostra "resultado realizado" */}
      {isMesCorrente ? (
        <div className="asb-card" style={{ padding: "20px 24px", borderTop: `3px solid ${semProj.cor}` }}>
          <SectionHead
            Icon={LineChart}
            color={semProj.cor}
            title="Projeção de Fechamento do Mês"
            desc="Faturado = ritmo do período · Compras = teto 54% do projetado"
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <StatTile label="Faturado Projetado" value={brl(projFaturado)} />
            <StatTile label="Orçamento Compras (54%)" value={brl(projCompras)} />
            <StatTile label="Comprometido Até Hoje" value={brl(comprometidoAteHoje)} />
            <StatTile
              label="Disponível p/ Comprar"
              value={brl(disponivelCompras)}
              num={disponivelCompras >= 0 ? "#2ea043" : "#f85149"}
              accent={disponivelCompras >= 0 ? "#2ea043" : "#f85149"}
            />
            <StatTile
              label="% Comprometido do Proj."
              value={`${pctComprometido}%`}
              num={semProj.cor}
              accent={semProj.cor}
              badges={<Pill value={semProj.label} color={semProj.cor} />}
            />
            {metaAcum > 0 && (
              <StatTile
                label="Ritmo da Meta"
                value={`${Math.round(fatorRitmo * 100)}%`}
                num={fatorRitmo >= 1 ? "#2ea043" : "#d29922"}
                sub={fatorRitmo >= 1 ? "acima da meta ↑" : "abaixo da meta ↓"}
              />
            )}
          </div>
        </div>
      ) : (
        <div style={{ ...S.card, padding: "14px 20px" }}>
          <span style={S.text}>Mês fechado — resultado realizado (sem projeção).</span>
        </div>
      )}

      {/* Fase 1.5 + 1.6 — calendário + gráficos + donut NF/Recibo + drawer com drilldown de produto */}
      {calRows.length === 0 && itensRows.length === 0 ? (
        <div style={{ ...S.card, padding: "14px 20px" }}>
          <span style={S.text}>Sem dados de calendário/compras neste período.</span>
        </div>
      ) : (
        <CalendarDashboard days={calRowsEmissao} itens={itensRows} fatTipo={fatTipoRows} devolucoes={devolRows} isMesCorrente={isMesCorrente} />
      )}
    </div>
  );
}
