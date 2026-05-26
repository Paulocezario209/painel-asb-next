/**
 * /api/compras/custos/insumos — CRUD de insumos (aba Insumos).
 *   GET    ?ativo=true → lista · POST cria · PATCH atualiza (body.id) · DELETE (body.id)
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELDS = ["data", "materia", "fornecedor", "quantidade", "lote", "validade", "sif", "unidade", "custo_unit", "categoria", "ativo", "obs"];
function pickFields(b: Record<string, unknown>) {
  const o: Record<string, unknown> = {};
  for (const f of FIELDS) if (b[f] !== undefined) o[f] = b[f];
  return o;
}

export async function GET(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  let q = sb.from("custos_insumo").select("*").order("data", { ascending: false });
  if (req.nextUrl.searchParams.get("ativo") === "true") q = q.eq("ativo", true);
  const { data, error } = await q.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ insumos: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const b = await req.json();
    if (!b?.data || !b?.materia) return NextResponse.json({ error: "data e materia obrigatórios" }, { status: 400 });
    const { data, error } = await sb.from("custos_insumo").insert(pickFields(b)).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, insumo: data });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const b = await req.json();
    if (!b?.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    const patch = { ...pickFields(b), updated_at: new Date().toISOString() };
    const { data, error } = await sb.from("custos_insumo").update(patch).eq("id", b.id).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, insumo: data });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const b = await req.json();
    if (!b?.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    const { error } = await sb.from("custos_insumo").delete().eq("id", b.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 500 }); }
}
