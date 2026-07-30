"use client";

// components/dashboard/jornada-cliente.tsx — "Jornada do Cliente até a Recorrência" (V2).
// Painel executivo: 2 visões (Carteira Viva | Histórico Geral), cards enriquecidos
// (qtd · %base · faturamento · %faturamento · ticket · mediana[principal]/média[secundária]),
// Funil da Jornada (população acumulada, substitui o cone de leads) e Taxas de avanço.
// Recebe os view-models já computados no server (lib/funnel/jornada-metrics.buildViewModel).

import { useState } from "react";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import type { JornadaView } from "@/lib/funnel/jornada";
import type { JornadaViewModel } from "@/lib/funnel/jornada-metrics";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct1 = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const dias = (n: number | null) => (n == null ? "—" : `${Math.round(n)}d`);

export function JornadaCliente({ viva, geral }: { viva: JornadaViewModel; geral: JornadaViewModel }) {
  const [view, setView] = useState<JornadaView>("viva");
  const vm = view === "viva" ? viva : geral;
  const maxFunil = Math.max(...vm.funil.map((f) => f.clientesAcumulado), 1);

  return (
    <div>
      {/* Seletor de visão */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ ...S.label, marginBottom: 0 }}>Base analisada</span>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as JornadaView)}
          style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.18)", borderRadius: 6, color: "#e4e9f0", fontSize: 12.5, fontFamily: theme.font.label, padding: "6px 10px", outline: "none", cursor: "pointer" }}
        >
          <option value="viva">Carteira Viva</option>
          <option value="geral">Histórico Geral</option>
        </select>
        <span style={{ fontSize: 11.5, color: "#83879a", fontFamily: theme.font.label }}>
          {view === "viva"
            ? "Só clientes comercialmente vivos (ativo/atenção) — churn e perdido ficam nas telas próprias."
            : "Toda a carteira faturada, inclusive clientes que depois entraram em churn/perdido."}
        </span>
      </div>

      {/* 5 cards enriquecidos — clicáveis (drill) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {vm.cards.map((c) => (
          <Link key={c.key} href={`/dashboard/jornada?view=${view}&stage=${c.key}`} style={{ textDecoration: "none" }}>
            <div style={{ ...S.card, padding: "14px 16px", borderTop: `3px solid ${c.fill}`, height: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 650, color: "#aeb7cc", fontFamily: theme.font.label, lineHeight: 1.3 }}>{c.label}</span>
              <span style={{ fontSize: 26, fontWeight: 850, letterSpacing: "-.02em", lineHeight: 1, color: c.fill, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{c.count}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 2 }}>
                <span style={badge}>{pct1(c.pct)} da base</span>
                <span style={badge}>{pct1(c.pctRevenue)} do fat.</span>
              </div>
              <div style={{ fontSize: 11, color: "#c8d2e6", fontFamily: theme.font.num, marginTop: 2 }}>{brl(c.revenue)} <span style={{ color: "#83879a" }}>faturados</span></div>
              <div style={{ fontSize: 10.5, color: "#83879a", fontFamily: theme.font.num }}>Ticket {brl(c.ticket)}</div>
              <div style={{ marginTop: "auto", paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.06)", fontSize: 10, color: "#aeb7cc", fontFamily: theme.font.label }}>
                {c.extraLabel}: <b style={{ color: "#fff", fontFamily: theme.font.num }}>{dias(c.extraDias)}</b>
                {c.key !== "p1" && c.mediaDias != null && <span style={{ color: "#83879a" }}> · média {dias(c.mediaDias)}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p style={{ fontSize: 10.5, color: "#83879a", fontFamily: theme.font.label, marginTop: 10, lineHeight: 1.5 }}>
        Classificação: <b style={{ color: "#aeb7cc" }}>histórico completo</b> de pedidos faturados (status 4/13) · Valores:{" "}
        <b style={{ color: "#aeb7cc" }}>histórico completo</b> · % do faturamento = sobre a base <b style={{ color: "#aeb7cc" }}>{view === "viva" ? "Carteira Viva" : "Histórico Geral"}</b> ({brl(vm.totalRevenue)}) ·
        intervalos: <b style={{ color: "#aeb7cc" }}>mediana</b> (principal) + <b style={{ color: "#aeb7cc" }}>média</b> (secundária). O filtro de período <b style={{ color: "#aeb7cc" }}>não</b> afeta esta seção.
      </p>

      {/* Funil da Jornada — população ACUMULADA (substitui o cone de leads) */}
      <div style={{ marginTop: 20 }}>
        <p style={{ ...S.label, marginBottom: 10 }}>Funil da Jornada · 1º pedido → recorrência (população acumulada)</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {vm.funil.map((f) => {
            const stageFill = viva.cards.find((c) => c.key === f.key)?.fill ?? "#185FA5";
            const w = (f.clientesAcumulado / maxFunil) * 100;
            return (
              <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 150, flexShrink: 0, fontSize: 11.5, color: "#c8d8e8", fontFamily: theme.font.label }}>{f.label}</span>
                <div style={{ flex: 1, background: "var(--asb-card)", borderRadius: 4, height: 26, position: "relative", overflow: "hidden" }}>
                  <div style={{ width: `${w}%`, height: "100%", background: stageFill, opacity: .85, borderRadius: 4, minWidth: 3 }} />
                  <span style={{ position: "absolute", left: 8, top: 5, color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: theme.font.num }}>{f.clientesAcumulado}</span>
                </div>
                <span style={{ width: 70, textAlign: "right", fontSize: 11, color: "#c0d0e0", fontFamily: theme.font.num, flexShrink: 0 }}>{f.taxaAvanco == null ? "—" : pct1(f.taxaAvanco)}</span>
                <span style={{ width: 96, textAlign: "right", fontSize: 10.5, color: "#aeb7cc", fontFamily: theme.font.num, flexShrink: 0 }}>{brl(f.faturamentoAcumulado)}</span>
                <span style={{ width: 128, textAlign: "right", fontSize: 10, color: "#83879a", fontFamily: theme.font.num, flexShrink: 0 }}>
                  {f.key === "p1" ? "—" : <>med {dias(f.tempoMedianoDias)} · méd {dias(f.tempoMedioDias)}</>}
                </span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 9, color: "#6b7280", fontFamily: theme.font.label, justifyContent: "flex-end" }}>
          <span style={{ width: 70, textAlign: "right" }}>avanço</span>
          <span style={{ width: 96, textAlign: "right" }}>faturamento</span>
          <span style={{ width: 128, textAlign: "right" }}>tempo até o marco</span>
        </div>
      </div>

      {/* Taxas de avanço (transições) */}
      <div style={{ marginTop: 18 }}>
        <p style={{ ...S.label, marginBottom: 10 }}>Taxas de avanço (população acumulada)</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {vm.funil.slice(1).map((f, i) => {
            const prev = vm.funil[i];
            const rot = ["1º → 2º", "2º → 3º", "3º → 4º", "4º → Recorrente"][i];
            return (
              <div key={f.key} style={{ ...S.card, padding: "14px 16px", borderTop: "3px solid #22c55e", display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 12, fontWeight: 650, color: "#aeb7cc", fontFamily: theme.font.label }}>{rot}</span>
                <span style={{ fontSize: 26, fontWeight: 850, lineHeight: 1, color: "#22c55e", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{f.taxaAvanco == null ? "—" : pct1(f.taxaAvanco)}</span>
                <span style={{ fontSize: 10.5, color: "#83879a", fontFamily: theme.font.num }}>{f.clientesAcumulado} de {prev.clientesAcumulado} clientes</span>
                <span style={{ fontSize: 10, color: "#83879a", fontFamily: theme.font.num }}>med {dias(f.tempoMedianoDias)} · méd {dias(f.tempoMedioDias)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const badge: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "#aeb7cc", fontFamily: theme.font.label,
  background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 999, padding: "1px 7px", fontVariantNumeric: "tabular-nums",
};
