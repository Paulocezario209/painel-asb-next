"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { theme } from "@/lib/theme";

export type CanalConsolidado = {
  canal: string;
  leads: number;
  convertidos: number;
  receita_brl: number;
  gasto_total: number;
  cac_por_lead: number | null;
  custo_por_conversao: number | null;
  roas: number | null;
};
export type CacMensalRow = {
  mes: string; canal: string;
  leads: number; gasto_total: number; cac_por_lead: number | null; roas: number | null;
};

const RED = theme.colors.critical;       // #C8102E
const BLUE = theme.colors.chartNavy;     // #2A3F8F
const GREEN = theme.colors.success;      // #22c55e
const YELLOW = theme.colors.chartYellow; // #e8b923
const MUT = theme.colors.neutral;        // #e4e9f0
const GRID = theme.colors.gridLine;

const CANAL_COR: Record<string, string> = {
  "instagram (ctwa)": RED,
  "site (lp)": BLUE,
  "organico": GREEN,
};

function fmtBRLc(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function fmtMes(iso: string) {
  const m = Number(iso.slice(5, 7)) - 1;
  return MESES[m] ?? iso.slice(0, 7);
}

const tooltipStyle = {
  contentStyle: { background: "#1a1a1a", border: `1px solid ${RED}`, borderRadius: 3, fontSize: 11, fontFamily: theme.font.num, color: "#c8d8e8" },
  itemStyle: { color: "#c8d8e8" },
  labelStyle: { color: MUT, fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase" as const },
};
const axisStyle = { fontSize: 10, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const, fill: MUT };

export function OrigemClient({ canais, mensal }: { canais: CanalConsolidado[]; mensal: CacMensalRow[] }) {
  // ordem fixa dos canais para os cards
  const ordem = ["instagram (ctwa)", "site (lp)", "organico"];
  const cards = useMemo(
    () => [...canais].sort((a, b) => ordem.indexOf(a.canal) - ordem.indexOf(b.canal)),
    [canais],
  );

  const mesesOrdenados = useMemo(() => Array.from(new Set(mensal.map(r => r.mes))).sort(), [mensal]);
  const lineData = useMemo(() => {
    const cs = Array.from(new Set(mensal.map(r => r.canal)));
    return mesesOrdenados.map(mes => {
      const ponto: Record<string, number | string | null> = { mes: fmtMes(mes) };
      for (const c of cs) {
        const row = mensal.find(r => r.mes === mes && r.canal === c);
        ponto[c] = row?.cac_por_lead != null ? Number(row.cac_por_lead) : null;
      }
      return ponto;
    });
  }, [mensal, mesesOrdenados]);
  const canaisComCac = useMemo(
    () => Array.from(new Set(mensal.filter(r => r.cac_por_lead != null).map(r => r.canal))),
    [mensal],
  );
  // nº de meses com ≥1 CAC válido — precisa de ≥2 pra traçar uma linha (senão são pontos soltos)
  const mesesComCac = useMemo(
    () => lineData.filter(row => canaisComCac.some(c => row[c] != null)).length,
    [lineData, canaisComCac],
  );
  // Gasto mensal por canal (barras empilhadas) — visível mesmo sem CAC (jan→mai)
  const canaisAll = useMemo(() => Array.from(new Set(mensal.map(r => r.canal))), [mensal]);
  const gastoData = useMemo(() => mesesOrdenados.map(mes => {
    const ponto: Record<string, number | string> = { mes: fmtMes(mes) };
    for (const c of canaisAll) {
      const row = mensal.find(r => r.mes === mes && r.canal === c);
      ponto[c] = Number(row?.gasto_total ?? 0);
    }
    return ponto;
  }), [mensal, mesesOrdenados, canaisAll]);
  const temGasto = useMemo(() => gastoData.some(d => canaisAll.some(c => Number(d[c] ?? 0) > 0)), [gastoData, canaisAll]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Cards por canal */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {cards.length === 0 ? (
          <p style={{ color: MUT, fontSize: 11, fontFamily: theme.font.label, padding: 20 }}>Sem canais ainda.</p>
        ) : cards.map(c => {
          const cor = CANAL_COR[c.canal] ?? MUT;
          return (
            <div key={c.canal} style={{ background: "#1a1a1a", border: `1px solid #2a2a2a`, borderLeft: `3px solid ${cor}`, borderRadius: 8, padding: 16 }}>
              <p style={{ color: cor, fontSize: 12, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 12 }}>{c.canal}</p>
              <Linha label="Gasto" valor={fmtBRLc(Number(c.gasto_total ?? 0))} cor={YELLOW} />
              <Linha label="Leads" valor={String(c.leads ?? 0)} cor="#c8d8e8" />
              <Linha label="CAC / lead" valor={c.cac_por_lead != null ? fmtBRLc(Number(c.cac_por_lead)) : "—"} cor="#FFFFFF" forte />
              <Linha label="ROAS" valor={c.roas != null ? `${Number(c.roas).toFixed(2)}×` : "—"} cor={c.roas != null && Number(c.roas) >= 1 ? GREEN : "#c8d8e8"} />
            </div>
          );
        })}
      </div>

      {/* Barras: gasto mensal por canal (visível mesmo sem CAC) */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
        <p style={{ color: "#FFFFFF", fontSize: 11, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>
          Gasto mensal por canal
        </p>
        {!temGasto ? (
          <p style={{ color: MUT, fontSize: 11, fontFamily: theme.font.label, textAlign: "center", padding: 30 }}>Sem gasto registrado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={gastoData} margin={{ top: 6, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="mes" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [fmtBRLc(Number(v)), String(n)]} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: theme.font.label }} />
              {canaisAll.map(c => (
                <Bar key={c} dataKey={c} stackId="gasto" fill={CANAL_COR[c] ?? MUT} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Linha: CAC por canal mês a mês */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
        <p style={{ color: "#FFFFFF", fontSize: 11, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>
          CAC por canal — evolução mensal
        </p>
        {lineData.length === 0 || canaisComCac.length === 0 || mesesComCac < 2 ? (
          <p style={{ color: MUT, fontSize: 11, fontFamily: theme.font.label, textAlign: "center", padding: 30 }}>
            Evolução mensal aparece com ≥2 meses de CAC válido (atribuição só desde 02/06).
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData} margin={{ top: 6, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="mes" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <Tooltip {...tooltipStyle} formatter={(v, n) => [v == null ? "—" : fmtBRLc(Number(v)), String(n)]} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: theme.font.label }} />
              {canaisComCac.map(c => (
                <Line key={c} type="monotone" dataKey={c} stroke={CANAL_COR[c] ?? MUT} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <p style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label }}>
        Fontes: v_cac_por_canal (cards consolidados) + v_cac_mensal_canal (evolução). CAC = gasto ÷ leads · ROAS = receita ÷ gasto. Leads atribuídos desde 02/06.
      </p>
    </div>
  );
}

function Linha({ label, valor, cor, forte }: { label: string; valor: string; cor: string; forte?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "3px 0" }}>
      <span style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: cor, fontSize: forte ? 15 : 12, fontWeight: forte ? 700 : 600, fontFamily: theme.font.num }}>{valor}</span>
    </div>
  );
}
