/**
 * POST /api/compras/custos/producao/lote — upsert em batch.
 * body: { registros: [{ data, kgProduzido, custoTotal, temperatura, ops, obs, horasMoagem, horasModelagem, horasEmbalamento }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const body = await req.json();
    const registros = Array.isArray(body?.registros) ? body.registros : [];
    if (registros.length === 0) return NextResponse.json({ error: "registros vazio" }, { status: 400 });
    const rows = registros
      .filter((b: Record<string, unknown>) => b?.data)
      .map((b: Record<string, unknown>) => ({
        data: b.data,
        kg_produzido: Number(b.kgProduzido ?? b.kg_produzido ?? 0),
        custo_total: Number(b.custoTotal ?? b.custo_total ?? 0),
        temperatura: Number(b.temperatura ?? 0),
        ops: Number(b.ops ?? 0),
        horas_moagem: Number(b.horasMoagem ?? b.horas_moagem ?? 0),
        horas_modelagem: Number(b.horasModelagem ?? b.horas_modelagem ?? 0),
        horas_embalamento: Number(b.horasEmbalamento ?? b.horas_embalamento ?? 0),
        obs: (b.obs as string) ?? null,
        source: (b.source as string) ?? "manual",
      }));
    const { error } = await sb.from("custos_registro_diario").upsert(rows, { onConflict: "data" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, gravados: rows.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
