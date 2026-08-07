// Testes da COORTE MENSAL da "Jornada do Cliente até a Recorrência".
// Runner: node:test via tsx (mesmo padrão dos demais testes do repo).
//
// Spec (Paulo, 2026-08-05): a competência do seletor de mês do topo comanda a seção.
// Entra na coorte de M todo cliente cujo 1º pedido faturado ocorreu em M — sem exigir
// origem SDR. Dentro da coorte contam SÓ os pedidos de M. Cards exclusivos, funil
// acumulado, taxas sobre a mesma coorte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cohortDoMes, dedupePedidos, isCompetenciaValida, mesDe } from "../lib/funnel/jornada";
import { buildViewModel, type JornadaClienteAgg } from "../lib/funnel/jornada-metrics";

type Ped = { data: string; valor: number; ares_pedido_id?: number | null };
const cli = (id: number, pedidos: Ped[], status = "ativo"): JornadaClienteAgg => ({
  ares_pessoa_id: id,
  customer_status: status,
  pedidos,
  total_orders: pedidos.length,
  total_revenue_brl: pedidos.reduce((a, p) => a + p.valor, 0),
  avg_ticket_brl: pedidos.length ? pedidos.reduce((a, p) => a + p.valor, 0) / pedidos.length : 0,
});
const HOJE = "2026-07-31";
const vmMes = (rows: JornadaClienteAgg[], mes: string) => buildViewModel(rows, "mes", HOJE, mes);
const card = (vm: ReturnType<typeof vmMes>, k: string) => vm.cards.find((c) => c.key === k)!;
const funil = (vm: ReturnType<typeof vmMes>, k: string) => vm.funil.find((f) => f.key === k)!;

// ── helpers de competência ───────────────────────────────────────────────────
test("mesDe extrai YYYY-MM sem conversão de fuso", () => {
  assert.equal(mesDe("2026-07-31"), "2026-07");
  assert.equal(mesDe("2026-07-01"), "2026-07");
});
test("isCompetenciaValida aceita YYYY-MM e recusa lixo", () => {
  assert.equal(isCompetenciaValida("2026-07"), true);
  assert.equal(isCompetenciaValida("2026-13"), false);
  assert.equal(isCompetenciaValida("julho"), false);
  assert.equal(isCompetenciaValida(undefined), false);
});

// ── Cenário 1: 1 pedido no mês → card p1, funil só no 1º ─────────────────────
test("Cenário 1 — 1 pedido no mês: card p1 e funil só na etapa 1", () => {
  const vm = vmMes([cli(1, [{ data: "2026-07-05", valor: 1200 }])], "2026-07");
  assert.equal(vm.base, 1);
  assert.equal(card(vm, "p1").count, 1);
  assert.equal(card(vm, "p2").count, 0);
  assert.equal(funil(vm, "p1").clientesAcumulado, 1);
  assert.equal(funil(vm, "p2").clientesAcumulado, 0);
});

// ── Cenário 2: 2 pedidos no mês ──────────────────────────────────────────────
test("Cenário 2 — 2 pedidos no mês: card p2, funil acumula em 1º e 2º", () => {
  const vm = vmMes([cli(1, [{ data: "2026-07-05", valor: 1200 }, { data: "2026-07-12", valor: 980 }])], "2026-07");
  assert.equal(card(vm, "p1").count, 0, "cards são exclusivos — não pode contar em p1 também");
  assert.equal(card(vm, "p2").count, 1);
  assert.equal(funil(vm, "p1").clientesAcumulado, 1);
  assert.equal(funil(vm, "p2").clientesAcumulado, 1);
  assert.equal(funil(vm, "p3").clientesAcumulado, 0);
  assert.equal(vm.totalRevenue, 2180, "faturamento = soma dos pedidos do mês");
});

// ── Cenário 3: 4 pedidos no mês ──────────────────────────────────────────────
test("Cenário 3 — 4 pedidos no mês: card p4 e funil nas 4 primeiras etapas", () => {
  const vm = vmMes([cli(1, [
    { data: "2026-07-02", valor: 100 }, { data: "2026-07-09", valor: 100 },
    { data: "2026-07-16", valor: 100 }, { data: "2026-07-23", valor: 100 },
  ])], "2026-07");
  assert.equal(card(vm, "p4").count, 1);
  for (const k of ["p1", "p2", "p3", "p4"]) assert.equal(funil(vm, k).clientesAcumulado, 1);
  assert.equal(funil(vm, "recorrente").clientesAcumulado, 0);
});

// ── Cenário 4: recorrência dentro do mês (≥5) ────────────────────────────────
test("Cenário 4 — 5 pedidos no mês: card recorrente e funil em todas as etapas", () => {
  const vm = vmMes([cli(1, [1, 2, 3, 4, 5].map((d) => ({ data: `2026-07-0${d}`, valor: 200 })))], "2026-07");
  assert.equal(card(vm, "recorrente").count, 1);
  for (const k of ["p1", "p2", "p3", "p4", "recorrente"]) assert.equal(funil(vm, k).clientesAcumulado, 1);
});

// ── Cenário 5: jornada cruza o mês — não vaza ────────────────────────────────
test("Cenário 5 — 2 pedidos em julho + 1 em agosto: julho vê só 2; agosto não reativa", () => {
  const c = cli(1, [
    { data: "2026-07-05", valor: 100 }, { data: "2026-07-20", valor: 100 },
    { data: "2026-08-03", valor: 100 },
  ]);
  const jul = vmMes([c], "2026-07");
  assert.equal(card(jul, "p2").count, 1, "julho: estágio 2º pedido");
  assert.equal(card(jul, "p3").count, 0, "pedido de agosto NÃO pode avançar a jornada de julho");
  assert.equal(funil(jul, "p3").clientesAcumulado, 0);

  const ago = vmMes([c], "2026-08");
  assert.equal(ago.base, 0, "cliente ativou em julho — não entra como ativação de agosto");
});

test("Cenário 5b — histórico geral do mesmo cliente considera os 3 pedidos", () => {
  const c = cli(1, [
    { data: "2026-07-05", valor: 100 }, { data: "2026-07-20", valor: 100 },
    { data: "2026-08-03", valor: 100 },
  ]);
  const geral = buildViewModel([c], "geral", HOJE);
  assert.equal(card(geral as never, "p3").count, 1, "histórico geral: 3 pedidos → p3");
});

// ── Cenário 6: ativou antes do mês → fora da coorte ──────────────────────────
test("Cenário 6 — 1º pedido em junho: não entra na coorte de julho mesmo comprando em julho", () => {
  const vm = vmMes([cli(1, [{ data: "2026-06-20", valor: 100 }, { data: "2026-07-10", valor: 100 }])], "2026-07");
  assert.equal(vm.base, 0, "a coorte é de ATIVAÇÃO — quem já era cliente não reativa");
});

// ── Cenário 8: dedupe por ares_pedido_id ─────────────────────────────────────
test("Cenário 8 — pedido duplicado pelo mesmo ares_pedido_id conta uma vez só", () => {
  const dup = dedupePedidos({
    pedidos: [
      { data: "2026-07-05", valor: 100, ares_pedido_id: 555 },
      { data: "2026-07-05", valor: 100, ares_pedido_id: 555 },
      { data: "2026-07-09", valor: 100, ares_pedido_id: 556 },
    ],
  });
  assert.equal(dup.pedidos.length, 2);
  const vm = vmMes([cli(1, [
    { data: "2026-07-05", valor: 100, ares_pedido_id: 555 },
    { data: "2026-07-05", valor: 100, ares_pedido_id: 555 },
  ])], "2026-07");
  assert.equal(card(vm, "p1").count, 1, "duplicata não pode promover o cliente para p2");
  assert.equal(vm.totalRevenue, 100, "duplicata não pode dobrar o faturamento");
});

// ── Taxas de avanço + divisão por zero ───────────────────────────────────────
test("taxas de avanço saem da mesma coorte e tratam denominador zero", () => {
  const vm = vmMes([
    cli(1, [{ data: "2026-07-01", valor: 100 }]),
    cli(2, [{ data: "2026-07-02", valor: 100 }, { data: "2026-07-10", valor: 100 }]),
  ], "2026-07");
  assert.equal(funil(vm, "p1").clientesAcumulado, 2);
  assert.equal(funil(vm, "p2").clientesAcumulado, 1);
  assert.equal(funil(vm, "p2").taxaAvanco, 50);
  assert.equal(funil(vm, "p4").taxaAvanco, null, "denominador zero → null, nunca 0% enganoso");
});

// ── Coorte vazia e competência inválida não quebram ──────────────────────────
test("competência sem clientes devolve base 0 sem quebrar", () => {
  const vm = vmMes([cli(1, [{ data: "2026-07-05", valor: 100 }])], "2026-01");
  assert.equal(vm.base, 0);
  assert.equal(vm.cards.length, 5);
  assert.equal(vm.funil.length, 5);
});
test("competência inválida devolve view-model vazio em vez de inventar recorte", () => {
  const vm = buildViewModel([cli(1, [{ data: "2026-07-05", valor: 100 }])], "mes", HOJE, "lixo");
  assert.equal(vm.base, 0);
  assert.equal(vm.cards.length, 5);
});

// ── Origem não interfere: cliente sem lead entra normalmente ─────────────────
test("cliente sem vínculo com SDR entra na coorte (origem não interfere)", () => {
  const vm = vmMes([cli(99, [{ data: "2026-07-15", valor: 500 }], "risco")], "2026-07");
  assert.equal(vm.base, 1, "status/origem não filtram a coorte mensal — só a data do 1º pedido");
});

// ── Soma dos cards = base da coorte ──────────────────────────────────────────
test("soma dos cards exclusivos = total de clientes da coorte", () => {
  const vm = vmMes([
    cli(1, [{ data: "2026-07-01", valor: 100 }]),
    cli(2, [{ data: "2026-07-02", valor: 100 }, { data: "2026-07-11", valor: 100 }]),
    cli(3, [1, 2, 3, 4, 5, 6].map((d) => ({ data: `2026-07-0${d}`, valor: 100 }))),
  ], "2026-07");
  assert.equal(vm.cards.reduce((a, c) => a + c.count, 0), vm.base);
  assert.equal(vm.base, 3);
  assert.equal(card(vm, "recorrente").count, 1, "6 pedidos ≥5 → recorrente");
});

// ── cohortDoMes puro ─────────────────────────────────────────────────────────
test("cohortDoMes recorta os pedidos ao mês e descarta quem não ativou nele", () => {
  const out = cohortDoMes([
    { pedidos: [{ data: "2026-07-05", valor: 1 }, { data: "2026-08-01", valor: 1 }] },
    { pedidos: [{ data: "2026-06-05", valor: 1 }, { data: "2026-07-02", valor: 1 }] },
    { pedidos: [] },
  ], "2026-07");
  assert.equal(out.length, 1);
  assert.equal(out[0].pedidos.length, 1, "só o pedido de julho fica");
});
