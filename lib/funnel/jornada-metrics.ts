// lib/funnel/jornada-metrics.ts — métricas V2 da Jornada do Cliente (100% auditável).
//
// Tudo derivado de pedidos_espelho (fonte oficial, sem fan-out): intervalos entre pedidos
// (mediana principal + média secundária), tempo até recorrência, funil da jornada (população
// acumulada) e o SCORE V1 de evolução — composto SÓ de variáveis mensuráveis, sem IA nem
// heurística oculta. O enriquecimento por contexto/IA fica para o G5.
//
// PURO (sem React/Supabase) → testável isolado (tests/jornada-metrics.test.ts).

import {
  JORNADA_STAGES, bucketByOrders, filterByView, dedupeById,
  cohortDoMes, dedupePedidos, isCompetenciaValida,
  type JornadaStageKey, type JornadaView, type Competencia,
} from "./jornada";

// Histórico de pedidos de UM cliente (já ordenado por data asc; datas em ISO/yyyy-mm-dd).
export interface ClienteHistorico {
  ares_pessoa_id: number;
  customer_status: string | null;
  // ares_pedido_id é a chave canônica do pedido — usada para deduplicar.
  pedidos: { data: string; valor: number; ares_pedido_id?: number | null }[]; // asc por data
}

// ── estatística ──────────────────────────────────────────────────────────────
export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
export function mean(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
const DAY = 86400000;
export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);

/** Intervalos consecutivos (em dias) de um cliente. */
export function gaps(h: ClienteHistorico): number[] {
  const out: number[] = [];
  for (let i = 1; i < h.pedidos.length; i++) out.push(daysBetween(h.pedidos[i - 1].data, h.pedidos[i].data));
  return out;
}

// ── intervalos por estágio (mediana principal + média secundária) ─────────────
// Para o card "Nº Pedido": clientes com EXATAMENTE N pedidos, gap entre o (N-1)º e o Nº.
// Para "Recorrente": tempo do 1º pedido até o 5º (virou recorrente).
export interface IntervaloEstagio {
  key: JornadaStageKey;
  n: number;
  medianaDias: number | null;
  mediaDias: number | null;
}
export function computeIntervalos(clientes: ClienteHistorico[]): Record<JornadaStageKey, IntervaloEstagio> {
  const buckets: Record<JornadaStageKey, number[]> = { p1: [], p2: [], p3: [], p4: [], recorrente: [] };
  for (const h of clientes) {
    const n = h.pedidos.length;
    const k = bucketByOrders(n);
    if (!k) continue;
    if (k === "p2") buckets.p2.push(daysBetween(h.pedidos[0].data, h.pedidos[1].data));
    else if (k === "p3") buckets.p3.push(daysBetween(h.pedidos[1].data, h.pedidos[2].data));
    else if (k === "p4") buckets.p4.push(daysBetween(h.pedidos[2].data, h.pedidos[3].data));
    else if (k === "recorrente") buckets.recorrente.push(daysBetween(h.pedidos[0].data, h.pedidos[4].data));
    // p1 não tem intervalo (1 pedido só)
  }
  const out = {} as Record<JornadaStageKey, IntervaloEstagio>;
  for (const s of JORNADA_STAGES) {
    const arr = buckets[s.key];
    out[s.key] = { key: s.key, n: arr.length, medianaDias: median(arr), mediaDias: mean(arr) };
  }
  return out;
}

/** Mediana de gap para ALCANÇAR cada rank de pedido (população acumulada) — referência do
 *  "atraso vs mediana da etapa" do score. rankMedian[N] = mediana p/ chegar ao Nº pedido. */
export function computeRankMedians(clientes: ClienteHistorico[]): Map<number, number> {
  const perRank = new Map<number, number[]>();
  for (const h of clientes) {
    for (let i = 1; i < h.pedidos.length; i++) {
      const rank = i + 1; // pedido nº (i+1)
      const g = daysBetween(h.pedidos[i - 1].data, h.pedidos[i].data);
      if (!perRank.has(rank)) perRank.set(rank, []);
      perRank.get(rank)!.push(g);
    }
  }
  const out = new Map<number, number>();
  for (const [rank, arr] of perRank) { const m = median(arr); if (m != null) out.set(rank, m); }
  return out;
}

// ── SCORE V1 (0–100, maior = mais atrasado/em risco) — auditável, pesos do Paulo ──
// 40% atraso vs mediana da etapa · 25% dias desde último pedido · 20% queda de frequência ·
// 15% redução de faturamento. Cada componente é normalizado 0–100 e documentado.
export type ScoreFaixa = "verde" | "amarelo" | "laranja" | "vermelho";
export interface ScoreResult {
  score: number;            // 0–100
  faixa: ScoreFaixa;
  componentes: { atraso: number; recencia: number; frequencia: number; faturamento: number };
}
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
export function scoreFaixa(score: number): ScoreFaixa {
  if (score <= 30) return "verde";
  if (score <= 60) return "amarelo";
  if (score <= 80) return "laranja";
  return "vermelho";
}
const CHURN_HORIZON_DIAS = 60; // régua oficial: ≥60d sem comprar = churn/inativo (customer-status)

/**
 * Score de evolução. `hoje` e `rankMedians` (referência da etapa) entram como parâmetros
 * → função pura, determinística e testável.
 */
export function computeScore(h: ClienteHistorico, hoje: string, rankMedians: Map<number, number>): ScoreResult {
  const n = h.pedidos.length;
  const g = gaps(h);
  const lastDate = h.pedidos[n - 1]?.data ?? hoje;
  const daysSinceLast = daysBetween(lastDate, hoje);
  const avgInterval = g.length > 0 ? mean(g)! : null;
  const proximoRank = n + 1;
  const stageMedian = rankMedians.get(proximoRank) ?? rankMedians.get(2) ?? 7; // fallback cadência semanal

  // 1) Atraso vs mediana da etapa (40%): quantos "múltiplos" da mediana esperada já se passaram.
  const atrasoRatio = daysSinceLast / Math.max(stageMedian, 1);
  const cAtraso = clamp(((atrasoRatio - 1) / 3) * 100); // no prazo(≤1×)=0 · 4×=100

  // 2) Dias desde último pedido (25%): normalizado ao horizonte de churn (60d).
  const cRecencia = clamp((daysSinceLast / CHURN_HORIZON_DIAS) * 100);

  // 3) Queda de frequência (20%): último intervalo vs média histórica (só ≥2 pedidos).
  let cFrequencia = 0;
  if (g.length >= 1 && avgInterval && avgInterval > 0) {
    const lastGap = g[g.length - 1];
    cFrequencia = clamp(((lastGap / avgInterval) - 1) / 2 * 100); // último ≤ média=0 · 3×=100
  }

  // 4) Redução de faturamento (15%): último pedido vs ticket médio (só ≥2 pedidos).
  let cFaturamento = 0;
  if (n >= 2) {
    const vals = h.pedidos.map((p) => p.valor);
    const avgTicket = mean(vals)!;
    const lastVal = vals[vals.length - 1];
    if (avgTicket > 0) cFaturamento = clamp((1 - lastVal / avgTicket) * 200); // sem queda=0 · −50%=100
  }

  const score = Math.round(0.40 * cAtraso + 0.25 * cRecencia + 0.20 * cFrequencia + 0.15 * cFaturamento);
  return {
    score,
    faixa: scoreFaixa(score),
    componentes: {
      atraso: Math.round(cAtraso),
      recencia: Math.round(cRecencia),
      frequencia: Math.round(cFrequencia),
      faturamento: Math.round(cFaturamento),
    },
  };
}

// ── Funil da Jornada (população ACUMULADA 1º→Recorrente) ──────────────────────
export interface FunilJornadaStep {
  key: JornadaStageKey;
  label: string;
  clientesAcumulado: number;       // chegou ao Nº pedido OU além
  taxaAvanco: number | null;       // % que avançou da etapa anterior p/ esta
  faturamentoAcumulado: number;    // faturamento dos que chegaram até aqui
  tempoMedianoDias: number | null; // mediana p/ alcançar este marco (do 1º pedido)
  tempoMedioDias: number | null;
}
/**
 * Funil por população acumulada. clientes já deduplicados (1 por ares_pessoa_id).
 * Passo N = clientes com ≥N pedidos. Taxa de avanço = passoN / passo(N-1).
 * Tempo até o marco = (data do Nº pedido − data do 1º).
 */
export function computeFunilJornada(clientes: ClienteHistorico[]): FunilJornadaStep[] {
  const ranks = [1, 2, 3, 4, 5];
  const temposAte: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  const revAte: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const countAte: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const h of clientes) {
    const n = h.pedidos.length;
    const revTotal = h.pedidos.reduce((a, p) => a + p.valor, 0);
    for (const r of ranks) {
      if (n >= r) {
        countAte[r]++;
        revAte[r] += revTotal;
        if (r >= 2) temposAte[r].push(daysBetween(h.pedidos[0].data, h.pedidos[r - 1].data));
      }
    }
  }
  let prevCount = 0;
  return ranks.map((r, i) => {
    const label = JORNADA_STAGES[i].label;
    const c = countAte[r];
    const taxa = i === 0 ? null : (prevCount > 0 ? (c / prevCount) * 100 : null);
    prevCount = c;
    return {
      key: JORNADA_STAGES[i].key,
      label,
      clientesAcumulado: c,
      taxaAvanco: taxa,
      faturamentoAcumulado: revAte[r],
      tempoMedianoDias: r >= 2 ? median(temposAte[r]) : 0,
      tempoMedioDias: r >= 2 ? mean(temposAte[r]) : 0,
    };
  });
}

// ── View-model por VISÃO (Carteira Viva | Histórico Geral) ────────────────────
// Agrega tudo que os cards precisam: count, %, faturamento, %faturamento, ticket,
// mediana/média de intervalo por estágio + métrica extra (dias desde 1º / tempo até
// recorrência). Puro e testável. Entrada = clientes com agregado + histórico.
export interface JornadaClienteAgg extends ClienteHistorico {
  total_orders: number;
  total_revenue_brl: number;
  avg_ticket_brl: number;
}
export interface JornadaCardVM {
  key: JornadaStageKey; label: string; fill: string;
  count: number; pct: number;            // % da base
  revenue: number; pctRevenue: number;   // % do faturamento da visão
  ticket: number;
  medianaDias: number | null; mediaDias: number | null;
  extraLabel: string; extraDias: number | null; // p1: dias desde 1º · recorrente: 1º→recorrência
}
export interface JornadaViewModel {
  view: JornadaView; base: number; totalRevenue: number;
  mes: Competencia | null;   // competência analisada (só na visão "mes"); null no histórico geral
  cards: JornadaCardVM[];
  funil: FunilJornadaStep[];
}

/** Cards zerados — usado quando a coorte é vazia (evita quebrar a UI). */
function emptyCards(): JornadaCardVM[] {
  return JORNADA_STAGES.map((s) => ({
    key: s.key, label: s.label, fill: s.fill,
    count: 0, pct: 0, revenue: 0, pctRevenue: 0, ticket: 0,
    medianaDias: null, mediaDias: null,
    extraLabel: STAGE_META[s.key].extraLabel, extraDias: null,
  }));
}

const STAGE_META: Record<JornadaStageKey, { extraLabel: string }> = {
  p1: { extraLabel: "Dias desde o 1º pedido (mediana)" },
  p2: { extraLabel: "Intervalo 1º→2º" },
  p3: { extraLabel: "Intervalo 2º→3º" },
  p4: { extraLabel: "Intervalo 3º→4º" },
  recorrente: { extraLabel: "1º pedido → recorrência" },
};

/**
 * Monta o view-model de uma visão.
 *
 * view="mes"  → COORTE MENSAL da competência `mes` (obrigatória): só clientes que
 *               ativaram no mês, contando apenas os pedidos daquele mês. Os agregados
 *               (nº de pedidos, faturamento, ticket) são RECALCULADOS sobre os pedidos
 *               recortados — não usam total_orders/total_revenue_brl da view, que são
 *               do histórico completo e contaminariam a competência.
 * view="geral"→ histórico completo (comportamento original, sem recorte de período).
 *
 * Cards, funil e taxas saem SEMPRE da mesma população `scoped` — não há como divergirem.
 */
export function buildViewModel(
  rows: JornadaClienteAgg[],
  view: JornadaView,
  hoje: string,
  mes?: Competencia,
): JornadaViewModel {
  const deduped = dedupeById(rows).map(dedupePedidos);

  let scoped: JornadaClienteAgg[];
  if (view === "mes") {
    if (!isCompetenciaValida(mes)) {
      // Sem competência válida não existe coorte — devolve vazio em vez de inventar recorte.
      return { view, base: 0, totalRevenue: 0, mes: mes ?? null, cards: emptyCards(), funil: computeFunilJornada([]) };
    }
    // Recorta a coorte e RECALCULA os agregados sobre os pedidos do mês.
    scoped = cohortDoMes(deduped, mes).map((r) => ({
      ...r,
      total_orders: r.pedidos.length,
      total_revenue_brl: r.pedidos.reduce((a, p) => a + p.valor, 0),
      avg_ticket_brl: r.pedidos.length > 0 ? r.pedidos.reduce((a, p) => a + p.valor, 0) / r.pedidos.length : 0,
    }));
  } else {
    scoped = filterByView(deduped, view).filter((r) => bucketByOrders(r.total_orders));
  }

  const base = scoped.length;
  const totalRevenue = scoped.reduce((a, r) => a + (r.total_revenue_brl ?? 0), 0);
  const intervalos = computeIntervalos(scoped);

  // dias desde 1º pedido (mediana) para os clientes de p1
  const p1dias: number[] = [];
  const acc: Record<JornadaStageKey, { count: number; revenue: number; orders: number }> = {
    p1: { count: 0, revenue: 0, orders: 0 }, p2: { count: 0, revenue: 0, orders: 0 },
    p3: { count: 0, revenue: 0, orders: 0 }, p4: { count: 0, revenue: 0, orders: 0 },
    recorrente: { count: 0, revenue: 0, orders: 0 },
  };
  for (const r of scoped) {
    const k = bucketByOrders(r.total_orders)!;
    acc[k].count++;
    acc[k].revenue += r.total_revenue_brl ?? 0;
    acc[k].orders += r.total_orders ?? 0;
    if (k === "p1" && r.pedidos[0]) p1dias.push(daysBetween(r.pedidos[0].data, hoje));
  }

  const cards: JornadaCardVM[] = JORNADA_STAGES.map((s) => {
    const a = acc[s.key];
    const iv = intervalos[s.key];
    const extraDias = s.key === "p1" ? median(p1dias) : iv.medianaDias;
    return {
      key: s.key, label: s.label, fill: s.fill,
      count: a.count,
      pct: base > 0 ? (a.count / base) * 100 : 0,
      revenue: a.revenue,
      pctRevenue: totalRevenue > 0 ? (a.revenue / totalRevenue) * 100 : 0,
      ticket: a.orders > 0 ? a.revenue / a.orders : 0,
      medianaDias: iv.medianaDias,
      mediaDias: iv.mediaDias,
      extraLabel: STAGE_META[s.key].extraLabel,
      extraDias,
    };
  });

  return {
    view, base, totalRevenue,
    mes: view === "mes" ? (mes ?? null) : null,
    cards,
    funil: computeFunilJornada(scoped),
  };
}
