"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Row = { label: string; count: number };

const GRID = "rgba(27,42,107,.35)";
const TEXT = "#556677";

const tooltipStyle = {
  contentStyle: {
    background: "#0f1428", border: "1px solid #C8102E", borderRadius: 3,
    fontSize: 11, fontFamily: "'Courier New', monospace", color: "#c8d8e8",
    boxShadow: "0 4px 20px rgba(200,16,46,.15)",
  },
  itemStyle:  { color: "#c8d8e8" },
  labelStyle: { color: "#556677", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase" as const },
};

const axisStyle = { fontSize: 10, fontFamily: "'Courier New', monospace", fill: TEXT };

export function SegmentChart({ data }: { data: Row[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="segHoriz" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0d1a3a" />
            <stop offset="100%" stopColor="#C8102E" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={80} tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v} leads`, "Leads"]} />
        <Bar dataKey="count" fill="url(#segHoriz)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
