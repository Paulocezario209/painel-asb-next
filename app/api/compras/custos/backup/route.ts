/**
 * /api/compras/custos/backup
 *   GET  → lista snapshots (id, nome, created_at, created_by)
 *   POST → cria snapshot (body { nome }) com todos os registros + insumos em jsonb
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  const { data, error } = await sb
    .from("custos_backup")
    .select("id,nome,created_by,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ backups: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const body = await req.json().catch(() => ({}));
    const nome = (body?.nome as string) || `Backup ${new Date().toISOString().slice(0, 16).replace("T", " ")}`;
    const [reg, ins] = await Promise.all([
      sb.from("custos_registro_diario").select("*"),
      sb.from("custos_insumo").select("*"),
    ]);
    if (reg.error) return NextResponse.json({ error: reg.error.message }, { status: 500 });
    const payload = { registros: reg.data ?? [], insumos: ins.data ?? [], ts: new Date().toISOString() };
    const { data, error } = await sb
      .from("custos_backup")
      .insert({ nome, payload, created_by: (body?.created_by as string) ?? null })
      .select("id,nome,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, backup: data, registros: payload.registros.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
