"use client";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { C, sCard, sLabel } from "../lib/ui";
import { theme } from "@/lib/theme";

// Etapa 2 item 3: % Gordura sobre Recorte por dia. Faixas fixas (NÃO limites estatísticos): baixo 6 / ideal 10 / alto 14.
// pct null (dia sem Recorte) = GAP (connectNulls=false), nunca 0.
type Pt = { label: string; pct: number | null; recorte: number; gordura: number };
const FAIXA = { baixo: 6, ideal: 10, alto: 14 };
const corZona = (v: number) => (v < FAIXA.baixo ? C.amarelo : v > FAIXA.alto ? C.vermelho : C.verde2);

export function ComparativoInsumosChart({ data, title = "Comparativo de Utilização de Insumos (% Gordura / Recorte)" }: { data: Pt[]; title?: string }) {
  const validos = data.filter((d) => d.pct != null);
  if (validos.length < 1) {
    return (
      <div style={{ ...sCard, padding: 16 }}>
        <p style={{ ...sLabel, marginBottom: 6 }}>{title}</p>
        <p style={{ color: C.mut, fontSize: 11, fontFamily: theme.font.label }}>Sem dias com Recorte lançado no mês — % indefinido.</p>
      </div>
    );
  }
  const tip = { contentStyle: { background: C.card2, border: `1px solid ${C.borda}`, borderRadius: 6, fontFamily: theme.font.num, fontSize: 11 }, labelStyle: { color: C.branco } };
  const axis = { tick: { fill: C.mut, fontSize: 9, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }, stroke: C.borda };

  type DotProps = { cx?: number; cy?: number; index?: number };
  const dot = (p: DotProps) => {
    const { cx, cy, index } = p;
    const v = data[index ?? 0]?.pct;
    if (cx == null || cy == null || v == null) return <g key={index} />; // gap: sem ponto
    return <circle key={index} cx={cx} cy={cy} r={3.5} fill={corZona(v)} stroke={C.bg} strokeWidth={1} />;
  };

  return (
    <div style={{ ...sCard, padding: 14 }}>
      <p style={{ color: C.branco, fontSize: 12, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".06em", marginBottom: 10 }}>{title}</p>
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 6, right: 48, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.borda} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} unit="%" domain={[0, (max: number) => Math.max(16, Math.ceil(max) + 2)]} />
          <Tooltip {...tip} formatter={(v) => [v == null ? "sem recorte" : `${v}%`, "% gordura/recorte"]} />
          <ReferenceLine y={FAIXA.baixo} stroke={C.amarelo} strokeDasharray="4 2" label={{ value: "baixo 6%", fill: C.amarelo, fontSize: 9, position: "right" }} />
          <ReferenceLine y={FAIXA.ideal} stroke={C.verde2} strokeDasharray="4 2" label={{ value: "ideal 10%", fill: C.verde2, fontSize: 9, position: "right" }} />
          <ReferenceLine y={FAIXA.alto} stroke={C.vermelho} strokeDasharray="4 2" label={{ value: "alto 14%", fill: C.vermelho, fontSize: 9, position: "right" }} />
          <Line type="linear" dataKey="pct" stroke={C.azul} strokeWidth={1.5} dot={dot} connectNulls={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
