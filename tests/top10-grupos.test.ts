// Testes da consolidação do Top 10 por grupo econômico (Grupo Alemão).
// Cobrem: consolidação exibida numa entrada única, prevenção de duplicidade,
// composição por unidade (só exibe se fechar com o total) e share com guardas.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ordenarELimitar,
  composicaoConfere,
  shareConsolidado,
  type Top10GrupoRow,
} from "../lib/top10-grupos";

function row(partial: Partial<Top10GrupoRow>): Top10GrupoRow {
  return {
    chave: "cliente:1",
    eh_grupo: false,
    nome_exibicao: "Cliente",
    ares_pessoa_id: 1,
    contato: null,
    bairro: null,
    vendedor_routing_team: "SETOR_CUIT",
    vendedor_nome: "Paulo",
    pedidos_mes: 1,
    receita_mes: 100,
    recorrencia_semanal: 1,
    ticket_medio: 100,
    unidades: 1,
    composicao: null,
    receita_total_mes: 1000,
    ...partial,
  };
}

const grupoAlemao = row({
  chave: "grupo:1",
  eh_grupo: true,
  nome_exibicao: "Grupo Alemão",
  unidades: 3,
  pedidos_mes: 5,
  receita_mes: 12743.6,
  composicao: [
    { ares_pessoa_id: 1892, nome: "ALEMAO BURGUER IBITI", receita_mes: 6044.96, pedidos_mes: 2 },
    { ares_pessoa_id: 171, nome: "ALEMAO CENTRO", receita_mes: 3180.4, pedidos_mes: 1 },
    { ares_pessoa_id: 1392, nome: "ALEMAO VOTORANTIM", receita_mes: 3518.24, pedidos_mes: 2 },
  ],
});

test("grupo aparece UMA vez, na posição do faturamento consolidado", () => {
  const rows = [
    row({ chave: "cliente:10", receita_mes: 20000 }),
    grupoAlemao,
    row({ chave: "cliente:11", receita_mes: 9000 }),
    row({ chave: "cliente:12", receita_mes: 500 }),
  ];
  const top = ordenarELimitar(rows, 10);
  const grupos = top.filter((r) => r.eh_grupo);
  assert.equal(grupos.length, 1);
  assert.equal(top[1].chave, "grupo:1"); // 12.743,60 fica entre 20.000 e 9.000
  assert.equal(top[1].nome_exibicao, "Grupo Alemão");
});

test("dedupe defensivo por chave: mesma chave nunca soma nem aparece 2x", () => {
  const dup = { ...grupoAlemao };
  const top = ordenarELimitar([grupoAlemao, dup, row({ chave: "cliente:2", receita_mes: 50 })], 10);
  assert.equal(top.filter((r) => r.chave === "grupo:1").length, 1);
  assert.equal(top.length, 2);
});

test("limita a N depois de ordenar", () => {
  const rows = Array.from({ length: 15 }, (_, i) =>
    row({ chave: `cliente:${i}`, receita_mes: i * 10 })
  );
  const top = ordenarELimitar(rows, 10);
  assert.equal(top.length, 10);
  assert.equal(top[0].receita_mes, 140); // maior primeiro
  assert.ok(top.every((r, i) => i === 0 || Number(top[i - 1].receita_mes) >= Number(r.receita_mes)));
});

test("composição confere quando a soma das unidades fecha com o total do grupo", () => {
  assert.equal(composicaoConfere(grupoAlemao), true);
});

test("composição NÃO exibida se a soma das unidades divergir do total (anti número errado)", () => {
  const quebrado = {
    ...grupoAlemao,
    composicao: [
      { ares_pessoa_id: 171, nome: "ALEMAO CENTRO", receita_mes: 999, pedidos_mes: 1 },
    ],
  };
  assert.equal(composicaoConfere(quebrado), false);
});

test("composição não se aplica a cliente individual", () => {
  assert.equal(composicaoConfere(row({ eh_grupo: false })), false);
});

test("share: exibe % correto sobre o total do período", () => {
  const s = shareConsolidado(50000, 200000);
  assert.equal(s.show, true);
  if (s.show) {
    assert.equal(s.pctLabel, "25,0%");
    assert.equal(s.barPct, 25);
  }
});

test("share: esconde sem total válido ou com % impossível (>100)", () => {
  assert.equal(shareConsolidado(100, 0).show, false);
  assert.equal(shareConsolidado(100, null).show, false);
  assert.equal(shareConsolidado(0, 1000).show, false);
  assert.equal(shareConsolidado(2000, 1000).show, false);
});
