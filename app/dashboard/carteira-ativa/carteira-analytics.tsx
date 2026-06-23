"use client";

import type { CSSProperties } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

// Tokens do design-system (padrão Inteligência).
const S = {
  card: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as CSSProperties,
  h2: { color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase" } as CSSProperties,
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#c0c8d8", fontFamily: "'Courier New', monospace" } as CSSProperties,
  label: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#556677", fontFamily: "'Courier New', monospace" } as CSSProperties,
  value: { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 } as CSSProperties,
  muted: { color: "#8899aa", fontSize: 10, fontFamily: "'Courier New', monospace" } as CSSProperties,
};
const GRUPO_COLORS = ["#185FA5", "#C8102E", "#D4A017", "#22c55e", "#9333ea", "#D85A30", "#556677", "#f59e0b"];

const brl = (n: number) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export type MetaRow = {
  routing_team: string; vendedor_nome: string | null; proxima_data_meta: string | null;
  meta_dia: number; clientes_no_dia: number; recompra_projetada: number;
  pct_atingimento: number | null; gap_brl: number;
};
export type TopRow = {
  routing_team: string; id_produto: number; descricao_produto: string; grupo_nome: string | null;
  valor_total: number; pct: number; rank: number;
};
export type GrupoRow = { routing_team: string; grupo_nome: string; valor_total: number; pct: number };

function groupBy<T extends { routing_team: string }>(rows: T[]) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    if (!m.has(r.routing_team)) m.set(r.routing_team, []);
    m.get(r.routing_team)!.push(r);
  }
  return m;
}

export function CarteiraAnalytics({ meta, top, grupos }: { meta: MetaRow[]; top: TopRow[]; grupos: GrupoRow[] }) {
  const topBy = groupBy(top);
  const grupoBy = groupBy(grupos);
  const metaSorted = [...meta].sort((a, b) => b.meta_dia - a.meta_dia);

  return (
    <div className="space-y-6">
      {/* ── Recompra × Meta do dia ── */}
      <div>
        <h2 style={{ ...S.h2, marginBottom: 4 }}>Recompra × Meta do dia</h2>
        <p style={{ ...S.muted, marginBottom: 12 }}>
          Recompra esperada até o dia de meta (Σ ticket médio dos clientes com próximo ciclo ≤ data de meta) vs meta do dia
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {metaSorted.map((m) => {
            const pct = m.pct_atingimento ?? 0;
            const bate = pct >= 100;
            const cor = bate ? "#22c55e" : "#C8102E";
            const grupoTop = (grupoBy.get(m.routing_team) ?? []).slice().sort((a, b) => b.pct - a.pct)[0];
            const prodTop =
              (topBy.get(m.routing_team) ?? []).find((p) => grupoTop && p.grupo_nome === grupoTop.grupo_nome) ??
              (topBy.get(m.routing_team) ?? [])[0];
            return (
              <div key={m.routing_team} style={{ ...S.card, padding: 20, borderTop: `2px solid ${cor}` }}>
                <div className="flex items-center justify-between">
                  <span style={S.section}>{m.vendedor_nome}</span>
                  <span style={S.muted}>meta {dt(m.proxima_data_meta)}</span>
                </div>
                <p style={{ ...S.value, marginTop: 12, color: cor }}>{pct}%</p>
                <p style={{ ...S.muted, marginTop: 4 }}>
                  {brl(m.recompra_projetada)} de {brl(m.meta_dia)} · {m.clientes_no_dia} clientes no dia
                </p>
                {/* barra de progresso */}
                <div style={{ marginTop: 10, height: 6, background: "#0f0f0f", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: cor, transition: "width .2s" }} />
                </div>
                {/* motor de mix — só se gap > 0 */}
                {m.gap_brl > 0 && (
                  <div style={{ marginTop: 12, padding: "10px 12px", background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 6 }}>
                    <p style={{ ...S.label, color: "#C8102E" }}>Fechar o gap · {brl(m.gap_brl)}</p>
                    <p style={{ ...S.muted, marginTop: 6, lineHeight: 1.5 }}>
                      {grupoTop ? (
                        <>
                          Foco no grupo <span style={{ color: "#c8d8e8" }}>{grupoTop.grupo_nome}</span> ({grupoTop.pct}% da cesta)
                          {prodTop ? (
                            <> — ofereça <span style={{ color: "#c8d8e8" }}>{prodTop.descricao_produto}</span> aos {m.clientes_no_dia} clientes do dia.</>
                          ) : "."}
                        </>
                      ) : (
                        <>Sem recompra no dia — prospecção/key accounts para cobrir {brl(m.gap_brl)}.</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Top 10 produtos (30d) ── */}
      <div>
        <h2 style={{ ...S.h2, marginBottom: 4 }}>Top 10 produtos · 30d</h2>
        <p style={{ ...S.muted, marginBottom: 12 }}>Mais vendidos por faturamento, com % de representatividade · por vendedor</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...topBy.entries()].map(([rt, prods]) => {
            const nome = meta.find((m) => m.routing_team === rt)?.vendedor_nome ?? rt;
            const max = Math.max(...prods.map((p) => p.pct), 1);
            return (
              <div key={rt} style={{ ...S.card }} className="p-4">
                <div style={{ ...S.section, marginBottom: 10 }}>{nome}</div>
                <div className="space-y-1.5">
                  {prods.map((p) => (
                    <div key={p.id_produto}>
                      <div className="flex items-baseline gap-2" style={{ fontSize: 11 }}>
                        <span className="font-mono tabular-nums" style={{ color: "#8899aa", width: 18 }}>{p.rank}.</span>
                        <span className="truncate flex-1" style={{ color: "#c8d8e8" }}>{p.descricao_produto}</span>
                        <span className="font-mono tabular-nums" style={{ color: "#FFFFFF", width: 44, textAlign: "right" }}>{p.pct}%</span>
                      </div>
                      <div style={{ height: 4, background: "#0f0f0f", borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
                        <div style={{ width: `${(p.pct / max) * 100}%`, height: "100%", background: "#185FA5" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Representatividade por grupo ── */}
      <div>
        <h2 style={{ ...S.h2, marginBottom: 4 }}>Mix por grupo de produto · 30d</h2>
        <p style={{ ...S.muted, marginBottom: 12 }}>Representatividade da cesta da recompra por família de produto · por vendedor</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...grupoBy.entries()].map(([rt, gs]) => {
            const nome = meta.find((m) => m.routing_team === rt)?.vendedor_nome ?? rt;
            const data = gs
              .slice()
              .sort((a, b) => b.valor_total - a.valor_total)
              .map((g, i) => ({ name: g.grupo_nome, value: Number(g.valor_total), pct: g.pct, color: GRUPO_COLORS[i % GRUPO_COLORS.length] }));
            return (
              <div key={rt} style={{ ...S.card }} className="p-4">
                <div style={{ ...S.section, marginBottom: 8 }}>{nome}</div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none">
                        {data.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 8, fontSize: 12 }}
                        formatter={(v, n) => [`${brl(Number(v) || 0)}`, String(n)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1">
                  {data.slice(0, 5).map((d) => (
                    <div key={d.name} className="flex items-center gap-2" style={{ fontSize: 11, fontFamily: "'Courier New', monospace" }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                      <span className="flex-1 truncate" style={{ color: "#c8d8e8" }}>{d.name}</span>
                      <span style={{ color: "#8899aa", width: 36, textAlign: "right" }}>{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
