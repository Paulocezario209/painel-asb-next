/** GET /api/compras/custos/relatorio-mensal?mes=04&ano=2026 — composição de custo, detalhamento diário, KPIs e apontamentos. */
import { NextRequest, NextResponse } from "next/server";
import { sbAdmin, ENV_ERR } from "@/lib/compras/sb-admin";
import { thrFromConfig, nivelDe } from "@/lib/compras/nivel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sb = sbAdmin();
  if (!sb) return NextResponse.json(ENV_ERR, { status: 503 });
  const sp = req.nextUrl.searchParams;
  const ano = Number(sp.get("ano")) || 2026;
  const mes = Number(sp.get("mes")) || 1;
  const thr = await thrFromConfig(sb as never);

  const ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fim = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
  const [regRes, pcRes] = await Promise.all([
    sb.from("custos_registro_diario").select("*").gte("data", ini).lt("data", fim).order("data"),
    sb.from("custos_processo_config").select("etapa,custo_hora"),
  ]);
  if (regRes.error) return NextResponse.json({ error: regRes.error.message }, { status: 500 });
  const regs = regRes.data ?? [];
  const ch: Record<string, number> = {}; (pcRes.data ?? []).forEach((p) => (ch[p.etapa] = Number(p.custo_hora)));
  const chMo = ch.moagem ?? 0, chMod = ch.modelagem ?? 0, chEmb = ch.embalamento ?? 0;

  let kgTot = 0, custoTot = 0, mpTot = 0, moTot = 0, modTot = 0, embTot = 0;
  let hMo = 0, hMod = 0, hEmb = 0, opsTot = 0, diasProd = 0;
  const dias = regs.map((r) => {
    const kg = Number(r.kg_produzido || 0);
    const cMo = Number(r.horas_moagem || 0) * chMo, cMod = Number(r.horas_modelagem || 0) * chMod, cEmb = Number(r.horas_embalamento || 0) * chEmb;
    const total = Number(r.custo_total || 0);
    const mp = Math.max(0, total - cMo - cMod - cEmb);
    if (kg > 0) diasProd++;
    kgTot += kg; custoTot += total; mpTot += mp; moTot += cMo; modTot += cMod; embTot += cEmb;
    hMo += Number(r.horas_moagem || 0); hMod += Number(r.horas_modelagem || 0); hEmb += Number(r.horas_embalamento || 0); opsTot += Number(r.ops || 0);
    return { data: r.data, kg, mp, moagem: cMo, modelagem: cMod, embalamento: cEmb, total, custo_kg: r.custo_kg, status: r.status };
  });

  const apont = dias.filter((d) => d.kg > 0 && Number(d.custo_kg) > thr.alerta).map((d) => {
    const n = nivelDe(Number(d.custo_kg), thr);
    return { data: d.data, custo_kg: Number(d.custo_kg), nivel: n.nivel, cor: n.cor, label: n.label, ref: thr.alerta, acao: n.nivel === "critico" ? "Auditar rendimento e mix de MP do dia." : "Monitorar fornecedores e perdas." };
  });

  const perKg = (v: number) => (kgTot > 0 ? Math.round((v / kgTot) * 100) / 100 : 0);
  return NextResponse.json({
    ano, mes,
    composicao: [
      { nome: "Matéria-Prima", valor: Math.round(mpTot * 100) / 100, cor: "#1B2A6B", horas: null, custo_hora: null },
      { nome: "Moagem", valor: Math.round(moTot * 100) / 100, cor: "#F97316", horas: Math.round(hMo * 100) / 100, custo_hora: chMo },
      { nome: "Modelagem", valor: Math.round(modTot * 100) / 100, cor: "#EC4899", horas: Math.round(hMod * 100) / 100, custo_hora: chMod },
      { nome: "Embalamento", valor: Math.round(embTot * 100) / 100, cor: "#8B5CF6", horas: Math.round(hEmb * 100) / 100, custo_hora: chEmb },
    ],
    custo_total: Math.round(custoTot * 100) / 100,
    dias,
    kpis: { mp_kg: perKg(mpTot), moagem_kg: perKg(moTot), modelagem_kg: perKg(modTot), embalamento_kg: perKg(embTot), total_kg: perKg(custoTot), h_moagem: Math.round(hMo * 100) / 100, h_modelagem: Math.round(hMod * 100) / 100, h_embalamento: Math.round(hEmb * 100) / 100, ops: opsTot, kg_dia: diasProd > 0 ? Math.round((kgTot / diasProd) * 10) / 10 : 0 },
    custo_hora: { moagem: chMo, modelagem: chMod, embalamento: chEmb },
    apontamentos: apont,
  });
}
