"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export type CacMensalRow = {
  mes: string; canal: string;
  leads: number; convertidos: number; receita_brl: number;
  gasto_total: number; cac_por_lead: number | null; roas: number | null;
};
export type FunilRow = {
  canal: string; leads_total: number; qualificados: number; handoffs: number; convertidos: number;
};
export type RankRow = {
  ad_name: string | null; campaign_name: string | null;
  cpl: number | null; leads: number; spend: number;
};

const mono = "'Courier New', monospace";
const RED = "#C8102E";
const BLUE = "#2A3F8F";
const GREEN = "#22c55e";
const YELLOW = "#e8b923";
const MUT = "#556677";
const GRID = "rgba(27,42,107,.35)";

const CANAL_COR: Record<string, string> = {
  "instagram (ctwa)": RED,
  "site (lp)": BLUE,
  "organico": GREEN,
};

function fmtBRL(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtBRLc(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmtMes(iso: string) {
  const m = Number(iso.slice(5, 7)) - 1;
  return MESES[m] ?? iso.slice(0, 7);
}

const tooltipStyle = {
  contentStyle: { background: "#1a1a1a", border: `1px solid ${RED}`, borderRadius: 3, fontSize: 11, fontFamily: mono, color: "#c8d8e8" },
  itemStyle: { color: "#c8d8e8" },
  labelStyle: { color: MUT, fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase" as const },
};
const axisStyle = { fontSize: 10, fontFamily: mono, fill: MUT };

const PERIODOS = [
  { k: "30d", label: "30d", meses: 1 },
  { k: "90d", label: "90d", meses: 3 },
  { k: "6m", label: "6m", meses: 6 },
] as const;
type PeriodoK = typeof PERIODOS[number]["k"];

export function OverviewClient({ cac, funil, rank }: { cac: CacMensalRow[]; funil: FunilRow[]; rank: RankRow[] }) {
  const [periodo, setPeriodo] = useState<PeriodoK>("90d");

  // meses distintos ordenados (asc) presentes na cacMensal
  const mesesOrdenados = useMemo(
    () => Array.from(new Set(cac.map(r => r.mes))).sort(),
    [cac],
  );

  // KPIs: últimos N meses (30d≈1 · 90d≈3 · 6m≈6) sobre v_cac_mensal_canal
  const kpis = useMemo(() => {
    const nMeses = PERIODOS.find(p => p.k === periodo)!.meses;
    const janela = new Set(mesesOrdenados.slice(-nMeses));
    const sel = cac.filter(r => janela.has(r.mes));
    const gasto = sel.reduce((a, r) => a + Number(r.gasto_total ?? 0), 0);
    const leads = sel.reduce((a, r) => a + Number(r.leads ?? 0), 0);
    const receita = sel.reduce((a, r) => a + Number(r.receita_brl ?? 0), 0);
    return {
      gasto, leads, receita,
      cac: leads > 0 ? gasto / leads : null,
      roas: gasto > 0 ? receita / gasto : null,
    };
  }, [cac, mesesOrdenados, periodo]);

  // Gráfico 1: gasto (barras empilhadas por canal) × CAC blendado (linha) por mês — eixo duplo
  const canaisBars = useMemo(() => Array.from(new Set(cac.map(r => r.canal))), [cac]);
  const gastoCacData = useMemo(() => {
    return mesesOrdenados.map(mes => {
      const ponto: Record<string, number | string | null> = { mes: fmtMes(mes) };
      let gastoMes = 0, leadsMes = 0;
      for (const c of canaisBars) {
        const row = cac.find(r => r.mes === mes && r.canal === c);
        const g = Number(row?.gasto_total ?? 0);
        ponto[c] = g;
        gastoMes += g;
        leadsMes += Number(row?.leads ?? 0);
      }
      ponto.cac = leadsMes > 0 ? Math.round((gastoMes / leadsMes) * 100) / 100 : null;
      return ponto;
    });
  }, [cac, mesesOrdenados, canaisBars]);

  // Gráfico 2: funil por canal (barras agrupadas por estágio)
  const funilData = useMemo(
    () => funil.map(f => ({
      canal: f.canal,
      Leads: Number(f.leads_total), Qualificados: Number(f.qualificados),
      Handoffs: Number(f.handoffs), Convertidos: Number(f.convertidos),
    })),
    [funil],
  );

  // Gráfico 3: top 5 criativos por CPL (menor primeiro)
  const top5 = useMemo(
    () => rank.filter(r => r.cpl != null)
      .sort((a, b) => Number(a.cpl) - Number(b.cpl))
      .slice(0, 5)
      .map(r => ({ nome: r.ad_name ?? "—", cpl: Number(r.cpl), leads: Number(r.leads) })),
    [rank],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Seletor de período */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ color: MUT, fontSize: 9, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" }}>Período (KPIs):</span>
        {PERIODOS.map(p => {
          const active = periodo === p.k;
          return (
            <button key={p.k} onClick={() => setPeriodo(p.k)} style={{
              padding: "5px 12px", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
              fontFamily: mono, fontWeight: 700, cursor: "pointer", borderRadius: 3,
              background: active ? RED : "transparent", color: active ? "#fff" : "#c0c8d8",
              border: `1px solid ${active ? RED : "#2a2a2a"}`, transition: "all .15s",
            }}>{p.label}</button>
          );
        })}
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <Kpi label="Total Investido" value={fmtBRLc(kpis.gasto)} cor={YELLOW} />
        <Kpi label="CAC Médio" value={kpis.cac != null ? fmtBRLc(kpis.cac) : "—"} cor="#FFFFFF" />
        <Kpi label="ROAS Médio" value={kpis.roas != null ? `${kpis.roas.toFixed(2)}×` : "—"} cor={kpis.roas != null && kpis.roas >= 1 ? GREEN : "#FFFFFF"} />
        <Kpi label="Leads" value={String(kpis.leads)} cor={BLUE === "#2A3F8F" ? "#8bb4ff" : BLUE} />
      </div>

      {/* Gráfico 1: gasto (barras) × CAC blendado (linha) por mês — eixo duplo */}
      <Card titulo="Gasto × CAC por mês">
        {gastoCacData.length === 0 ? (
          <Vazio texto="Sem gasto mensal ainda." />
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={gastoCacData} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="mes" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis yAxisId="left" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <YAxis yAxisId="right" orientation="right" tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [v == null ? "—" : fmtBRLc(Number(v)), n === "cac" ? "CAC blendado" : String(n)]} />
              <Legend wrapperStyle={{ fontSize: 9, fontFamily: mono }} />
              {canaisBars.map(c => (
                <Bar key={c} yAxisId="left" dataKey={c} stackId="gasto" fill={CANAL_COR[c] ?? MUT} radius={[2, 2, 0, 0]} />
              ))}
              <Line yAxisId="right" type="monotone" dataKey="cac" name="CAC blendado" stroke="#FFFFFF" strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
        {/* Gráfico 2: funil por canal */}
        <Card titulo="Funil por canal">
          {funilData.length === 0 ? (
            <Vazio texto="Sem funil atribuído ainda." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={funilData} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="canal" tick={{ ...axisStyle, fontSize: 8 }} axisLine={{ stroke: GRID }} tickLine={false} />
                <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 9, fontFamily: mono }} />
                <Bar dataKey="Leads" fill={BLUE} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Qualificados" fill="#1B6BC8" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Handoffs" fill={YELLOW} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Convertidos" fill={GREEN} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Gráfico 3: top 5 criativos por CPL */}
        <Card titulo="Top 5 criativos por CPL (30d)">
          {top5.length === 0 ? (
            <Vazio texto="Sem CPL atribuível ainda (leads por anúncio só desde 02/06)." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top5} layout="vertical" margin={{ top: 6, right: 24, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                <XAxis type="number" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                <YAxis type="category" dataKey="nome" width={70} tick={{ ...axisStyle, fontSize: 9 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [fmtBRLc(Number(v)), "CPL"]} />
                <Bar dataKey="cpl" fill={RED} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <p style={{ color: MUT, fontSize: 9, fontFamily: mono }}>
        Fontes: v_cac_mensal_canal (KPIs + gasto×CAC mês a mês), v_funil_por_canal (funil), v_ranking_criativo (top CPL 30d). Barras = gasto por canal (eixo esq.) · linha = CAC blendado (eixo dir.). Período dos KPIs ≈ últimos 1/3/6 meses. Leads atribuídos desde 02/06.
      </p>
    </div>
  );
}

function Kpi({ label, value, cor }: { label: string; value: string; cor: string }) {
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: "14px 16px" }}>
      <p style={{ color: MUT, fontSize: 9, fontFamily: mono, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 6 }}>{label}</p>
      <p style={{ color: cor, fontSize: 20, fontWeight: 700, fontFamily: mono }}>{value}</p>
    </div>
  );
}
function Card({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
      <p style={{ color: "#FFFFFF", fontSize: 11, fontWeight: 700, fontFamily: mono, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>{titulo}</p>
      {children}
    </div>
  );
}
function Vazio({ texto }: { texto: string }) {
  return <p style={{ color: MUT, fontSize: 11, fontFamily: mono, textAlign: "center", padding: 30 }}>{texto}</p>;
}
