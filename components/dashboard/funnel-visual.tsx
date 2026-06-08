"use client";

// FIX 4 (auditoria 2026-06-08): funil VISUAL real (Recharts FunnelChart) — substitui o
// BarChart horizontal no /dashboard/funil. Cada nível afunila do topo (mais largo) à base.
// Cores semânticas: qualificação #185FA5, handoff #D4A017, avançadas #22c55e.
// Recebe data já enriquecida no server (label, count, pct vs etapa anterior, fill).

import { FunnelChart, Funnel, LabelList, Tooltip, ResponsiveContainer, Cell } from "recharts";

export type FunnelStage = {
  label: string;
  count: number;
  pct: number | null;   // % de conversão vs etapa anterior (null na 1ª)
  fill: string;
};

const tooltipStyle = {
  contentStyle: {
    background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 3,
    fontSize: 11, fontFamily: "'Courier New', monospace", color: "#c8d8e8",
    boxShadow: "0 4px 20px rgba(200,16,46,.15)",
  },
  itemStyle:  { color: "#c8d8e8" },
  labelStyle: { color: "#556677", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase" as const },
};

export function FunnelVisual({ data }: { data: FunnelStage[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <FunnelChart>
        <Tooltip
          {...tooltipStyle}
          formatter={(v: unknown, _n: unknown, item: { payload?: FunnelStage }) => {
            const p = item?.payload;
            const pct = p?.pct != null ? ` · ${p.pct}% da etapa anterior` : "";
            return [`${v} leads${pct}`, p?.label ?? ""];
          }}
        />
        <Funnel dataKey="count" data={data} isAnimationActive={false} stroke="#1a1a1a" strokeWidth={2}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
          <LabelList
            position="right"
            dataKey="label"
            stroke="none"
            fill="#c8d8e8"
            fontSize={11}
            fontFamily="'Courier New', monospace"
          />
          <LabelList
            position="inside"
            dataKey="count"
            stroke="none"
            fill="#FFFFFF"
            fontSize={12}
            fontWeight={700}
            fontFamily="'Courier New', monospace"
          />
        </Funnel>
      </FunnelChart>
    </ResponsiveContainer>
  );
}
