"use client";

// components/dashboard/jornada-cliente.tsx — "Jornada do Cliente até a Recorrência".
// Duas VISÕES sobre a mesma régua (nº de pedidos faturados no histórico completo):
//   • Carteira Viva  (customer_status ativo/atenção)
//   • Histórico Geral(toda a carteira faturada, inclusive churn/perdido)
// Classificação SEMPRE por histórico completo — o seletor troca só o RECORTE (viva x geral),
// nunca a régua. Cards clicáveis → /dashboard/jornada?view=&stage= (drill pedido-a-pedido).
// Lógica pura em lib/funnel/jornada.ts (testada). Compõe com o KIT grafite (StatTile).

import { useState } from "react";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { StatTile } from "@/app/dashboard/lib/ui";
import {
  computeJornada,
  computeAvancos,
  type JornadaClienteRow,
  type JornadaView,
} from "@/lib/funnel/jornada";

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct1 = (n: number) => `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const VIEW_LABEL: Record<JornadaView, string> = {
  viva: "Carteira Viva",
  geral: "Histórico Geral",
};

export function JornadaCliente({ rows }: { rows: JornadaClienteRow[] }) {
  const [view, setView] = useState<JornadaView>("viva");
  const jornada = computeJornada(rows, view);
  // Taxas de avanço = só no Histórico Geral (população acumulada da carteira inteira).
  const avancos = view === "geral" ? computeAvancos(rows) : null;

  return (
    <div>
      {/* Seletor de visão */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ ...S.label, marginBottom: 0 }}>Base analisada</span>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as JornadaView)}
          style={{
            background: "var(--asb-card-hi)",
            border: "1px solid rgba(255,255,255,.18)",
            borderRadius: 6,
            color: "#e4e9f0",
            fontSize: 12.5,
            fontFamily: theme.font.label,
            padding: "6px 10px",
            outline: "none",
            cursor: "pointer",
          }}
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

      {/* 5 cards da jornada — clicáveis (drill pedido-a-pedido) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
        {jornada.stages.map((s) => (
          <Link
            key={s.key}
            href={`/dashboard/jornada?view=${view}&stage=${s.key}`}
            style={{ textDecoration: "none" }}
          >
            <StatTile
              label={s.label}
              value={s.count}
              accent={s.fill}
              num={s.fill}
              sub={`${brl(s.revenue)} faturados`}
              badges={
                <>
                  <span style={chip}>Ticket {brl(s.ticket)}</span>
                  <span style={chip}>{pct1(s.pct)} da base</span>
                </>
              }
            />
          </Link>
        ))}
      </div>

      {/* Legenda de período (limitação documentada) */}
      <p style={{ fontSize: 10.5, color: "#83879a", fontFamily: theme.font.label, marginTop: 10, lineHeight: 1.5 }}>
        Classificação: <b style={{ color: "#aeb7cc" }}>histórico completo</b> de pedidos faturados (status 4/13) ·
        Valores exibidos: <b style={{ color: "#aeb7cc" }}>histórico completo</b> · base analisada:{" "}
        <b style={{ color: "#aeb7cc" }}>{VIEW_LABEL[view]}</b> ({jornada.base} clientes).
        O filtro de período da página <b style={{ color: "#aeb7cc" }}>não</b> afeta esta seção (só a Conversão por Marcos).
      </p>

      {/* Taxas de avanço — só no Histórico Geral (população acumulada) */}
      {avancos && (
        <div style={{ marginTop: 18 }}>
          <p style={{ ...S.label, marginBottom: 10 }}>Taxas de avanço (histórico acumulado)</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              { label: "1º → 2º pedido", v: avancos.av12, den: avancos.reached.r1, num: avancos.reached.r2 },
              { label: "2º → 3º pedido", v: avancos.av23, den: avancos.reached.r2, num: avancos.reached.r3 },
              { label: "3º → 4º pedido", v: avancos.av34, den: avancos.reached.r3, num: avancos.reached.r4 },
              { label: "Viram recorrentes", v: avancos.recorrencia, den: avancos.reached.r1, num: avancos.reached.r5 },
            ].map((a) => (
              <StatTile
                key={a.label}
                label={a.label}
                value={a.v == null ? "—" : pct1(a.v)}
                accent="#22c55e"
                num="#22c55e"
                sub={`${a.num} de ${a.den} clientes`}
              />
            ))}
          </div>
          <p style={{ fontSize: 10.5, color: "#83879a", fontFamily: theme.font.label, marginTop: 8, lineHeight: 1.5 }}>
            População acumulada (chegou ao Nº pedido <b style={{ color: "#aeb7cc" }}>ou além</b>), não as categorias exclusivas —
            revela em qual etapa ocorre a maior perda.
          </p>
        </div>
      )}
    </div>
  );
}

const chip: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 600,
  color: "#aeb7cc",
  fontFamily: theme.font.label,
  background: "rgba(255,255,255,.06)",
  border: "1px solid rgba(255,255,255,.1)",
  borderRadius: 999,
  padding: "2px 8px",
  fontVariantNumeric: "tabular-nums",
};
