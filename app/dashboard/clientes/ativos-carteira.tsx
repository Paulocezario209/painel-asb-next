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

// default = carteira VIVA (ativo/atencao); a tab COMPLETA passa os 7 (6 + sem_movimentacao).
const LIVE_STATUS: readonly string[] = ["ativo", "atencao"];

const brl = (n: number | null) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// rows = universo COMPLETO da tab (todos os statusKeys); filtro de status + busca = client-side.
// statusKeys parametriza: ATIVOS (2) e COMPLETA (7). KPIs no topo no MESMO padrão de CHURN/UP-SELL.
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
  const [q, setQ] = useState("");
  const termo = q.trim().toLowerCase();

  // contagem por status (sobre o universo completo) — alimenta os KPI-cards do topo.
  const counts = new Map<string, number>();
  for (const c of rows) counts.set(c.customer_status, (counts.get(c.customer_status) ?? 0) + 1);

  // KPI-cards: "Todos" + um por status (count + cor + clicável p/ filtrar via ?health=).
  const KPIS = [
    { key: "all", label: "Todos", color: "#185FA5", desc: "toda a carteira", count: rows.length },
    ...statusKeys.map((k) => ({
      key: k,
      label: CUSTOMER_STATUS[k]?.label ?? k,
      color: CUSTOMER_STATUS[k]?.color ?? "#556677",
      desc: CUSTOMER_STATUS[k]?.desc ?? "",
      count: counts.get(k) ?? 0,
    })),
  ];

  // filtro de status (client-side) → depois a busca por nome/cidade.
  const statusBase =
    healthFilter && healthFilter !== "all" ? rows.filter((c) => c.customer_status === healthFilter) : rows;
  const filtradas = termo
    ? statusBase.filter(
        (c) => (c.name ?? "").toLowerCase().includes(termo) || (c.city ?? "").toLowerCase().includes(termo)
      )
    : statusBase;

  // Ordem de colunas ESTÁVEL = receita do status base (não muda durante a busca).
  const revTotal = new Map<string, number>();
  for (const c of statusBase) {
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
      {/* KPIs por status (mesmo padrão de CHURN/UP-SELL) — clicáveis p/ filtrar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPIS.map((k) => {
          const active = (healthFilter || "all") === k.key;
          return (
            <Link
              key={k.key}
              href={`/dashboard/clientes?tab=${tab}&health=${k.key}`}
              className="bg-[#16161c] border rounded-lg p-4 transition-all block"
              style={{
                borderColor: active ? k.color : "#2a2a35",
                borderTop: `3px solid ${k.color}`,
                boxShadow: active ? `0 0 28px -6px ${k.color}` : "0 0 24px -8px rgba(79,125,240,0.45)",
              }}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold truncate" style={{ color: k.color }}>
                {k.label}
              </div>
              <div className="text-3xl font-bold text-white mt-2">{k.count}</div>
              <div className="text-[10px] text-gray-500 mt-2 leading-tight truncate">{k.desc}</div>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-400">
          {filtradas.length} de {rows.length} clientes · {brl(totalReceita)} faturado
        </p>
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome ou cidade…"
        className="w-full bg-[#0f0f0f] border border-[#2a2a35] focus:border-[#4f7df0] rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
      />

      {/* Colunas por vendedor, receita DESC dentro de cada */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {colunas.map((col) => (
          <div key={col.nome} className="bg-[#16161c] border border-[#2a2a35] rounded-lg p-4 shadow-[0_0_26px_-10px_rgba(79,125,240,0.55)]">
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
                    <div className="bg-[#0f0f0f] border border-[#2a2a35] hover:border-[#4f7df0] rounded-md p-3 transition-all shadow-[0_0_12px_-9px_rgba(79,125,240,0.6)]">
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
                            style={{ background: statusColor(c.customer_status), color: "#fff", boxShadow: `0 0 8px -2px ${statusColor(c.customer_status)}` }}
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
