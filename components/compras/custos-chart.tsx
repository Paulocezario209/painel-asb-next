"use client";

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const mono = "'Courier New', monospace";

export type SemanaPonto = {
  semana: string;       // "S21"
  kg_total: number | null;
  custo_medio_kg: number | null;
  custo_processo_kg: number | null;
};

export function CustosChart({ data }: { data: SemanaPonto[] }) {
  if (!data || data.length === 0) {
    return (
      <p style={{ color: "#556677", fontSize: 11, fontFamily: mono, padding: 20, textAlign: "center" }}>
        sem dados semanais ainda (aguardando produção + upload de apontamentos)
      </p>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid stroke="#1B2A6B" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="semana" tick={{ fill: "#8899aa", fontSize: 10, fontFamily: mono }} stroke="#1B2A6B" />
        <YAxis yAxisId="kg" tick={{ fill: "#8899aa", fontSize: 10, fontFamily: mono }} stroke="#1B2A6B" />
        <YAxis yAxisId="rs" orientation="right" tick={{ fill: "#8899aa", fontSize: 10, fontFamily: mono }} stroke="#1B2A6B" />
        <Tooltip
          contentStyle={{ background: "#0b0f1d", border: "1px solid #1B2A6B", borderRadius: 6, fontFamily: mono, fontSize: 11 }}
          labelStyle={{ color: "#FFFFFF" }}
          formatter={(value, name) => {
            const v = Number(value); const n = String(name);
            return n === "kg produzido"
              ? [v.toLocaleString("pt-BR"), "kg produzido"]
              : [`R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, n];
          }}
        />
        <Legend wrapperStyle={{ fontFamily: mono, fontSize: 10 }} />
        <Bar yAxisId="kg" dataKey="kg_total" name="kg produzido" fill="#1B2A6B" radius={[3, 3, 0, 0]} />
        <Line yAxisId="rs" type="monotone" dataKey="custo_medio_kg" name="custo/kg (c/MP)" stroke="#2ea043" strokeWidth={2} dot={{ r: 3 }} />
        <Line yAxisId="rs" type="monotone" dataKey="custo_processo_kg" name="custo/kg processo" stroke="#d29922" strokeWidth={2} strokeDasharray="4 3" dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
