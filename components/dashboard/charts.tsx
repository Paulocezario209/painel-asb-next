"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

type StageBucket = { label: string; count: number };
type WeekPoint   = { week: string; count: number };
type VendorRow   = { label: string; handoffs: number; confirmed: number; converted: number };

const GRID  = "#1a2e1a";
const TEXT  = "#4a6a4a";
const GREEN = "#00C853";
const NEON  = "#00E676";
const AMBER = "#f59e0b";

const tooltipStyle = {
  contentStyle: {
    background: "#111f11", border: "1px solid #00C853", borderRadius: 3,
    fontSize: 11, fontFamily: "'Courier New', monospace", color: "#C8D8C8",
    boxShadow: "0 4px 20px rgba(0,200,83,.15)",
  },
  itemStyle:  { color: "#C8D8C8" },
  labelStyle: { color: "#4a6a4a", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase" as const },
};

const axisStyle = { fontSize: 10, fontFamily: "'Courier New', monospace", fill: TEXT };

export function QualificationFunnel({ data }: { data: StageBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="greenHoriz" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1B5E20" />
            <stop offset="100%" stopColor="#00C853" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis type="category" dataKey="label" width={40} tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v} leads`, "Leads"]} />
        <Bar dataKey="count" fill="url(#greenHoriz)" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WeeklyConversions({ data }: { data: WeekPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="week" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v}`, "Conversões"]} />
        <Line
          type="monotone" dataKey="count" stroke={NEON} strokeWidth={2}
          dot={{ r: 3, fill: NEON, stroke: "#111f11", strokeWidth: 2 }}
          activeDot={{ r: 5, fill: NEON, stroke: "#00C853", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function VendorPerformance({ data }: { data: VendorRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="greenVert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00C853" />
            <stop offset="100%" stopColor="#1B5E20" />
          </linearGradient>
          <linearGradient id="neonVert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00E676" />
            <stop offset="100%" stopColor="#2E7D32" />
          </linearGradient>
          <linearGradient id="amberVert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 9, fontFamily: "'Courier New', monospace", color: TEXT, letterSpacing: ".10em", textTransform: "uppercase" }} />
        <Bar dataKey="handoffs"  name="Handoffs"    fill="url(#amberVert)"  radius={[3, 3, 0, 0]} />
        <Bar dataKey="confirmed" name="Confirmados"  fill="url(#greenVert)"  radius={[3, 3, 0, 0]} />
        <Bar dataKey="converted" name="Convertidos"  fill="url(#neonVert)"   radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
