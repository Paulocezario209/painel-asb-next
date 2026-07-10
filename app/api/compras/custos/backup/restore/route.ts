/**
 * POST /api/compras/custos/backup/restore — body { id }
 * Restaura um snapshot: re-upsert dos registros (source='backup_restore') + insumos do payload.
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
    const { data: bk, error: e0 } = await sb.from("custos_backup").select("payload").eq("id", id).single();
    if (e0 || !bk) return NextResponse.json({ error: `Backup não encontrado: ${e0?.message}` }, { status: 404 });

    const payload = bk.payload as { registros?: Record<string, unknown>[]; insumos?: Record<string, unknown>[] };
    const registros = (payload.registros ?? []).map((r) => {
      // remove colunas geradas/identity p/ re-upsert limpo
      const { id: _id, custo_kg: _ck, created_at: _ca, updated_at: _ua, ...rest } = r as Record<string, unknown>;
      void _id; void _ck; void _ca; void _ua;
      return { ...rest, source: "backup_restore" };
    });

    if (registros.length > 0) {
      const { error } = await sb.from("custos_registro_diario").upsert(registros, { onConflict: "data" });
      if (error) return NextResponse.json({ error: `registros: ${error.message}` }, { status: 500 });
    }

    // DEBT-254: insumos do payload eram ignorados (restore parcial silencioso).
    // id é bigserial (aceita explícito) e os ids vieram desta mesma tabela → upsert por id.
    const insumos = (payload.insumos ?? []).map((i) => {
      const { created_at: _ca, ...rest } = i as Record<string, unknown>;
      void _ca;
      return rest;
    });
    if (insumos.length > 0) {
      const { error } = await sb.from("custos_insumo").upsert(insumos, { onConflict: "id" });
      if (error) return NextResponse.json({ error: `insumos: ${error.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true, restaurados: registros.length, insumosRestaurados: insumos.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
