/**
 * /api/compras/custos/projecao/config — meta anual de produção/custo.
 *   GET ?ano=2026 · PATCH (body { ano, meta_kg_anual, meta_custo_kg, cenario })
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  const ano = Number(req.nextUrl.searchParams.get("ano")) || new Date().getFullYear();
  const { data, error } = await sb.from("custos_projecao_config").select("*").eq("ano", ano).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}

export async function PATCH(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const b = await req.json();
    const ano = Number(b?.ano);
    if (!ano) return NextResponse.json({ error: "ano obrigatório" }, { status: 400 });
    const row: Record<string, unknown> = { ano, updated_at: new Date().toISOString() };
    for (const f of ["meta_kg_anual", "meta_custo_kg", "cenario"]) if (b[f] !== undefined) row[f] = b[f];
    const { data, error } = await sb.from("custos_projecao_config").upsert(row, { onConflict: "ano" }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, config: data });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
