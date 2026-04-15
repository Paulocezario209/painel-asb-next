"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

type StageBucket = { label: string; count: number };
type WeekPoint   = { week: string; count: number };
type VendorRow   = { label: string; handoffs: number; confirmed: number; converted: number };

const GRID  = "rgba(27,42,107,.35)";
const TEXT  = "#556677";
const RED   = "#C8102E";
const BLUE  = "#1B2A6B";
const BLUE2 = "#2A3F8F";
const AMBER = "#f59e0b";

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

export function QualificationFunnel({ data }: { data: StageBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="blueHoriz" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0d1a3a" />
            <stop offset="100%" stopColor="#2A3F8F" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis type="category" dataKey="label" width={40} tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [`${v} leads`, "Leads"]} />
        <Bar dataKey="count" fill="url(#blueHoriz)" radius={[0, 3, 3, 0]} />
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
          type="monotone" dataKey="count" stroke={RED} strokeWidth={2}
          dot={{ r: 3, fill: RED, stroke: "#0f1428", strokeWidth: 2 }}
          activeDot={{ r: 5, fill: RED, stroke: "#C8102E", strokeWidth: 2 }}
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
          <linearGradient id="redVert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C8102E" />
            <stop offset="100%" stopColor="#7a0a1c" />
          </linearGradient>
          <linearGradient id="blueVert" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2A3F8F" />
            <stop offset="100%" stopColor="#1B2A6B" />
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
        <Bar dataKey="confirmed" name="Confirmados"  fill="url(#blueVert)"   radius={[3, 3, 0, 0]} />
        <Bar dataKey="converted" name="Convertidos"  fill="url(#redVert)"    radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
