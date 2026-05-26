/**
 * POST /api/compras/ancora/upload
 * Parseia o XLSX do inventário 01/05 (aba "Inventario") → estoque_ancora (auditoria)
 * + estoque_saldo.saldo_ancora (só limpas KG no M1) + recompute_estoque_saldo().
 *
 * Cabeçalho esperado (linha 1 da 1ª aba):
 *   Página | Grupo | Subgrupo | Id Produto | Descrição | Un | Saldo sistema | Contagem/anotação | Observações
 *
 * Só processa linhas com "Contagem/anotação" preenchida (as 75 contadas).
 *   - LIMPA:   Id numérico + Un definida + contagem parseável (>=0, sem '?')
 *   - AMBIGUA: contagem preenchida mas não-limpa ('0,00?'/'OK / 24?'/'Real'/'?'...)
 * GRAVA: estoque_ancora recebe todas (limpa+ambígua); saldo_ancora recebe só LIMPA + Un='KG' (M1).
 *
 * dry_run=true → preview (não grava). dry_run=false → grava + recompute.
 */
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATA_ANCORA = "2026-05-01";

function normalize(s: string): string {
  return (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}
function pickKey(row: Record<string, unknown>, candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const k = keys.find((kk) => normalize(kk) === c);
    if (k !== undefined) return row[k];
  }
  return undefined;
}
// número BR ('5,697' -> 5.697 ; '1.234,5' -> 1234.5). Rejeita '?' e texto.
function parseBR(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === "" || s.includes("?")) return null;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

type ParsedAncora = {
  row: number;
  id_produto: number | null;
  descricao: string;
  grupo: string | null;
  subgrupo: string | null;
  unidade: string;
  qtd_contada: number | null;
  contagem_raw: string;
  status_ancora: "limpa" | "ambigua";
  entra_no_saldo: boolean; // limpa + KG
  observacao: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const dryRun = form.get("dry_run") === "true";
    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]]; // 1ª aba = "Inventario"
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const parsed: ParsedAncora[] = [];
    rows.forEach((r, idx) => {
      const contRaw = pickKey(r, ["contagem/anotacao", "contagem", "contagem/anotação"]);
      if (contRaw === null || contRaw === undefined || String(contRaw).trim() === "") return; // só as contadas
      const idRaw = pickKey(r, ["id produto", "id_produto", "idproduto"]);
      const idStr = String(idRaw ?? "").trim();
      const idOk = /^\d+$/.test(idStr);
      const un = String(pickKey(r, ["un", "unidade"]) ?? "").trim().toUpperCase();
      const qt = parseBR(contRaw);
      const limpa = idOk && !!un && qt !== null && qt >= 0;
      parsed.push({
        row: idx + 2,
        id_produto: idOk ? Number(idStr) : null,
        descricao: String(pickKey(r, ["descricao", "descrição"]) ?? "").trim(),
        grupo: (pickKey(r, ["grupo"]) as string) ?? null,
        subgrupo: (pickKey(r, ["subgrupo"]) as string) ?? null,
        unidade: un,
        qtd_contada: qt,
        contagem_raw: String(contRaw),
        status_ancora: limpa ? "limpa" : "ambigua",
        entra_no_saldo: limpa && un === "KG",
        observacao: (pickKey(r, ["observacoes", "observações", "observacao"]) as string) ?? null,
      });
    });

    const limpas = parsed.filter((p) => p.status_ancora === "limpa");
    const ambiguas = parsed.filter((p) => p.status_ancora === "ambigua");
    const noSaldo = parsed.filter((p) => p.entra_no_saldo);

    if (dryRun) {
      return NextResponse.json({
        mode: "preview",
        total_contadas: parsed.length,
        limpas: limpas.length,
        ambiguas: ambiguas.length,
        entram_no_saldo_kg: noSaldo.length,
        previa_saldo: noSaldo,
        ambiguas_lista: ambiguas,
      });
    }

    // GRAVA
    const gravaveis = parsed.filter((p) => p.id_produto !== null);
    if (gravaveis.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha com Id Produto numérico" }, { status: 400 });
    }
    const sb = createClient(SB_URL, SB_SRK);

    // 1) upsert auditoria (limpa + ambígua, todas com id numérico)
    const { error: upErr } = await sb.from("estoque_ancora").upsert(
      gravaveis.map((p) => ({
        id_produto: p.id_produto,
        descricao: p.descricao,
        grupo: p.grupo,
        subgrupo: p.subgrupo,
        unidade: p.unidade,
        qtd_contada: p.qtd_contada,
        contagem_raw: p.contagem_raw,
        status_ancora: p.status_ancora,
        observacao: p.observacao,
        data_ancora: DATA_ANCORA,
      })),
      { onConflict: "id_produto,data_ancora" },
    );
    if (upErr) return NextResponse.json({ error: `Falha estoque_ancora: ${upErr.message}` }, { status: 500 });

    // 2) saldo_ancora só das limpas KG (M1)
    let saldoAtualizados = 0;
    for (const p of noSaldo) {
      const { error: sErr, count } = await sb
        .from("estoque_saldo")
        .update({ saldo_ancora: p.qtd_contada }, { count: "exact" })
        .eq("id_produto", p.id_produto!);
      if (sErr) return NextResponse.json({ error: `Falha saldo_ancora ${p.id_produto}: ${sErr.message}` }, { status: 500 });
      saldoAtualizados += count ?? 0;
    }

    // 3) recompute server-side
    const { error: rpcErr } = await sb.rpc("recompute_estoque_saldo");
    if (rpcErr) return NextResponse.json({ error: `Falha recompute: ${rpcErr.message}` }, { status: 500 });

    return NextResponse.json({
      mode: "applied",
      total_contadas: parsed.length,
      auditoria_gravada: gravaveis.length,
      saldo_ancora_atualizados: saldoAtualizados,
      entram_no_saldo_kg: noSaldo.length,
      ambiguas: ambiguas.length,
      nota_saldo_nao_encontrado: noSaldo.length - saldoAtualizados, // KG limpo sem match em estoque_saldo
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Erro ao processar XLSX: ${msg}` }, { status: 500 });
  }
}
