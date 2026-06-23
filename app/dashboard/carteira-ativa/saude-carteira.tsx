"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CUSTOMER_STATUS, STATUS_FILTER_KEYS } from "@/lib/customer-status";

export type SaudeVendedor = { vendedor: string; dist: Record<string, number> };

const totalOf = (d: Record<string, number>) => Object.values(d).reduce((a, b) => a + b, 0);

export function SaudeCarteira({ saude }: { saude: SaudeVendedor[] }) {
  const vendedores = saude
    .filter((s) => s.vendedor !== "Sem vendedor")
    .sort((a, b) => totalOf(b.dist) - totalOf(a.dist));

  if (!vendedores.length) return null;

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-1">Saúde da carteira por vendedor</h2>
      <p className="text-sm text-gray-400 mb-3">
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
            <div key={s.vendedor} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white truncate">{s.vendedor}</h3>
                <span className="text-xs text-gray-500 shrink-0 ml-2">{total} clientes</span>
              </div>

              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={42}
                      outerRadius={64}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {data.map((d) => (
                        <Cell key={d.key} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#0f0f0f",
                        border: "1px solid #2a2a2a",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
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
                  <div key={d.key} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-gray-300 flex-1 truncate">{d.name}</span>
                    <span className="text-white font-mono tabular-nums">{d.value}</span>
                    <span className="text-gray-500 w-9 text-right">{Math.round((100 * d.value) / total)}%</span>
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
