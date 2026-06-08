"use client";
import { useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type Pedido = { cliente_nome: string; valor_total_brl: number; valor_faturado_brl?: number; status_pedido?: string };
type CnbVenda = { cliente_nome: string; valor_total_brl: number; numero: string; forma_pagamento: string | null };
type Ausente = { cliente_nome: string; ultima_compra: string; dias_ausente: number };

type Props = {
  dia: string;
  vendorLabel: string;
  pedidos: Pedido[];
  cnb: CnbVenda[];
  ausentes: Ausente[];
  meta: number;
  realizado: number;
  faturado: number;
  onClose: () => void;
};

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

const S = {
  overlay: { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "#0f1117", border: "1px solid #2a2a2a", borderRadius: 8, width: "100%", maxWidth: 860, maxHeight: "90vh", overflowY: "auto" as const, padding: 24, display: "flex", flexDirection: "column" as const, gap: 20 },
  title: { fontSize: 13, fontWeight: 700, color: "#c0c8d8", fontFamily: "'Courier New', monospace", textTransform: "uppercase" as const, letterSpacing: ".1em" },
  section: { display: "flex", flexDirection: "column" as const, gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: "#556677", fontFamily: "'Courier New', monospace", textTransform: "uppercase" as const, letterSpacing: ".08em", borderBottom: "1px solid #1e2a35", paddingBottom: 4 },
  kpiRow: { display: "flex", gap: 12, flexWrap: "wrap" as const },
  kpi: { flex: 1, minWidth: 120, background: "#1a1a2e", border: "1px solid #2a2a2a", borderRadius: 6, padding: "10px 14px" },
  kpiLabel: { fontSize: 10, color: "#556677", fontFamily: "'Courier New', monospace", textTransform: "uppercase" as const },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 12 },
  th: { textAlign: "left" as const, padding: "6px 8px", color: "#556677", fontFamily: "'Courier New', monospace", fontSize: 10, borderBottom: "1px solid #1e2a35" },
  td: { padding: "6px 8px", color: "#c0c8d8", borderBottom: "1px solid #111" },
  tdVal: { padding: "6px 8px", color: "#22c55e", textAlign: "right" as const, fontFamily: "'Courier New', monospace", borderBottom: "1px solid #111" },
  badge: { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700 },
};

export default function GerenteDayModal({ dia, vendorLabel, pedidos, cnb, ausentes, meta, realizado, faturado, onClose }: Props) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const validos = pedidos.filter(p => p.status_pedido !== "cancelado");
  const cnbTotal = cnb.reduce((s, r) => s + Number(r.valor_total_brl), 0);
  const aresTotal = faturado;
  const pctMeta = meta > 0 ? Math.round((realizado / meta) * 100) : 0;
  const pctAres = realizado > 0 ? Math.round((aresTotal / realizado) * 100) : 0;
  const pctCnb = realizado > 0 ? Math.round((cnbTotal / realizado) * 100) : 0;
  const saldo = realizado - meta;

  const pieData = [
    { name: "ASB", value: aresTotal, color: "#185FA5" },
    { name: "CNB", value: cnbTotal, color: "#D85A30" },
  ].filter(d => d.value > 0);

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={S.title}>{fmtDate(dia)}</p>
            <p style={{ fontSize: 11, color: "#556677", marginTop: 2 }}>{vendorLabel}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#556677", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        {/* KPIs */}
        <div style={S.section}>
          <p style={S.sectionTitle}>Resumo do dia</p>
          <div style={S.kpiRow}>
            {[
              { label: "Meta", value: fmtBRL(meta), color: "#ff7b1c" },
              { label: "Realizado", value: fmtBRL(realizado), color: pctMeta >= 100 ? "#22c55e" : "#D4A017" },
              { label: "↳ ASB", value: fmtBRL(aresTotal), color: "#185FA5" },
              { label: "↳ CNB", value: fmtBRL(cnbTotal), color: "#D85A30" },
              { label: "% Meta", value: `${pctMeta}%`, color: pctMeta >= 100 ? "#22c55e" : "#C8102E" },
              { label: "Saldo", value: (saldo >= 0 ? "+" : "") + fmtBRL(saldo), color: saldo >= 0 ? "#22c55e" : "#C8102E" },
            ].map(k => (
              <div key={k.label} style={S.kpi}>
                <p style={S.kpiLabel}>{k.label}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: k.color, fontFamily: "'Courier New', monospace", marginTop: 4 }}>{k.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pizza */}
        {pieData.length > 0 && (
          <div style={S.section}>
            <p style={S.sectionTitle}>ASB vs CNB — % do realizado</p>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" as const }}>
              <div style={{ width: 200, height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65} label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                      {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => fmtBRL(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                <div><span style={{ ...S.badge, background: "#185FA520", color: "#185FA5" }}>ASB</span> <span style={{ color: "#c0c8d8", fontSize: 13 }}>{fmtBRL(aresTotal)} ({pctAres}% da meta)</span></div>
                <div><span style={{ ...S.badge, background: "#D85A3020", color: "#D85A30" }}>CNB</span> <span style={{ color: "#c0c8d8", fontSize: 13 }}>{fmtBRL(cnbTotal)} ({pctCnb}% da meta)</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Pedidos ARES */}
        {validos.length > 0 && (
          <div style={S.section}>
            <p style={S.sectionTitle}>Pedidos ASB ({validos.length})</p>
            <table style={S.table}>
              <thead><tr><th style={S.th}>Cliente</th><th style={{ ...S.th, textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {validos.map((p, i) => (
                  <tr key={i}>
                    <td style={S.td}>{p.cliente_nome}</td>
                    <td style={S.tdVal}>{fmtBRL(Number(p.valor_faturado_brl ?? p.valor_total_brl))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Vendas CNB */}
        {cnb.length > 0 && (
          <div style={S.section}>
            <p style={S.sectionTitle}>Vendas CNB ({cnb.length})</p>
            <table style={S.table}>
              <thead><tr><th style={S.th}>Cliente</th><th style={S.th}>Cupom</th><th style={{ ...S.th, textAlign: "right" }}>Valor</th></tr></thead>
              <tbody>
                {cnb.map((c, i) => (
                  <tr key={i}>
                    <td style={S.td}>{c.cliente_nome}</td>
                    <td style={{ ...S.td, color: "#556677" }}>{c.numero}</td>
                    <td style={S.tdVal}>{fmtBRL(Number(c.valor_total_brl))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Ausentes */}
        {ausentes.length > 0 && (
          <div style={S.section}>
            <p style={S.sectionTitle}>Recorrentes ausentes neste dia ({ausentes.length})</p>
            <table style={S.table}>
              <thead><tr><th style={S.th}>Cliente</th><th style={S.th}>Última compra</th><th style={{ ...S.th, textAlign: "right" }}>Dias ausente</th></tr></thead>
              <tbody>
                {ausentes.map((a, i) => (
                  <tr key={i}>
                    <td style={S.td}>{a.cliente_nome}</td>
                    <td style={{ ...S.td, color: "#556677" }}>{new Date(a.ultima_compra + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                    <td style={{ ...S.tdVal, color: a.dias_ausente > 14 ? "#C8102E" : "#D4A017" }}>{a.dias_ausente}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
