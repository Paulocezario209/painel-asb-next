/**
 * /api/compras/custos/insumos-consumo — leitura das views de consumo de insumos (Etapa 2).
 *   GET → { diario, comparativo, mensal } lidos das views (agregação no banco, GET só lê).
 *   diario: v_insumos_consumo_diario (data, categoria, kg, custo_brl, n_lancamentos)
 *   comparativo: v_insumos_comparativo_diario (data, recorte_kg, gordura_kg, pct_gordura|null)
 *   mensal: v_insumos_consumo_mensal (ano_mes, categoria, kg, custo_brl)
 */
import { NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  const [diario, comparativo, mensal] = await Promise.all([
    sb.from("v_insumos_consumo_diario").select("*").order("data", { ascending: true }),
    sb.from("v_insumos_comparativo_diario").select("*").order("data", { ascending: true }),
    sb.from("v_insumos_consumo_mensal").select("*").order("ano_mes", { ascending: true }),
  ]);
  const err = diario.error || comparativo.error || mensal.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });
  return NextResponse.json({
    diario: diario.data ?? [],
    comparativo: comparativo.data ?? [],
    mensal: mensal.data ?? [],
  });
}
