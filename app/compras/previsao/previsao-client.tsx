"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { norm } from "@/lib/normalize";

import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { StatTile } from "@/app/dashboard/lib/ui";

export type PrevRow = {
  id_produto: string | number; descricao: string | null; grupo_nome: string | null;
  cmd: number; demanda_horizonte: number; saldo_atual: number | null; saldo_confiavel: boolean;
  em_pedido: number; fornecedor_provavel: string | null; lead_time_dias: number;
  ponto_reposicao: number; a_comprar: number; repor_agora: boolean;
  skus?: string | null; __isPool?: boolean;
};

const n3 = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }));

export default function PrevisaoClient({ rows }: { rows: PrevRow[] }) {
  const [q, setQ] = useState("");
  const [soRepor, setSoRepor] = useState(false);

  // cabeçalho de COLUNA → UPPERCASE SANS pequeno (S.label)
  const th: React.CSSProperties = { ...S.label, fontSize: 10, padding: "10px 10px", textAlign: "right", borderBottom: "1px solid var(--asb-border)" };
  // célula de NÚMERO → mono/tabular
  const td: React.CSSProperties = { padding: "8px 10px", color: "#c8d2e6", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontSize: 12.5, textAlign: "right" };
  // célula de TEXTO → sans
  const tdText: React.CSSProperties = { ...td, fontFamily: theme.font.label, textAlign: "left" };

  // "Comprar Agora" (repor_agora) — MESMA base (rows) que o card conta, então card e lista nunca divergem
  const reporTotal = rows.filter((r) => r.repor_agora).length;
  const sinal = reporTotal > 0 ? "#C8102E" : "#22c55e";

  // filtro acento-insensitive: descricao OU id_produto OU skus, combinado com "Comprar Agora" se ativo
  const qn = norm(q.trim());
  const porRepor = soRepor ? rows.filter((r) => r.repor_agora) : rows;
  const filtered = qn
    ? porRepor.filter((r) => norm(r.descricao).includes(qn) || norm(r.id_produto).includes(qn) || norm(r.skus).includes(qn))
    : porRepor;

  // particionar DEPOIS do filtro (blocos refletem a busca). Com "Comprar Agora" ativo, ok fica sempre vazio.
  const repor = filtered.filter((r) => r.repor_agora);
  const ok = filtered.filter((r) => !r.repor_agora);

  const linha = (r: PrevRow) => (
    <tr key={String(r.id_produto)} style={{ borderBottom: "1px solid var(--asb-border)" }}>
      <td style={{ ...tdText, color: "#FFFFFF", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {r.descricao || `#${r.id_produto}`}
        {r.__isPool && r.skus ? <span style={{ color: "#83879a", fontSize: 10.5 }}> · pool {r.skus}</span> : null}
      </td>
      <td style={td}>{n3(r.cmd)}</td>
      <td style={{ ...td, color: r.saldo_confiavel ? "#c8d2e6" : "#83879a", fontFamily: r.saldo_confiavel ? theme.font.num : theme.font.label }}>{r.saldo_confiavel ? n3(r.saldo_atual) : "s/ âncora"}</td>
      <td style={td}>{n3(r.em_pedido)}</td>
      <td style={{ ...td, color: r.a_comprar > 0 ? "#f59e0b" : "#83879a", fontWeight: 700 }}>{n3(r.a_comprar)}</td>
      <td style={{ ...tdText, color: "#aeb7cc" }}>{r.fornecedor_provavel || "—"}{r.lead_time_dias ? ` (${r.lead_time_dias}d)` : ""}</td>
    </tr>
  );

  return (
    <>
      {/* Semáforo de reposição — sinal (🔴 comprar agora / 🟢 cobertura ok) preservado; clicável = filtro */}
      <div className="asb-grid-kpi">
        <StatTile
          label="Comprar Agora"
          value={reporTotal}
          accent={sinal}
          num={sinal}
          sub={reporTotal > 0 ? "insumos abaixo do ponto de reposição" : "nenhum insumo abaixo do ponto de reposição"}
          onClick={() => setSoRepor((v) => !v)}
          active={soRepor}
        />
      </div>

      <div style={{ ...S.card, overflowX: "auto" }}>
        {/* Barra de busca (lupa) + filtro ativo, sticky no topo do card */}
        <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--asb-card)", borderBottom: "1px solid var(--asb-border)", padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Search size={14} color="#83879a" style={{ flexShrink: 0 }} />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar insumo por nome ou código…"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e6ebf5", fontFamily: theme.font.label, fontSize: 12.5 }}
            />
            {soRepor ? (
              <span style={{ color: sinal, fontFamily: theme.font.label, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                filtro: Comprar Agora
              </span>
            ) : null}
            <span style={{ color: "#aeb7cc", fontFamily: theme.font.label, fontSize: 11, whiteSpace: "nowrap" }}>
              <b style={{ fontFamily: theme.font.num }}>{filtered.length}</b> de <b style={{ fontFamily: theme.font.num }}>{rows.length}</b>
            </span>
            {q ? (
              <button
                onClick={() => setQ("")}
                aria-label="Limpar busca"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              >
                <X size={14} color="#83879a" />
              </button>
            ) : null}
            {soRepor ? (
              <button
                onClick={() => setSoRepor(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 4, background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)",
                  borderRadius: 6, padding: "4px 9px", color: "#c8d2e6", fontFamily: theme.font.label, fontSize: 11, fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                <X size={11} /> Limpar filtro / Mostrar todos
              </button>
            ) : null}
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...th, textAlign: "left" }}>Insumo</th><th style={th} title="Consumo médio diário — janela 90 dias corridos (planejamento estável)">CMD-90/dia</th><th style={th}>Saldo</th>
            <th style={th}>Em pedido</th><th style={th}>Comprar</th><th style={{ ...th, textAlign: "left" }}>Fornecedor (LT)</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#83879a", fontFamily: theme.font.label, padding: 20 }}>aguardando dados (aplicar migrations)</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#83879a", fontFamily: theme.font.label, padding: 20 }}>Nenhum insumo encontrado{q ? ` para "${q}"` : ""}</td></tr>
            ) : (
              <>
                {repor.length > 0 && <tr><td colSpan={6} style={{ ...tdText, ...S.label, fontSize: 10.5, color: "#ff5a72", background: "var(--asb-card-hi)" }}>🔴 Comprar Agora</td></tr>}
                {repor.map(linha)}
                {ok.length > 0 && <tr><td colSpan={6} style={{ ...tdText, ...S.label, fontSize: 10.5, color: "#22c55e", background: "var(--asb-card-hi)" }}>✓ Cobertura Ok</td></tr>}
                {ok.map(linha)}
              </>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
