"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

type StageBucket = { label: string; count: number };
type WeekPoint   = { week: string; count: number };
type VendorRow   = { label: string; handoffs: number; confirmed: number; converted: number };

const SANS  = "var(--font-geist-sans), system-ui, sans-serif";
const GRID  = "rgba(255,255,255,.08)";
const TEXT  = "#aeb7cc";
const RED   = "#FF3B57";
const BLUE  = "#2a2a2a";
const BLUE2 = "#2A3F8F";
const AMBER = "#f59e0b";

const tooltipStyle = {
  contentStyle: {
    background: "#17181d", border: "1px solid rgba(255,255,255,.14)", borderRadius: 10,
    fontSize: 12, fontFamily: SANS, color: "#f4f4f8",
    boxShadow: "0 20px 44px -18px rgba(0,0,0,.6)",
  },
  itemStyle:  { color: "#c8d2e6" },
  labelStyle: { color: "#aeb7cc", fontSize: 11, fontWeight: 650 },
};

const axisStyle = { fontSize: 11, fontFamily: SANS, fill: TEXT };

export function QualificationFunnel({ data }: { data: StageBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="blueHoriz" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0d1a3a" />
            <stop offset="100%" stopColor="#2A3F8F" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis type="category" dataKey="label" width={130} tick={axisStyle} axisLine={false} tickLine={false} interval={0} />
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
          dot={{ r: 3, fill: RED, stroke: "#1a1a1a", strokeWidth: 2 }}
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
            <stop offset="100%" stopColor="#2a2a2a" />
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
        <Legend wrapperStyle={{ fontSize: 11.5, fontFamily: SANS, color: TEXT, fontWeight: 600 }} />
        <Bar dataKey="handoffs"  name="Handoffs"    fill="url(#amberVert)"  radius={[3, 3, 0, 0]} />
        <Bar dataKey="confirmed" name="Confirmados"  fill="url(#blueVert)"   radius={[3, 3, 0, 0]} />
        <Bar dataKey="converted" name="Convertidos"  fill="url(#redVert)"    radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
