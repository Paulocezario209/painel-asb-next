"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { FunnelVisual, type FunnelStage } from "@/components/dashboard/funnel-visual";
import { theme } from "@/lib/theme";
import { Filter as FilterIcon, BarChart3, TrendingUp } from "lucide-react";
import { SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { GREEN, YELLOW, MUT, GRID, fmtBRLc, fmtMes, tooltipStyle, axisStyle, th, td } from "@/lib/marketing/ui";

export type FunilRow = {
  canal: string;
  leads_total: number; qualificados_real: number; handoffs: number; convertidos: number;
  pct_qualificacao_real: number | null; pct_handoff: number | null; pct_conversao: number | null;
};
export type ConvMensalRow = { mes: string; leads: number; convertidos: number };
export type CacCanalRow = { canal: string; gasto_total: number; cac_por_lead: number | null; custo_por_conversao: number | null };

// FIX2: cores semânticas do funil (topo→fundo)
const FUNNEL_FILL = ["#185FA5", "#534AB7", "#1f7a6a", "#0F6E56"];

export function FunilCacClient({ funil, mensal, cac }: { funil: FunilRow[]; mensal: ConvMensalRow[]; cac: CacCanalRow[] }) {
  const cacPorCanal = useMemo(() => new Map(cac.map(c => [c.canal, c])), [cac]);
  // Funil agregado (soma dos canais)
  const agg = useMemo(() => funil.reduce(
    (a, f) => ({
      leads: a.leads + Number(f.leads_total),
      qualificados: a.qualificados + Number(f.qualificados_real),  // gate real qual_stage>=7 (não a tautológica)
      handoffs: a.handoffs + Number(f.handoffs),
      convertidos: a.convertidos + Number(f.convertidos),
    }),
    { leads: 0, qualificados: 0, handoffs: 0, convertidos: 0 },
  ), [funil]);
  // FIX2: estágios do funil p/ Recharts FunnelChart (afunila por funnelWidth; pct vs etapa anterior)
  const funnelStages: FunnelStage[] = useMemo(() => {
    const base = [
      { label: "Leads", count: agg.leads },
      { label: "Qualificados", count: agg.qualificados },
      { label: "Handoffs", count: agg.handoffs },
      { label: "Convertidos", count: agg.convertidos },
    ];
    const N = base.length;
    return base.map((s, i) => {
      const prev = i > 0 ? base[i - 1].count : 0;
      const pct = i > 0 && prev > 0 ? Math.round((s.count / prev) * 100) : null;
      return { ...s, pct, fill: FUNNEL_FILL[i] ?? MUT, funnelWidth: N - i };
    });
  }, [agg]);

  // Conversão mensal blendada (Σconv / Σleads por mês)
  const convMensal = useMemo(() => {
    const byMes = new Map<string, { leads: number; conv: number }>();
    for (const r of mensal) {
      const cur = byMes.get(r.mes) ?? { leads: 0, conv: 0 };
      cur.leads += Number(r.leads ?? 0);
      cur.conv += Number(r.convertidos ?? 0);
      byMes.set(r.mes, cur);
    }
    return Array.from(byMes.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, v]) => ({ mes: fmtMes(mes), pct: v.leads > 0 ? Math.round((v.conv / v.leads) * 1000) / 10 : null }));
  }, [mensal]);
  const temConv = convMensal.some(d => d.pct != null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* KPIs do funil agregado — stat compactos canônicos (linguagem do Dashboard) */}
      <div className="asb-grid-kpi">
        <StatTile label="Leads" value={agg.leads} accent="#8bb4ff" num="#8bb4ff" sub="Total atribuído" />
        <StatTile label="Qualificados" value={agg.qualificados} accent={theme.colors.chartNavyLight} num={theme.colors.chartNavyLight} sub="qual_stage ≥ 7" />
        <StatTile label="Handoffs" value={agg.handoffs} accent={YELLOW} num={YELLOW} sub="Entregues ao vendedor" />
        <StatTile label="Convertidos" value={agg.convertidos} accent={GREEN} num={GREEN} sub="Primeiro pedido" />
      </div>

      {/* FIX2: Funil visual (Recharts FunnelChart) — afunila topo→fundo, count nos labels */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={FilterIcon} color="#8bb4ff" title="Funil de conversão" desc="Todos os canais" />
        {agg.leads === 0 ? (
          <p style={{ color: MUT, fontSize: 11, fontFamily: theme.font.label, textAlign: "center", padding: 24 }}>
            Sem leads atribuídos ainda (captura desde 02/06).
          </p>
        ) : (
          <div style={{ height: 320 }}>
            <FunnelVisual data={funnelStages} />
          </div>
        )}
        <p style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label, marginTop: 8 }}>
          Impressões/Cliques não estão em <code>v_funil_por_canal</code> (vêm das views de ads Meta) — o funil inicia em Leads.
        </p>
      </div>

      {/* Breakdown por canal */}
      <div style={{ ...S.card, padding: "20px 24px", overflowX: "auto" }}>
        <SectionHead Icon={BarChart3} color="#534AB7" title="Por canal" desc="Leads, qualificação, handoff, conversão e CAC" />
        {funil.length === 0 ? (
          <p style={{ color: MUT, fontSize: 11, fontFamily: theme.font.label, textAlign: "center", padding: 16 }}>Sem dados.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: theme.font.num }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--asb-border)" }}>
                <th style={{ ...th, textAlign: "left" }}>Canal</th>
                <th style={th}>Leads</th>
                <th style={th}>Qualif.</th>
                <th style={th}>Handoff</th>
                <th style={th}>Convert.</th>
                <th style={th}>% Qualif.</th>
                <th style={th}>% Handoff</th>
                <th style={th}>% Conv.</th>
                <th style={th}>Gasto</th>
                <th style={th}>CAC/lead</th>
                <th style={th}>Custo/conv.</th>
              </tr>
            </thead>
            <tbody>
              {[...funil].sort((a, b) => Number(b.leads_total) - Number(a.leads_total)).map(f => {
                const c = cacPorCanal.get(f.canal);
                return (
                <tr key={f.canal} style={{ borderTop: "1px solid var(--asb-border)" }}>
                  <td style={{ ...td, color: "#FFFFFF", fontFamily: theme.font.label, textTransform: "uppercase" }}>{f.canal}</td>
                  <td style={{ ...td, textAlign: "center" }}>{f.leads_total}</td>
                  <td style={{ ...td, textAlign: "center", color: theme.colors.chartNavyLight }}>{f.qualificados_real}</td>
                  <td style={{ ...td, textAlign: "center", color: YELLOW }}>{f.handoffs}</td>
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

      {/* Linha: conversão mensal */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={TrendingUp} color={GREEN} title="Taxa de conversão" desc="Evolução mensal" />
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
        Fonte: v_funil_por_canal (qualificado = qual_stage ≥ 7 / lead realmente qualificado · handoff=seller_first_reply_at · convertido=first_order_at) + v_cac_por_canal (Gasto/CAC/Custo por conversão) + v_cac_mensal_canal (conversão mensal). % do funil = razão sobre Leads. Leads atribuídos desde 02/06.
      </p>
    </div>
  );
}

function pctFmt(p: number | null) {
  if (p == null) return "—";
  return `${(Number(p) * 100).toFixed(1)}%`;
}
