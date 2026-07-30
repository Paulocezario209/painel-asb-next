// lib/funnel/jornada.ts — FONTE ÚNICA da lógica "Jornada do Cliente até a Recorrência".
//
// Classifica os clientes da carteira real ARES (v_carteira_360) por QUANTIDADE de
// pedidos FATURADOS VÁLIDOS no histórico completo (total_orders), em 5 estágios
// mutuamente exclusivos: 1º / 2º / 3º / 4º pedido e Recorrente (≥5).
//
// Duas VISÕES sobre a MESMA régua de classificação:
//   • Carteira Viva  → só clientes comercialmente vivos (customer_status ativo/atenção);
//                      exclui churn (risco/pré-churn/churn) e perdido (inativo definitivo).
//   • Histórico Geral→ TODA a carteira faturada, inclusive quem depois entrou em churn/perdido.
//
// A classificação (nº de pedidos) é SEMPRE pelo histórico completo — nunca pelo período
// da tela. Este módulo é PURO (sem React/Supabase) → testável isolado (tests/jornada.test.ts).
//
// Régua de status: reusa a convenção oficial (lib/customer-status.ts / fn_status_cliente).
// NÃO redefine churn/perdido — apenas LÊ o customer_status já calculado pela view.

export type JornadaView = "viva" | "geral";
export type JornadaStageKey = "p1" | "p2" | "p3" | "p4" | "recorrente";

// Linha mínima de cliente (subconjunto de v_carteira_360) que a classificação consome.
export interface JornadaClienteRow {
  ares_pessoa_id: number;
  total_orders: number | null;
  total_revenue_brl: number | null;
  customer_status: string | null;
}

// Carteira VIVA = comercialmente ativa (régua oficial existente: ativos-carteira.tsx LIVE_STATUS).
// Tudo fora disso é churn/perdido → sai da visão Viva, permanece na visão Histórico Geral.
export const VIVA_STATUS = new Set<string>(["ativo", "atencao"]);
export const isViva = (status: string | null | undefined): boolean =>
  !!status && VIVA_STATUS.has(status);

// Ordem visual + rótulos (1º → 2º → 3º → 4º → Recorrente).
export const JORNADA_STAGES: { key: JornadaStageKey; label: string; min: number; max: number | null; fill: string }[] = [
  { key: "p1",         label: "1º Pedido — Ativação", min: 1, max: 1,    fill: "#D4A017" },
  { key: "p2",         label: "2º Pedido",            min: 2, max: 2,    fill: "#185FA5" },
  { key: "p3",         label: "3º Pedido",            min: 3, max: 3,    fill: "#3b82f6" },
  { key: "p4",         label: "4º Pedido",            min: 4, max: 4,    fill: "#8b5cf6" },
  { key: "recorrente", label: "Cliente Recorrente",   min: 5, max: null, fill: "#22c55e" },
];

/** Estágio de um cliente pelo nº de pedidos faturados (histórico completo). null se 0/negativo. */
export function bucketByOrders(totalOrders: number | null | undefined): JornadaStageKey | null {
  const n = totalOrders ?? 0;
  if (n <= 0) return null;
  if (n === 1) return "p1";
  if (n === 2) return "p2";
  if (n === 3) return "p3";
  if (n === 4) return "p4";
  return "recorrente"; // ≥5
}

/** Aplica a régua da VISÃO (viva = só ativo/atenção; geral = todos). */
export function filterByView<T extends { customer_status: string | null }>(
  rows: T[],
  view: JornadaView,
): T[] {
  return view === "viva" ? rows.filter((r) => isViva(r.customer_status)) : rows;
}

export interface JornadaStageResult {
  key: JornadaStageKey;
  label: string;
  count: number;
  revenue: number;   // faturamento acumulado do grupo (BRL)
  orders: number;    // total de pedidos do grupo (p/ ticket médio ponderado)
  ticket: number;    // ticket médio do grupo = revenue / orders (valor médio por pedido)
  pct: number;       // % de clientes sobre a base da visão
  fill: string;
}
export interface JornadaResult {
  view: JornadaView;
  base: number;                    // total de clientes na visão (denominador do %)
  stages: JornadaStageResult[];
}

/**
 * Agrega os cards da Jornada para uma visão. Classificação SEMPRE por total_orders
 * (histórico completo). Categorias mutuamente exclusivas — um cliente cai em UM estágio.
 */
export function computeJornada(rows: JornadaClienteRow[], view: JornadaView): JornadaResult {
  const scoped = filterByView(rows, view);
  const acc: Record<JornadaStageKey, { count: number; revenue: number; orders: number }> = {
    p1: { count: 0, revenue: 0, orders: 0 },
    p2: { count: 0, revenue: 0, orders: 0 },
    p3: { count: 0, revenue: 0, orders: 0 },
    p4: { count: 0, revenue: 0, orders: 0 },
    recorrente: { count: 0, revenue: 0, orders: 0 },
  };
  let base = 0;
  for (const r of scoped) {
    const k = bucketByOrders(r.total_orders);
    if (!k) continue; // cliente sem pedido faturado válido não entra na jornada
    base++;
    acc[k].count++;
    acc[k].revenue += r.total_revenue_brl ?? 0;
    acc[k].orders += r.total_orders ?? 0;
  }
  const stages: JornadaStageResult[] = JORNADA_STAGES.map((s) => {
    const a = acc[s.key];
    return {
      key: s.key,
      label: s.label,
      count: a.count,
      revenue: a.revenue,
      orders: a.orders,
      ticket: a.orders > 0 ? a.revenue / a.orders : 0,
      pct: base > 0 ? (a.count / base) * 100 : 0,
      fill: s.fill,
    };
  });
  return { view, base, stages };
}

export interface JornadaAvancos {
  reached: { r1: number; r2: number; r3: number; r4: number; r5: number };
  av12: number | null;         // % que chegou ao 2º dado que chegou ao 1º
  av23: number | null;
  av34: number | null;
  recorrencia: number | null;  // % que virou recorrente (≥5) sobre quem fez ≥1 pedido
}

/**
 * Taxas de avanço (só visão Histórico Geral). Reconstrói a população ACUMULADA
 * (chegou ao Nº ou além) — NÃO usa as categorias exclusivas cruas.
 *   Avanço 1→2 = (≥2) / (≥1) · 2→3 = (≥3)/(≥2) · 3→4 = (≥4)/(≥3)
 *   Recorrência = (≥5) / (≥1)
 * Recebe a população da visão (para Histórico Geral, todos os clientes faturados).
 */
export function computeAvancos(rows: JornadaClienteRow[]): JornadaAvancos {
  let r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0;
  for (const r of rows) {
    const n = r.total_orders ?? 0;
    if (n >= 1) r1++;
    if (n >= 2) r2++;
    if (n >= 3) r3++;
    if (n >= 4) r4++;
    if (n >= 5) r5++;
  }
  const pct = (num: number, den: number): number | null => (den > 0 ? (num / den) * 100 : null);
  return {
    reached: { r1, r2, r3, r4, r5 },
    av12: pct(r2, r1),
    av23: pct(r3, r2),
    av34: pct(r4, r3),
    recorrencia: pct(r5, r1),
  };
}
