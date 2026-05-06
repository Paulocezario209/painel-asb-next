/**
 * POST /api/orders/upload
 * Parseia XLSX → chama /internal/orders para cada row → loga em xlsx_upload_log.
 *
 * Decisões arquiteturais respeitadas:
 *   D1: orders alimentada por XLSX upload
 *   D2: loose join customer_phone
 *   D5: INTERNAL_API_KEY apenas server-side (nunca NEXT_PUBLIC_)
 *   D10: upload_batch_id gerado aqui e propagado para cada call /internal/orders
 *
 * SUPABASE_SERVICE_ROLE_KEY usada APENAS para o INSERT em xlsx_upload_log (1 row no fim).
 * Evita criar endpoint CP só para isso (overkill para log de auditoria local do painel).
 */
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";

// ─── Env vars (server-side only) ────────────────────────────────────────────
const CP_URL      = process.env.CP_INTERNAL_URL!;
const API_KEY     = process.env.INTERNAL_API_KEY!;
const SB_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_SRK      = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─── COLUMN_MAP: header ARES → campo orders ─────────────────────────────────
const COLUMN_MAP: Record<string, string> = {
  "Pedido":          "order_ref",
  "Num. Pedido":     "order_ref",
  "Nº Pedido":       "order_ref",
  "NF":              "nf_number",
  "Nº NF":           "nf_number",
  "Nota":            "nf_number",
  "Cliente":         "customer_name",
  "Nome Cliente":    "customer_name",
  "Telefone":        "customer_phone",
  "Fone":            "customer_phone",
  "Celular":         "customer_phone",
  "Cidade":          "city",
  "Município":       "city",
  "Vendedor":        "seller_id",
  "Cód. Vendedor":   "seller_id",
  "Produto":         "product_group",
  "Grupo":           "product_group",
  "Qtd (kg)":        "quantity_kg",
  "Quantidade (kg)": "quantity_kg",
  "Qtd":             "quantity_kg",
  "Kg":              "quantity_kg",
  "Preço Unit":      "unit_price_brl",
  "Preço Unitário":  "unit_price_brl",
  "Valor Unit":      "unit_price_brl",
  "Total":           "total_brl",
  "Valor Total":     "total_brl",
  "Total BRL":       "total_brl",
  "Data":            "order_date",
  "Data Pedido":     "order_date",
  "Data do Pedido":  "order_date",
  "Status":          "status",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizePhone(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  // 11 dígitos (DDD + número) → prepend 55
  if (digits.length === 11) return `55${digits}`;
  // 13 dígitos começando com 55 → manter
  if (digits.length === 13 && digits.startsWith("55")) return digits;
  // 10 dígitos (DDD + 8 dígitos) → prepend 55
  if (digits.length === 10) return `55${digits}`;
  // qualquer outro → retorna o que tem
  return digits;
}

function normalizeGroup(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const lower = String(raw).toLowerCase();
  if (lower.includes("smash")) return "smash";
  if (lower.includes("steak")) return "steak";
  if (lower.includes("blend")) return "blend";
  if (lower.includes("chicken") || lower.includes("panko")) return "blend";
  return null;
}

/** Converte serial XLSX, DD/MM/YYYY ou YYYY-MM-DD para YYYY-MM-DD. */
function parseOrderDate(raw: unknown): string | null {
  if (raw == null) return null;
  // Serial XLSX (número)
  if (typeof raw === "number") {
    const date = XLSX.SSF.parse_date_code(raw);
    if (!date) return null;
    const mm = String(date.m).padStart(2, "0");
    const dd = String(date.d).padStart(2, "0");
    return `${date.y}-${mm}-${dd}`;
  }
  const s = String(raw).trim();
  // DD/MM/YYYY
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, "0")}-${dmY[1].padStart(2, "0")}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

// ─── Main handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const uploadedBy = (formData.get("uploaded_by") as string | null) ?? "painel";

  if (!file) {
    return NextResponse.json({ error: "Campo 'file' ausente." }, { status: 400 });
  }

  const filename = file.name;
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!["xlsx", "xls"].includes(ext ?? "")) {
    return NextResponse.json({ error: "Formato inválido. Enviar .xlsx ou .xls." }, { status: 400 });
  }

  // Parse XLSX
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (rawRows.length === 0) {
    return NextResponse.json({ error: "Planilha vazia ou sem linhas de dados." }, { status: 400 });
  }

  // Gera batch_id antes do loop (D10)
  const batchId = uuidv4();
  const startedAt = new Date().toISOString();

  const results = {
    batch_id:     batchId,
    rows_total:   rawRows.length,
    rows_inserted: 0,
    rows_updated:  0,
    rows_skipped:  0,
    errors:        [] as { row: number; order_ref: string | null; reason: string }[],
  };

  // Loop: mapear + enviar cada row ao CP
  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];

    // Mapear headers ARES → campos orders
    const mapped: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(raw)) {
      const field = COLUMN_MAP[header];
      if (field) mapped[field] = value;
    }

    // Validar campos obrigatórios
    if (!mapped["order_ref"] || !mapped["total_brl"] || !mapped["order_date"]) {
      results.rows_skipped++;
      results.errors.push({
        row: i + 2, // +2 = header + 1-based
        order_ref: (mapped["order_ref"] as string) ?? null,
        reason: "Campos obrigatórios ausentes: order_ref, total_brl ou order_date.",
      });
      continue;
    }

    // Normalizar
    const payload = {
      order_ref:      String(mapped["order_ref"]),
      total_brl:      Number(mapped["total_brl"]),
      order_date:     parseOrderDate(mapped["order_date"]),
      customer_phone: normalizePhone(mapped["customer_phone"] as string | null),
      customer_name:  mapped["customer_name"] ? String(mapped["customer_name"]) : undefined,
      seller_id:      mapped["seller_id"] ? String(mapped["seller_id"]) : undefined,
      city:           mapped["city"] ? String(mapped["city"]) : undefined,
      product_group:  normalizeGroup(mapped["product_group"] as string | null) ?? undefined,
      quantity_kg:    mapped["quantity_kg"] != null ? Number(mapped["quantity_kg"]) : undefined,
      unit_price_brl: mapped["unit_price_brl"] != null ? Number(mapped["unit_price_brl"]) : undefined,
      nf_number:      mapped["nf_number"] ? String(mapped["nf_number"]) : undefined,
      status:         mapped["status"] ? String(mapped["status"]) : "confirmed",
      upload_batch_id: batchId,
    };

    if (!payload.order_date) {
      results.rows_skipped++;
      results.errors.push({
        row: i + 2,
        order_ref: payload.order_ref,
        reason: `Data inválida: ${String(mapped["order_date"])}`,
      });
      continue;
    }

    // POST /internal/orders
    try {
      const res = await fetch(`${CP_URL}/internal/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-api-key": API_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const detail = await res.text();
        results.rows_skipped++;
        results.errors.push({
          row: i + 2,
          order_ref: payload.order_ref,
          reason: `CP ${res.status}: ${detail.slice(0, 120)}`,
        });
        continue;
      }

      const cpRes = await res.json();
      if (cpRes.action === "inserted") results.rows_inserted++;
      else results.rows_updated++;

    } catch (err) {
      results.rows_skipped++;
      results.errors.push({
        row: i + 2,
        order_ref: payload.order_ref,
        reason: `Erro de rede: ${String(err).slice(0, 80)}`,
      });
    }
  }

  // Calcular status do batch
  const processed = results.rows_inserted + results.rows_updated;
  const batchStatus =
    results.errors.length === 0 ? "completed" :
    processed === 0 ? "failed" : "partial";

  // INSERT em xlsx_upload_log (service_role, server-side)
  try {
    const supabase = createClient(SB_URL, SB_SRK);
    await supabase.from("xlsx_upload_log").insert({
      id:             batchId,
      filename,
      uploaded_by:    uploadedBy,
      rows_total:     results.rows_total,
      rows_inserted:  results.rows_inserted,
      rows_updated:   results.rows_updated,
      rows_skipped:   results.rows_skipped,
      status:         batchStatus,
      uploaded_at:    startedAt,
      errors:         results.errors.length > 0 ? results.errors : null,
    });
  } catch (logErr) {
    // Não falhar o request por erro de log
    console.error("xlsx_upload_log INSERT error:", logErr);
  }

  return NextResponse.json({
    batch_id:     results.batch_id,
    rows_total:   results.rows_total,
    rows_inserted: results.rows_inserted,
    rows_updated:  results.rows_updated,
    rows_skipped:  results.rows_skipped,
    status:       batchStatus,
    errors:       results.errors,
  });
}
