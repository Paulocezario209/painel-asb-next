// Fonte única de formatação de data/hora em BRT (America/Sao_Paulo) para o painel.
//
// Regra (asb-decisoes-imutaveis §TIMEZONE): todo timestamp exibido ao usuário usa
// timeZone: "America/Sao_Paulo" explícito — NUNCA hardcode de offset (-3h), porque a
// política de fuso pode mudar (ex.: retorno do horário de verão) e um offset fixo
// quebraria silenciosamente. UTC segue correto para armazenamento e cutoff de query.
//
// first_contact e last_contact são EXCEÇÃO: já vêm gravados em BRT sem marcador de
// fuso (naive) — não usar nenhuma função deste arquivo neles, exibir como vieram.

const BRT_TZ = "America/Sao_Paulo";

function toValidDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/** Componentes de data/hora de `d`, já resolvidos em BRT via Intl (sem hardcode). */
function brtParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BRT_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24, // ICU às vezes devolve "24" para meia-noite
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekdayEn: get("weekday"), // "Sun".."Sat"
  };
}

/** Offset (em minutos) de America/Sao_Paulo para um instante, descoberto via Intl —
 *  nunca craveado no código. Hoje é sempre -180 (BRT fixo, sem DST desde 2019); se a
 *  política mudar, este cálculo acompanha sozinho, sem precisar de deploy. */
function brtOffsetMinutesAt(epochMs: number): number {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: BRT_TZ, timeZoneName: "shortOffset",
  }).formatToParts(epochMs).find(p => p.type === "timeZoneName")?.value ?? "GMT-3";
  const m = part.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return -180;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2]);
  const mm = m[3] ? Number(m[3]) : 0;
  return sign * (hh * 60 + mm);
}

/** Converte um "relógio de parede" em BRT (ano/mês/dia/hora/min/seg tal como aparecem
 *  num relógio em São Paulo) para o epoch (ms) UTC correspondente. */
export function brtWallClockToEpoch(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off1 = brtOffsetMinutesAt(guess);
  const guess2 = guess - off1 * 60000;
  const off2 = brtOffsetMinutesAt(guess2);
  return guess - off2 * 60000;
}

/** Formata "dd/mm hh:mm" (+ ano opcional, 2 dígitos) em BRT. Entrada = ISO UTC tz-aware
 *  (created_at, handoff_at, sent_at, ...). NÃO usar em first_contact/last_contact. */
export function fmtDateTimeBRT(iso: string | null | undefined, opts?: { withYear?: boolean }): string {
  const d = toValidDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRT_TZ,
    day: "2-digit", month: "2-digit",
    ...(opts?.withYear ? { year: "2-digit" as const } : {}),
    hour: "2-digit", minute: "2-digit",
  }).format(d);
}

/** Formata data/hora completa em BRT — "dd/mm/yyyy, hh:mm:ss" (equivalente ao
 *  toLocaleString("pt-BR") default do navegador, só que com fuso explícito). */
export function fmtDateTimeVerboseBRT(iso: string | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: BRT_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(d);
}

/** Formata "dd/mm hh:mm" (sem separador entre data e hora) em BRT. */
export function fmtDateTimeCompactBRT(iso: string | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "—";
  const p = brtParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.day)}/${pad(p.month)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Formata "dd/mm/yyyy hh:mm" (ano completo, separador ':' na hora) em BRT. */
export function fmtDateTimeFullBRT(iso: string | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "—";
  const p = brtParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(p.day)}/${pad(p.month)}/${p.year} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Formata "dd/mm/yyyy" (sem hora) em BRT — equivalente a toLocaleDateString("pt-BR"). */
export function fmtDateFullBRT(iso: string | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: BRT_TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

/** Formata só "dd/mm" em BRT. */
export function fmtDateBRT(iso: string | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: BRT_TZ, day: "2-digit", month: "2-digit" }).format(d);
}

const WEEKDAY_EN_TO_PT_ABBR: Record<string, string> = {
  Sun: "dom", Mon: "seg", Tue: "ter", Wed: "qua", Thu: "qui", Fri: "sex", Sat: "sáb",
};

/** "qui, 16/07 às 13h" (minuto só aparece se ≠ 0) — agenda de handoff, em BRT. */
export function fmtScheduledBRT(iso: string | null | undefined): string {
  const d = toValidDate(iso);
  if (!d) return "—";
  const p = brtParts(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  const diaSemana = WEEKDAY_EN_TO_PT_ABBR[p.weekdayEn] ?? "";
  const hora = p.minute ? `${pad(p.hour)}h${pad(p.minute)}` : `${pad(p.hour)}h`;
  return `${diaSemana}, ${pad(p.day)}/${pad(p.month)} às ${hora}`;
}

/** Epoch (ms) do início do dia de HOJE em BRT — cutoff técnico de query ("hoje"). */
export function startOfTodayBRT(at: Date = new Date()): number {
  const p = brtParts(at);
  return brtWallClockToEpoch(p.year, p.month, p.day, 0, 0, 0);
}

/** Epoch (ms) do início de amanhã em BRT — fim exclusivo do dia de hoje. */
export function endOfTodayBRT(at: Date = new Date()): number {
  return startOfTodayBRT(at) + 24 * 60 * 60 * 1000;
}

/** { year, month } (1-12) do mês corrente em BRT — para filtros "mês atual". */
export function currentYearMonthBRT(at: Date = new Date()): { year: number; month: number } {
  const p = brtParts(at);
  return { year: p.year, month: p.month };
}

/**
 * Date cujos componentes UTC (getUTCFullYear/getUTCMonth/getUTCDate/...) equivalem aos
 * componentes em BRT. Existe só para alimentar código legado que espera um objeto Date
 * "ingênuo" e lê seus componentes LOCAIS (ex.: businessDaysElapsed em business-days.ts).
 * Equivale ao BRT real quando o processo roda em UTC (nosso caso hoje, confirmado no
 * Dockerfile) — não usar para nova aritmética de fuso; prefira as funções acima, que
 * resolvem via Intl independente do TZ do processo.
 */
export function brtWallClockAsLocalDate(at: Date = new Date()): Date {
  const p = brtParts(at);
  return new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second));
}
