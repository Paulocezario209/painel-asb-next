"use client";

import type { CSSProperties } from "react";
import { theme } from "@/lib/theme";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CUSTOMER_STATUS, STATUS_FILTER_KEYS } from "@/lib/customer-status";
import { S } from "@/app/dashboard/lib/dashboard-tokens";

export type SaudeVendedor = { vendedor: string; dist: Record<string, number> };

// Título de seção (mesma camada que PageHead: page-ink, 20px) — bare heading acima do grid de cards.
const h2Style: CSSProperties = { color: "var(--asb-page-ink)", fontSize: 20, fontWeight: 800, fontFamily: theme.font.label, letterSpacing: "-.01em" };

const totalOf = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + b, 0);

export function SaudeCarteira({ saude }: { saude: SaudeVendedor[] }) {
  const vendedores = saude
    .filter((s) => s.vendedor !== "Sem vendedor")
    .sort((a, b) => totalOf(b.dist) - totalOf(a.dist));

  if (!vendedores.length) return null;

  return (
    <div>
      <h2 style={{ ...h2Style, marginBottom: 4 }}>Saúde da carteira por vendedor</h2>
      <p style={{ ...S.muted, marginBottom: 12 }}>
        Carteira real ARES por status (régua absoluta, 6 faixas de dias sem comprar)
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vendedores.map((s) => {
          const total = totalOf(s.dist);
          const data = STATUS_FILTER_KEYS.map((k) => ({
            key: k,
            name: CUSTOMER_STATUS[k].label,
            value: s.dist[k] ?? 0,
            color: CUSTOMER_STATUS[k].color,
          })).filter((d) => d.value > 0);

          return (
            <div key={s.vendedor} style={{ ...S.card, padding: 16 }}>
              <div className="flex items-center justify-between mb-2">
                <span style={{ ...S.section, marginBottom: 0 }}>{s.vendedor}</span>
                <span style={S.muted}>{total} clientes</span>
              </div>

              <div className="h-44" style={{ filter: "drop-shadow(0 0 7px rgba(79,125,240,.30))" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">
                      {data.map((d) => (
                        <Cell key={d.key} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--asb-card-hi)", border: "1px solid #4f7df0", borderRadius: 4, fontSize: 11, fontFamily: theme.font.num, color: "#c8d8e8", boxShadow: "0 4px 20px rgba(79,125,240,.20)" }}
                      itemStyle={{ color: "#c8d8e8" }}
                      formatter={(v, n) => {
                        const val = Number(v) || 0;
                        return [`${val} (${Math.round((100 * val) / total)}%)`, String(n)];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 space-y-1">
                {data.map((d) => (
                  <div key={d.key} className="flex items-center gap-2" style={{ fontSize: 11, fontFamily: theme.font.label }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                    <span className="flex-1 truncate" style={{ color: "#c8d8e8" }}>{d.name}</span>
                    <span className="tabular-nums" style={{ color: "#FFFFFF" }}>{d.value}</span>
                    <span className="w-9 text-right" style={{ color: "#c0d0e0" }}>{Math.round((100 * d.value) / total)}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
