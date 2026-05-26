/** GET /api/compras/custos/alertas-ativos — meses com custo_medio_kg > ideal (atenção+). */
import { NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";
import { thrFromConfig, nivelDe } from "@/lib/compras/nivel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  const thr = await thrFromConfig(sb as never);
  const { data, error } = await sb.from("v_custos_mes_2026").select("ano,mes,ano_mes,custo_medio_kg,kg_total").gt("custo_medio_kg", thr.ideal);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const alertas = (data ?? [])
    .filter((m) => Number(m.kg_total) > 0)
    .map((m) => { const n = nivelDe(Number(m.custo_medio_kg), thr); return { ano: m.ano, mes: m.mes, ano_mes: m.ano_mes, custo_medio_kg: Number(m.custo_medio_kg), nivel: n.nivel, cor: n.cor, label: n.label }; })
    .sort((a, b) => b.custo_medio_kg - a.custo_medio_kg);
  return NextResponse.json({ alertas, total: alertas.length });
}
