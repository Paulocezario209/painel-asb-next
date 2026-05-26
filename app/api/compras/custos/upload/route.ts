/**
 * POST /api/compras/custos/upload
 * Recebe o template preenchido (FormData: file XLSX + mode=preview|grava) e:
 *  - preview: parseia as 5 abas, valida (enums/ranges + ID OP contra op_espelho), devolve resumo + erros.
 *  - grava:   se preview limpo, registra planilhas_upload_log + grava nas 5 tabelas producao_* (com upload_id).
 *
 * Parse via xlsx (SheetJS). Validação no módulo puro lib/compras/custos-upload.ts.
 * Guard SUPABASE_SERVICE_ROLE_KEY (DEBT-070). ID OP é soft ref — fonte única de OP é o ARES.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { parseUpload, ABAS, type Row } from "@/lib/compras/custos-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sheetRows(wb: XLSX.WorkBook, name: string): Row[] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
}

export async function POST(req: NextRequest) {
  if (!SB_URL || !SB_SRK) {
    return NextResponse.json(
      { error: "Config ausente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias." },
      { status: 503 }
    );
  }

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const mode = String(form.get("mode") ?? "preview");
    const idUsuario = (form.get("id_usuario") as string) ?? null;
    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    if (mode !== "preview" && mode !== "grava")
      return NextResponse.json({ error: "mode deve ser preview ou grava" }, { status: 400 });

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });

    const sb = createClient(SB_URL, SB_SRK, { auth: { persistSession: false } });

    // IDs de OP válidos (soft ref) — paginação simples até 2000 (op_espelho ~589)
    const { data: ops, error: opErr } = await sb
      .from("op_espelho")
      .select("id")
      .limit(5000);
    if (opErr) return NextResponse.json({ error: `Falha ao ler op_espelho: ${opErr.message}` }, { status: 500 });
    const validOps = new Set<number>((ops ?? []).map((o: { id: number }) => Number(o.id)));

    const parsed = parseUpload(
      {
        temp_produto: sheetRows(wb, ABAS.temp_produto),
        temp_setor: sheetRows(wb, ABAS.temp_setor),
        horas: sheetRows(wb, ABAS.horas),
        jornada: sheetRows(wb, ABAS.jornada),
        qualidade: sheetRows(wb, ABAS.qualidade),
      },
      validOps
    );

    const totalOk =
      parsed.temp_produto.length + parsed.temp_setor.length + parsed.horas.length +
      parsed.jornada.length + parsed.qualidade.length;
    const totalErros = parsed.erros.length;

    if (mode === "preview") {
      return NextResponse.json({
        mode: "preview",
        resumo: parsed.resumo,
        total_ok: totalOk,
        total_erros: totalErros,
        erros: parsed.erros.slice(0, 100),
      });
    }

    // ── mode = grava ──
    if (totalErros > 0) {
      return NextResponse.json(
        { error: "Existem erros — corrija antes de gravar.", total_erros: totalErros, erros: parsed.erros.slice(0, 100) },
        { status: 422 }
      );
    }
    if (totalOk === 0) {
      return NextResponse.json({ error: "Nenhuma linha válida para gravar." }, { status: 400 });
    }

    // 1) registra o log → upload_id
    const { data: logRow, error: logErr } = await sb
      .from("planilhas_upload_log")
      .insert({
        arquivo_nome: file.name,
        id_usuario: idUsuario,
        abas_processadas: parsed.resumo,
        total_linhas_ok: totalOk,
        total_linhas_erro: 0,
        status: "gravado",
      })
      .select("id")
      .single();
    if (logErr || !logRow)
      return NextResponse.json({ error: `Falha ao registrar log: ${logErr?.message}` }, { status: 500 });
    const uploadId = logRow.id as number;

    const tag = (rows: Record<string, unknown>[]) => rows.map((r) => ({ ...r, upload_id: uploadId }));

    // 2) grava: upsert onde há UNIQUE; insert onde não há
    const steps: { tabela: string; rows: Record<string, unknown>[]; onConflict?: string }[] = [
      { tabela: "producao_temperatura_setor", rows: parsed.temp_setor, onConflict: "data,setor,turno" },
      { tabela: "producao_apontamento_horas", rows: parsed.horas, onConflict: "data,etapa" },
      { tabela: "producao_jornada_semana", rows: parsed.jornada, onConflict: "ano,semana_iso" },
      { tabela: "producao_temperatura_produto", rows: parsed.temp_produto },
      { tabela: "producao_qualidade", rows: parsed.qualidade },
    ];
    for (const s of steps) {
      if (s.rows.length === 0) continue;
      const tagged = tag(s.rows);
      const { error } = s.onConflict
        ? await sb.from(s.tabela).upsert(tagged, { onConflict: s.onConflict })
        : await sb.from(s.tabela).insert(tagged);
      if (error) {
        // marca o log como revertido (gravação parcial não fica "gravado")
        await sb.from("planilhas_upload_log").update({ status: "revertido" }).eq("id", uploadId);
        return NextResponse.json({ error: `Falha em ${s.tabela}: ${error.message} (log ${uploadId} revertido)` }, { status: 500 });
      }
    }

    return NextResponse.json({ mode: "applied", upload_id: uploadId, resumo: parsed.resumo, total_ok: totalOk });
  } catch (e) {
    return NextResponse.json({ error: `Erro ao processar XLSX: ${(e as Error).message}` }, { status: 500 });
  }
}
