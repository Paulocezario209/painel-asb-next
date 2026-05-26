"use client";
import { useEffect, useState } from "react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { C, mono, sCard, sLabel } from "../lib/ui";
import { brl, num } from "../lib/formatadores";

type Comp = { nome: string; valor: number; cor: string; horas: number | null; custo_hora: number | null };
type Dia = { data: string; kg: number; mp: number; moagem: number; modelagem: number; embalamento: number; total: number; custo_kg: number | null; status: string };
type Apont = { data: string; custo_kg: number; nivel: string; cor: string; label: string; ref: number; acao: string };
type Resp = { ano: number; mes: number; composicao: Comp[]; custo_total: number; dias: Dia[]; kpis: Record<string, number>; custo_hora: { moagem: number; modelagem: number; embalamento: number }; apontamentos: Apont[] };

const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function AbaRelatorio({ ano, mes }: { ano: number; mes: number }) {
  const [d, setD] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setD(null); setErr(null);
    fetch(`/api/compras/custos/relatorio-mensal?ano=${ano}&mes=${mes}`).then((r) => r.json()).then((j) => j.error ? setErr(j.error) : setD(j)).catch((e) => setErr(String(e)));
  }, [ano, mes]);
  const th: React.CSSProperties = { ...sLabel, padding: "6px 8px", textAlign: "right", borderBottom: `1px solid ${C.borda}` };
  const td: React.CSSProperties = { padding: "5px 8px", color: C.texto, fontFamily: mono, fontSize: 11, textAlign: "right" };
  const tip = { contentStyle: { background: C.card2, border: `1px solid ${C.borda}`, borderRadius: 6, fontFamily: mono, fontSize: 11 }, labelStyle: { color: C.branco } };
  const axis = { tick: { fill: C.mut, fontSize: 9, fontFamily: mono }, stroke: C.borda };

  if (err) return <p style={{ color: C.vermelho, fontFamily: mono, fontSize: 12 }}>{err}</p>;
  if (!d) return <p style={{ color: C.mut, fontFamily: mono, fontSize: 12 }}>carregando relatório...</p>;
  const total = d.custo_total || 1;
  const pct = (v: number) => Math.round((v / total) * 1000) / 10;
  const k = d.kpis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ color: C.branco, fontSize: 13, fontWeight: 700, fontFamily: mono, letterSpacing: ".08em", textTransform: "uppercase" }}>Relatório {MESES[d.mes]}/{d.ano}</p>

      {/* 4 cards composição */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
        {d.composicao.map((c) => (
          <div key={c.nome} style={{ ...sCard, padding: "12px 14px", borderLeft: `3px solid ${c.cor}` }}>
            <p style={{ ...sLabel, marginBottom: 4 }}>{c.nome}</p>
            <p style={{ fontSize: 18, color: c.cor, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>{brl(c.valor)}</p>
            <p style={{ fontSize: 9, color: C.mut, fontFamily: mono }}>{pct(c.valor)}% do total{c.horas != null ? ` · ${num(c.horas, 1)}h · R$ ${(c.custo_hora ?? 0).toFixed(2)}/h` : ""}</p>
          </div>
        ))}
      </div>

      {/* Chart composição empilhada + linha custo/kg */}
      <div style={{ ...sCard, padding: "14px 8px 6px" }}>
        <p style={{ ...sLabel, padding: "0 6px 8px" }}>Composição diária (R$) + custo/kg</p>
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={d.dias}>
            <CartesianGrid stroke={C.borda} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="data" tickFormatter={(v) => String(v).slice(8)} {...axis} /><YAxis yAxisId="rs" {...axis} /><YAxis yAxisId="kg" orientation="right" {...axis} />
            <Tooltip {...tip} />
            <Bar yAxisId="rs" dataKey="mp" stackId="a" name="MP" fill="#1B2A6B" />
            <Bar yAxisId="rs" dataKey="moagem" stackId="a" name="Moagem" fill="#F97316" />
            <Bar yAxisId="rs" dataKey="modelagem" stackId="a" name="Modelagem" fill="#EC4899" />
            <Bar yAxisId="rs" dataKey="embalamento" stackId="a" name="Embalamento" fill="#8B5CF6" />
            <Line yAxisId="kg" type="monotone" dataKey="custo_kg" name="custo/kg" stroke="#22C55E" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela detalhamento diário */}
      <div style={{ ...sCard, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={{ ...th, textAlign: "left" }}>Data</th><th style={th}>Kg</th><th style={th}>MP</th><th style={th}>Moag.</th><th style={th}>Model.</th><th style={th}>Embal.</th><th style={th}>Total</th><th style={th}>R$/Kg</th></tr></thead>
          <tbody>
            {d.dias.map((x) => (
              <tr key={x.data} style={{ borderBottom: "1px solid #0b0f1d" }}>
                <td style={{ ...td, textAlign: "left", color: C.branco }}>{x.data.slice(5)}</td>
                <td style={td}>{num(x.kg, 1)}</td><td style={td}>{brl(x.mp)}</td><td style={td}>{brl(x.moagem)}</td><td style={td}>{brl(x.modelagem)}</td><td style={td}>{brl(x.embalamento)}</td>
                <td style={td}>{brl(x.total)}</td><td style={{ ...td, fontWeight: 700, color: C.texto }}>{x.custo_kg != null ? brl(x.custo_kg) : "—"}</td>
              </tr>
            ))}
            <tr style={{ borderTop: `2px solid ${C.borda}` }}>
              <td style={{ ...td, textAlign: "left", color: C.branco, fontWeight: 700 }}>TOTAL MÊS</td>
              <td style={{ ...td, fontWeight: 700 }}>{num(d.dias.reduce((s, x) => s + x.kg, 0), 1)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{brl(d.composicao[0].valor)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{brl(d.composicao[1].valor)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{brl(d.composicao[2].valor)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{brl(d.composicao[3].valor)}</td>
              <td style={{ ...td, fontWeight: 700, color: C.branco }}>{brl(d.custo_total)}</td>
              <td style={{ ...td, fontWeight: 700, color: C.branco }}>{brl(k.total_kg)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Barras horizontais % composição */}
      <div style={{ ...sCard, padding: 16 }}>
        <p style={{ ...sLabel, marginBottom: 10 }}>Composição (%)</p>
        {d.composicao.map((c) => (
          <div key={c.nome} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: mono, color: C.mut, marginBottom: 2 }}><span>{c.nome}</span><span>{pct(c.valor)}%</span></div>
            <div style={{ height: 8, background: C.card2, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${pct(c.valor)}%`, height: "100%", background: c.cor }} /></div>
          </div>
        ))}
      </div>

      {/* 9 KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8 }}>
        {[["MP/Kg", brl(k.mp_kg)], ["Moagem/Kg", brl(k.moagem_kg)], ["Model./Kg", brl(k.modelagem_kg)], ["Embal./Kg", brl(k.embalamento_kg)], ["Total/Kg", brl(k.total_kg)], ["H Moagem", `${num(k.h_moagem, 1)}h`], ["H Model.", `${num(k.h_modelagem, 1)}h`], ["H Embal.", `${num(k.h_embalamento, 1)}h`], ["OPs / Kg-dia", `${k.ops} / ${num(k.kg_dia, 0)}`]].map(([a, b]) => (
          <div key={a} style={{ background: C.card2, borderRadius: 4, padding: "8px 10px" }}><p style={{ fontSize: 8, color: C.mut2, fontFamily: mono, textTransform: "uppercase" }}>{a}</p><p style={{ fontSize: 13, color: C.texto, fontFamily: mono, fontWeight: 700 }}>{b}</p></div>
        ))}
      </div>

      {/* Apontamentos */}
      <div style={{ ...sCard, padding: 16 }}>
        <p style={{ color: C.branco, fontSize: 12, fontWeight: 700, fontFamily: mono, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>Apontamentos Fora do Padrão — Melhoria Contínua</p>
        {d.apontamentos.length === 0 ? <p style={{ color: C.verde2, fontSize: 12, fontFamily: mono }}>Nenhum dia acima do threshold de alerta.</p> :
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {d.apontamentos.map((a) => (
              <div key={a.data} style={{ borderLeft: `3px solid ${a.cor}`, background: `${a.cor}11`, borderRadius: 4, padding: "8px 12px" }}>
                <p style={{ fontSize: 11, fontFamily: mono }}><span style={{ color: a.cor, fontWeight: 700 }}>{a.label}</span> <span style={{ color: C.branco }}>{a.data} — Custo/Kg {brl(a.custo_kg)}</span></p>
                <p style={{ fontSize: 10, color: C.mut, fontFamily: mono }}>Referência: threshold alerta {brl(a.ref)}/kg → {a.acao}</p>
              </div>
            ))}
          </div>}
      </div>

      <p style={{ color: C.mut2, fontSize: 9, fontFamily: mono, textAlign: "center", letterSpacing: ".05em" }}>
        AMERICAN STEAK BRASIL · RELATÓRIO {MESES[d.mes]}/{d.ano} · MOAGEM R${d.custo_hora.moagem.toFixed(2)}/H · MODELAGEM R${d.custo_hora.modelagem.toFixed(2)}/H · EMBALAMENTO R${d.custo_hora.embalamento.toFixed(2)}/H · GERADO AUTOMATICAMENTE · USO INTERNO
      </p>
    </div>
  );
}
