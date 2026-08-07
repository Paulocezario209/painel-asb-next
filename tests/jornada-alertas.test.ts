// Testes dos ALERTAS da Jornada (lib/jornada/alertas.ts) — 2 níveis: 48h e +24h.
// Runner: node:test via tsx. Relógio sempre injetado (nada de Date.now implícito).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  etapaPorPedidos, venceEm, criticoEm, proximoEstado, acaoValida,
  normalizarTelefone, chavesDeTelefone, rotuloAtraso, referenciaContador,
  RECORRENTE_MIN_PEDIDOS, type MensagemVendedor,
} from "../lib/jornada/alertas";

const FAT = new Date("2026-08-01T10:00:00-03:00");           // pedido de origem
const V = venceEm(FAT);                                       // +48h
const C = criticoEm(FAT);                                     // +72h
const VEND = "vendor-ana";
const alerta = (estado = "pendente", acao_em: string | null = null) => ({
  estado: estado as never, faturado_em: FAT.toISOString(),
  vence_em: V.toISOString(), critico_em: C.toISOString(), acao_em,
});
const msg = (o: Partial<MensagemVendedor>): MensagemVendedor => ({
  vendor_id: VEND, lead_phone: "5511987654321", direction: "outbound",
  created_at: new Date(V.getTime() + 3600_000).toISOString(), evolution_message_id: "evo-1", ...o,
});
const janela = (o = {}) => ({ vendeEm: V, criticoEm: C, vendorIdResponsavel: VEND, chavesTelefoneCliente: ["1187654321"], ...o });

// ── etapa ────────────────────────────────────────────────────────────────────
test("etapa pela quantidade de pedidos", () => {
  assert.equal(etapaPorPedidos(1), "aguardando_2");
  assert.equal(etapaPorPedidos(2), "aguardando_3");
  assert.equal(etapaPorPedidos(3), "aguardando_4");
  assert.equal(etapaPorPedidos(4), "aguardando_recorrencia");
  assert.equal(etapaPorPedidos(0), null, "sem 1º pedido não entra na jornada");
});
test("12 — quinto pedido encerra a jornada (recorrente não gera alerta)", () => {
  assert.equal(etapaPorPedidos(RECORRENTE_MIN_PEDIDOS), null);
  assert.equal(etapaPorPedidos(9), null);
});

// ── janelas de tempo ─────────────────────────────────────────────────────────
test("vence em +48h e fica crítico em +72h (horas corridas)", () => {
  assert.equal((V.getTime() - FAT.getTime()) / 3600_000, 48);
  assert.equal((C.getTime() - FAT.getTime()) / 3600_000, 72);
});

// ── 1 a 5: máquina de estados ────────────────────────────────────────────────
test("1 — menos de 48h não aparece (pendente)", () => {
  const e = proximoEstado({ atual: alerta(), agora: new Date(FAT.getTime() + 47 * 3600_000), temPedidoNovo: false, temAcaoValida: false, jaRecorrente: false });
  assert.equal(e, "pendente");
});
test("2 — 48h sem novo pedido vira vencido", () => {
  const e = proximoEstado({ atual: alerta(), agora: new Date(V.getTime() + 60_000), temPedidoNovo: false, temAcaoValida: false, jaRecorrente: false });
  assert.equal(e, "vencido");
});
test("3 — novo pedido antes das 48h encerra como convertido", () => {
  const e = proximoEstado({ atual: alerta(), agora: new Date(FAT.getTime() + 10 * 3600_000), temPedidoNovo: true, temAcaoValida: false, jaRecorrente: false });
  assert.equal(e, "convertido");
});
test("4 — ação outbound dentro das 24h seguintes NÃO vira crítico", () => {
  const e = proximoEstado({ atual: alerta("vencido"), agora: new Date(C.getTime() + 3600_000), temPedidoNovo: false, temAcaoValida: true, jaRecorrente: false });
  assert.equal(e, "acao_registrada");
});
test("5 — sem ação por mais 24h vira crítico", () => {
  const e = proximoEstado({ atual: alerta("vencido"), agora: new Date(C.getTime() + 60_000), temPedidoNovo: false, temAcaoValida: false, jaRecorrente: false });
  assert.equal(e, "critico");
});

// ── 6 a 9: o que conta (e o que não conta) como ação ─────────────────────────
test("6 — mensagem inbound não conta como ação", () => {
  assert.equal(acaoValida([msg({ direction: "inbound" })], janela()), null);
});
test("7 — mensagem de OUTRO vendedor não conta", () => {
  assert.equal(acaoValida([msg({ vendor_id: "vendor-alan" })], janela()), null);
});
test("8 — mensagem para OUTRO telefone não conta", () => {
  assert.equal(acaoValida([msg({ lead_phone: "5511999990000" })], janela()), null);
});
test("9 — abrir a tela não conta: sem vendor_message, não há ação", () => {
  assert.equal(acaoValida([], janela()), null, "visualizar não gera evento — logo, nada valida");
});
test("ação válida = outbound + vendedor certo + telefone certo + dentro da janela", () => {
  const ok = acaoValida([msg({})], janela());
  assert.ok(ok);
  assert.equal(ok!.evolution_message_id, "evo-1");
});
test("mensagem FORA da janela (antes do vencimento) não conta", () => {
  assert.equal(acaoValida([msg({ created_at: new Date(V.getTime() - 3600_000).toISOString() })], janela()), null);
});
test("mensagem depois de critico_em não retroage", () => {
  assert.equal(acaoValida([msg({ created_at: new Date(C.getTime() + 7200_000).toISOString() })], janela()), null);
});

// ── 10 a 12: resolução ───────────────────────────────────────────────────────
test("10 — novo faturamento encerra como convertido", () => {
  const e = proximoEstado({ atual: alerta("critico"), agora: new Date(C.getTime() + 10 * 3600_000), temPedidoNovo: true, temAcaoValida: false, jaRecorrente: false });
  assert.equal(e, "convertido");
});
test("11 — nova contagem parte do novo faturamento", () => {
  const novoFat = new Date("2026-08-06T09:00:00-03:00");
  assert.equal((venceEm(novoFat).getTime() - novoFat.getTime()) / 3600_000, 48);
  assert.notEqual(venceEm(novoFat).getTime(), V.getTime());
});
test("12b — atingir recorrência encerra o alerta aberto", () => {
  const e = proximoEstado({ atual: alerta("vencido"), agora: new Date(C.getTime()), temPedidoNovo: false, temAcaoValida: false, jaRecorrente: true });
  assert.equal(e, "convertido");
});

// ── 13: idempotência ─────────────────────────────────────────────────────────
test("13 — job repetido não muda o resultado (determinístico) e não reabre terminal", () => {
  const inp = { atual: alerta("vencido"), agora: new Date(C.getTime() + 60_000), temPedidoNovo: false, temAcaoValida: false, jaRecorrente: false };
  assert.equal(proximoEstado(inp), proximoEstado(inp));
  assert.equal(proximoEstado(inp), proximoEstado(inp), "3ª execução idem");
  // terminais nunca voltam
  assert.equal(proximoEstado({ ...inp, atual: alerta("convertido") }), "convertido");
  assert.equal(proximoEstado({ ...inp, atual: alerta("dispensado") }), "dispensado");
});

// ── 15: crítico permanece até resolução ──────────────────────────────────────
test("15 — crítico continua crítico enquanto não houver pedido nem dispensa", () => {
  const e = proximoEstado({ atual: alerta("critico"), agora: new Date(C.getTime() + 5 * 24 * 3600_000), temPedidoNovo: false, temAcaoValida: false, jaRecorrente: false });
  assert.equal(e, "critico");
});
test("ação após virar crítico registra, mas o alerta continua aberto", () => {
  const e = proximoEstado({ atual: alerta("critico"), agora: new Date(C.getTime() + 3600_000), temPedidoNovo: false, temAcaoValida: true, jaRecorrente: false });
  assert.equal(e, "acao_registrada", "não encerra — só pedido novo ou dispensa encerram");
});

// ── 19 a 22: telefone ────────────────────────────────────────────────────────
test("19 — com e sem DDI 55 casam na mesma chave", () => {
  assert.equal(normalizarTelefone("5511987654321"), normalizarTelefone("11987654321"));
  assert.equal(normalizarTelefone("5511987654321"), "1187654321");
});
test("20 — com e sem nono dígito casam", () => {
  assert.equal(normalizarTelefone("11987654321"), normalizarTelefone("1187654321"));
  assert.equal(normalizarTelefone("(11) 98765-4321"), "1187654321");
  assert.equal(normalizarTelefone("11 8765-4321"), "1187654321");
});
test("21 — telefone inválido não gera associação", () => {
  for (const t of ["", "123", "abc", null, undefined, "999999999999999"]) {
    assert.equal(normalizarTelefone(t as string), null, `deveria recusar: ${t}`);
  }
});
test("21b — telefone inválido no cliente ⇒ nenhuma ação é atribuída", () => {
  assert.equal(acaoValida([msg({})], janela({ chavesTelefoneCliente: [] })), null);
});
test("22 — campo com vários números devolve todas as chaves", () => {
  const ks = chavesDeTelefone("(11) 98765-4321 / 11 3456-7890");
  assert.ok(ks.includes("1187654321"));
  assert.ok(ks.includes("1134567890"));
});

// ── 10/24: contador e fuso ───────────────────────────────────────────────────
test("contador formata horas e dias corretamente", () => {
  const base = new Date("2026-08-03T10:00:00-03:00");
  assert.equal(rotuloAtraso(base, new Date(base.getTime() + 3 * 3600_000)), "3h em atraso");
  assert.equal(rotuloAtraso(base, new Date(base.getTime() + 28 * 3600_000)), "1 dia e 4h em atraso");
  assert.equal(rotuloAtraso(base, new Date(base.getTime() + 55 * 3600_000)), "2 dias e 7h em atraso");
  assert.equal(rotuloAtraso(base, new Date(base.getTime() - 3600_000)), "no prazo");
});
test("referência do contador: crítico conta de critico_em; vencido, de vence_em", () => {
  assert.equal(referenciaContador({ estado: "critico", vence_em: V.toISOString(), critico_em: C.toISOString() }).getTime(), C.getTime());
  assert.equal(referenciaContador({ estado: "vencido", vence_em: V.toISOString(), critico_em: C.toISOString() }).getTime(), V.getTime());
});
test("24 — janela é de horas corridas: virada de dia/fuso não desloca o vencimento", () => {
  // pedido às 23h de -03:00 → vence 48h depois, no mesmo instante absoluto
  const noite = new Date("2026-08-01T23:30:00-03:00");
  assert.equal(venceEm(noite).toISOString(), new Date(noite.getTime() + 48 * 3600_000).toISOString());
  // o mesmo instante escrito em UTC produz o mesmo vencimento
  const mesmoEmUtc = new Date("2026-08-02T02:30:00Z");
  assert.equal(noite.getTime(), mesmoEmUtc.getTime());
  assert.equal(venceEm(noite).getTime(), venceEm(mesmoEmUtc).getTime());
});

// ── 23: pedido inválido não resolve ──────────────────────────────────────────
test("23 — só pedido VÁLIDO resolve: temPedidoNovo=false mantém o alerta", () => {
  // o job só passa temPedidoNovo=true para status 4/13 não deletado/excluído;
  // um cancelado nunca chega aqui como pedido novo.
  const e = proximoEstado({ atual: alerta("vencido"), agora: new Date(C.getTime() + 60_000), temPedidoNovo: false, temAcaoValida: false, jaRecorrente: false });
  assert.equal(e, "critico", "cancelado não encerra — o alerta segue escalando");
});

// ══════════════════════════════════════════════════════════════════════════════
// DECISÕES DE 2026-08-05: status elegíveis, data de corte e registro manual.
// ══════════════════════════════════════════════════════════════════════════════
import { elegivelPorStatus, dentroDoCorte, lerDataDeCorte, STATUS_ELEGIVEIS } from "../lib/jornada/alertas";

test("elegibilidade — só ativo, atencao e risco geram alerta", () => {
  for (const s of ["ativo", "atencao", "risco"]) assert.equal(elegivelPorStatus(s), true, s);
  for (const s of ["pre_churn", "churn_comercial", "inativo_definitivo", "unknown", "", null, undefined]) {
    assert.equal(elegivelPorStatus(s as string), false, `${s} não pode gerar alerta`);
  }
  assert.equal(STATUS_ELEGIVEIS.size, 3);
});

test("data de corte — pedido anterior ao corte NÃO gera alerta (sem retroatividade)", () => {
  const corte = new Date("2026-08-05T00:00:00-03:00");
  assert.equal(dentroDoCorte(new Date("2026-08-06T10:00:00-03:00"), corte), true, "depois do corte: entra");
  assert.equal(dentroDoCorte(new Date("2026-08-05T00:00:00-03:00"), corte), true, "exatamente no corte: entra");
  assert.equal(dentroDoCorte(new Date("2026-08-04T23:59:59-03:00"), corte), false, "1s antes: fora");
  assert.equal(dentroDoCorte(new Date("2025-11-27T21:00:00-03:00"), corte), false, "pedido antigo: fora");
});

test("data de corte ausente ⇒ fail-closed (não gera nada)", () => {
  assert.equal(lerDataDeCorte(undefined), null);
  assert.equal(lerDataDeCorte(""), null);
  assert.equal(lerDataDeCorte("data inválida"), null);
  assert.equal(dentroDoCorte(new Date(), null), false, "sem corte configurado, nenhum pedido é elegível");
  assert.ok(lerDataDeCorte("2026-08-05T00:00:00-03:00") instanceof Date);
});

test("registro manual dentro da janela impede a escalada para crítico", () => {
  const e = proximoEstado({
    atual: alerta("vencido"), agora: new Date(C.getTime() + 3600_000),
    temPedidoNovo: false, temAcaoValida: false, jaRecorrente: false, temRegistroManual: true,
  });
  assert.equal(e, "acao_registrada", "fallback manual vale como ação");
});

test("sem registro manual e sem outbound ⇒ crítico (abrir a tela não salva ninguém)", () => {
  const e = proximoEstado({
    atual: alerta("vencido"), agora: new Date(C.getTime() + 3600_000),
    temPedidoNovo: false, temAcaoValida: false, jaRecorrente: false, temRegistroManual: false,
  });
  assert.equal(e, "critico");
});

test("registro manual não reabre alerta já encerrado", () => {
  for (const st of ["convertido", "dispensado"] as const) {
    const e = proximoEstado({
      atual: alerta(st), agora: new Date(C.getTime() + 3600_000),
      temPedidoNovo: false, temAcaoValida: false, jaRecorrente: false, temRegistroManual: true,
    });
    assert.equal(e, st, `${st} é terminal`);
  }
});
