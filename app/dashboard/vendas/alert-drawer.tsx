"use client";

import { useEffect } from "react";
import { theme } from "@/lib/theme";

// ─────────────────────────────────────────────────────────────────────────────
// AlertDrawer — drawer lateral reutilizável (drill-down dos cards de alerta).
// Overlay + ESC + tokens ASB inline (padrão herdado do antigo day-detail-modal, removido na DEBT-231);
// não introduz lib nova. Decisão pontual Paulo 2026-05-27 ("lista leve, preserva
// contexto") — não altera o princípio P2 de asb-dashboard.
// ─────────────────────────────────────────────────────────────────────────────

export type DrawerColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render?: (row: T) => React.ReactNode;
};

const VENDOR_NAMES: Record<string, string> = {
  SETOR_CUIT: "SETOR CUIT",
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula",
  SETOR_CAMPINAS_JUNDIAI: "Alan",
};
export function vName(t: string | null | undefined): string {
  if (!t) return "—";
  return VENDOR_NAMES[t] ?? t;
}

export function fmtBRL(v: number | null | undefined): string {
  return Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// ── Tipos das linhas (preenchidas pelas server actions na Etapa 2) ───────────
export type PedidoAtrasadoRow = {
  n_pedido: string | null;
  cliente_nome: string | null;
  valor_total_brl: number | null;
  data_meta: string | null;
  dias_atraso: number;
};

export type ClienteDormenteRow = {
  cliente_nome: string | null;
  last_order_date: string | null;
  days_since_last: number | null;
  avg_interval_days: number | null;
  vendedor_routing_team: string | null;
  churn_state: string | null;
};

// ── Configs de coluna (decisões de layout do Paulo) ──────────────────────────
export const PEDIDOS_ATRASADOS_COLUMNS: DrawerColumn<PedidoAtrasadoRow>[] = [
  { key: "n_pedido", label: "Nº Pedido", render: (r) => <span style={{ color: "#c0d0e0" }}>#{r.n_pedido ?? "—"}</span> },
  { key: "cliente_nome", label: "Cliente", render: (r) => r.cliente_nome ?? "—" },
  { key: "valor_total_brl", label: "Valor", align: "right", render: (r) => fmtBRL(r.valor_total_brl) },
  { key: "dias_atraso", label: "Dias atrasado", align: "right",
    render: (r) => <span style={{ color: r.dias_atraso > 7 ? "#f85149" : "#c8d8e8", fontWeight: 700 }}>{r.dias_atraso}d</span> },
  { key: "data_meta", label: "Data", render: (r) => fmtDate(r.data_meta) },
];

const CHURN_COLOR: Record<string, string> = {
  churn_warning: "#D4A017",
  churn_at_risk: "#BA7517",
  churn: "#C8102E",
};
export const CLIENTES_DORMENTES_COLUMNS: DrawerColumn<ClienteDormenteRow>[] = [
  { key: "cliente_nome", label: "Cliente", render: (r) => r.cliente_nome ?? "—" },
  { key: "last_order_date", label: "Última compra", render: (r) => fmtDate(r.last_order_date) },
  { key: "days_since_last", label: "Dias dormindo", align: "right",
    render: (r) => <span style={{ color: CHURN_COLOR[r.churn_state ?? ""] ?? "#c8d8e8", fontWeight: 700 }}>{r.days_since_last ?? "—"}d</span> },
  { key: "avg_interval_days", label: "Recorrência", align: "right",
    render: (r) => (r.avg_interval_days ? `a cada ${Math.round(Number(r.avg_interval_days))}d` : "—") },
  { key: "vendedor_routing_team", label: "Vendedor", render: (r) => vName(r.vendedor_routing_team) },
];

// ── Componente ───────────────────────────────────────────────────────────────
export function AlertDrawer<T extends Record<string, unknown>>({
  title,
  subtitle,
  columns,
  rows,
  onClose,
}: {
  title: string;
  subtitle?: string;
  columns: DrawerColumn<T>[];
  rows: T[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 60, display: "flex", justifyContent: "flex-end" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(620px, 94vw)", height: "100%", background: "var(--asb-card)", borderLeft: "1px solid var(--asb-border)", padding: "20px 22px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.label, textTransform: "uppercase", letterSpacing: ".1em" }}>{title}</p>
            {subtitle && <p style={{ fontSize: 10, color: "#c0d0e0", marginTop: 4 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{ background: "none", border: "none", color: "#c0d0e0", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {rows.length === 0 ? (
          <p style={{ fontSize: 12, color: "#c0d0e0" }}>Nenhum item.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: theme.font.label, fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--asb-border)" }}>
                {columns.map((c) => (
                  <th key={c.key} style={{ textAlign: c.align ?? "left", padding: "6px 8px", color: "#e4e9f0", fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700 }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #1f1f1f" }}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ textAlign: c.align ?? "left", padding: "8px", color: "#c8d8e8", fontFamily: c.align === "right" ? theme.font.num : theme.font.label, fontVariantNumeric: c.align === "right" ? "tabular-nums" : undefined }}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
