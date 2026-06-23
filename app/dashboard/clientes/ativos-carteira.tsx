"use client";

import { useState } from "react";
import Link from "next/link";
import { CUSTOMER_STATUS, statusColor, statusLabel } from "@/lib/customer-status";

export type Carteira = {
  ares_pessoa_id: number;
  lead_id: string | null;
  name: string | null;
  city: string | null;
  vendedor_nome: string | null;
  customer_status: string;
  customer_tier: string | null;
  dias_sem_compra: number | null;
  total_revenue_brl: number | null;
  total_orders: number | null;
};

// chips: default = carteira VIVA (ativo/atencao); a tab COMPLETA passa os 6 status.
const LIVE_STATUS: readonly string[] = ["ativo", "atencao"];

const brl = (n: number | null) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// rows já vêm filtradas pelo chip (server) e ordenadas por receita DESC.
// tab/statusKeys parametrizam o reuso: ATIVOS (2 status) e COMPLETA (6 status).
export function AtivosCarteira({
  rows,
  healthFilter,
  tab = "ativos",
  statusKeys = LIVE_STATUS,
}: {
  rows: Carteira[];
  healthFilter: string;
  tab?: string;
  statusKeys?: readonly string[];
}) {
  const STATUS_OPTIONS: { key: string; label: string }[] = [
    { key: "all", label: "Todos" },
    ...statusKeys.map((k) => ({ key: k, label: CUSTOMER_STATUS[k]?.label ?? k })),
  ];
  const [q, setQ] = useState("");
  const termo = q.trim().toLowerCase();

  // Busca 100% client-side (zero chamada nova): casa por name OU city, case-insensitive.
  const filtradas = termo
    ? rows.filter(
        (c) => (c.name ?? "").toLowerCase().includes(termo) || (c.city ?? "").toLowerCase().includes(termo)
      )
    : rows;

  // Ordem de colunas ESTÁVEL = receita da carteira completa (não muda durante a busca).
  const revTotal = new Map<string, number>();
  for (const c of rows) {
    const k = c.vendedor_nome ?? "Sem vendedor";
    revTotal.set(k, (revTotal.get(k) ?? 0) + (c.total_revenue_brl ?? 0));
  }
  const byVendedor = new Map<string, Carteira[]>();
  for (const c of filtradas) {
    const k = c.vendedor_nome ?? "Sem vendedor";
    if (!byVendedor.has(k)) byVendedor.set(k, []);
    byVendedor.get(k)!.push(c);
  }
  const colunas = [...revTotal.keys()]
    .sort((a, b) => (revTotal.get(b) ?? 0) - (revTotal.get(a) ?? 0))
    .map((nome) => ({ nome, list: byVendedor.get(nome) ?? [] }));

  const totalReceita = filtradas.reduce((s, c) => s + (c.total_revenue_brl ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-400">
          {filtradas.length} de {rows.length} clientes ativos · {brl(totalReceita)} faturado
        </p>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => {
            const active = healthFilter === opt.key;
            return (
              <Link
                key={opt.key}
                href={`/dashboard/clientes?tab=${tab}&health=${opt.key}`}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                  active
                    ? "bg-[#193264] text-white"
                    : "bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome ou cidade…"
        className="w-full bg-[#0f0f0f] border border-[#2a2a2a] focus:border-[#185FA5] rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
      />

      {/* Colunas por vendedor (carteira viva), receita DESC dentro de cada */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {colunas.map((col) => (
          <div key={col.nome} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2a2a]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white truncate">{col.nome}</h2>
              <span className="text-xs text-gray-500 font-semibold shrink-0 ml-2">{col.list.length}</span>
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {col.list.length === 0 ? (
                <div className="text-[11px] text-gray-600 italic py-2 text-center">—</div>
              ) : (
                col.list.map((c) => {
                  const card = (
                    <div className="bg-[#0f0f0f] border border-[#2a2a2a] hover:border-[#185FA5] rounded-md p-3 transition-all">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="text-sm font-semibold text-white truncate flex-1">
                          {c.name || `cliente ${c.ares_pessoa_id}`}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {c.customer_tier && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#193264] text-white">
                              {c.customer_tier}
                            </span>
                          )}
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                            style={{ background: statusColor(c.customer_status), color: "#fff" }}
                          >
                            {statusLabel(c.customer_status)}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {[c.city, c.dias_sem_compra != null ? `${c.dias_sem_compra}d s/ comprar` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">{brl(c.total_revenue_brl)} faturado</div>
                    </div>
                  );
                  return c.lead_id ? (
                    <Link key={c.ares_pessoa_id} href={`/dashboard/cliente/${c.lead_id}`} className="block">
                      {card}
                    </Link>
                  ) : (
                    <div key={c.ares_pessoa_id}>{card}</div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
