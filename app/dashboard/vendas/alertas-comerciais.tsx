"use client";

import { useState } from "react";
import Link from "next/link";
import type { Alerta, AlertasResponse } from "./actions";
import { getPedidosAtrasadosPorVendedor, getClientesDormentes } from "./actions";
import {
  AlertDrawer,
  PEDIDOS_ATRASADOS_COLUMNS,
  CLIENTES_DORMENTES_COLUMNS,
  type PedidoAtrasadoRow,
  type ClienteDormenteRow,
} from "./alert-drawer";

type DrawerState =
  | { kind: "atrasados"; title: string; subtitle?: string; rows: PedidoAtrasadoRow[] }
  | { kind: "dormente"; title: string; subtitle?: string; rows: ClienteDormenteRow[] }
  | null;

const SEV: Record<Alerta["severidade"], { bg: string; border: string; icon: string; label: string }> = {
  vermelho: { bg: "rgba(200,16,46,.12)", border: "#C8102E", icon: "🔴", label: "CRÍTICO" },
  laranja:  { bg: "rgba(186,117,23,.12)", border: "#BA7517", icon: "🟠", label: "ATENÇÃO" },
  amarelo:  { bg: "rgba(212,160,23,.12)", border: "#D4A017", icon: "🟡", label: "AVISO" },
  verde:    { bg: "rgba(15,110,86,.12)", border: "#0F6E56", icon: "🟢", label: "OK" },
};

const TIPO_ICON: Record<Alerta["tipo"], string> = {
  saldo_negativo: "💰",
  atrasados: "⏰",
  dormente: "💤",
  tendencia_queda: "📉",
  meta_dia: "🎯",
};

export function AlertasComerciais({ data }: { data: AlertasResponse }) {
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [loading, setLoading] = useState(false);

  async function openDrawer(a: Alerta) {
    if (loading) return;
    setLoading(true);
    try {
      if (a.tipo === "atrasados") {
        const rows = await getPedidosAtrasadosPorVendedor(a.vendedor ?? "");
        setDrawer({ kind: "atrasados", title: a.titulo, subtitle: a.descricao, rows });
      } else if (a.tipo === "dormente") {
        const rows = await getClientesDormentes(5);
        setDrawer({ kind: "dormente", title: "Clientes dormentes", subtitle: a.descricao, rows });
      }
    } finally {
      setLoading(false);
    }
  }

  if (data.total === 0) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg" style={{ padding: "20px 24px" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#22c55e", fontFamily: "'Courier New', monospace", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 6 }}>
          🟢 ALERTAS COMERCIAIS
        </p>
        <p style={{ fontSize: 12, color: "#8899aa" }}>
          Nenhum alerta no momento. Operação saudável.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#c0c8d8", fontFamily: "'Courier New', monospace", textTransform: "uppercase", letterSpacing: ".1em" }}>
          ⚠ ALERTAS COMERCIAIS — {data.total}
        </p>
        <div style={{ display: "flex", gap: 6, fontSize: 9, fontFamily: "'Courier New', monospace" }}>
          {data.contadores.vermelho > 0 && (
            <span style={{ color: "#fff", background: "#C8102E", padding: "2px 8px", borderRadius: 3, fontWeight: 700 }}>
              {data.contadores.vermelho} CRÍTICO
            </span>
          )}
          {data.contadores.laranja > 0 && (
            <span style={{ color: "#fff", background: "#BA7517", padding: "2px 8px", borderRadius: 3, fontWeight: 700 }}>
              {data.contadores.laranja} ATENÇÃO
            </span>
          )}
          {data.contadores.amarelo > 0 && (
            <span style={{ color: "#0f0f0f", background: "#D4A017", padding: "2px 8px", borderRadius: 3, fontWeight: 700 }}>
              {data.contadores.amarelo} AVISO
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {data.alertas.map((a, i) => {
          const s = SEV[a.severidade];
          const isLink = !!a.href;
          const isDrawer = !a.href && (a.tipo === "atrasados" || a.tipo === "dormente");
          const clickable = isLink || isDrawer;
          const cardStyle: React.CSSProperties = {
            background: s.bg,
            borderLeft: `3px solid ${s.border}`,
            borderRadius: 4,
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            ...(clickable ? { cursor: "pointer" } : {}),
          };
          const inner = (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14 }}>{TIPO_ICON[a.tipo]}</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: s.border, fontFamily: "'Courier New', monospace", letterSpacing: ".1em" }}>
                  {s.label}
                </span>
                {clickable && (
                  <span style={{ marginLeft: "auto", fontSize: 11, color: s.border, fontWeight: 700 }}>→</span>
                )}
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.3 }}>
                {a.titulo}
              </p>
              <p style={{ fontSize: 10, color: "#8899aa", lineHeight: 1.4 }}>
                {a.descricao}
              </p>
            </>
          );
          if (isLink) {
            return (
              <Link key={`${a.tipo}-${i}`} href={a.href!} style={{ ...cardStyle, textDecoration: "none" }}>
                {inner}
              </Link>
            );
          }
          if (isDrawer) {
            return (
              <div
                key={`${a.tipo}-${i}`}
                role="button"
                tabIndex={0}
                onClick={() => openDrawer(a)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openDrawer(a); }}
                style={cardStyle}
              >
                {inner}
              </div>
            );
          }
          return (
            <div key={`${a.tipo}-${i}`} style={cardStyle}>
              {inner}
            </div>
          );
        })}
      </div>

      {drawer?.kind === "atrasados" && (
        <AlertDrawer
          title={drawer.title}
          subtitle={drawer.subtitle}
          columns={PEDIDOS_ATRASADOS_COLUMNS}
          rows={drawer.rows}
          onClose={() => setDrawer(null)}
        />
      )}
      {drawer?.kind === "dormente" && (
        <AlertDrawer
          title={drawer.title}
          subtitle={drawer.subtitle}
          columns={CLIENTES_DORMENTES_COLUMNS}
          rows={drawer.rows}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}
