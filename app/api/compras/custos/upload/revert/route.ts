/**
 * POST /api/compras/custos/upload/revert
 * Body JSON: { upload_id }
 * Desfaz um upload: apaga os registros das 5 tabelas producao_* com aquele upload_id
 * e marca planilhas_upload_log.status = 'revertido'.
 * Guard SUPABASE_SERVICE_ROLE_KEY (DEBT-070).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABELAS = [
  "producao_temperatura_produto",
  "producao_temperatura_setor",
  "producao_apontamento_horas",
  "producao_jornada_semana",
  "producao_qualidade",
];

export async function POST(req: NextRequest) {
  if (!SB_URL || !SB_SRK) {
    return NextResponse.json(
      { error: "Config ausente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias." },
      { status: 503 }
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const uploadId = Number(body?.upload_id);
    if (!Number.isInteger(uploadId) || uploadId <= 0)
      return NextResponse.json({ error: "upload_id inválido" }, { status: 400 });

    const sb = createClient(SB_URL, SB_SRK, { auth: { persistSession: false } });

    const apagados: Record<string, number> = {};
    for (const t of TABELAS) {
      const { error, count } = await sb
        .from(t)
        .delete({ count: "exact" })
        .eq("upload_id", uploadId);
      if (error) return NextResponse.json({ error: `Falha ao reverter ${t}: ${error.message}` }, { status: 500 });
      apagados[t] = count ?? 0;
    }

    const { error: updErr } = await sb
      .from("planilhas_upload_log")
      .update({ status: "revertido" })
      .eq("id", uploadId);
    if (updErr) return NextResponse.json({ error: `Falha ao marcar log: ${updErr.message}` }, { status: 500 });

    return NextResponse.json({ mode: "reverted", upload_id: uploadId, apagados });
  } catch (e) {
    return NextResponse.json({ error: `Erro ao reverter: ${(e as Error).message}` }, { status: 500 });
  }
}
