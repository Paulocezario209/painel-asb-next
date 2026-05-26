/**
 * POST /api/compras/custos/ares-sync — disparo MANUAL (gestor).
 * Agrega do ARES espelhado: kg = Σ op_espelho.qtde_real por data_encerramento;
 * custo = -Σ consumo_movimento.valor_brl (tipo 4 = saída) por dia.
 * UPSERT em custos_registro_diario com source='ares' — NÃO sobrescreve dias source='manual'.
 * Nota: kg ARES em validação (DEBT-073). Não é automático.
 */
import { NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const [ops, cons, manuais] = await Promise.all([
      sb.from("op_espelho").select("data_encerramento,qtde_real").not("data_encerramento", "is", null).limit(10000),
      sb.from("consumo_movimento").select("dia,valor_brl").eq("tipo_mov", 4).limit(20000),
      sb.from("custos_registro_diario").select("data").eq("source", "manual"),
    ]);
    if (ops.error) return NextResponse.json({ error: `op_espelho: ${ops.error.message}` }, { status: 500 });
    if (cons.error) return NextResponse.json({ error: `consumo: ${cons.error.message}` }, { status: 500 });

    const kgByDate = new Map<string, number>();
    for (const o of ops.data ?? []) {
      const d = String((o as { data_encerramento: string }).data_encerramento).slice(0, 10);
      kgByDate.set(d, (kgByDate.get(d) ?? 0) + Number((o as { qtde_real: number }).qtde_real ?? 0));
    }
    const custoByDate = new Map<string, number>();
    for (const c of cons.data ?? []) {
      const d = String((c as { dia: string }).dia).slice(0, 10);
      custoByDate.set(d, (custoByDate.get(d) ?? 0) + Number((c as { valor_brl: number }).valor_brl ?? 0));
    }
    const manualDates = new Set((manuais.data ?? []).map((m) => String((m as { data: string }).data).slice(0, 10)));

    const datas = new Set<string>([...kgByDate.keys(), ...custoByDate.keys()]);
    const rows = [...datas]
      .filter((d) => !manualDates.has(d)) // protege manual
      .map((d) => ({
        data: d,
        kg_produzido: Math.round((kgByDate.get(d) ?? 0) * 1000) / 1000,
        custo_total: Math.round(-(custoByDate.get(d) ?? 0) * 100) / 100, // tipo4 negativo → custo positivo
        source: "ares",
      }));

    if (rows.length === 0) return NextResponse.json({ ok: true, sincronizados: 0, protegidos_manual: manualDates.size });
    const { error } = await sb.from("custos_registro_diario").upsert(rows, { onConflict: "data" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, sincronizados: rows.length, protegidos_manual: manualDates.size, nota: "kg ARES em validação (DEBT-073)" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
