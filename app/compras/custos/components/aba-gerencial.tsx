"use client";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, BarChart, Cell } from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle2, ClipboardCheck } from "lucide-react";
import { C, sCard } from "../lib/ui";
import { SectionHead } from "@/app/dashboard/lib/ui";
import { theme } from "@/lib/theme";
import { brl } from "../lib/formatadores";
import type { Thresholds } from "../lib/classificar";
import type { Registro } from "../lib/storage-supabase";

export type MesGer = {
  ano_mes: string; kg_total: number; custo_medio_kg: number;
  horas_moagem_total: number; horas_modelagem_total: number; horas_embalamento_total: number;
};
export type InsumoMes = { ano_mes: string; recorte: number; gordura: number };
type Apontamento = { tipo: "critico" | "alerta" | "atencao" | "positivo"; titulo: string; detalhe: string; acao: string };

const TIPO_COR = { critico: C.vermelho, alerta: C.laranja, atencao: C.amarelo, positivo: C.verde2 };

function detectar(meses: MesGer[], registros: Registro[], t: Thresholds): Apontamento[] {
  const out: Apontamento[] = [];
  const m = meses.filter((x) => x.kg_total > 0);
  const ult = m[m.length - 1];
  const ant = m[m.length - 2];

  // 1 e 2 — custo absoluto
  if (ult) {
    if (ult.custo_medio_kg > t.ALERTA) out.push({ tipo: "critico", titulo: "Custo/kg acima do limite crítico", detalhe: `${ult.ano_mes}: ${brl(ult.custo_medio_kg)}/kg (> ${brl(t.ALERTA)})`, acao: "Revisar mix de matéria-prima e rendimento da produção." });
    else if (ult.custo_medio_kg > t.ATENCAO) out.push({ tipo: "alerta", titulo: "Custo/kg em zona de alerta", detalhe: `${ult.ano_mes}: ${brl(ult.custo_medio_kg)}/kg (> ${brl(t.ATENCAO)})`, acao: "Monitorar fornecedores e perdas da semana." });
  }
  // 3 — variação custo ±5%
  if (ult && ant && ant.custo_medio_kg > 0) {
    const v = ((ult.custo_medio_kg - ant.custo_medio_kg) / ant.custo_medio_kg) * 100;
    if (v > 5) out.push({ tipo: "alerta", titulo: "Custo subiu mês a mês", detalhe: `+${v.toFixed(1)}% vs ${ant.ano_mes}`, acao: "Investigar causa do aumento (preço MP, retrabalho)." });
    else if (v < -5) out.push({ tipo: "positivo", titulo: "Custo caiu mês a mês", detalhe: `${v.toFixed(1)}% vs ${ant.ano_mes}`, acao: "Registrar boa prática e replicar." });
  }
  // 4 e 5 — variação kg
  if (ult && ant && ant.kg_total > 0) {
    const vk = ((ult.kg_total - ant.kg_total) / ant.kg_total) * 100;
    if (vk < -20) out.push({ tipo: "critico", titulo: "Queda forte de volume", detalhe: `${vk.toFixed(1)}% kg vs ${ant.ano_mes}`, acao: "Verificar paradas de produção e demanda." });
    else if (vk < -10) out.push({ tipo: "alerta", titulo: "Queda de volume", detalhe: `${vk.toFixed(1)}% kg vs ${ant.ano_mes}`, acao: "Acompanhar capacidade e pedidos." });
  }
  // 6 — outlier diário (média + 2σ) no custo/kg
  const custos = registros.filter((r) => r.kg_produzido > 0 && r.custo_kg != null).map((r) => Number(r.custo_kg));
  if (custos.length >= 5) {
    const media = custos.reduce((s, v) => s + v, 0) / custos.length;
    const sd = Math.sqrt(custos.reduce((s, v) => s + (v - media) ** 2, 0) / custos.length);
    const lim = media + 2 * sd;
    const outliers = registros.filter((r) => r.kg_produzido > 0 && Number(r.custo_kg) > lim);
    if (outliers.length > 0) out.push({ tipo: "alerta", titulo: `${outliers.length} dia(s) com custo fora da curva`, detalhe: `acima de ${brl(lim)}/kg (média + 2σ)`, acao: `Auditar: ${outliers.slice(0, 3).map((o) => o.data.slice(5)).join(", ")}.` });
  }
  // 7 — concentração de horas > 60% numa etapa
  if (ult) {
    const tot = ult.horas_moagem_total + ult.horas_modelagem_total + ult.horas_embalamento_total;
    if (tot > 0) {
      const etapas: [string, number][] = [["moagem", ult.horas_moagem_total], ["modelagem", ult.horas_modelagem_total], ["embalamento", ult.horas_embalamento_total]];
      const [nome, val] = etapas.sort((a, b) => b[1] - a[1])[0];
      const conc = (val / tot) * 100;
      if (conc > 60) out.push({ tipo: "atencao", titulo: "Concentração de horas numa etapa", detalhe: `${nome}: ${conc.toFixed(0)}% das horas`, acao: "Avaliar balanceamento/gargalo da linha." });
    }
  }
  return out;
}

export function AbaGerencial({ meses, registros, thresholds, insumosMensal = [] }: { meses: MesGer[]; registros: Registro[]; thresholds: Thresholds; insumosMensal?: InsumoMes[] }) {
  const apont = detectar(meses, registros, thresholds);
  const horasData = meses.length ? (() => { const u = meses[meses.length - 1]; return [
    { etapa: "Moagem", horas: u.horas_moagem_total }, { etapa: "Modelagem", horas: u.horas_modelagem_total }, { etapa: "Embalamento", horas: u.horas_embalamento_total },
  ]; })() : [];
  const CORES = [C.azul, C.verde, C.amarelo];

  const tip = { contentStyle: { background: C.card2, border: `1px solid ${C.borda}`, borderRadius: 6, fontFamily: theme.font.num, fontSize: 11 }, labelStyle: { color: C.branco } };
  const axis = { tick: { fill: C.mut, fontSize: 10, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }, stroke: C.borda };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
        <div style={{ ...sCard, padding: "12px 8px 4px" }}>
          <p style={{ ...lblChart }}>Custo médio/kg por mês</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={meses}>
              <CartesianGrid stroke={C.borda} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="ano_mes" {...axis} /><YAxis {...axis} domain={["auto", "auto"]} />
              <Tooltip {...tip} formatter={(value) => [brl(Number(value)), "custo/kg"]} />
              <ReferenceLine y={thresholds.IDEAL} stroke={C.verde2} strokeDasharray="4 2" />
              <ReferenceLine y={thresholds.ALERTA} stroke={C.vermelho} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="custo_medio_kg" stroke={C.verde} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ ...sCard, padding: "12px 8px 4px" }}>
          <p style={{ ...lblChart }}>kg produzido por mês</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={meses}>
              <CartesianGrid stroke={C.borda} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="ano_mes" {...axis} /><YAxis {...axis} />
              <Tooltip {...tip} formatter={(value) => [Number(value).toLocaleString("pt-BR"), "kg"]} />
              <Bar dataKey="kg_total" fill={C.azul} radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ ...sCard, padding: "12px 8px 4px" }}>
          <p style={{ ...lblChart }}>Horas por etapa (último mês)</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={horasData}>
              <CartesianGrid stroke={C.borda} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="etapa" {...axis} /><YAxis {...axis} />
              <Tooltip {...tip} formatter={(value) => [`${Number(value).toFixed(1)} h`, "horas"]} />
              <Bar dataKey="horas" radius={[3, 3, 0, 0]}>{horasData.map((_, i) => <Cell key={i} fill={CORES[i]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {insumosMensal.length > 0 && (
        <div style={{ ...sCard, padding: "12px 8px 4px" }}>
          <p style={{ ...lblChart }}>Consumo de insumos por mês (kg) — Recorte 80/20 vs Gordura</p>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={insumosMensal}>
              <CartesianGrid stroke={C.borda} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="ano_mes" {...axis} /><YAxis {...axis} />
              <Tooltip {...tip} formatter={(value, name) => [`${Number(value).toLocaleString("pt-BR")} kg`, name]} />
              <Bar dataKey="recorte" name="Recorte 80/20" fill={C.azul} radius={[3, 3, 0, 0]} />
              <Bar dataKey="gordura" name="Gordura" fill={C.laranja} radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ ...sCard, padding: 16 }}>
        <SectionHead Icon={ClipboardCheck} color={C.amarelo} title="Apontamentos fora do padrão" desc="Melhoria contínua — desvios detectados nos dados" />
        {apont.length === 0 ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", color: C.verde2, fontFamily: theme.font.label, fontSize: 12 }}>
            <CheckCircle2 size={18} /> Nenhum desvio detectado nos dados atuais.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {apont.map((a, i) => {
              const cor = TIPO_COR[a.tipo];
              const Icon = a.tipo === "positivo" ? TrendingDown : a.tipo === "critico" ? AlertTriangle : TrendingUp;
              return (
                <div key={i} style={{ borderLeft: `3px solid ${cor}`, background: `${cor}11`, borderRadius: 4, padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                    <Icon size={14} color={cor} />
                    <span style={{ color: cor, fontSize: 9, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>{a.tipo}</span>
                    <span style={{ color: C.branco, fontSize: 12, fontWeight: 700, fontFamily: theme.font.label }}>{a.titulo}</span>
                  </div>
                  <p style={{ color: C.texto, fontSize: 11, fontFamily: theme.font.label }}>{a.detalhe}</p>
                  <p style={{ color: C.mut, fontSize: 10, fontFamily: theme.font.label, marginTop: 2 }}>→ {a.acao}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const lblChart: React.CSSProperties = { color: C.mut2, fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", padding: "0 6px 8px" };
