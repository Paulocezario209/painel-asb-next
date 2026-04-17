"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Row = { label: string; count: number };

const COLORS = ["#C8102E", "#1B2A6B", "#f59e0b", "#22c55e", "#8b5cf6", "#0ea5e9", "#ec4899", "#14b8a6"];

const tooltipStyle = {
  contentStyle: {
    background: "#0f1428", border: "1px solid #C8102E", borderRadius: 3,
    fontSize: 11, fontFamily: "'Courier New', monospace", color: "#c8d8e8",
    boxShadow: "0 4px 20px rgba(200,16,46,.15)",
  },
  itemStyle:  { color: "#c8d8e8" },
  labelStyle: { color: "#556677", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase" as const },
};

export function PainDonut({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          cx="50%"
          cy="48%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          stroke="none"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          {...tooltipStyle}
          formatter={(v, name) => [`${v} leads`, name]}
        />
        <Legend
          wrapperStyle={{
            fontSize: 9, fontFamily: "'Courier New', monospace",
            color: "#556677", letterSpacing: ".10em", textTransform: "uppercase",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
