// components/dashboard/motivos-perda-chart.tsx — P3: gráfico de motivos de perda.
// Client Component (recharts). Lê da view v_motivos_perda via Server Component pai.
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export type MotivoPerda = { motivo: string; total: number; total_30d: number };

const mono = "'Courier New', monospace";

// Cores semânticas por motivo (ótica do gestor) — fallback por índice.
const COR_MOTIVO: Record<string, string> = {
  "Comprou concorrente": "#C8102E", // perda dura
  "Sem orcamento": "#D4A017",
  "Sem orçamento": "#D4A017",
  "Sem interesse": "#c0d0e0",
  "Sem retorno": "#e4e9f0",
  "Outro": "#185FA5",
};
const PALETA = ["#C8102E", "#D4A017", "#185FA5", "#c0d0e0", "#e4e9f0", "#D85A30", "#22c55e"];

// Fix 2: categorias sempre visíveis (mesmo com 0) — espelham os motivos novos do dropdown.
const CATEGORIAS_FIXAS = ["Preço"];   // DEBT-167: "Fora de rota" não é motivo de perda (estado terminal próprio)

function cor(motivo: string, i: number): string {
  return COR_MOTIVO[motivo] ?? PALETA[i % PALETA.length];
}

export function MotivosPerdaChart({ data }: { data: MotivoPerda[] }) {
  const total = data.reduce((s, d) => s + d.total, 0);

  if (!data.length || total === 0) {
    return (
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: mono }}>
        Nenhum lead marcado como perdido ainda (sem motivos para agregar).
      </p>
    );
  }

  // garante Preço/Fora de rota como categoria (total 0) quando sem dado real
  const presentes = new Set(data.map((d) => d.motivo));
  const fixas = CATEGORIAS_FIXAS
    .filter((m) => !presentes.has(m))
    .map((m) => ({ motivo: m, total: 0, total_30d: 0 }));
  const dataView = [...data, ...fixas];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.1fr)", gap: 12, alignItems: "center" }}>
      {/* Pizza */}
      <div style={{ width: "100%", height: 200 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={dataView} dataKey="total" nameKey="motivo" cx="50%" cy="50%" innerRadius={42} outerRadius={75} paddingAngle={2} strokeWidth={0}>
              {dataView.map((d, i) => (
                <Cell key={d.motivo} fill={cor(d.motivo, i)} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "#0d1117", border: "1px solid #2a3a45", borderRadius: 4, fontFamily: mono, fontSize: 11 }}
              labelStyle={{ color: "#fff" }}
              formatter={(value, name) => {
                const v = Number(value);
                return [`${v} lead(s) — ${Math.round((v / total) * 100)}%`, String(name)];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda + ranking (% e 30d) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {dataView.map((d, i) => {
          const pct = Math.round((d.total / total) * 100);
          return (
            <div key={d.motivo} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: cor(d.motivo, i), flexShrink: 0 }} />
                <span style={{ color: "#c8d8e8", fontSize: 11, fontFamily: mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {d.motivo}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
                <span style={{ color: "#fff", fontSize: 12, fontFamily: mono, fontWeight: 700 }}>{d.total}</span>
                <span style={{ color: "#c0d0e0", fontSize: 10, fontFamily: mono }}>{pct}%</span>
                {d.total_30d > 0 && (
                  <span style={{ color: "#D4A017", fontSize: 9, fontFamily: mono }} title="perdas nos últimos 30 dias">
                    ▲{d.total_30d}/30d
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div style={{ borderTop: "1px solid #2a2a2a", marginTop: 4, paddingTop: 6, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#c0d0e0", fontSize: 10, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" }}>Total perdidos</span>
          <span style={{ color: "#fff", fontSize: 12, fontFamily: mono, fontWeight: 700 }}>{total}</span>
        </div>
      </div>
    </div>
  );
}
