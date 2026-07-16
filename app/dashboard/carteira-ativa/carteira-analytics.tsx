"use client";

import type { CSSProperties } from "react";
import { theme } from "@/lib/theme";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { S } from "@/app/dashboard/lib/dashboard-tokens";

// Padrões reusados da aba Inteligência (components/insights/segment-chart.tsx): barra horizontal
// gradiente + tooltip estilizado + eixos mono. Adaptado ao tema tech (glow azul ASB).
const GRID = "rgba(27,42,107,.35)";
const axisStyle = { fontSize: 10, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const, fill: "#e4e9f0" };
const tooltipStyle = {
  contentStyle: {
    background: "var(--asb-card-hi)", border: "1px solid #4f7df0", borderRadius: 4,
    fontSize: 11, fontFamily: theme.font.num, color: "#c8d8e8",
    boxShadow: "0 4px 20px rgba(79,125,240,.20)",
  },
  itemStyle: { color: "#c8d8e8" },
  labelStyle: { color: "#e4e9f0", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase" as const },
};

// Título de seção (mesma camada que PageHead: page-ink, 20px) — bare heading acima do grid de cards.
const h2Style: CSSProperties = { color: "var(--asb-page-ink)", fontSize: 20, fontWeight: 800, fontFamily: theme.font.label, letterSpacing: "-.01em" };

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

// ── (b) Recompra × Meta do dia (com motor de mix) ──
export function RecompraMetaSection({ meta, top, grupos }: { meta: MetaRow[]; top: TopRow[]; grupos: GrupoRow[] }) {
  const topBy = groupBy(top);
  const grupoBy = groupBy(grupos);
  const metaSorted = [...meta].sort((a, b) => b.meta_dia - a.meta_dia);
  return (
    <div>
      <h2 style={{ ...h2Style, marginBottom: 4 }}>Recompra × Meta do dia</h2>
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
            <div key={m.routing_team} style={{ ...S.card, padding: "20px 24px", borderTop: `3px solid ${cor}` }}>
              <div className="flex items-center justify-between">
                <span style={{ ...S.section, marginBottom: 0 }}>{m.vendedor_nome}</span>
                <span style={S.muted}>meta {dt(m.proxima_data_meta)}</span>
              </div>
              <p style={{ ...S.value, marginTop: 12, color: cor }}>{pct}%</p>
              <p style={{ ...S.muted, marginTop: 4 }}>
                {brl(m.recompra_projetada)} de {brl(m.meta_dia)} · {m.clientes_no_dia} clientes no dia
              </p>
              <div style={{ marginTop: 10, height: 6, background: "var(--asb-card-hi)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: `linear-gradient(90deg, ${cor}cc, ${cor})` }} />
              </div>
              {m.gap_brl > 0 && (
                <div style={{ marginTop: 12, padding: "10px 12px", background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)", borderRadius: 6 }}>
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
  );
}

// ── (d) Top 10 produtos (30d) ──
export function TopProdutosSection({ meta, top }: { meta: MetaRow[]; top: TopRow[] }) {
  const topBy = groupBy(top);
  return (
    <div>
      <h2 style={{ ...h2Style, marginBottom: 4 }}>Top 10 produtos · 30d</h2>
      <p style={{ ...S.muted, marginBottom: 12 }}>Mais vendidos por faturamento, com % de representatividade · por vendedor</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...topBy.entries()].map(([rt, prods]) => {
          const nome = meta.find((m) => m.routing_team === rt)?.vendedor_nome ?? rt;
          const max = Math.max(...prods.map((p) => p.pct), 1);
          return (
            <div key={rt} style={S.card} className="p-4">
              <div style={{ ...S.section, marginBottom: 10 }}>{nome}</div>
              <div className="space-y-1.5">
                {prods.map((p) => (
                  <div key={p.id_produto}>
                    <div className="flex items-baseline gap-2" style={{ fontSize: 11 }}>
                      <span className="font-mono tabular-nums" style={{ color: "#c0d0e0", width: 18 }}>{p.rank}.</span>
                      <span className="truncate flex-1" style={{ color: "#c8d8e8" }}>{p.descricao_produto}</span>
                      <span className="font-mono tabular-nums" style={{ color: "#FFFFFF", width: 44, textAlign: "right" }}>{p.pct}%</span>
                    </div>
                    <div style={{ height: 4, background: "var(--asb-card-hi)", borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
                      <div style={{ width: `${(p.pct / max) * 100}%`, height: "100%", background: "linear-gradient(90deg, #185FA5, #4f7df0)", boxShadow: "0 0 8px -1px #4f7df0" }} />
                    </div>
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

// ── (e) Mix por grupo de produto — BARRAS HORIZONTAIS (estilo Inteligência) ──
export function GruposSection({ meta, grupos }: { meta: MetaRow[]; grupos: GrupoRow[] }) {
  const grupoBy = groupBy(grupos);
  return (
    <div>
      <h2 style={{ ...h2Style, marginBottom: 4 }}>Mix por grupo de produto · 30d</h2>
      <p style={{ ...S.muted, marginBottom: 12 }}>Representatividade da cesta da recompra por família de produto · por vendedor</p>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...grupoBy.entries()].map(([rt, gs]) => {
          const nome = meta.find((m) => m.routing_team === rt)?.vendedor_nome ?? rt;
          const data = gs
            .slice()
            .sort((a, b) => b.valor_total - a.valor_total)
            .map((g) => ({ name: g.grupo_nome, value: Number(g.valor_total), pct: g.pct }));
          const h = Math.max(140, data.length * 30);
          return (
            <div key={rt} style={S.card} className="p-4">
              <div style={{ ...S.section, marginBottom: 8 }}>{nome}</div>
              <div style={{ height: h, filter: "drop-shadow(0 0 6px rgba(79,125,240,.25))" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`grupoBar-${rt}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#0d1a3a" />
                        <stop offset="100%" stopColor="#4f7df0" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
                    <XAxis type="number" tick={axisStyle} axisLine={{ stroke: GRID }} tickLine={false} hide />
                    <YAxis type="category" dataKey="name" width={96} tick={axisStyle} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} cursor={{ fill: "rgba(79,125,240,.08)" }} formatter={(v) => [brl(Number(v) || 0), "Valor 30d"]} />
                    <Bar dataKey="value" fill={`url(#grupoBar-${rt})`} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-1 space-y-1">
                {data.slice(0, 5).map((d) => (
                  <div key={d.name} className="flex items-center gap-2" style={{ fontSize: 11, fontFamily: theme.font.label }}>
                    <span className="flex-1 truncate" style={{ color: "#c8d8e8" }}>{d.name}</span>
                    <span style={{ color: "#c0d0e0", width: 36, textAlign: "right" }}>{d.pct}%</span>
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
