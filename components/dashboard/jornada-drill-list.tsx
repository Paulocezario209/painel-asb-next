"use client";

// components/dashboard/jornada-drill-list.tsx — lista detalhada de um estágio da Jornada.
// Resumo por cliente (sem pedido-a-pedido — isso fica no Dossiê), com ORDENAÇÕES client-side.
// Cada linha abre o Dossiê do cliente (/dashboard/jornada/cliente/[ares_id]).

import { useState, useMemo } from "react";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { statusLabel, statusColor } from "@/lib/customer-status";
import type { ScoreFaixa } from "@/lib/funnel/jornada-metrics";

export interface DrillRow {
  ares_pessoa_id: number;
  name: string | null;
  city: string | null;
  uf: string | null;
  vendedor_nome: string | null;
  customer_status: string | null;
  total_orders: number;
  total_revenue_brl: number;
  avg_ticket_brl: number;
  last_order_at: string | null;
  dias_sem_compra: number | null;
  avg_interval_dias: number | null;
  score: number;
  faixa: ScoreFaixa;
  motivo: string | null;
  viva: boolean;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDia = (d: string | null) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");

const FAIXA: Record<ScoreFaixa, { cor: string; label: string }> = {
  verde: { cor: "#22c55e", label: "no prazo" },
  amarelo: { cor: "#eab308", label: "atenção" },
  laranja: { cor: "#f59e0b", label: "alto risco" },
  vermelho: { cor: "#ef4444", label: "crítico" },
};

type SortKey = "faturamento" | "ticket" | "dias" | "maior_intervalo" | "menor_intervalo" | "score" | "vendedor" | "cidade";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "faturamento", label: "Faturamento" },
  { key: "score", label: "Score (maior)" },
  { key: "dias", label: "Dias desde último" },
  { key: "ticket", label: "Ticket médio" },
  { key: "maior_intervalo", label: "Maior intervalo" },
  { key: "menor_intervalo", label: "Menor intervalo" },
  { key: "vendedor", label: "Vendedor" },
  { key: "cidade", label: "Cidade" },
];

export function JornadaDrillList({ rows, view }: { rows: DrillRow[]; view: string }) {
  const [sort, setSort] = useState<SortKey>("faturamento");
  const sorted = useMemo(() => {
    const r = [...rows];
    const num = (v: number | null) => v ?? -1;
    switch (sort) {
      case "faturamento": r.sort((a, b) => b.total_revenue_brl - a.total_revenue_brl); break;
      case "ticket": r.sort((a, b) => b.avg_ticket_brl - a.avg_ticket_brl); break;
      case "dias": r.sort((a, b) => num(b.dias_sem_compra) - num(a.dias_sem_compra)); break;
      case "maior_intervalo": r.sort((a, b) => num(b.avg_interval_dias) - num(a.avg_interval_dias)); break;
      case "menor_intervalo": r.sort((a, b) => num(a.avg_interval_dias) - num(b.avg_interval_dias)); break;
      case "score": r.sort((a, b) => b.score - a.score); break;
      case "vendedor": r.sort((a, b) => (a.vendedor_nome ?? "").localeCompare(b.vendedor_nome ?? "")); break;
      case "cidade": r.sort((a, b) => (a.city ?? "").localeCompare(b.city ?? "")); break;
    }
    return r;
  }, [rows, sort]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#83879a", fontFamily: theme.font.label }}>Ordenar por</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
          style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 6, color: "#e4e9f0", fontSize: 12, fontFamily: theme.font.label, padding: "5px 9px", outline: "none", cursor: "pointer" }}>
          {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <span style={{ fontSize: 11.5, color: "#83879a", fontFamily: theme.font.label }}>{sorted.length} clientes</span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: theme.font.label, minWidth: 880 }}>
          <thead>
            <tr style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7280" }}>
              {["Cliente", "Vendedor", "Cidade", "Pedidos", "Faturado", "Ticket", "Últ. pedido", "Dias", "Score", "Situação", "Motivo"].map((h) => (
                <th key={h} style={{ textAlign: h === "Cliente" || h === "Vendedor" || h === "Cidade" || h === "Motivo" ? "left" : "right", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,.1)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const f = FAIXA[c.faixa];
              return (
                <tr key={c.ares_pessoa_id} style={{ fontSize: 11.5, color: "#c8d2e6", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                  <td style={{ padding: "7px 8px", maxWidth: 220 }}>
                    <Link href={`/dashboard/jornada/cliente/${c.ares_pessoa_id}?view=${view}`} style={{ color: "#fff", fontWeight: 600, textDecoration: "none" }}>
                      {c.name || `cliente ${c.ares_pessoa_id}`}
                    </Link>
                    <div style={{ fontSize: 9, color: "#6b7280", fontFamily: theme.font.num }}>ID ARES {c.ares_pessoa_id}</div>
                  </td>
                  <td style={{ padding: "7px 8px" }}>{c.vendedor_nome ?? "—"}</td>
                  <td style={{ padding: "7px 8px" }}>{[c.city, c.uf].filter(Boolean).join("/") || "—"}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: theme.font.num }}>{c.total_orders}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: theme.font.num }}>{brl(c.total_revenue_brl)}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: theme.font.num }}>{brl(c.avg_ticket_brl)}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: theme.font.num }}>{fmtDia(c.last_order_at)}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: theme.font.num }}>{c.dias_sem_compra ?? "—"}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right" }}>
                    <span title={f.label} style={{ display: "inline-flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: f.cor, display: "inline-block" }} />
                      <b style={{ color: f.cor, fontFamily: theme.font.num }}>{c.score}</b>
                    </span>
                  </td>
                  <td style={{ padding: "7px 8px", textAlign: "right" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", padding: "2px 6px", borderRadius: 999, background: statusColor(c.customer_status), color: "#fff", whiteSpace: "nowrap" }}>{statusLabel(c.customer_status)}</span>
                  </td>
                  <td style={{ padding: "7px 8px", color: c.motivo ? "#c8d2e6" : "#6b7280", fontStyle: c.motivo ? "normal" : "italic" }}>{c.motivo ?? "Motivo não identificado"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
