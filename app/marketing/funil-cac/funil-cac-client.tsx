"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { FunnelVisual, type FunnelStage } from "@/components/dashboard/funnel-visual";
import { theme } from "@/lib/theme";
import { Filter as FilterIcon, BarChart3, TrendingUp } from "lucide-react";
import { SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { RED, GREEN, YELLOW, MUT, GRID, fmtBRLc, fmtMes, tooltipStyle, axisStyle, th, td } from "@/lib/marketing/ui";

// coorte por mês de atribuição (bridge usa created_at) — soma no cliente conforme a janela
export type FunilMensalRow = {
  canal: string; mes: string;
  leads_total: number; qualificados_real: number; agendamentos: number; convertidos: number;
};
export type CacMensalRow = {
  canal: string; mes: string; leads: number; convertidos: number; gasto_total: number;
};

// FIX2: cores semânticas do funil (topo→fundo)
const FUNNEL_FILL = ["#185FA5", "#534AB7", "#1f7a6a", "#0F6E56"];

// mesmo seletor da Visão Geral (janela = últimos N meses de calendário) + Acumulado
const PERIODOS = [
  { k: "1m", label: "1 mês", meses: 1 },
  { k: "2m", label: "2 meses", meses: 2 },
  { k: "3m", label: "3 meses", meses: 3 },
  { k: "6m", label: "6 meses", meses: 6 },
  { k: "12m", label: "12 meses", meses: 12 },
  { k: "all", label: "Acumulado", meses: null },
] as const;
type PeriodoK = typeof PERIODOS[number]["k"];

export function FunilCacClient({ funilMensal, cacMensal }: { funilMensal: FunilMensalRow[]; cacMensal: CacMensalRow[] }) {
  // default = Acumulado → mesmo número de sempre (zero regressão); mês reconcilia com Visão Geral/Comercial
  const [periodo, setPeriodo] = useState<PeriodoK>("all");

  const mesesOrdenados = useMemo(
    () => Array.from(new Set(funilMensal.map(r => r.mes))).sort(),
    [funilMensal],
  );
  const janela = useMemo(() => {
    const nMeses = PERIODOS.find(p => p.k === periodo)!.meses;
    return new Set(nMeses == null ? mesesOrdenados : mesesOrdenados.slice(-nMeses));
  }, [mesesOrdenados, periodo]);

  // Funil por canal na JANELA (soma as coortes dos meses selecionados); pct recomputado sobre a soma
  const funil = useMemo(() => {
    const m = new Map<string, { leads: number; qualif: number; agend: number; conv: number }>();
    for (const r of funilMensal) {
      if (!janela.has(r.mes)) continue;
      const cur = m.get(r.canal) ?? { leads: 0, qualif: 0, agend: 0, conv: 0 };
      cur.leads += Number(r.leads_total ?? 0);
      cur.qualif += Number(r.qualificados_real ?? 0);
      cur.agend += Number(r.agendamentos ?? 0);
      cur.conv += Number(r.convertidos ?? 0);
      m.set(r.canal, cur);
    }
    return Array.from(m.entries()).map(([canal, v]) => ({
      canal,
      leads_total: v.leads, qualificados_real: v.qualif, agendamentos: v.agend, convertidos: v.conv,
      pct_qualificacao_real: v.leads > 0 ? v.qualif / v.leads : null,
      pct_handoff: v.leads > 0 ? v.agend / v.leads : null,
      pct_conversao: v.leads > 0 ? v.conv / v.leads : null,
    })).sort((a, b) => b.leads_total - a.leads_total);
  }, [funilMensal, janela]);

  // Gasto/CAC por canal na MESMA janela (de v_cac_mensal_canal) — nunca misturar gasto acumulado com funil do mês
  const cacPorCanal = useMemo(() => {
    const m = new Map<string, { gasto: number; leads: number; conv: number }>();
    for (const r of cacMensal) {
      if (!janela.has(r.mes)) continue;
      const cur = m.get(r.canal) ?? { gasto: 0, leads: 0, conv: 0 };
      cur.gasto += Number(r.gasto_total ?? 0);
      cur.leads += Number(r.leads ?? 0);
      cur.conv += Number(r.convertidos ?? 0);
      m.set(r.canal, cur);
    }
    const out = new Map<string, { gasto_total: number; cac_por_lead: number | null; custo_por_conversao: number | null }>();
    for (const [canal, v] of m) {
      out.set(canal, {
        gasto_total: v.gasto,
        cac_por_lead: v.leads > 0 && v.gasto > 0 ? v.gasto / v.leads : null,
        custo_por_conversao: v.conv > 0 && v.gasto > 0 ? v.gasto / v.conv : null,
      });
    }
    return out;
  }, [cacMensal, janela]);

  // Funil agregado (soma dos canais) na janela
  const agg = useMemo(() => funil.reduce(
    (a, f) => ({
      leads: a.leads + f.leads_total,
      qualificados: a.qualificados + f.qualificados_real,  // gate real qual_stage>=7
      agendamentos: a.agendamentos + f.agendamentos,
      convertidos: a.convertidos + f.convertidos,
    }),
    { leads: 0, qualificados: 0, agendamentos: 0, convertidos: 0 },
  ), [funil]);

  // FIX2: estágios do funil p/ FunnelVisual (afunila; pct vs etapa anterior)
  const funnelStages: FunnelStage[] = useMemo(() => {
    const base = [
      { label: "Leads", count: agg.leads },
      { label: "Qualificados", count: agg.qualificados },
      { label: "Agendamentos", count: agg.agendamentos },
      { label: "Convertidos", count: agg.convertidos },
    ];
    const N = base.length;
    return base.map((s, i) => {
      const prev = i > 0 ? base[i - 1].count : 0;
      const pct = i > 0 && prev > 0 ? Math.round((s.count / prev) * 100) : null;
      return { ...s, pct, fill: FUNNEL_FILL[i] ?? MUT, funnelWidth: N - i };
    });
  }, [agg]);

  // Conversão mensal blendada (Σconv / Σleads por mês) — timeline COMPLETA (não afetada pelo seletor)
  const convMensal = useMemo(() => {
    const byMes = new Map<string, { leads: number; conv: number }>();
    for (const r of cacMensal) {
      const cur = byMes.get(r.mes) ?? { leads: 0, conv: 0 };
      cur.leads += Number(r.leads ?? 0);
      cur.conv += Number(r.convertidos ?? 0);
      byMes.set(r.mes, cur);
    }
    return Array.from(byMes.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes: fmtMes(mes), pct: v.leads > 0 ? Math.round((v.conv / v.leads) * 1000) / 10 : null }));
  }, [cacMensal]);
  const temConv = convMensal.some(d => d.pct != null);

  const periodoLabel = PERIODOS.find(p => p.k === periodo)!.label;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Seletor de período — mesma régua da Visão Geral; "Acumulado" = coorte total desde 02/06 */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ ...S.label, marginBottom: 0 }}>Período (coorte por mês):</span>
        {PERIODOS.map(p => {
          const active = periodo === p.k;
          return (
            <button key={p.k} onClick={() => setPeriodo(p.k)} style={{
              padding: "5px 12px", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
              fontFamily: theme.font.label, fontWeight: 700, cursor: "pointer", borderRadius: 3,
              background: active ? RED : "transparent", color: active ? "#fff" : "#c0c8d8",
              border: `1px solid ${active ? RED : "var(--asb-border)"}`, transition: "all .15s",
            }}>{p.label}</button>
          );
        })}
      </div>

      {/* KPIs do funil agregado — stat compactos canônicos */}
      <div className="asb-grid-kpi">
        <StatTile label="Leads" value={agg.leads} accent="#8bb4ff" num="#8bb4ff" sub={`Atribuído · ${periodoLabel}`} />
        <StatTile label="Qualificados" value={agg.qualificados} accent={theme.colors.chartNavyLight} num={theme.colors.chartNavyLight} sub="qual_stage ≥ 7" />
        <StatTile label="Agendamentos" value={agg.agendamentos} accent={YELLOW} num={YELLOW} sub="Entregues ao vendedor" />
        <StatTile label="Convertidos" value={agg.convertidos} accent={GREEN} num={GREEN} sub="Primeiro pedido" />
      </div>

      {/* Funil visual */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={FilterIcon} color="#8bb4ff" title="Funil de conversão" desc={`Todos os canais · ${periodoLabel}`} />
        {agg.leads === 0 ? (
          <p style={{ color: MUT, fontSize: 11, fontFamily: theme.font.label, textAlign: "center", padding: 24 }}>
            Sem leads atribuídos na janela selecionada.
          </p>
        ) : (
          <div style={{ height: 320 }}>
            <FunnelVisual data={funnelStages} />
          </div>
        )}
        <p style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label, marginTop: 8 }}>
          Impressões/Cliques não estão em <code>v_funil_por_canal_mensal</code> (vêm das views de ads Meta) — o funil inicia em Leads.
        </p>
      </div>

      {/* Breakdown por canal */}
      <div style={{ ...S.card, padding: "20px 24px", overflowX: "auto" }}>
        <SectionHead Icon={BarChart3} color="#534AB7" title="Por canal" desc={`Leads, qualificação, agendamento, conversão e CAC · ${periodoLabel}`} />
        {funil.length === 0 ? (
          <p style={{ color: MUT, fontSize: 11, fontFamily: theme.font.label, textAlign: "center", padding: 16 }}>Sem dados na janela.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: theme.font.num }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--asb-border)" }}>
                <th style={{ ...th, textAlign: "left" }}>Canal</th>
                <th style={th}>Leads</th>
                <th style={th}>Qualif.</th>
                <th style={th}>Agendamento</th>
                <th style={th}>Convert.</th>
                <th style={th}>% Qualif.</th>
                <th style={th}>% Agendamento</th>
                <th style={th}>% Conv.</th>
                <th style={th}>Gasto</th>
                <th style={th}>CAC/lead</th>
                <th style={th}>Custo/conv.</th>
              </tr>
            </thead>
            <tbody>
              {funil.map(f => {
                const c = cacPorCanal.get(f.canal);
                return (
                <tr key={f.canal} style={{ borderTop: "1px solid var(--asb-border)" }}>
                  <td style={{ ...td, color: "#FFFFFF", fontFamily: theme.font.label, textTransform: "uppercase" }}>{f.canal}</td>
                  <td style={{ ...td, textAlign: "center" }}>{f.leads_total}</td>
                  <td style={{ ...td, textAlign: "center", color: theme.colors.chartNavyLight }}>{f.qualificados_real}</td>
                  <td style={{ ...td, textAlign: "center", color: YELLOW }}>{f.agendamentos}</td>
                  <td style={{ ...td, textAlign: "center", color: GREEN }}>{f.convertidos}</td>
                  <td style={{ ...td, textAlign: "center", color: "#c0d0e0" }}>{pctFmt(f.pct_qualificacao_real)}</td>
                  <td style={{ ...td, textAlign: "center", color: "#c0d0e0" }}>{pctFmt(f.pct_handoff)}</td>
                  <td style={{ ...td, textAlign: "center", color: "#c0d0e0" }}>{pctFmt(f.pct_conversao)}</td>
                  <td style={{ ...td, textAlign: "center", color: YELLOW }}>{c ? fmtBRLc(Number(c.gasto_total ?? 0)) : "—"}</td>
                  <td style={{ ...td, textAlign: "center", color: "#FFFFFF", fontWeight: 700 }}>{c?.cac_por_lead != null ? fmtBRLc(Number(c.cac_por_lead)) : "—"}</td>
                  <td style={{ ...td, textAlign: "center", color: "#c0d0e0" }}>{c?.custo_por_conversao != null ? fmtBRLc(Number(c.custo_por_conversao)) : "—"}</td>
                </tr>
              );})}
            </tbody>
          </table>
        )}
      </div>

      {/* Linha: conversão mensal (timeline completa) */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={TrendingUp} color={GREEN} title="Taxa de conversão" desc="Evolução mensal (linha do tempo completa)" />
        {!temConv ? (
          <p style={{ color: MUT, fontSize: 11, fontFamily: theme.font.label, textAlign: "center", padding: 30 }}>
            Sem conversão mensal ainda (leads atribuídos só desde 02/06).
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={convMensal} margin={{ top: 6, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="mes" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} unit="%" />
              <Tooltip {...tooltipStyle} formatter={(v) => [v == null ? "—" : `${v}%`, "Conversão"]} />
              <Line type="monotone" dataKey="pct" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <p style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label }}>
        Fonte: v_funil_por_canal_mensal (coorte por mês de atribuição; qualificado = qual_stage ≥ 7 · agendamento = seller_first_reply_at · convertido = first_order_at) + v_cac_mensal_canal (Gasto/CAC/conversão, mesma janela). % do funil = razão sobre Leads. Inclui fora-de-rota (você pagou por eles) — o funil do Comercial é só EM ROTA, por isso o período de 1 mês aqui ≈ Comercial nos convertidos, com leads a mais. Leads atribuídos desde 02/06.
      </p>
    </div>
  );
}

function pctFmt(p: number | null) {
  if (p == null) return "—";
  return `${(Number(p) * 100).toFixed(1)}%`;
}
