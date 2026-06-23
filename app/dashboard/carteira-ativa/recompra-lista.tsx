"use client";

import { useState } from "react";
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
  customer_status: string;
  customer_tier: string | null;
  total_orders: number;
  next_expected_order_at: string | null;
  bucket: string;
  dias_pra_proximo: number;
  cesta_qtd_produtos: number;
  cesta_valor_90d: number;
  cesta: CestaItem[];
};

const BUCKET: Record<string, { label: string; color: string }> = {
  atrasado: { label: "Atrasado", color: "#BA1717" },
  hoje: { label: "Hoje", color: "#D4A017" },
  proximos_3d: { label: "Próx. 3d", color: "#BA7517" },
  proximos_7d: { label: "Próx. 7d", color: "#185FA5" },
};
const ORDER = ["atrasado", "hoje", "proximos_3d", "proximos_7d"];

const brl = (n: number) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const num = (n: number) => (n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const dt = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");

export function RecompraLista({ rows }: { rows: RecompraRow[] }) {
  const [open, setOpen] = useState<Set<number>>(new Set());
  const toggle = (id: number) =>
    setOpen((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Agrupa por vendedor (carteira separada, nunca misturada) → 1 coluna por vendedor (kanban).
  const byVend = new Map<string, RecompraRow[]>();
  for (const r of rows) {
    const k = r.vendedor_nome ?? "Sem vendedor";
    if (!byVend.has(k)) byVend.set(k, []);
    byVend.get(k)!.push(r);
  }
  const vendedores = [...byVend.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Recompra Prevista</h1>
        <p className="text-sm text-gray-400 mt-1">
          {rows.length} clientes · carteira real ARES · cesta sugerida (média 90d, unidade nativa)
        </p>
      </div>

      {/* Kanban: 1 coluna por vendedor, responsivo (empilha no mobile) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vendedores.map(([vend, list]) => {
          // Ordena CADA carteira por urgência (bucket) e depois data esperada.
          const sorted = [...list].sort(
            (a, b) =>
              ORDER.indexOf(a.bucket) - ORDER.indexOf(b.bucket) ||
              (a.next_expected_order_at ?? "").localeCompare(b.next_expected_order_at ?? "")
          );
          return (
            <div key={vend} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4 flex flex-col">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2a2a2a]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white truncate">{vend}</h2>
                <span className="text-xs text-gray-500 ml-auto shrink-0">{sorted.length} clientes</span>
              </div>

              <div className="space-y-1.5 max-h-[75vh] overflow-y-auto pr-1">
                {sorted.map((r) => {
                  const b = BUCKET[r.bucket] ?? { label: r.bucket, color: "#556677" };
                  const isOpen = open.has(r.ares_pessoa_id);
                  return (
                    <div
                      key={r.ares_pessoa_id}
                      className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-md overflow-hidden"
                    >
                      <button
                        onClick={() => toggle(r.ares_pessoa_id)}
                        className="w-full flex items-center gap-2 p-3 text-xs text-left hover:bg-[#181818] transition-colors"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: b.color, boxShadow: `0 0 6px ${b.color}` }}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-white font-semibold truncate">
                            {r.name || `cliente ${r.ares_pessoa_id}`}
                          </span>
                          <span className="block text-gray-500 text-[10px] truncate">
                            {[r.city, `${r.cesta_qtd_produtos} prod · ${brl(r.cesta_valor_90d)}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="text-right shrink-0">
                          <span className="block font-bold text-[11px]" style={{ color: b.color }}>
                            {dt(r.next_expected_order_at)}
                          </span>
                          <span className="flex items-center gap-1 justify-end mt-0.5">
                            {r.customer_tier && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#193264] text-white">
                                {r.customer_tier}
                              </span>
                            )}
                            <span
                              className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded"
                              style={{ background: statusColor(r.customer_status), color: "#fff" }}
                            >
                              {statusLabel(r.customer_status)}
                            </span>
                            <span className="text-gray-500 text-[10px] w-3 text-center">{isOpen ? "−" : "+"}</span>
                          </span>
                        </span>
                      </button>

                      {isOpen && <CestaView cesta={r.cesta} pedidos={r.total_orders} />}
                    </div>
                  );
                })}
              </div>
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
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mt-1 mb-1">
        Sugestão de pedido — média por compra · {pedidos} pedidos/90d
      </div>
      {cesta.map((p) => (
        <div key={p.id_produto} className="flex items-baseline gap-2 text-xs">
          <span className="font-mono font-bold text-white whitespace-nowrap tabular-nums">
            {num(p.qtd_media)} {p.sigla ?? ""}
          </span>
          <span className="text-gray-300 truncate flex-1">{p.descricao}</span>
          <span className="text-gray-600 text-[10px] whitespace-nowrap">
            {p.pedidos}× · {brl(p.valor_total_90d)}
          </span>
        </div>
      ))}
    </div>
  );
}
