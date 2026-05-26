/**
 * POST /api/compras/custos/producao/copiar-mes
 * body: { mesOrigem, mesDestino, ano }
 * Copia registros do mesOrigem → mesDestino (mesmo dia do mês quando válido), obs += "[copiado de MM/AAAA]".
 * Não sobrescreve datas já existentes no destino (ON CONFLICT DO NOTHING via filtro).
 */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function diasNoMes(ano: number, mes: number) {
  return new Date(ano, mes, 0).getDate();
}

export async function POST(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  try {
    const { mesOrigem, mesDestino, ano } = await req.json();
    const mo = Number(mesOrigem), md = Number(mesDestino), an = Number(ano);
    if (!mo || !md || !an) return NextResponse.json({ error: "mesOrigem, mesDestino e ano obrigatórios" }, { status: 400 });

    const ini = `${an}-${String(mo).padStart(2, "0")}-01`;
    const fim = mo === 12 ? `${an + 1}-01-01` : `${an}-${String(mo + 1).padStart(2, "0")}-01`;
    const { data: origem, error: e1 } = await sb
      .from("custos_registro_diario")
      .select("data,kg_produzido,custo_total,temperatura,ops,horas_moagem,horas_modelagem,horas_embalamento,obs")
      .gte("data", ini).lt("data", fim);
    if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });

    const maxDia = diasNoMes(an, md);
    const rows = (origem ?? [])
      .map((r) => {
        const dia = Number(String(r.data).slice(8, 10));
        if (dia > maxDia) return null; // ex: 31 num mês de 30 dias
        const novaData = `${an}-${String(md).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
        return {
          ...r,
          data: novaData,
          obs: `${r.obs ?? ""} [copiado de ${String(mo).padStart(2, "0")}/${an}]`.trim(),
          source: "manual",
        };
      })
      .filter(Boolean) as Record<string, unknown>[];

    if (rows.length === 0) return NextResponse.json({ ok: true, copiados: 0, nota: "mês origem vazio" });
    // ignoreDuplicates: não sobrescreve datas já existentes no destino
    const { error } = await sb.from("custos_registro_diario").upsert(rows, { onConflict: "data", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, copiados: rows.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
