// Testes da lógica "Jornada do Cliente até a Recorrência" (lib/funnel/jornada.ts).
// Runner: node:test via tsx (mesmo padrão dos demais testes do repo).
//
// Cobre a spec (Paulo): classificação por nº de pedidos faturados (histórico completo),
// duas visões (Carteira Viva x Histórico Geral), mutualidade exclusiva, faturamento/ticket
// por card, % sobre a base da visão, e as taxas de avanço (população acumulada).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bucketByOrders,
  isViva,
  filterByView,
  computeJornada,
  computeAvancos,
  type JornadaClienteRow,
} from "../lib/funnel/jornada";

const cli = (
  id: number,
  total_orders: number,
  total_revenue_brl: number,
  customer_status: string,
): JornadaClienteRow => ({ ares_pessoa_id: id, total_orders, total_revenue_brl, customer_status });

// ── bucketByOrders: cliente cai no estágio certo pelo nº de pedidos ──────────────
test("cliente com exatamente 1 pedido → p1 (Ativação)", () => {
  assert.equal(bucketByOrders(1), "p1");
});
test("cliente com exatamente 2 pedidos → p2", () => {
  assert.equal(bucketByOrders(2), "p2");
});
test("cliente com exatamente 3 pedidos → p3", () => {
  assert.equal(bucketByOrders(3), "p3");
});
test("cliente com exatamente 4 pedidos → p4", () => {
  assert.equal(bucketByOrders(4), "p4");
});
test("cliente com 5 ou mais pedidos → recorrente", () => {
  assert.equal(bucketByOrders(5), "recorrente");
  assert.equal(bucketByOrders(7), "recorrente");
  assert.equal(bucketByOrders(99), "recorrente");
});
test("cliente com 0/negativo/null pedidos → sem estágio (null)", () => {
  assert.equal(bucketByOrders(0), null);
  assert.equal(bucketByOrders(-1), null);
  assert.equal(bucketByOrders(null), null);
  assert.equal(bucketByOrders(undefined), null);
});

// ── régua de Carteira Viva (status oficial) ──────────────────────────────────────
test("isViva: só ativo/atenção são carteira viva; churn/perdido não", () => {
  assert.equal(isViva("ativo"), true);
  assert.equal(isViva("atencao"), true);
  assert.equal(isViva("risco"), false);
  assert.equal(isViva("pre_churn"), false);
  assert.equal(isViva("churn_comercial"), false);
  assert.equal(isViva("inativo_definitivo"), false);
  assert.equal(isViva(null), false);
});

// ── Recorrência exclusiva: cliente com 7 pedidos SÓ em Recorrente, não nos anteriores ──
test("cliente recorrente (7 pedidos) aparece só em Recorrente, categorias exclusivas", () => {
  const rows = [cli(1, 7, 70000, "ativo")];
  const r = computeJornada(rows, "geral");
  const byKey = Object.fromEntries(r.stages.map((s) => [s.key, s.count]));
  assert.equal(byKey.recorrente, 1);
  assert.equal(byKey.p1, 0);
  assert.equal(byKey.p2, 0);
  assert.equal(byKey.p3, 0);
  assert.equal(byKey.p4, 0);
  // soma dos estágios = base (sem duplicidade)
  const soma = r.stages.reduce((a, s) => a + s.count, 0);
  assert.equal(soma, r.base);
});

// ── recorrente em churn: fica FORA da Viva, DENTRO do Histórico Geral ─────────────
test("cliente recorrente em churn: some da Carteira Viva, permanece no Histórico Geral", () => {
  const rows = [cli(1, 6, 60000, "churn_comercial")];
  const viva = computeJornada(rows, "viva");
  const geral = computeJornada(rows, "geral");
  assert.equal(viva.base, 0); // excluído da viva
  assert.equal(geral.base, 1);
  assert.equal(geral.stages.find((s) => s.key === "recorrente")!.count, 1);
});

// ── perdido com histórico de compras: só no Histórico Geral ──────────────────────
test("cliente perdido (inativo definitivo) com 3 pedidos: fora da Viva, dentro do Geral em p3", () => {
  const rows = [cli(1, 3, 30000, "inativo_definitivo")];
  assert.equal(filterByView(rows, "viva").length, 0);
  assert.equal(filterByView(rows, "geral").length, 1);
  const geral = computeJornada(rows, "geral");
  assert.equal(geral.stages.find((s) => s.key === "p3")!.count, 1);
});

// ── alternância de visão muda a base e os counts ─────────────────────────────────
test("alternância Carteira Viva ↔ Histórico Geral altera base e counts", () => {
  const rows = [
    cli(1, 1, 5000, "ativo"),
    cli(2, 2, 12000, "atencao"),
    cli(3, 3, 30000, "churn_comercial"), // fora da viva
    cli(4, 6, 90000, "inativo_definitivo"), // fora da viva
  ];
  const viva = computeJornada(rows, "viva");
  const geral = computeJornada(rows, "geral");
  assert.equal(viva.base, 2);   // só ativo + atenção
  assert.equal(geral.base, 4);  // todos
  assert.equal(viva.stages.find((s) => s.key === "p3")!.count, 0);   // churn não entra na viva
  assert.equal(geral.stages.find((s) => s.key === "p3")!.count, 1);  // entra no geral
  assert.equal(geral.stages.find((s) => s.key === "recorrente")!.count, 1);
});

// ── total faturado por card + ticket médio ───────────────────────────────────────
test("faturamento e ticket médio do grupo (ponderado por pedidos)", () => {
  const rows = [
    cli(1, 2, 10000, "ativo"), // 2 pedidos
    cli(2, 2, 6000, "ativo"),  // 2 pedidos
  ];
  const r = computeJornada(rows, "geral");
  const p2 = r.stages.find((s) => s.key === "p2")!;
  assert.equal(p2.count, 2);
  assert.equal(p2.revenue, 16000);       // faturamento total do grupo
  assert.equal(p2.orders, 4);            // 2+2 pedidos
  assert.equal(p2.ticket, 4000);         // 16000 / 4 pedidos
});

// ── % sobre a base da visão ──────────────────────────────────────────────────────
test("percentual é sobre a base da visão (não sobre 360 global)", () => {
  const rows = [
    cli(1, 1, 1000, "ativo"),
    cli(2, 1, 1000, "ativo"),
    cli(3, 2, 4000, "ativo"),
    cli(4, 5, 50000, "churn_comercial"), // só no geral
  ];
  const viva = computeJornada(rows, "viva"); // base 3
  const p1 = viva.stages.find((s) => s.key === "p1")!;
  assert.equal(viva.base, 3);
  assert.equal(Math.round(p1.pct), 67); // 2/3
});

// ── sem duplicidade: soma dos cards = base em qualquer visão ─────────────────────
test("ausência de duplicidade: soma dos 5 cards = base (viva e geral)", () => {
  const rows = [
    cli(1, 1, 1000, "ativo"),
    cli(2, 2, 2000, "atencao"),
    cli(3, 3, 3000, "risco"),
    cli(4, 4, 4000, "pre_churn"),
    cli(5, 9, 9000, "inativo_definitivo"),
  ];
  for (const view of ["viva", "geral"] as const) {
    const r = computeJornada(rows, view);
    assert.equal(r.stages.reduce((a, s) => a + s.count, 0), r.base);
  }
});

// ── filtro de período NÃO reclassifica: total_orders é histórico completo ────────
test("classificação usa histórico completo (total_orders), imune a período", () => {
  // Simula que a mesma linha (histórico=7) nunca vira p1/p2 — bucket só olha total_orders.
  const recorrente = cli(1, 7, 70000, "ativo");
  assert.equal(bucketByOrders(recorrente.total_orders), "recorrente");
});

// ── taxas de avanço (população ACUMULADA, não categorias cruas) ──────────────────
test("taxas de avanço reconstroem a população acumulada corretamente", () => {
  // 10 clientes: 4×1ped, 3×2ped, 2×3ped, 1×6ped
  const rows: JornadaClienteRow[] = [
    ...Array.from({ length: 4 }, (_, i) => cli(100 + i, 1, 1000, "ativo")),
    ...Array.from({ length: 3 }, (_, i) => cli(200 + i, 2, 2000, "ativo")),
    ...Array.from({ length: 2 }, (_, i) => cli(300 + i, 3, 3000, "ativo")),
    cli(400, 6, 6000, "ativo"),
  ];
  const a = computeAvancos(rows);
  // acumulado: r1=10, r2=6, r3=3, r4=1, r5=1
  assert.deepEqual(a.reached, { r1: 10, r2: 6, r3: 3, r4: 1, r5: 1 });
  assert.equal(Math.round(a.av12!), 60);       // 6/10
  assert.equal(Math.round(a.av23!), 50);       // 3/6
  assert.equal(Math.round(a.av34!), 33);       // 1/3
  assert.equal(Math.round(a.recorrencia!), 10); // 1/10
});

test("taxas de avanço com base vazia → null, sem divisão por zero", () => {
  const a = computeAvancos([]);
  assert.equal(a.av12, null);
  assert.equal(a.av23, null);
  assert.equal(a.av34, null);
  assert.equal(a.recorrencia, null);
});

// ── dedup: v_carteira_360 pode duplicar cliente (fan-out do JOIN vendors) ────────
test("cliente duplicado na fonte é contado UMA vez (count e faturamento)", () => {
  // Mesmo cliente (ares_pessoa_id=1) aparece 2× — não pode inflar count nem revenue.
  const rows: JornadaClienteRow[] = [
    cli(1, 6, 90000, "ativo"),
    cli(1, 6, 90000, "ativo"), // duplicata (fan-out)
    cli(2, 2, 10000, "ativo"),
  ];
  const r = computeJornada(rows, "geral");
  assert.equal(r.base, 2); // não 3
  const rec = r.stages.find((s) => s.key === "recorrente")!;
  assert.equal(rec.count, 1);       // contado uma vez
  assert.equal(rec.revenue, 90000); // faturamento não dobrado
  // avanços também não inflam
  const a = computeAvancos(rows);
  assert.equal(a.reached.r1, 2);
});

// ── robustez: revenue/orders nulos não viram NaN ─────────────────────────────────
test("campos nulos (revenue/orders) não produzem NaN", () => {
  const rows: JornadaClienteRow[] = [
    { ares_pessoa_id: 1, total_orders: 1, total_revenue_brl: null, customer_status: "ativo" },
  ];
  const r = computeJornada(rows, "geral");
  const p1 = r.stages.find((s) => s.key === "p1")!;
  assert.equal(p1.revenue, 0);
  assert.equal(p1.ticket, 0);
  assert.equal(Number.isNaN(p1.ticket), false);
});
