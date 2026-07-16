"use client";

import { useState } from "react";
import { theme } from "@/lib/theme";
import type { CSSProperties } from "react";
import { statusColor, statusLabel } from "@/lib/customer-status";

type CestaItem = {
  id_produto: number;
  descricao: string;
  sigla: string | null;
  qtd_media: number;
  qtd_total_90d: number;
  pedidos: number;
  ultimo_preco_un: number;
  valor_total_90d: number;
};

export type RecompraRow = {
  ares_pessoa_id: number;
  lead_id: string | null;
  name: string | null;
  city: string | null;
  vendedor_nome: string | null;
  routing_team: string | null;
  customer_status: string;
  customer_tier: string | null;
  total_orders: number;
  last_order_at: string | null;
  next_expected_order_at: string | null;
  days_since_last_order: number | null;
  proxima_data_meta: string | null;
  cesta_qtd_produtos: number;
  cesta_valor_90d: number;
  cesta: CestaItem[];
};

// Cards de vendedor com PRESENÇA (Paulo): elevados + glow tech, mesmo estilo p/ todos (sem cor por vendedor).
const cardPresenca: CSSProperties = {
  background: "#16161c", border: "1px solid #2a2a35", borderRadius: 10,
  boxShadow: "0 0 26px -10px rgba(79,125,240,.55), inset 0 1px 0 0 rgba(79,125,240,.10)",
};
const S = {
  card: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as CSSProperties,
  h1: { color: "var(--asb-page-ink)", fontSize: 20, fontWeight: 800, fontFamily: theme.font.label, letterSpacing: "-.01em", textTransform: "none" } as CSSProperties,
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#c0c8d8", fontFamily: theme.font.label } as CSSProperties,
  muted: { color: "#c0d0e0", fontSize: 10, fontFamily: theme.font.label } as CSSProperties,
};
const ORDER = ["atrasado", "hoje", "proximos_3d", "proximos_7d"];

const brl = (n: number) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number) => (n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export function RecompraLista({ rows }: { rows: RecompraRow[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set()); // cesta por cliente
  const [openVend, setOpenVend] = useState<Set<string>>(new Set()); // coluna por vendedor (fechado por padrão)
  const toggle = (id: number) =>
    setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleVend = (v: string) =>
    setOpenVend((p) => { const n = new Set(p); n.has(v) ? n.delete(v) : n.add(v); return n; });

  // Agrupa por vendedor (carteira separada) → 1 coluna colapsável por vendedor.
  const byVend = new Map<string, RecompraRow[]>();
  for (const r of rows) {
    const k = r.vendedor_nome ?? "Sem vendedor";
    if (!byVend.has(k)) byVend.set(k, []);
    byVend.get(k)!.push(r);
  }
  const vendedores = [...byVend.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-4">
      <h1 style={S.h1}>Clientes por vendedor</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vendedores.map(([vend, list]) => {
          const sorted = [...list].sort(
            (a, b) =>
              (a.customer_status === "ativo" ? 1 : 0) - (b.customer_status === "ativo" ? 1 : 0) ||
              (b.days_since_last_order ?? 0) - (a.days_since_last_order ?? 0)
          );
          const proxMeta = sorted[0]?.proxima_data_meta ?? null;
          const isVendOpen = openVend.has(vend);
          return (
            <div key={vend} style={{ ...cardPresenca }} className="p-5 flex flex-col">
              {/* Header colapsável (presença tech) */}
              <button
                onClick={() => toggleVend(vend)}
                className="w-full flex items-center gap-3 text-left"
                style={{ paddingBottom: isVendOpen ? 10 : 0, borderBottom: isVendOpen ? "1px solid #2a2a35" : "none", marginBottom: isVendOpen ? 12 : 0 }}
              >
                <span
                  style={{
                    width: 22, height: 22, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 6, background: "#0c0c12", border: "1px solid #2a2a35", color: "#4f7df0",
                    fontSize: 14, fontWeight: 700, boxShadow: "0 0 8px -2px #4f7df0",
                  }}
                  aria-hidden
                >
                  {isVendOpen ? "−" : "+"}
                </span>
                <span style={{ ...S.section, fontSize: 11, color: "#FFFFFF" }}>{vend}</span>
                <span style={{ ...S.muted, marginLeft: "auto" }}>
                  {proxMeta ? `próx meta ${dt(proxMeta)} · ` : ""}
                  {sorted.length} clientes
                </span>
              </button>

              {/* Lista (só quando aberto) */}
              {isVendOpen && (
                <div className="space-y-1.5">
                  {sorted.map((r) => {
                    const isOpen = open.has(r.ares_pessoa_id);
                    const col = statusColor(r.customer_status);
                    return (
                      <div key={r.ares_pessoa_id} style={{ background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 6 }} className="overflow-hidden">
                        <button
                          onClick={() => toggle(r.ares_pessoa_id)}
                          className="w-full flex items-center gap-2 p-3 text-left hover:bg-[#181818] transition-colors"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col, boxShadow: `0 0 6px ${col}` }} />
                          <span className="flex-1 min-w-0">
                            <span className="block truncate" style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 600 }}>
                              {r.name || `cliente ${r.ares_pessoa_id}`}
                            </span>
                            <span className="block truncate" style={S.muted}>
                              {[
                                r.city,
                                r.days_since_last_order != null ? `${r.days_since_last_order}d s/ comprar` : null,
                                `${r.cesta_qtd_produtos} prod · ${brl(r.cesta_valor_90d)}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <span className="text-right shrink-0 flex items-center gap-1">
                            {r.customer_tier && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "#193264", color: "#fff" }}>
                                {r.customer_tier}
                              </span>
                            )}
                            <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", padding: "2px 6px", borderRadius: 3, background: col, color: "#fff" }}>
                              {statusLabel(r.customer_status)}
                            </span>
                            <span style={{ ...S.muted, width: 12, textAlign: "center" }}>{isOpen ? "−" : "+"}</span>
                          </span>
                        </button>

                        {isOpen && <CestaView cesta={r.cesta} pedidos={r.total_orders} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CestaView({ cesta, pedidos }: { cesta: CestaItem[]; pedidos: number }) {
  if (!cesta?.length)
    return <div className="px-3 pb-3 text-[11px] text-gray-600 italic">Sem cesta nos últimos 90d.</div>;
  return (
    <div className="px-3 pb-3 pt-1 border-t border-[#2a2a2a] space-y-1">
      <div className="text-[10px] text-slate-200 uppercase tracking-wider mt-1 mb-1" style={{ fontFamily: theme.font.label }}>
        Sugestão de pedido — média por compra · {pedidos} pedidos/90d
      </div>
      {cesta.map((p) => (
        <div key={p.id_produto} className="flex items-baseline gap-2 text-xs">
          <span className="font-mono font-bold text-white whitespace-nowrap tabular-nums">
            {num(p.qtd_media)} {p.sigla ?? ""}
          </span>
          <span className="text-slate-200 truncate flex-1">{p.descricao}</span>
          <span className="text-gray-600 text-[10px] whitespace-nowrap">
            {p.pedidos}× · {brl(p.valor_total_90d)}
          </span>
        </div>
      ))}
    </div>
  );
}
