/** GET /api/compras/custos/projecao-12-meses?ano=2026 — 12 linhas: realizado (view) ou projeção (média móvel 3m). */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";
import { thrFromConfig, nivelDe } from "@/lib/compras/nivel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export async function GET(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  const ano = Number(req.nextUrl.searchParams.get("ano")) || 2026;
  const thr = await thrFromConfig(sb as never);
  const { data, error } = await sb.from("v_custos_mes_2026").select("ano,mes,kg_total,valor_total,custo_medio_kg").eq("ano", ano);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const realMap = new Map<number, { kg: number; valor: number; custo: number }>();
  for (const m of data ?? []) if (Number(m.kg_total) > 0) realMap.set(Number(m.mes), { kg: Number(m.kg_total), valor: Number(m.valor_total), custo: Number(m.custo_medio_kg) });

  const linhas = [];
  for (let mes = 1; mes <= 12; mes++) {
    const real = realMap.get(mes);
    if (real) {
      const n = nivelDe(real.custo, thr);
      linhas.push({ mes, nome: MESES[mes - 1], status: "realizado", kg: real.kg, custo_kg: real.custo, valor: real.valor, nivel: n.nivel, cor: n.cor, label: n.label, registros: null });
    } else {
      // média móvel dos últimos 3 meses realizados anteriores; fallback média geral
      const ant = [...realMap.entries()].filter(([k]) => k < mes).sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, v]) => v);
      const base = ant.length ? ant : [...realMap.values()];
      const kg = base.length ? base.reduce((s, v) => s + v.kg, 0) / base.length : 0;
      const custo = base.length ? base.reduce((s, v) => s + v.custo, 0) / base.length : 0;
      const n = nivelDe(custo, thr);
      linhas.push({ mes, nome: MESES[mes - 1], status: "projecao", kg: Math.round(kg), custo_kg: Math.round(custo * 100) / 100, valor: Math.round(kg * custo), nivel: n.nivel, cor: n.cor, label: n.label, registros: null });
    }
  }
  const kgTot = linhas.reduce((s, l) => s + l.kg, 0);
  const valTot = linhas.reduce((s, l) => s + l.valor, 0);
  return NextResponse.json({ ano, linhas, total: { kg: kgTot, valor: valTot, custo_kg: kgTot > 0 ? Math.round((valTot / kgTot) * 100) / 100 : 0 } });
}
