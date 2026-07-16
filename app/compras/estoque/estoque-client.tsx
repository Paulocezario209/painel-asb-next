"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { norm } from "@/lib/normalize";

import { theme } from "@/lib/theme";

export type CoberturaRow = {
  id_produto: number;
  descricao: string | null;
  grupo: string | null;
  unidade: string | null;
  saldo_atual: number | null;
  ancora_data: string | null;
  cmd_dia: number | null;
  cobertura_dias: number | null;
  semaforo: "vermelho" | "amarelo" | "verde" | "sem_cmd";
};

const SEM: Record<string, { cor: string; label: string }> = {
  vermelho: { cor: "#f85149", label: "CRÍTICO" },
  amarelo: { cor: "#d29922", label: "ALERTA" },
  verde: { cor: "#2ea043", label: "OK" },
  sem_cmd: { cor: "#e4e9f0", label: "SEM CMD" },
};
const num = (n: number | null, d = 1) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function EstoqueClient({ rows }: { rows: CoberturaRow[] }) {
  const [q, setQ] = useState("");

  // Cabeçalho de coluna = UPPERCASE SANS pequeno (eyebrow), nunca mono, nunca título.
  const th: React.CSSProperties = {
    fontSize: 10.5, color: "#83879a", fontFamily: theme.font.label, letterSpacing: ".06em", fontWeight: 700,
    textTransform: "uppercase", padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--asb-border)",
  };
  // NÚMERO → mono/tabular (célula numérica, à direita).
  const td: React.CSSProperties = { padding: "9px 12px", color: "#c8d2e6", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontSize: 12.5, textAlign: "right" };
  // TEXTO → sans (Produto / Grupo / Unidade). Zero mono em texto.
  const tdText: React.CSSProperties = { padding: "9px 12px", color: "#c8d2e6", fontFamily: theme.font.label, fontSize: 13, textAlign: "left" };

  // filtro acento-insensitive: descricao OU id_produto OU grupo. Lista PLANA (sem partição).
  const qn = norm(q.trim());
  const filtered = qn
    ? rows.filter((r) => norm(r.descricao).includes(qn) || norm(r.id_produto).includes(qn) || norm(r.grupo).includes(qn))
    : rows;

  return (
    <div style={{ background: "var(--asb-card)", border: "1px solid var(--asb-border)", borderRadius: 14, overflowX: "auto" }}>
      {/* Barra de busca (lupa), sticky no topo do card */}
      <div style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--asb-card)", borderBottom: "1px solid var(--asb-border)", padding: "10px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Search size={14} color="#83879a" style={{ flexShrink: 0 }} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar insumo por nome, código ou grupo…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e6ebf5", fontFamily: theme.font.label, fontSize: 12.5 }}
          />
          {q ? (
            <>
              <span style={{ color: "#83879a", fontFamily: theme.font.label, fontSize: 11, whiteSpace: "nowrap" }}>{filtered.length} de {rows.length}</span>
              <button
                onClick={() => setQ("")}
                aria-label="Limpar busca"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              >
                <X size={14} color="#83879a" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>Produto</th>
            <th style={{ ...th, textAlign: "left" }}>Grupo</th>
            <th style={th}>Un</th>
            <th style={th}>Saldo</th>
            <th style={th} title="Consumo médio diário — janela 30 dias úteis (reação a ruptura)">CMD-30/dia</th>
            <th style={th}>Cobertura (dias)</th>
            <th style={{ ...th, textAlign: "center" }}>Semáforo</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={7} style={{ ...tdText, textAlign: "center", color: "#83879a", padding: 20 }}>sem produtos ancorados</td></tr>
          ) : filtered.length === 0 ? (
            <tr><td colSpan={7} style={{ ...tdText, textAlign: "center", color: "#83879a", padding: 20 }}>Nenhum insumo encontrado para &quot;{q}&quot;</td></tr>
          ) : (
            filtered.map((r) => {
              const s = SEM[r.semaforo] ?? SEM.sem_cmd;
              return (
                <tr key={r.id_produto} style={{ borderBottom: "1px solid var(--asb-border)" }}>
                  <td style={{ ...tdText, color: "#FFFFFF", fontWeight: 600, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.descricao || `#${r.id_produto}`}
                  </td>
                  <td style={{ ...tdText, color: "#aeb7cc" }}>{r.grupo || "—"}</td>
                  <td style={{ ...tdText, color: "#aeb7cc" }}>{r.unidade || "—"}</td>
                  <td style={{ ...td, color: (r.saldo_atual ?? 0) < 0 ? "#f85149" : "#c8d8e8" }}>{num(r.saldo_atual, 3)}</td>
                  <td style={td}>{num(r.cmd_dia, 3)}</td>
                  <td style={{ ...td, color: s.cor, fontWeight: 700 }}>{num(r.cobertura_dias)}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ color: s.cor, fontSize: 10, fontWeight: 700, fontFamily: theme.font.label, border: `1px solid ${s.cor}`, borderRadius: 3, padding: "2px 6px" }}>
                      {s.label}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
