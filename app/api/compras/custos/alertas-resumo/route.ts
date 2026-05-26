/** GET /api/compras/custos/alertas-resumo — contagem de meses por nível + faixas + lista ativos. */
import { NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";
import { thrFromConfig, nivelDe } from "@/lib/compras/nivel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  const thr = await thrFromConfig(sb as never);
  const { data, error } = await sb.from("v_custos_mes_2026").select("ano,mes,ano_mes,custo_medio_kg,kg_total");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const meses = (data ?? []).filter((m) => Number(m.kg_total) > 0);
  const cont = { ideal: 0, atencao: 0, alerta: 0, critico: 0 };
  const ativos: { ano_mes: string; custo_medio_kg: number; nivel: string; cor: string; label: string }[] = [];
  for (const m of meses) {
    const n = nivelDe(Number(m.custo_medio_kg), thr);
    if (n.nivel in cont) cont[n.nivel as keyof typeof cont]++;
    if (n.nivel !== "ideal") ativos.push({ ano_mes: m.ano_mes, custo_medio_kg: Number(m.custo_medio_kg), nivel: n.nivel, cor: n.cor, label: n.label });
  }
  ativos.sort((a, b) => b.custo_medio_kg - a.custo_medio_kg);
  const cards = [
    { nivel: "critico", count: cont.critico, faixa: `> R$ ${thr.alerta.toFixed(0)}/kg`, cor: "#EF4444" },
    { nivel: "alerta", count: cont.alerta, faixa: `R$ ${thr.atencao.toFixed(0)}-${thr.alerta.toFixed(0)}/kg`, cor: "#F97316" },
    { nivel: "atencao", count: cont.atencao, faixa: `R$ ${thr.ideal.toFixed(0)}-${thr.atencao.toFixed(0)}/kg`, cor: "#EAB308" },
    { nivel: "ideal", count: cont.ideal, faixa: `≤ R$ ${thr.ideal.toFixed(0)}/kg`, cor: "#22C55E" },
  ];
  return NextResponse.json({ cards, ativos });
}
