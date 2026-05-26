/**
 * GET /api/compras/custos/template
 * Gera o template XLSX unificado de apontamentos de produção (Fase 5).
 *
 * 5 abas: Instruções + Temperatura Produto + Temperatura Setor + Horas Operacionais + Qualidade.
 * Dropdowns (data validation) nativos via exceljs. O ID OP é livre — fonte única de OP é o ARES
 * (princípio cravado: painel NUNCA é fonte de OP). Validação de ID OP existente acontece no upload (Etapa 5).
 *
 * Lê custos_config (id=1) só para renderizar os thresholds atuais na aba Instruções (texto estático no XLSX).
 * Guard SUPABASE_SERVICE_ROLE_KEY (DEBT-070): 503 claro se env ausente.
 * Construção do workbook em lib/compras/custos-template.ts (módulo puro, testável).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildTemplateWorkbook, DEFAULT_CONFIG, type CustosConfig } from "@/lib/compras/custos-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET() {
  if (!SB_URL || !SB_SRK) {
    return NextResponse.json(
      {
        error:
          "Config ausente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias no servidor.",
      },
      { status: 503 }
    );
  }

  try {
    const sb = createClient(SB_URL, SB_SRK, { auth: { persistSession: false } });
    const { data: cfgRow } = await sb
      .from("custos_config")
      .select(
        "custo_hora_moagem,custo_hora_modelagem,custo_hora_embalamento,threshold_custo_ideal,threshold_custo_atencao,threshold_custo_alerta,threshold_temp_produto_max,threshold_temp_setor"
      )
      .eq("id", 1)
      .single();

    const cfg = (cfgRow as CustosConfig | null) ?? DEFAULT_CONFIG;
    const wb = buildTemplateWorkbook(cfg);
    const buf = await wb.xlsx.writeBuffer();

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="ASB_Apontamentos_Producao.xlsx"',
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Falha ao gerar template: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
