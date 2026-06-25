"use client";
import { ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, BarChart } from "recharts";
import { analisarIMR } from "@/lib/shewhart";
import { C, sCard, sLabel } from "../lib/ui";
import { theme } from "@/lib/theme";

const ZCOR = { normal: "#22C55E", atencao: "#EAB308", fora: "#EF4444" };

export function ShewartIMRChart({ data, unit = "", title }: {
  data: { label: string; value: number }[]; metric?: string; target?: number; unit?: string; title: string; thresholds?: { ideal?: number; alerta?: number; critico?: number };
}) {
  const serie = data.filter((d) => Number.isFinite(d.value));
  if (serie.length < 2) {
    return <div style={{ ...sCard, padding: 16 }}><p style={{ ...sLabel, marginBottom: 6 }}>{title}</p><p style={{ color: C.mut, fontSize: 11, fontFamily: theme.font.label }}>São necessários pelo menos 2 pontos com dados.</p></div>;
  }
  const r = analisarIMR(serie.map((s) => ({ label: s.label, valor: s.value })));
  const L = r.limites;
  const chartData = r.pontos.map((p) => ({ label: p.label, valor: p.valor, mr: p.mr ?? 0, zona: p.zona }));
  const fmt = (v: number) => `${v.toFixed(2)}${unit ? " " + unit : ""}`;
  const tip = { contentStyle: { background: C.card2, border: `1px solid ${C.borda}`, borderRadius: 6, fontFamily: theme.font.num, fontSize: 11 }, labelStyle: { color: C.branco } };
  const axis = { tick: { fill: C.mut, fontSize: 9, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }, stroke: C.borda };

  type DotProps = { cx?: number; cy?: number; index?: number };
  const dot = (props: DotProps) => {
    const { cx, cy, index } = props;
    const z = chartData[index ?? 0]?.zona ?? "normal";
    return <circle key={index} cx={cx} cy={cy} r={3.5} fill={ZCOR[z as keyof typeof ZCOR]} stroke={C.bg} strokeWidth={1} />;
  };

  return (
    <div style={{ ...sCard, padding: 14 }}>
      <p style={{ color: C.branco, fontSize: 12, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".06em", marginBottom: 4 }}>{title}</p>
      <p style={{ color: r.pontosFora > 0 ? C.vermelho : r.pontosAtencao > 0 ? C.amarelo : C.verde2, fontSize: 10, fontFamily: theme.font.label, marginBottom: 10 }}>● {r.sinal}</p>

      <ResponsiveContainer width="100%" height={210}>
        <ComposedChart data={chartData} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.borda} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" {...axis} /><YAxis {...axis} domain={["auto", "auto"]} />
          <Tooltip {...tip} formatter={(v) => [fmt(Number(v)), "valor"]} />
          <ReferenceLine y={L.media} stroke={C.mut} strokeDasharray="2 2" label={{ value: "x̄", fill: C.mut, fontSize: 9 }} />
          <ReferenceLine y={L.lcs} stroke={C.vermelho} strokeDasharray="4 2" label={{ value: "LCS", fill: C.vermelho, fontSize: 9 }} />
          <ReferenceLine y={L.lci} stroke={C.vermelho} strokeDasharray="4 2" label={{ value: "LCI", fill: C.vermelho, fontSize: 9 }} />
          <ReferenceLine y={L.s2p} stroke={C.amarelo} strokeDasharray="2 4" /><ReferenceLine y={L.s2m} stroke={C.amarelo} strokeDasharray="2 4" />
          <Line type="linear" dataKey="valor" stroke={C.verde} strokeWidth={1.5} dot={dot} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>

      <p style={{ ...sLabel, margin: "8px 0 4px" }}>Amplitude Móvel (MR)</p>
      <ResponsiveContainer width="100%" height={90}>
        <BarChart data={chartData} margin={{ top: 2, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={C.borda} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" hide /><YAxis {...axis} />
          <Tooltip {...tip} formatter={(v) => [fmt(Number(v)), "MR"]} />
          <ReferenceLine y={L.lcsMr} stroke={C.vermelho} strokeDasharray="4 2" />
          <Bar dataKey="mr" fill={C.azul} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginTop: 10 }}>
        {[["Média", fmt(L.media)], ["σ", fmt(L.sigma)], ["Mín", fmt(L.min)], ["Máx", fmt(L.max)], ["LCS", fmt(L.lcs)], ["LCI", fmt(L.lci)], ["Fora", String(r.pontosFora)], ["Atenção", String(r.pontosAtencao)]].map(([k, v]) => (
          <div key={k} style={{ background: C.card2, borderRadius: 4, padding: "6px 8px" }}>
            <p style={{ fontSize: 8, color: C.mut2, fontFamily: theme.font.label, textTransform: "uppercase" }}>{k}</p>
            <p style={{ fontSize: 12, color: C.texto, fontFamily: theme.font.num, fontWeight: 700 }}>{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
