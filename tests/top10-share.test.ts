// Testes do indicador "Top 10 x Faturamento Mensal" (lib/top10-share.ts).
// Runner: node:test via tsx (mesmo padrão dos demais testes do repo).
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveTop10Share, brl, pctBR, type Top10ShareRow } from "../lib/top10-share";

const row = (over: Partial<Top10ShareRow> = {}): Top10ShareRow => ({
  receita_top10: 340084.77,
  faturamento_mensal_total: 765836.85,
  percentual_top10: 44.4,
  periodo: "2026-07",
  criterio: "pedido_faturado",
  ...over,
});

test("percentual normal (dados reais 2026-07)", () => {
  const v = resolveTop10Share(340084.77, row());
  assert.equal(v.show, true);
  if (v.show) {
    assert.equal(v.pct, 44.4);
    assert.equal(v.barPct, 44.4);
    assert.equal(v.pctLabel, "44,4%");
    assert.equal(v.totalLabel, "R$ 765.836,85");
    assert.equal(v.periodo, "2026-07");
  }
});

test("faturamento mensal igual a zero → percentual 0, sem divisão por zero", () => {
  const v = resolveTop10Share(0, row({ receita_top10: 0, faturamento_mensal_total: 0, percentual_top10: 0 }));
  assert.equal(v.show, true);
  if (v.show) assert.equal(v.pct, 0);
});

test("receita Top 10 igual a zero → 0,0%", () => {
  const v = resolveTop10Share(0, row({ receita_top10: 0, percentual_top10: 0 }));
  assert.equal(v.show, true);
  if (v.show) assert.equal(v.pctLabel, "0,0%");
});

test("ausência de dados (row null) → estado vazio", () => {
  const v = resolveTop10Share(1000, null);
  assert.deepEqual(v, { show: false, reason: "sem_dados" });
});

test("campos nulos inesperados → estado vazio, nunca NaN", () => {
  const v = resolveTop10Share(1000, row({ percentual_top10: null }));
  assert.deepEqual(v, { show: false, reason: "sem_dados" });
});

test("valores numéricos como string (PostgREST numeric) → parse correto", () => {
  const v = resolveTop10Share(
    340084.77,
    row({ receita_top10: "340084.77", faturamento_mensal_total: "765836.85", percentual_top10: "44.4" })
  );
  assert.equal(v.show, true);
});

test("arredondamento para 1 casa decimal", () => {
  // 68.44...% → 68,4
  const v = resolveTop10Share(340084.77, row({ faturamento_mensal_total: 497200.0, percentual_top10: 68.4 }));
  assert.equal(v.show, true);
  if (v.show) assert.equal(v.pctLabel, "68,4%");
});

test("formatação monetária pt-BR", () => {
  assert.equal(brl(340084.77), "R$ 340.084,77");
  assert.equal(brl(0), "R$ 0,00");
  assert.equal(pctBR(68.4), "68,4%");
});

test("soma dos dez exibidos diferente do agregado → inconsistente, não exibe", () => {
  const v = resolveTop10Share(999999.99, row());
  assert.deepEqual(v, { show: false, reason: "inconsistente" });
});

test("percentual do backend divergente do cálculo matemático → inconsistente", () => {
  const v = resolveTop10Share(340084.77, row({ percentual_top10: 90 }));
  assert.deepEqual(v, { show: false, reason: "inconsistente" });
});

test("percentual acima de 100 → interrompe exibição", () => {
  const v = resolveTop10Share(200, row({ receita_top10: 200, faturamento_mensal_total: 100, percentual_top10: 200 }));
  assert.deepEqual(v, { show: false, reason: "inconsistente" });
});

test("tolerância de 1 centavo na conciliação da soma exibida", () => {
  const v = resolveTop10Share(340084.78, row());
  assert.equal(v.show, true);
});

test("barra nunca passa de 100% de largura", () => {
  const v = resolveTop10Share(100, row({ receita_top10: 100, faturamento_mensal_total: 100, percentual_top10: 100 }));
  assert.equal(v.show, true);
  if (v.show) assert.equal(v.barPct, 100);
});
