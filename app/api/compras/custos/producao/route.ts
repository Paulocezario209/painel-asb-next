/**
 * /api/compras/custos/producao — registro diário de produção/custo (Fase 5.2).
 *   POST   upsert por data (status calculado pelo trigger)
 *   GET    ?todos=true  → todos · ?ano=2026&mes=4 → mês
 *   DELETE body { data } → remove o dia
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapIn(b: Record<string, unknown>) {
  return {
    data: b.data,
    kg_produzido: Number(b.kgProduzido ?? b.kg_produzido ?? 0),
    custo_total: Number(b.custoTotal ?? b.custo_total ?? 0),
    temperatura: Number(b.temperatura ?? 0),
    ops: Number(b.ops ?? 0),
    horas_moagem: Number(b.horasMoagem ?? b.horas_moagem ?? 0),
    horas_modelagem: Number(b.horasModelagem ?? b.horas_modelagem ?? 0),
    horas_embalamento: Number(b.horasEmbalamento ?? b.horas_embalamento ?? 0),
    obs: (b.obs as string) ?? null,
    source: (b.source as string) ?? "manual",
    created_by: (b.created_by as string) ?? null,
  };
}

export async function POST(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const body = await req.json();
    if (!body?.data) return NextResponse.json({ error: "campo 'data' obrigatório" }, { status: 400 });
    const row = mapIn(body);
    const { data, error } = await sb
      .from("custos_registro_diario")
      .upsert(row, { onConflict: "data" })
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, registro: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  const sp = req.nextUrl.searchParams;
  let q = sb.from("custos_registro_diario").select("*").order("data", { ascending: true });
  if (sp.get("todos") !== "true") {
    const ano = Number(sp.get("ano"));
    const mes = Number(sp.get("mes"));
    if (ano && mes) {
      const ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const fimMes = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
      q = q.gte("data", ini).lt("data", fimMes);
    }
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ registros: data ?? [] });
}

export async function DELETE(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const body = await req.json();
    if (!body?.data) return NextResponse.json({ error: "campo 'data' obrigatório" }, { status: 400 });
    const { error } = await sb.from("custos_registro_diario").delete().eq("data", body.data);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
