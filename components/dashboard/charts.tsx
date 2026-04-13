"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

type StageBucket = { label: string; count: number };
type WeekPoint   = { week: string; count: number };
type VendorRow   = { label: string; handoffs: number; confirmed: number; converted: number };

const GRID  = "#21262d";
const TEXT  = "#8b949e";
const BLUE  = "#58a6ff";
const GREEN = "#3fb950";
const AMBER = "#f0b429";

const tooltipStyle = {
  contentStyle: { background: "#161b22", border: "1px solid #30363d", borderRadius: 4, fontSize: 11, fontFamily: "'Courier New', monospace", color: "#c9d1d9" },
  itemStyle:    { color: "#c9d1d9" },
  labelStyle:   { color: "#8b949e", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase" as const },
};

const axisStyle = { fontSize: 10, fontFamily: "'Courier New', monospace", fill: TEXT };

export function QualificationFunnel({ data }: { data: StageBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis type="category" dataKey="label" width={40} tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v} leads`, "Leads"]} />
        <Bar dataKey="count" fill={BLUE} radius={[0, 3, 3, 0]} />
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
        <Line type="monotone" dataKey="count" stroke={GREEN} strokeWidth={2} dot={{ r: 3, fill: GREEN }} activeDot={{ r: 5, fill: GREEN }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function VendorPerformance({ data }: { data: VendorRow[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 9, fontFamily: "'Courier New', monospace", color: TEXT, letterSpacing: ".10em", textTransform: "uppercase" }} />
        <Bar dataKey="handoffs"  name="Handoffs"   fill={AMBER} radius={[3, 3, 0, 0]} />
        <Bar dataKey="confirmed" name="Confirmados" fill={BLUE}  radius={[3, 3, 0, 0]} />
        <Bar dataKey="converted" name="Convertidos" fill={GREEN} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
