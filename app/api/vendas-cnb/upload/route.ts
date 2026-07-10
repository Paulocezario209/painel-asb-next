/**
 * POST /api/vendas-cnb/upload
 * Parseia XLSX de Vendas Carnes Nobres Boutique (CNB) → UPSERT em supabase.vendas_cnb.
 *
 * Formato esperado do XLSX (cabeçalho na linha 1, 7 colunas):
 *   numero | data | cliente_cnpj_cpf | cliente_nome | valor_total | forma_pagamento | vendedor
 *   2965   | 27/05/2026 | 21439554000160 | BENNE LANCHES | 296,10 | BOLETO BANCARIO SICRED | Alan
 *
 * Aliases de header (case/acento-insensitive) — ver pickKey abaixo.
 * Vendedor → routing_team via VENDOR_MAP.
 * dry_run=true: preview (sem gravar). dry_run=false: UPSERT por (numero, data_venda, cliente_documento).
 * Padrão idêntico ao /api/metas/upload (DEBT-087).
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { revalidateTag } from "next/cache";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

function parseData(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(raw).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return s.slice(0, 10);
  return null;
}

// Aceita "296,10", "1.296,10", "296.10", 296.1
function parseValor(raw: unknown): number {
  if (typeof raw === "number") return raw;
  let s = String(raw ?? "").trim().replace(/r\$/i, "").replace(/\s/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? NaN : n;
}

type ParsedVenda = {
  row: number;
  numero: string;
  data_venda: string | null;
  cliente_documento: string;
  cliente_documento_tipo: "CPF" | "CNPJ" | null;
  cliente_nome: string;
  valor_total_brl: number;
  forma_pagamento: string | null;
  vendedor_raw: string;
  vendedor_routing_team: string | null;
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
    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const parsed: ParsedVenda[] = rows.map((r, idx) => {
      const numero = String(pickKey(r, ["numero", "número", "nro", "cupom", "numero_cupom"]) ?? "").trim();
      const dataVenda = parseData(pickKey(r, ["data", "data_venda", "data venda", "dt"]));
      const docRaw = String(pickKey(r, ["cliente_cnpj_cpf", "cnpj", "cpf", "cnpj_cpf", "cliente_doc", "documento"]) ?? "").replace(/\D/g, "");
      const nome = String(pickKey(r, ["cliente_nome", "nome", "cliente"]) ?? "").trim();
      const valor = parseValor(pickKey(r, ["valor_total", "valor", "total", "valor_total_brl", "vlr"]));
      const pagamento = String(pickKey(r, ["forma_pagamento", "pagamento", "forma"]) ?? "").trim() || null;
      const vendedorRaw = String(pickKey(r, ["vendedor", "nome_vendedor", "vendedora"]) ?? "").trim();
      const vendedor = VENDOR_MAP[normalize(vendedorRaw)] ?? null;

      let docTipo: "CPF" | "CNPJ" | null = null;
      if (docRaw.length === 11) docTipo = "CPF";
      else if (docRaw.length === 14) docTipo = "CNPJ";

      let error: string | undefined;
      if (!numero) error = "Número do cupom vazio";
      else if (!dataVenda) error = "Data inválida (use DD/MM/AAAA)";
      else if (!docTipo) error = `Documento inválido (${docRaw.length} dígitos; use CPF=11 ou CNPJ=14)`;
      else if (!nome) error = "Cliente vazio";
      else if (isNaN(valor) || valor < 0) error = `Valor inválido: ${valor}`;
      else if (!vendedor) error = `Vendedor desconhecido: "${vendedorRaw}"`;

      return {
        row: idx + 2,
        numero,
        data_venda: dataVenda,
        cliente_documento: docRaw,
        cliente_documento_tipo: docTipo,
        cliente_nome: nome,
        valor_total_brl: isNaN(valor) ? 0 : valor,
        forma_pagamento: pagamento,
        vendedor_raw: vendedorRaw,
        vendedor_routing_team: vendedor,
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

    if (validas.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha válida pra gravar", invalidas }, { status: 400 });
    }

    const sb = createClient(SB_URL, SB_SRK);
    const payload = validas.map((v) => ({
      numero: v.numero,
      data_venda: v.data_venda,
      cliente_documento: v.cliente_documento,
      cliente_documento_tipo: v.cliente_documento_tipo,
      cliente_nome: v.cliente_nome,
      valor_total_brl: v.valor_total_brl,
      forma_pagamento: v.forma_pagamento,
      vendedor_routing_team: v.vendedor_routing_team,
      uploaded_by: "xlsx_painel_upload",
    }));

    const { data: up, error: upErr } = await sb
      .from("vendas_cnb")
      .upsert(payload, { onConflict: "numero,data_venda,cliente_documento", ignoreDuplicates: false })
      .select("numero");

    if (upErr) {
      return NextResponse.json({ error: `Falha ao gravar: ${upErr.message}`, invalidas }, { status: 500 });
    }

    // ETAPA6 (DEBT-137): CNB alimenta o CAC mensal → invalida o cache da view.
    // Next 16: Route Handler usa { expire: 0 } para expiração imediata (doc oficial).
    revalidateTag("marketing-cac-mensal", { expire: 0 });

    return NextResponse.json({
      mode: "applied",
      total: parsed.length,
      aplicadas: up?.length ?? payload.length,
      invalidas: invalidas.length,
      detalhe: validas,
      erros: invalidas,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Erro ao processar XLSX: ${msg}` }, { status: 500 });
  }
}
