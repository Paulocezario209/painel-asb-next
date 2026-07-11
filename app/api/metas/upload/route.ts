/**
 * POST /api/metas/upload
 * Parseia XLSX de metas anuais por vendedor → UPSERT em supabase.metas.
 *
 * Formato esperado do XLSX (cabeçalho na linha 1):
 *
 *   Vendedor          | Mes | Ano  | MetaMensal
 *   Ana Paula         | 5   | 2026 | 513000
 *   Alan              | 5   | 2026 | 240000
 *   Paulo Cezario     | 5   | 2026 | 55682.17
 *
 * Aceita também variações de header (case-insensitive):
 *   vendedor / nome | mes / mês | ano / year | meta / valor / meta_mensal
 *
 * Modo PREVIEW (dry_run=true): retorna o que SERIA gravado sem aplicar.
 * Modo GRAVA (dry_run=false): UPSERT em metas.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { revalidateTag } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Mapeamento nome vendedor → routing_team
const VENDOR_MAP: Record<string, string> = {
  "ana": "SETOR_SOROCABA_SAO_PAULO",
  "ana paula": "SETOR_SOROCABA_SAO_PAULO",
  "ana paula sorocaba": "SETOR_SOROCABA_SAO_PAULO",
  "sorocaba": "SETOR_SOROCABA_SAO_PAULO",
  "sao paulo": "SETOR_SOROCABA_SAO_PAULO",
  "alan": "SETOR_CAMPINAS_JUNDIAI",
  "alan campinas": "SETOR_CAMPINAS_JUNDIAI",
  "campinas": "SETOR_CAMPINAS_JUNDIAI",
  "jundiai": "SETOR_CAMPINAS_JUNDIAI",
  "paulo": "SETOR_CUIT",
  "paulo cezario": "SETOR_CUIT",
  "paulo cuit": "SETOR_CUIT",
  "cuit": "SETOR_CUIT",
};

function normalize(s: string): string {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function pickKey(row: Record<string, unknown>, candidates: string[]): unknown {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const k = keys.find((kk) => normalize(kk) === c);
    if (k !== undefined) return row[k];
  }
  return undefined;
}

function ultimoDiaDoMes(ano: number, mes: number): string {
  const d = new Date(ano, mes, 0);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ParsedMeta = {
  row: number;
  vendedor_raw: string;
  vendedor_routing_team: string | null;
  ano: number;
  mes: number;
  meta_valor_brl: number;
  data_inicio: string;
  data_fim: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  // Gap fechado 2026-07-10: a PÁGINA /uploads bloqueava vendedor/manager, mas a
  // API aceitava POST de qualquer sessão. Mesma régua da página (canAccess).
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/uploads")) {
    return NextResponse.json({ error: "Sem permissão para uploads" }, { status: 403 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const dryRun = form.get("dry_run") === "true";

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const parsed: ParsedMeta[] = rows.map((r, idx) => {
      const vendedorRaw = String(pickKey(r, ["vendedor", "nome", "vendedora"]) ?? "").trim();
      const vendedor = VENDOR_MAP[normalize(vendedorRaw)] ?? null;
      const ano = Number(pickKey(r, ["ano", "year", "ano_referencia"]));
      const mes = Number(pickKey(r, ["mes", "mês", "month", "mes_referencia"]));
      const valor = Number(pickKey(r, ["meta", "valor", "meta_mensal", "meta_valor_brl", "metabrl", "meta_brl"]));

      let error: string | undefined;
      if (!vendedor) error = `Vendedor desconhecido: "${vendedorRaw}"`;
      else if (!ano || ano < 2025 || ano > 2030) error = `Ano inválido: ${ano}`;
      else if (!mes || mes < 1 || mes > 12) error = `Mês inválido: ${mes}`;
      else if (!valor || valor <= 0) error = `Valor inválido: ${valor}`;

      return {
        row: idx + 2, // +2 = cabeçalho + 1-based
        vendedor_raw: vendedorRaw,
        vendedor_routing_team: vendedor,
        ano: ano || 0,
        mes: mes || 0,
        meta_valor_brl: valor || 0,
        data_inicio: ano && mes ? `${ano}-${String(mes).padStart(2, "0")}-01` : "",
        data_fim: ano && mes ? ultimoDiaDoMes(ano, mes) : "",
        error,
      };
    });

    const validas = parsed.filter((p) => !p.error);
    const invalidas = parsed.filter((p) => p.error);

    if (dryRun) {
      return NextResponse.json({
        mode: "preview",
        total: parsed.length,
        validas: validas.length,
        invalidas: invalidas.length,
        previa: validas,
        erros: invalidas,
      });
    }

    // Modo GRAVA — UPSERT (delete + insert por vendedor+mês)
    if (validas.length === 0) {
      return NextResponse.json({
        error: "Nenhuma linha válida pra gravar",
        invalidas,
      }, { status: 400 });
    }

    const sb = createClient(SB_URL, SB_SRK);
    const aplicadas: Array<{ vendedor: string; mes: number; ano: number; valor: number; action: "insert" | "update" }> = [];

    for (const m of validas) {
      // Desativar existente (mesmo vendedor + período)
      await sb
        .from("metas")
        .update({ ativo: false })
        .eq("vendedor_routing_team", m.vendedor_routing_team!)
        .eq("granularidade", "mensal")
        .eq("data_inicio", m.data_inicio)
        .eq("ativo", true);

      // Inserir novo
      const { error: insErr } = await sb.from("metas").insert({
        vendedor_routing_team: m.vendedor_routing_team,
        granularidade: "mensal",
        tipo: "valor",
        data_inicio: m.data_inicio,
        data_fim: m.data_fim,
        meta_valor_brl: m.meta_valor_brl,
        fonte: "xlsx_painel_upload",
        ativo: true,
        notas: `Atualizado via painel ${new Date().toISOString().slice(0, 10)}`,
      });

      if (insErr) {
        return NextResponse.json({
          error: `Falha gravar ${m.vendedor_raw} ${m.mes}/${m.ano}: ${insErr.message}`,
          aplicadas,
        }, { status: 500 });
      }

      aplicadas.push({
        vendedor: m.vendedor_routing_team!,
        mes: m.mes,
        ano: m.ano,
        valor: m.meta_valor_brl,
        action: "insert",
      });
    }

    // ETAPA6 residual (DEBT-137): metas alimentam o calendário do gerente →
    // invalida o cache da rota /api/metas/calendario (Next 16: { expire: 0 }).
    revalidateTag("gerente-calendario-historico", { expire: 0 });

    return NextResponse.json({
      mode: "applied",
      total: parsed.length,
      aplicadas: aplicadas.length,
      invalidas: invalidas.length,
      detalhe: aplicadas,
      erros: invalidas,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Erro ao processar XLSX: ${msg}` }, { status: 500 });
  }
}
