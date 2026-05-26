/**
 * Construção do template XLSX de apontamentos de produção (Fase 5).
 * Módulo PURO (sem HTTP/DB) — importado pelo route GET /api/compras/custos/template
 * e testável isoladamente. Dropdowns via data validation nativo (exceljs).
 *
 * 5 abas: Instruções + Temperatura Produto + Temperatura Setor + Horas Operacionais
 *         + Jornada Semanal + Qualidade. (Qualidade inclui perda de MP via tipo=descarte.)
 * Dashboard semanal (v_custos_producao_semana) espelha 1:1 o PDF "Controle Custo" da Qualidade.
 *
 * Domínios espelham os CHECK constraints das tabelas producao_* — NÃO divergir.
 */
import * as ExcelJS from "exceljs";

export const MOMENTO = ["entrada", "meio", "saida", "final"];
export const SETOR = ["camara_fria", "sala_modelagem", "expedicao", "recebimento"];
export const TURNO = ["manha", "tarde", "noite"];
export const ETAPA = ["moagem", "modelagem", "embalamento"];
export const TIPO_QUAL = ["rendimento", "retrabalho", "descarte", "nao_conformidade"];
export const UNIDADE = ["kg", "percent"];

const HEADER_FILL = "FF1F2937"; // cinza-900 (design system)
const SAMPLE_FILL = "FFF3F4F6"; // cinza-100

export type CustosConfig = {
  custo_hora_moagem: number;
  custo_hora_modelagem: number;
  custo_hora_embalamento: number;
  threshold_custo_ideal: number;
  threshold_custo_atencao: number;
  threshold_custo_alerta: number;
  threshold_temp_produto_max: number;
  threshold_temp_setor: Record<string, number>;
};

export const DEFAULT_CONFIG: CustosConfig = {
  custo_hora_moagem: 0,
  custo_hora_modelagem: 0,
  custo_hora_embalamento: 0,
  threshold_custo_ideal: 18,
  threshold_custo_atencao: 19,
  threshold_custo_alerta: 20,
  threshold_temp_produto_max: 4,
  threshold_temp_setor: { camara_fria: 2, sala_modelagem: 12, expedicao: 4, recebimento: 7 },
};

function listDV(ws: ExcelJS.Worksheet, col: string, values: string[], rows = 500) {
  for (let r = 2; r <= rows; r++) {
    ws.getCell(`${col}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${values.join(",")}"`],
      showErrorMessage: true,
      errorStyle: "stop", // OOXML válido: rejeita digitação fora do enum
      errorTitle: "Valor inválido",
      error: `Use apenas: ${values.join(", ")}`,
    };
  }
}

function numDV(
  ws: ExcelJS.Worksheet,
  col: string,
  opts: { min?: number; max?: number; rows?: number }
) {
  const rows = opts.rows ?? 500;
  const between = opts.min !== undefined && opts.max !== undefined;
  for (let r = 2; r <= rows; r++) {
    ws.getCell(`${col}${r}`).dataValidation = {
      type: "decimal",
      allowBlank: true,
      operator: between ? "between" : "greaterThanOrEqual",
      formulae: between ? [opts.min!, opts.max!] : [opts.min ?? 0],
      showErrorMessage: true,
      errorStyle: "warning", // OOXML válido: avisa mas permite salvar (upload revalida)
      errorTitle: "Fora do intervalo",
      error: between ? `Valor entre ${opts.min} e ${opts.max}` : `Valor >= ${opts.min ?? 0}`,
    };
  }
}

function header(ws: ExcelJS.Worksheet, cols: { h: string; w: number }[]) {
  ws.columns = cols.map((c) => ({ header: c.h, width: c.w }));
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function paintSamples(ws: ExcelJS.Worksheet, fromRow: number, count: number, ncols: number) {
  for (let r = fromRow; r < fromRow + count; r++) {
    for (let c = 1; c <= ncols; c++) {
      ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: SAMPLE_FILL } };
      ws.getCell(r, c).font = { italic: true, color: { argb: "FF6B7280" } };
    }
  }
}

/** Monta o workbook completo (5 abas). cfg renderiza os thresholds na aba Instruções. */
export function buildTemplateWorkbook(cfg: CustosConfig = DEFAULT_CONFIG): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ASB Painel — Fase 5 Custos";
  wb.created = new Date();
  const hoje = new Date().toISOString().slice(0, 10);

  // ── Aba 0: Instruções ──
  const ins = wb.addWorksheet("Instruções", { properties: { tabColor: { argb: "FF1F2937" } } });
  ins.columns = [{ width: 4 }, { width: 32 }, { width: 72 }];
  const line = (a: string, b = "", bold = false) => {
    const row = ins.addRow(["", a, b]);
    if (bold) row.font = { bold: true };
    return row;
  };
  ins.addRow([]);
  line("ASB — Apontamentos de Produção (semanal)", "", true).font = { bold: true, size: 14 };
  line("Gerado em", hoje);
  line("Periodicidade", "Líderes preenchem ao longo da semana e sobem o arquivo na sexta-feira.");
  ins.addRow([]);
  line("REGRA DE OURO", "", true);
  line("ID OP", "Consulte o ID da Ordem de Produção no ARES e digite na coluna. O painel NÃO é fonte de OP.");
  line("IDs inválidos", "Linhas com ID OP inexistente no ARES são rejeitadas no upload (Preview).");
  ins.addRow([]);
  line("ABAS A PREENCHER", "", true);
  line("1. Temperatura Produto", "Temperatura por OP em cada momento (entrada/meio/saida/final). Sanitário.");
  line("2. Temperatura Setor", "Temperatura ambiente por setor e turno.");
  line("3. Horas Operacionais", "Horas por etapa no dia. Formato HH:MM:SS (ex: 8:00:12). O sistema converte.");
  line("4. Jornada Semanal", "1 linha por semana: ano + semana ISO + dias trabalhados + horas semanais.");
  line("5. Qualidade", "Rendimento, retrabalho, descarte e não-conformidade por OP. Perda de MP = tipo 'descarte'.");
  ins.addRow([]);
  line("THRESHOLDS ATUAIS (no momento do download)", "", true);
  line("Custo/hora moagem", `R$ ${Number(cfg.custo_hora_moagem).toFixed(2)}`);
  line("Custo/hora modelagem", `R$ ${Number(cfg.custo_hora_modelagem).toFixed(2)}`);
  line("Custo/hora embalamento", `R$ ${Number(cfg.custo_hora_embalamento).toFixed(2)}`);
  line("Custo/kg ideal (≤)", `R$ ${Number(cfg.threshold_custo_ideal).toFixed(2)}`);
  line("Custo/kg atenção (≤)", `R$ ${Number(cfg.threshold_custo_atencao).toFixed(2)}`);
  line("Custo/kg alerta (≤)", `R$ ${Number(cfg.threshold_custo_alerta).toFixed(2)}`);
  line("Temp. produto máx", `${Number(cfg.threshold_temp_produto_max).toFixed(1)} °C`);
  line(
    "Temp. setor máx",
    Object.entries(cfg.threshold_temp_setor || {})
      .map(([k, v]) => `${k}: ${v}°C`)
      .join(" · ")
  );
  ins.addRow([]);
  line("ATENÇÃO", "Datas em AAAA-MM-DD. Temperatura em °C. Não renomeie as abas nem os cabeçalhos.", true);

  // ── Aba 1: Temperatura Produto ──
  const a1 = wb.addWorksheet("Temperatura Produto");
  header(a1, [
    { h: "Data", w: 14 },
    { h: "ID OP", w: 12 },
    { h: "Momento", w: 14 },
    { h: "Temperatura (°C)", w: 16 },
    { h: "Apontador", w: 20 },
    { h: "Observação", w: 30 },
  ]);
  a1.addRows([
    [hoje, 12345, "entrada", -2, "Rafael", "exemplo — apague"],
    [hoje, 12345, "meio", 3, "Rafael", "exemplo — apague"],
    [hoje, 12346, "final", 1.5, "Ana", "exemplo — apague"],
  ]);
  paintSamples(a1, 2, 3, 6);
  listDV(a1, "C", MOMENTO);
  numDV(a1, "D", { min: -30, max: 60 });

  // ── Aba 2: Temperatura Setor ──
  const a2 = wb.addWorksheet("Temperatura Setor");
  header(a2, [
    { h: "Data", w: 14 },
    { h: "Setor", w: 18 },
    { h: "Turno", w: 12 },
    { h: "Temperatura (°C)", w: 16 },
    { h: "Apontador", w: 20 },
    { h: "Observação", w: 30 },
  ]);
  a2.addRows([
    [hoje, "camara_fria", "manha", 1.5, "Rafael", "exemplo — apague"],
    [hoje, "sala_modelagem", "tarde", 11, "Ana", "exemplo — apague"],
    [hoje, "expedicao", "noite", 3.5, "João", "exemplo — apague"],
  ]);
  paintSamples(a2, 2, 3, 6);
  listDV(a2, "B", SETOR);
  listDV(a2, "C", TURNO);
  numDV(a2, "D", { min: -30, max: 60 });

  // ── Aba 3: Horas Operacionais (HH:MM:SS como texto — upload converte p/ decimal) ──
  const a3 = wb.addWorksheet("Horas Operacionais");
  header(a3, [
    { h: "Data", w: 14 },
    { h: "Etapa", w: 16 },
    { h: "Horas (HH:MM:SS)", w: 18 },
    { h: "Apontador", w: 20 },
    { h: "Observação", w: 30 },
  ]);
  a3.getColumn(3).numFmt = "@"; // força texto na coluna de horas (não vira serial de tempo)
  a3.addRows([
    [hoje, "moagem", "08:00:12", "Rafael", "exemplo — apague"],
    [hoje, "modelagem", "06:24:00", "Ana", "exemplo — apague"],
    [hoje, "embalamento", "03:07:00", "João", "exemplo — apague"],
  ]);
  paintSamples(a3, 2, 3, 5);
  listDV(a3, "B", ETAPA);
  a3.getCell("C1").note = "Formato HH:MM:SS (ex: 8:00:12). O sistema converte para decimal automaticamente.";

  // ── Aba 4: Jornada Semanal (1 linha por semana) ──
  const a4 = wb.addWorksheet("Jornada Semanal");
  header(a4, [
    { h: "Ano", w: 10 },
    { h: "Semana ISO", w: 12 },
    { h: "Dias Trabalhados", w: 16 },
    { h: "Horas Semanais", w: 16 },
    { h: "Apontador", w: 20 },
    { h: "Observação", w: 30 },
  ]);
  a4.addRows([
    [2026, 21, 5.0, 44.0, "Rafael", "exemplo — apague"],
    [2026, 22, 4.0, 36.0, "Rafael", "exemplo — apague (semana com feriado)"],
    [2026, 23, 5.0, 44.0, "Ana", "exemplo — apague"],
  ]);
  paintSamples(a4, 2, 3, 6);
  numDV(a4, "A", { min: 2024, max: 2030 });
  numDV(a4, "B", { min: 1, max: 53 });
  numDV(a4, "C", { min: 0, max: 7 });
  numDV(a4, "D", { min: 0, max: 80 });
  a4.getCell("B1").note = "Semana ISO 8601 (mesma do calendário Excel). 1 linha por semana.";

  // ── Aba 5: Qualidade (inclui perda de MP via tipo=descarte) ──
  const a5 = wb.addWorksheet("Qualidade");
  header(a5, [
    { h: "Data", w: 14 },
    { h: "ID OP", w: 12 },
    { h: "Tipo", w: 18 },
    { h: "Quantidade", w: 12 },
    { h: "Unidade", w: 10 },
    { h: "Justificativa", w: 30 },
    { h: "Apontador", w: 20 },
  ]);
  a5.addRows([
    [hoje, 12345, "rendimento", 92, "percent", "exemplo — apague", "Rafael"],
    [hoje, 12345, "descarte", 1.2, "kg", "perda de MP — exemplo, apague", "Ana"],
    [hoje, 12346, "retrabalho", 5.5, "kg", "exemplo — apague", "João"],
  ]);
  paintSamples(a5, 2, 3, 7);
  listDV(a5, "C", TIPO_QUAL);
  listDV(a5, "E", UNIDADE);
  numDV(a5, "D", { min: 0 });

  return wb;
}
