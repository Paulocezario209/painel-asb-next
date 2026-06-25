"use client";

import type { RankingItem } from "./actions";
import { theme } from "@/lib/theme";

const MEDAL: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
const COR_HEX: Record<string, string> = {
  verde:    "#22c55e",
  amarelo:  "#D4A017",
  laranja:  "#BA7517",
  vermelho: "#C8102E",
  cinza:    "#556677",
};

function fmtBRL(v: number): string {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v.toFixed(1)}%`;
}

function fmtDelta(v: number | null): { txt: string; cor: string; icon: string } {
  if (v === null) return { txt: "—", cor: "#556677", icon: "" };
  if (Math.abs(v) < 5) return { txt: `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`, cor: "#8899aa", icon: "→" };
  if (v > 0) return { txt: `+${v.toFixed(0)}%`, cor: "#22c55e", icon: "↑" };
  return { txt: `${v.toFixed(0)}%`, cor: "#C8102E", icon: "↓" };
}

export function RankingVendedores({ ranking }: { ranking: RankingItem[] }) {
  if (ranking.length === 0) {
    return null;
  }

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#c0c8d8", fontFamily: theme.font.label, textTransform: "uppercase", letterSpacing: ".1em" }}>
          🏆 RANKING DO MÊS
        </p>
        <span style={{ fontSize: 9, color: "#556677", fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Hoje vs média 7d
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
              {["#", "Vendedor", "% Mês", "Realizado", "Saldo", "Média 7d", "Hoje", "Δ vs Média"].map((h) => (
                <th
                  key={h}
                  style={{
                    fontSize: 9,
                    color: "#556677",
                    fontFamily: theme.font.label,
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                    padding: "8px 6px",
                    textAlign: h === "Vendedor" || h === "#" ? "left" : "right",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ranking.map((r) => {
              const delta = fmtDelta(r.delta_pct_vs_media);
              const saldoPositivo = r.saldo >= 0;
              const corPct = COR_HEX[r.cor_card_mes] ?? "#8899aa";
              return (
                <tr key={r.vendedor_routing_team} style={{ borderBottom: "1px solid rgba(42,42,42,.5)" }}>
                  <td style={{ padding: "10px 6px", fontSize: 14 }}>
                    {MEDAL[r.posicao] ?? <span style={{ color: "#556677", fontFamily: theme.font.num, fontSize: 11 }}>{r.posicao}º</span>}
                  </td>
                  <td style={{ padding: "10px 6px", fontSize: 12, color: "#FFFFFF", fontWeight: 700, fontFamily: theme.font.label }}>
                    {r.nome}
                  </td>
                  <td style={{ padding: "10px 6px", fontSize: 12, color: corPct, fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    <span className="priv-pct">{fmtPct(r.pct_atingido_mes)}</span>
                  </td>
                  <td style={{ padding: "10px 6px", fontSize: 11, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    <span className="priv-brl">{fmtBRL(r.realizado_mes)}</span>
                  </td>
                  <td style={{ padding: "10px 6px", fontSize: 11, color: saldoPositivo ? "#22c55e" : "#C8102E", fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    <span className="priv-brl">{(saldoPositivo ? "+" : "") + fmtBRL(r.saldo)}</span>
                  </td>
                  <td style={{ padding: "10px 6px", fontSize: 11, color: "#8899aa", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    <span className="priv-brl">{fmtBRL(r.media_7d)}</span>
                  </td>
                  <td style={{ padding: "10px 6px", fontSize: 11, color: r.realizado_hoje > 0 ? "#FFFFFF" : "#556677", fontWeight: r.realizado_hoje > 0 ? 700 : 400, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    <span className="priv-brl">{fmtBRL(r.realizado_hoje)}</span>
                  </td>
                  <td style={{ padding: "10px 6px", fontSize: 11, color: delta.cor, fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                    <span style={{ marginRight: 4 }}>{delta.icon}</span>
                    {delta.txt}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
