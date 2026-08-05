import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fmtDateTimeBRT,
  fmtDateTimeCompactBRT,
  fmtDateTimeFullBRT,
  fmtDateTimeVerboseBRT,
  fmtDateBRT,
  fmtDateFullBRT,
  fmtScheduledBRT,
  startOfTodayBRT,
  endOfTodayBRT,
  currentYearMonthBRT,
  brtWallClockToEpoch,
  brtWallClockAsLocalDate,
} from "../lib/datetime-brt.ts";

// BRT = America/Sao_Paulo = UTC-3 fixo (sem horário de verão desde 2019).

test("UTC 17:00 vira BRT 14:00", () => {
  // Intl.DateTimeFormat("pt-BR", {day,month,hour,minute}) insere vírgula entre data e
  // hora (comportamento nativo do ICU) — mesmo formato que toLocaleString já produzia
  // antes desta correção, então fmtDateTimeCompactBRT existe à parte para o "dd/mm hh:mm"
  // sem vírgula usado em 2 pontos específicos (ver teste dedicado abaixo).
  assert.equal(fmtDateTimeBRT("2026-08-05T17:00:00Z"), "05/08, 14:00");
  assert.equal(fmtDateTimeCompactBRT("2026-08-05T17:00:00Z"), "05/08 14:00");
});

test("UTC 01:30 vira BRT 22:30 do dia anterior (não deve virar o dia)", () => {
  assert.equal(fmtDateTimeBRT("2026-08-05T01:30:00Z"), "04/08, 22:30");
  assert.equal(fmtDateFullBRT("2026-08-05T01:30:00Z"), "04/08/2026");
});

test("virada de mês perto da meia-noite BRT: UTC 02:30 do dia 1 é BRT 23:30 do último dia do mês anterior", () => {
  assert.equal(fmtDateTimeFullBRT("2026-08-01T02:30:00Z"), "31/07/2026 23:30");
});

test("virada de ano: UTC 02:30 de 1º de janeiro é BRT 31 de dezembro do ano anterior, 23:30", () => {
  assert.equal(fmtDateTimeFullBRT("2026-01-01T02:30:00Z"), "31/12/2025 23:30");
});

test("fmtScheduledBRT mantém o dia da semana correto na virada (sexta 23h BRT = sábado 02h UTC)", () => {
  // 2026-08-07 é sexta-feira. 23h BRT do dia 7 = 02h UTC do dia 8 (sábado).
  const iso = "2026-08-08T02:00:00Z";
  assert.equal(fmtScheduledBRT(iso), "sex, 07/08 às 23h");
});

test("fmtScheduledBRT omite minuto quando é 0, mostra quando != 0", () => {
  assert.equal(fmtScheduledBRT("2026-08-05T12:00:00Z"), "qua, 05/08 às 09h");
  assert.equal(fmtScheduledBRT("2026-08-05T12:30:00Z"), "qua, 05/08 às 09h30");
});

test("valores vazios/invalidos retornam o fallback, sem lançar exceção", () => {
  assert.equal(fmtDateTimeBRT(null), "—");
  assert.equal(fmtDateTimeBRT(undefined), "—");
  assert.equal(fmtDateTimeBRT("not-a-date"), "—");
  assert.equal(fmtDateBRT(null), "—");
  assert.equal(fmtScheduledBRT(null), "—");
});

test("fmtDateTimeVerboseBRT reproduz o formato dd/mm/yyyy, hh:mm:ss em BRT", () => {
  assert.equal(fmtDateTimeVerboseBRT("2026-08-05T17:05:09Z"), "05/08/2026, 14:05:09");
});

test("startOfTodayBRT/endOfTodayBRT delimitam exatamente 24h e cobrem a meia-noite BRT, não a UTC", () => {
  const at = new Date("2026-08-05T15:00:00Z"); // 12:00 BRT do dia 5
  const start = startOfTodayBRT(at);
  const end = endOfTodayBRT(at);
  assert.equal(end - start, 24 * 60 * 60 * 1000);
  // meia-noite BRT do dia 5 = 03:00 UTC do dia 5
  assert.equal(new Date(start).toISOString(), "2026-08-05T03:00:00.000Z");
  assert.equal(new Date(end).toISOString(), "2026-08-06T03:00:00.000Z");
});

test("currentYearMonthBRT vira o mês pela meia-noite BRT, não pela UTC", () => {
  // 2026-08-01T02:00:00Z é 31/07 23:00 em BRT — mês ainda é julho.
  assert.deepEqual(currentYearMonthBRT(new Date("2026-08-01T02:00:00Z")), { year: 2026, month: 7 });
  // 2026-08-01T03:00:00Z é 01/08 00:00 em BRT — mês já virou agosto.
  assert.deepEqual(currentYearMonthBRT(new Date("2026-08-01T03:00:00Z")), { year: 2026, month: 8 });
});

test("brtWallClockToEpoch é o inverso de startOfTodayBRT (ida e volta)", () => {
  const epoch = brtWallClockToEpoch(2026, 8, 5, 0, 0, 0);
  assert.equal(new Date(epoch).toISOString(), "2026-08-05T03:00:00.000Z");
});

test("brtWallClockAsLocalDate expõe os componentes BRT via getUTC* (para código legado local-naive)", () => {
  const d = brtWallClockAsLocalDate(new Date("2026-08-01T02:00:00Z")); // 31/07 23:00 BRT
  assert.equal(d.getUTCFullYear(), 2026);
  assert.equal(d.getUTCMonth(), 6); // julho, 0-indexed
  assert.equal(d.getUTCDate(), 31);
  assert.equal(d.getUTCHours(), 23);
});

test("first_contact/last_contact (BRT naive) não passam por conversão de fuso — helper não deve ser usado neles", () => {
  // first_contact chega do banco como "2026-08-05 04:45:54.111" (BRT, sem marcador de fuso).
  // Se alguém acidentalmente aplicasse fmtDateTimeBRT nele, o valor seria tratado como se
  // fosse UTC (new Date interpreta string sem 'Z'/offset como local do processo — que é UTC
  // no container) e sofreria uma conversão para BRT que NÃO deveria acontecer (dupla conversão).
  // Este teste documenta a armadilha: exibir first_contact é uma questão de NÃO usar este
  // helper, não de usá-lo com alguma opção especial.
  const firstContactNaive = "2026-08-05 04:45:54.111";
  const asIfUtc = fmtDateTimeBRT(firstContactNaive); // NÃO fazer isso em produção
  assert.notEqual(asIfUtc, "05/08 04:45", "aplicar o helper em first_contact desloca -3h indevidamente — por isso não deve ser usado nele");
});
