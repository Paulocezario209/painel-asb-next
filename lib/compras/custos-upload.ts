/**
 * Parser + validador do template de apontamentos de produção (Fase 5, Etapa 5).
 * Módulo PURO (sem HTTP/DB) — recebe as linhas já extraídas das abas (XLSX.utils.sheet_to_json)
 * + o conjunto de IDs de OP válidos, e devolve records prontos p/ upsert + erros por linha.
 *
 * Domínios espelham os CHECK das tabelas producao_* (mesmos de custos-template.ts).
 */
import { MOMENTO, SETOR, TURNO, ETAPA, TIPO_QUAL, UNIDADE } from "./custos-template";

export type Row = Record<string, unknown>;
export type RowError = { aba: string; linha: number; motivo: string };

export type ParseResult = {
  temp_produto: Record<string, unknown>[];
  temp_setor: Record<string, unknown>[];
  horas: Record<string, unknown>[];
  jornada: Record<string, unknown>[];
  qualidade: Record<string, unknown>[];
  erros: RowError[];
  resumo: Record<string, { ok: number; erros: number }>;
};

export const ABAS = {
  temp_produto: "Temperatura Produto",
  temp_setor: "Temperatura Setor",
  horas: "Horas Operacionais",
  jornada: "Jornada Semanal",
  qualidade: "Qualidade",
} as const;

function norm(s: string): string {
  return (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

// pega valor da linha por candidatos de header (tolerante a acento/caixa)
function pick(row: Row, candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const k = keys.find((kk) => norm(kk) === norm(c));
    if (k !== undefined) return row[k];
  }
  return undefined;
}

function isExemplo(...vals: unknown[]): boolean {
  return vals.some((v) => norm(String(v ?? "")).includes("exemplo"));
}

// data → 'YYYY-MM-DD'. Aceita Date, string ISO, ou 'YYYY-MM-DD HH:MM:SS'.
function parseData(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// número BR/US ('5,5'|'5.5'|5.5). Rejeita texto/?.
function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === "" || s.includes("?")) return null;
  const n = Number(s.replace(/\./g, "").replace(",", ".")); // 1.234,5 -> 1234.5
  const n2 = Number(s); // 5.5 direto
  if (Number.isFinite(n) && s.includes(",")) return n;
  return Number.isFinite(n2) ? n2 : Number.isFinite(n) ? n : null;
}

/** HH:MM:SS (ou H:MM, ou decimal) → horas decimais. Excel time-fraction (<=1) → ×24. */
export function parseHoras(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return null;
    return v > 0 && v <= 1 ? v * 24 : v; // fração de dia do Excel
  }
  const s = String(v).trim();
  if (s.includes(":")) {
    const parts = s.split(":").map((p) => Number(p));
    if (parts.some((p) => !Number.isFinite(p))) return null;
    const [h, m = 0, sec = 0] = parts;
    return h + m / 60 + sec / 3600;
  }
  return parseNum(s);
}

function err(arr: RowError[], aba: string, linha: number, motivo: string) {
  arr.push({ aba, linha, motivo });
}

/**
 * @param sheets linhas já extraídas (sheet_to_json) por chave de aba
 * @param validOps Set de id_op existentes em op_espelho (validação soft ref)
 * @param hojeStr data de referência (não usado p/ validação; mantém assinatura simples)
 */
export function parseUpload(
  sheets: { temp_produto?: Row[]; temp_setor?: Row[]; horas?: Row[]; jornada?: Row[]; qualidade?: Row[] },
  validOps: Set<number>
): ParseResult {
  const erros: RowError[] = [];
  const out: ParseResult = {
    temp_produto: [], temp_setor: [], horas: [], jornada: [], qualidade: [],
    erros, resumo: {},
  };
  // linha no Excel: header=linha 1, dados começam na 2. idx 0 do array = linha 2.
  const lineNo = (i: number) => i + 2;

  // ── Temperatura Produto ──
  (sheets.temp_produto ?? []).forEach((row, i) => {
    const obs = pick(row, ["Observação", "Observacao"]);
    if (isExemplo(obs)) return;
    const ln = lineNo(i), A = ABAS.temp_produto;
    const data = parseData(pick(row, ["Data"]));
    const idOp = parseNum(pick(row, ["ID OP", "id_op"]));
    const momento = norm(String(pick(row, ["Momento"]) ?? ""));
    const temp = parseNum(pick(row, ["Temperatura (°C)", "Temperatura (C)", "Temperatura"]));
    if (!data) return err(erros, A, ln, "Data inválida/ausente");
    if (idOp === null || !Number.isInteger(idOp)) return err(erros, A, ln, "ID OP inválido");
    if (!validOps.has(idOp)) return err(erros, A, ln, `ID OP ${idOp} não existe no ARES (op_espelho)`);
    if (!MOMENTO.includes(momento)) return err(erros, A, ln, `Momento inválido (use ${MOMENTO.join("/")})`);
    if (temp === null || temp < -30 || temp > 60) return err(erros, A, ln, "Temperatura fora de -30..60");
    out.temp_produto.push({
      id_op: idOp, momento, temperatura_c: temp, ts_apontamento: `${data}T12:00:00Z`,
      id_apontador: pick(row, ["Apontador"]) ?? null, obs: obs ?? null,
    });
  });

  // ── Temperatura Setor ──
  (sheets.temp_setor ?? []).forEach((row, i) => {
    const obs = pick(row, ["Observação", "Observacao"]);
    if (isExemplo(obs)) return;
    const ln = lineNo(i), A = ABAS.temp_setor;
    const data = parseData(pick(row, ["Data"]));
    const setor = norm(String(pick(row, ["Setor"]) ?? ""));
    const turno = norm(String(pick(row, ["Turno"]) ?? ""));
    const temp = parseNum(pick(row, ["Temperatura (°C)", "Temperatura (C)", "Temperatura"]));
    if (!data) return err(erros, A, ln, "Data inválida/ausente");
    if (!SETOR.includes(setor)) return err(erros, A, ln, `Setor inválido (use ${SETOR.join("/")})`);
    if (!TURNO.includes(turno)) return err(erros, A, ln, `Turno inválido (use ${TURNO.join("/")})`);
    if (temp === null || temp < -30 || temp > 60) return err(erros, A, ln, "Temperatura fora de -30..60");
    out.temp_setor.push({
      data, setor, turno, temperatura_c: temp,
      id_apontador: pick(row, ["Apontador"]) ?? null, obs: obs ?? null,
    });
  });

  // ── Horas Operacionais ──
  (sheets.horas ?? []).forEach((row, i) => {
    const obs = pick(row, ["Observação", "Observacao"]);
    if (isExemplo(obs)) return;
    const ln = lineNo(i), A = ABAS.horas;
    const data = parseData(pick(row, ["Data"]));
    const etapa = norm(String(pick(row, ["Etapa"]) ?? ""));
    const horas = parseHoras(pick(row, ["Horas (HH:MM:SS)", "Horas"]));
    if (!data) return err(erros, A, ln, "Data inválida/ausente");
    if (!ETAPA.includes(etapa)) return err(erros, A, ln, `Etapa inválida (use ${ETAPA.join("/")})`);
    if (horas === null || horas < 0 || horas > 24) return err(erros, A, ln, "Horas fora de 0..24 (HH:MM:SS)");
    out.horas.push({
      data, etapa, horas: Math.round(horas * 100) / 100,
      id_apontador: pick(row, ["Apontador"]) ?? null, obs: obs ?? null,
    });
  });

  // ── Jornada Semanal ──
  (sheets.jornada ?? []).forEach((row, i) => {
    const obs = pick(row, ["Observação", "Observacao"]);
    if (isExemplo(obs)) return;
    const ln = lineNo(i), A = ABAS.jornada;
    const ano = parseNum(pick(row, ["Ano"]));
    const semana = parseNum(pick(row, ["Semana ISO", "Semana"]));
    const dias = parseNum(pick(row, ["Dias Trabalhados", "Dias"]));
    const horas = parseNum(pick(row, ["Horas Semanais", "Horas"]));
    if (ano === null || !Number.isInteger(ano)) return err(erros, A, ln, "Ano inválido");
    if (semana === null || semana < 1 || semana > 53) return err(erros, A, ln, "Semana ISO fora de 1..53");
    if (dias === null || dias < 0 || dias > 7) return err(erros, A, ln, "Dias trabalhados fora de 0..7");
    if (horas === null || horas < 0 || horas > 80) return err(erros, A, ln, "Horas semanais fora de 0..80");
    out.jornada.push({
      ano, semana_iso: semana, dias_trabalhados: dias, horas_semanais: horas,
      id_apontador: pick(row, ["Apontador"]) ?? null, obs: obs ?? null,
    });
  });

  // ── Qualidade ──
  (sheets.qualidade ?? []).forEach((row, i) => {
    const just = pick(row, ["Justificativa"]);
    if (isExemplo(just)) return;
    const ln = lineNo(i), A = ABAS.qualidade;
    const data = parseData(pick(row, ["Data"]));
    const idOp = parseNum(pick(row, ["ID OP", "id_op"]));
    const tipo = norm(String(pick(row, ["Tipo"]) ?? ""));
    const qtd = parseNum(pick(row, ["Quantidade"]));
    const unidade = norm(String(pick(row, ["Unidade"]) ?? "kg"));
    if (!data) return err(erros, A, ln, "Data inválida/ausente");
    if (idOp === null || !Number.isInteger(idOp)) return err(erros, A, ln, "ID OP inválido");
    if (!validOps.has(idOp)) return err(erros, A, ln, `ID OP ${idOp} não existe no ARES (op_espelho)`);
    if (!TIPO_QUAL.includes(tipo)) return err(erros, A, ln, `Tipo inválido (use ${TIPO_QUAL.join("/")})`);
    if (qtd === null || qtd < 0) return err(erros, A, ln, "Quantidade inválida (>=0)");
    if (!UNIDADE.includes(unidade)) return err(erros, A, ln, `Unidade inválida (use ${UNIDADE.join("/")})`);
    out.qualidade.push({
      data, id_op: idOp, tipo, quantidade: qtd, unidade,
      justificativa: just ?? null, id_apontador: pick(row, ["Apontador"]) ?? null,
    });
  });

  // resumo por aba
  for (const [k, label] of Object.entries(ABAS)) {
    const key = k as keyof typeof ABAS;
    out.resumo[label] = {
      ok: (out[key] as unknown[]).length,
      erros: erros.filter((e) => e.aba === label).length,
    };
  }
  return out;
}
