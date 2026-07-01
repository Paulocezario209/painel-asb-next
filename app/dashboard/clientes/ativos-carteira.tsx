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

// Detalhe de cada cliente recuperado (v_clientes_recuperados + cidade da v_carteira_360).
export type RecuperadoDetalhe = {
  ares_cliente_id: number;
  cliente_nome: string | null;
  cidade: string | null;
  vendedor_routing_team: string | null;
  data_retorno: string;
  gap_dias: number;
  valor_retorno: number | null;
};

// default = carteira VIVA (ativo/atencao); a tab COMPLETA passa os 7 (6 + sem_movimentacao).
const LIVE_STATUS: readonly string[] = ["ativo", "atencao"];

// routing_team → nome do vendedor (agrupa a lista de recuperados).
const RT_NOME: Record<string, string> = {
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula",
  SETOR_CAMPINAS_JUNDIAI: "Alan",
  SETOR_CUIT: "Fernando",
};

const brl = (n: number | null) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDia = (d: string) => {
  const p = d.slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : d;
};

// rows = universo COMPLETO da tab (todos os statusKeys); filtro de status + busca = client-side.
export function AtivosCarteira({
  rows,
  healthFilter,
  tab = "ativos",
  statusKeys = LIVE_STATUS,
  recuperadosCount,
  recuperadosMes,
  recuperadosDetalhe,
}: {
  rows: Carteira[];
  healthFilter: string;
  tab?: string;
  statusKeys?: readonly string[];
  recuperadosCount?: number;
  recuperadosMes?: string;
  recuperadosDetalhe?: RecuperadoDetalhe[];
}) {
  const [q, setQ] = useState("");
  // FIX 1: filtro é estado LOCAL (client-side). Clicar NÃO navega nem mexe no ?mes= da URL.
  const [filter, setFilter] = useState(healthFilter && healthFilter !== "all" ? healthFilter : "all");
  const termo = q.trim().toLowerCase();
  const isRec = filter === "recuperados";

  // contagem por status (universo completo) → KPI-cards.
  const counts = new Map<string, number>();
  for (const c of rows) counts.set(c.customer_status, (counts.get(c.customer_status) ?? 0) + 1);

  const KPIS = [
    { key: "all", label: "Todos", color: "#185FA5", desc: "toda a carteira", count: rows.length },
    ...statusKeys.map((k) => ({
      key: k,
      label: CUSTOMER_STATUS[k]?.label ?? k,
      color: CUSTOMER_STATUS[k]?.color ?? "#e4e9f0",
      desc: CUSTOMER_STATUS[k]?.desc ?? "",
      count: counts.get(k) ?? 0,
    })),
  ];

  // Lista padrão por status (só quando NÃO é recuperados).
  const statusBase =
    filter && filter !== "all" && !isRec ? rows.filter((c) => c.customer_status === filter) : rows;
  const filtradas = termo
    ? statusBase.filter(
        (c) => (c.name ?? "").toLowerCase().includes(termo) || (c.city ?? "").toLowerCase().includes(termo)
      )
    : statusBase;

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

  // FIX 2: RECUPERADOS agrupado por vendedor (routing_team → nome), com dados de retorno.
  const recFiltrados = (recuperadosDetalhe ?? []).filter(
    (r) =>
      !termo ||
      (r.cliente_nome ?? "").toLowerCase().includes(termo) ||
      (r.cidade ?? "").toLowerCase().includes(termo)
  );
  const recByVend = new Map<string, RecuperadoDetalhe[]>();
  for (const r of recFiltrados) {
    const nome = RT_NOME[r.vendedor_routing_team ?? ""] ?? (r.vendedor_routing_team ?? "Sem vendedor");
    if (!recByVend.has(nome)) recByVend.set(nome, []);
    recByVend.get(nome)!.push(r);
  }
  const gruposRec = [...recByVend.entries()]
    .map(([nome, list]) => ({ nome, list }))
    .sort((a, b) => b.list.length - a.list.length);

  const kpiClass = "bg-[#16161c] border rounded-lg p-4 transition-all block w-full text-left";

  return (
    <div className="space-y-4">
      {/* KPIs por status (client-side, sem navegação) — clicáveis p/ filtrar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPIS.map((k) => {
          const active = (filter || "all") === k.key;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => setFilter(filter === k.key ? "all" : k.key)}
              className={kpiClass}
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
              <div className="text-[10px] text-slate-200 mt-2 leading-tight truncate">{k.desc}</div>
            </button>
          );
        })}
        {recuperadosCount != null && (
          <button
            type="button"
            onClick={() => setFilter(isRec ? "all" : "recuperados")}
            className={kpiClass}
            style={{
              borderColor: isRec ? "#f97316" : "#2a2a35",
              borderTop: "3px solid #f97316",
              boxShadow: isRec ? "0 0 28px -6px #f97316" : "0 0 24px -8px rgba(79,125,240,0.45)",
            }}
          >
            <div className="text-[10px] uppercase tracking-wider font-bold truncate" style={{ color: "#f97316" }}>
              Recuperados{recuperadosMes ? ` · ${recuperadosMes}` : ""}
            </div>
            <div className="text-3xl font-bold text-white mt-2">{recuperadosCount}</div>
            <div className="text-[10px] text-slate-200 mt-2 leading-tight truncate">voltaram após 60+ dias fora</div>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-200">
          {isRec
            ? `${recFiltrados.length} recuperados${recuperadosMes ? ` em ${recuperadosMes}` : ""}`
            : `${filtradas.length} de ${rows.length} clientes · ${brl(totalReceita)} faturado`}
        </p>
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome ou cidade…"
        className="w-full bg-[#0f0f0f] border border-[#2a2a35] focus:border-[#4f7df0] rounded-md px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
      />

      {isRec ? (
        gruposRec.length === 0 ? (
          <div className="bg-[#16161c] border border-[#2a2a35] rounded-lg p-8 text-center text-sm text-slate-400">
            Nenhum cliente recuperado em {recuperadosMes ?? "—"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {gruposRec.map((g) => (
              <div key={g.nome} className="bg-[#16161c] border border-[#2a2a35] rounded-lg p-4 shadow-[0_0_26px_-10px_rgba(79,125,240,0.55)]">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2a2a]">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-white truncate">{g.nome}</h2>
                  <span className="text-xs text-slate-200 font-semibold shrink-0 ml-2">{g.list.length}</span>
                </div>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {g.list.map((r) => (
                    <div
                      key={r.ares_cliente_id}
                      className="bg-[#0f0f0f] border border-[#2a2a35] rounded-md p-3 shadow-[0_0_12px_-9px_rgba(79,125,240,0.6)]"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="text-sm font-semibold text-white truncate flex-1">
                          {r.cliente_nome || `cliente ${r.ares_cliente_id}`}
                        </div>
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "#f97316", color: "#0a0a0a" }}
                        >
                          gap {r.gap_dias}d
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-200 truncate">
                        {[r.cidade, `voltou ${fmtDia(r.data_retorno)}`].filter(Boolean).join(" · ")}
                      </div>
                      <div className="text-[10px] text-slate-200 mt-1">{brl(r.valor_retorno)} no retorno</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Colunas por vendedor, receita DESC dentro de cada */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {colunas.map((col) => (
            <div key={col.nome} className="bg-[#16161c] border border-[#2a2a35] rounded-lg p-4 shadow-[0_0_26px_-10px_rgba(79,125,240,0.55)]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2a2a]">
                <h2 className="text-xs font-bold uppercase tracking-wider text-white truncate">{col.nome}</h2>
                <span className="text-xs text-slate-200 font-semibold shrink-0 ml-2">{col.list.length}</span>
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
                        <div className="text-[11px] text-slate-200 truncate">
                          {[c.city, c.dias_sem_compra != null ? `${c.dias_sem_compra}d s/ comprar` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                        <div className="text-[10px] text-slate-200 mt-1">{brl(c.total_revenue_brl)} faturado</div>
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
      )}
    </div>
  );
}
