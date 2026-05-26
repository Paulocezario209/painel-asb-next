/**
 * /api/compras/custos/processo/config — custo_hora por etapa (moagem/modelagem/embalamento).
 *   GET → lista · PATCH (body { etapa, custo_hora, capacidade_kg_hora })
 * Enquanto custo_hora=0 → banner "aguardando RH" (DEBT-075).
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  const { data, error } = await sb.from("custos_processo_config").select("*").order("etapa");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const b = await req.json();
    if (!b?.etapa) return NextResponse.json({ error: "etapa obrigatória" }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of ["custo_hora", "capacidade_kg_hora"]) if (b[f] !== undefined) patch[f] = b[f];
    const { data, error } = await sb.from("custos_processo_config").update(patch).eq("etapa", b.etapa).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, config: data });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
