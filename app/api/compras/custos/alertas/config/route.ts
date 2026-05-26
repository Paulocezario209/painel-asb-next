/**
 * /api/compras/custos/alertas/config — thresholds de classificação.
 *   GET → lista níveis · PATCH (body { nivel, valor_min, valor_max, cor_hex, ativo })
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  const { data, error } = await sb.from("custos_alerta_config").select("*").order("valor_min");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const b = await req.json();
    if (!b?.nivel) return NextResponse.json({ error: "nivel obrigatório" }, { status: 400 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const f of ["valor_min", "valor_max", "cor_hex", "notifica_email", "ativo"]) if (b[f] !== undefined) patch[f] = b[f];
    const { data, error } = await sb.from("custos_alerta_config").update(patch).eq("nivel", b.nivel).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, config: data });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
