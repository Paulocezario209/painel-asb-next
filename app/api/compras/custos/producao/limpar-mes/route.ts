/**
 * POST /api/compras/custos/producao/limpar-mes
 * body: { ano, mes, confirmacao: 'LIMPAR' }
 * Deleta registros do mês. Exige confirmacao === 'LIMPAR' (proteção).
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const { ano, mes, confirmacao } = await req.json();
    if (confirmacao !== "LIMPAR") return NextResponse.json({ error: "confirmacao deve ser 'LIMPAR'" }, { status: 400 });
    const an = Number(ano), m = Number(mes);
    if (!an || !m) return NextResponse.json({ error: "ano e mes obrigatórios" }, { status: 400 });
    const ini = `${an}-${String(m).padStart(2, "0")}-01`;
    const fim = m === 12 ? `${an + 1}-01-01` : `${an}-${String(m + 1).padStart(2, "0")}-01`;
    const { error, count } = await sb
      .from("custos_registro_diario")
      .delete({ count: "exact" })
      .gte("data", ini).lt("data", fim);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, removidos: count ?? 0 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
