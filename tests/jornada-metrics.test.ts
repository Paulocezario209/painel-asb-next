// Testes das métricas V2 da Jornada (lib/funnel/jornada-metrics.ts).
// Runner: node:test via tsx.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  median, mean, daysBetween, gaps,
  computeIntervalos, computeRankMedians, computeScore, scoreFaixa, computeFunilJornada,
  type ClienteHistorico,
} from "../lib/funnel/jornada-metrics";

const h = (id: number, status: string, pedidos: [string, number][]): ClienteHistorico => ({
  ares_pessoa_id: id, customer_status: status, pedidos: pedidos.map(([data, valor]) => ({ data, valor })),
});

// ── estatística ──────────────────────────────────────────────────────────────
test("median: ímpar e par", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});
test("mean e daysBetween", () => {
  assert.equal(mean([2, 4, 6]), 4);
  assert.equal(daysBetween("2026-01-01", "2026-01-08"), 7);
});
test("gaps consecutivos", () => {
  assert.deepEqual(gaps(h(1, "ativo", [["2026-01-01", 100], ["2026-01-08", 100], ["2026-01-18", 100]])), [7, 10]);
});

// ── intervalos por estágio: mediana principal + média secundária ─────────────
test("computeIntervalos: p2 usa gap 1º→2º; recorrente usa 1º→5º", () => {
  const clientes = [
    h(1, "ativo", [["2026-01-01", 100], ["2026-01-11", 100]]),            // p2, gap 10
    h(2, "ativo", [["2026-01-01", 100], ["2026-01-21", 100]]),            // p2, gap 20
    h(3, "ativo", [["2026-01-01", 100], ["2026-01-08", 100], ["2026-01-15", 100], ["2026-01-22", 100], ["2026-02-10", 100]]), // recorrente, 1º→5º = 40d
  ];
  const iv = computeIntervalos(clientes);
  assert.equal(iv.p2.n, 2);
  assert.equal(iv.p2.medianaDias, 15);  // mediana(10,20)
  assert.equal(iv.p2.mediaDias, 15);
  assert.equal(iv.recorrente.n, 1);
  assert.equal(iv.recorrente.medianaDias, 40);
});

// ── funil da jornada: população acumulada + taxa de avanço ───────────────────
test("computeFunilJornada: acumulado decrescente + taxa de avanço", () => {
  const clientes = [
    h(1, "ativo", [["2026-01-01", 100]]),                                                   // 1 pedido
    h(2, "ativo", [["2026-01-01", 100], ["2026-01-08", 100]]),                               // 2
    h(3, "ativo", [["2026-01-01", 100], ["2026-01-08", 100], ["2026-01-15", 100]]),          // 3
    h(4, "ativo", Array.from({ length: 6 }, (_, i) => [`2026-0${1}-0${i + 1}`, 100] as [string, number])), // 6 → recorrente
  ];
  const f = computeFunilJornada(clientes);
  assert.equal(f[0].clientesAcumulado, 4); // ≥1
  assert.equal(f[1].clientesAcumulado, 3); // ≥2
  assert.equal(f[2].clientesAcumulado, 2); // ≥3
  assert.equal(f[3].clientesAcumulado, 1); // ≥4
  assert.equal(f[4].clientesAcumulado, 1); // ≥5
  assert.equal(f[0].taxaAvanco, null);
  assert.equal(Math.round(f[1].taxaAvanco!), 75); // 3/4
  assert.equal(f[0].faturamentoAcumulado, 100 + 200 + 300 + 600); // soma do revenue total dos que chegaram a ≥1
});

// ── rank medians (referência do score) ───────────────────────────────────────
test("computeRankMedians: mediana de gap por rank", () => {
  const clientes = [
    h(1, "ativo", [["2026-01-01", 100], ["2026-01-08", 100]]),  // rank2 gap 7
    h(2, "ativo", [["2026-01-01", 100], ["2026-01-15", 100]]),  // rank2 gap 14
  ];
  const rm = computeRankMedians(clientes);
  assert.equal(rm.get(2), 10.5); // mediana(7,14)
});

// ── SCORE V1 (auditável) ──────────────────────────────────────────────────────
test("scoreFaixa: limites das 4 faixas", () => {
  assert.equal(scoreFaixa(0), "verde");
  assert.equal(scoreFaixa(30), "verde");
  assert.equal(scoreFaixa(31), "amarelo");
  assert.equal(scoreFaixa(60), "amarelo");
  assert.equal(scoreFaixa(61), "laranja");
  assert.equal(scoreFaixa(80), "laranja");
  assert.equal(scoreFaixa(81), "vermelho");
  assert.equal(scoreFaixa(100), "vermelho");
});

test("cliente no prazo (comprou hoje, cadência estável) → score baixo/verde", () => {
  const rm = new Map<number, number>([[2, 7], [3, 7], [4, 7]]);
  const cli = h(1, "ativo", [["2026-01-01", 1000], ["2026-01-08", 1000], ["2026-01-15", 1000]]);
  const r = computeScore(cli, "2026-01-16", rm); // 1 dia desde último (cadência 7d)
  assert.equal(r.faixa, "verde");
  assert.ok(r.score <= 30);
});

test("silêncio longo mas histórico estável satura em atraso+recência (≤65 → laranja)", () => {
  const rm = new Map<number, number>([[2, 7], [3, 7], [4, 7]]);
  const cli = h(1, "ativo", [["2026-01-01", 1000], ["2026-01-08", 1000], ["2026-01-15", 1000]]);
  const r = computeScore(cli, "2026-04-15", rm); // 90 dias desde último
  // atraso(40) + recência(25) maxados = 65; sem decaimento de freq/fat NÃO chega a vermelho (design dos pesos).
  assert.equal(r.componentes.atraso, 100);
  assert.equal(r.componentes.recencia, 100);
  assert.equal(r.componentes.frequencia, 0);
  assert.equal(r.componentes.faturamento, 0);
  assert.equal(r.score, 65);
  assert.equal(r.faixa, "laranja");
});

test("atraso + queda de frequência + queda de faturamento → crítico/vermelho", () => {
  const rm = new Map<number, number>([[2, 7], [3, 7], [4, 7]]);
  const cli = h(1, "atencao", [["2026-01-01", 2000], ["2026-01-08", 2000], ["2026-02-20", 300]]);
  const r = computeScore(cli, "2026-04-15", rm);
  assert.equal(r.faixa, "vermelho");
  assert.ok(r.score >= 81);
});

test("queda de frequência e faturamento elevam o score", () => {
  const rm = new Map<number, number>([[2, 7], [3, 7], [4, 7]]);
  // último gap 30d (vs média baixa) + último pedido bem menor que o ticket médio
  const cli = h(1, "atencao", [["2026-01-01", 2000], ["2026-01-08", 2000], ["2026-02-07", 200]]);
  const r = computeScore(cli, "2026-02-20", rm);
  assert.ok(r.componentes.frequencia > 0);
  assert.ok(r.componentes.faturamento > 0);
});

test("cliente de 1 pedido: frequência e faturamento não computáveis → componentes 0 (não inventa)", () => {
  const rm = new Map<number, number>([[2, 7]]);
  const cli = h(1, "ativo", [["2026-01-01", 1000]]);
  const r = computeScore(cli, "2026-01-05", rm);
  assert.equal(r.componentes.frequencia, 0);
  assert.equal(r.componentes.faturamento, 0);
});

// ── buildViewModel: cards enriquecidos + % faturamento + funil por visão ──────
import { buildViewModel, type JornadaClienteAgg } from "../lib/funnel/jornada-metrics";
const agg = (id: number, status: string, pedidos: [string, number][]): JornadaClienteAgg => {
  const ped = pedidos.map(([data, valor]) => ({ data, valor }));
  return {
    ares_pessoa_id: id, customer_status: status, pedidos: ped,
    total_orders: ped.length, total_revenue_brl: ped.reduce((a, p) => a + p.valor, 0),
    avg_ticket_brl: ped.length ? ped.reduce((a, p) => a + p.valor, 0) / ped.length : 0,
  };
};
test("buildViewModel: viva exclui churn; % da base e % do faturamento corretos", () => {
  const rows = [
    agg(1, "ativo", [["2026-01-01", 1000]]),                                  // p1
    agg(2, "ativo", [["2026-01-01", 1000], ["2026-01-08", 3000]]),            // p2
    agg(3, "churn_comercial", [["2026-01-01", 500], ["2026-01-08", 500], ["2026-01-15", 500], ["2026-01-22", 500], ["2026-02-01", 500]]), // recorrente, fora da viva
  ];
  const viva = buildViewModel(rows, "viva", "2026-02-15");
  assert.equal(viva.base, 2);                                   // churn fora
  assert.equal(viva.totalRevenue, 1000 + 4000);
  const p2 = viva.cards.find((c) => c.key === "p2")!;
  assert.equal(p2.count, 1);
  assert.equal(Math.round(p2.pct), 50);                        // 1/2
  assert.equal(Math.round(p2.pctRevenue), 80);                 // 4000/5000
  assert.equal(p2.medianaDias, 7);                             // gap 1º→2º
  const geral = buildViewModel(rows, "geral", "2026-02-15");
  assert.equal(geral.base, 3);                                 // churn entra
  assert.equal(geral.funil[0].clientesAcumulado, 3);
});
