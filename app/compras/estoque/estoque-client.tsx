"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { norm } from "@/lib/normalize";
import { StatTile } from "@/app/dashboard/lib/ui";

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

// null = "Quantidade cadastrada" (todos, comportamento padrão de hoje)
type FiltroSemaforo = CoberturaRow["semaforo"] | null;

const FILTRO_LABEL: Record<CoberturaRow["semaforo"], string> = {
  vermelho: "Crítico",
  amarelo: "Alerta",
  verde: "Cobertura OK",
  sem_cmd: "Sem CMD",
};

export default function EstoqueClient({ rows, totalProdutos }: { rows: CoberturaRow[]; totalProdutos: number }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<FiltroSemaforo>(null);

  // Cabeçalho de coluna = UPPERCASE SANS pequeno (eyebrow), nunca mono, nunca título.
  const th: React.CSSProperties = {
    fontSize: 10.5, color: "#83879a", fontFamily: theme.font.label, letterSpacing: ".06em", fontWeight: 700,
    textTransform: "uppercase", padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--asb-border)",
  };
  // NÚMERO → mono/tabular (célula numérica, à direita).
  const td: React.CSSProperties = { padding: "9px 12px", color: "#c8d2e6", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontSize: 12.5, textAlign: "right" };
  // TEXTO → sans (Produto / Grupo / Unidade). Zero mono em texto.
  const tdText: React.CSSProperties = { padding: "9px 12px", color: "#c8d2e6", fontFamily: theme.font.label, fontSize: 13, textAlign: "left" };

  // distribuição por semáforo — MESMA base (rows) que alimenta a tabela, então card e lista nunca divergem
  const cnt = { vermelho: 0, amarelo: 0, verde: 0, sem_cmd: 0 } as Record<CoberturaRow["semaforo"], number>;
  for (const r of rows) cnt[r.semaforo] = (cnt[r.semaforo] ?? 0) + 1;

  const toggleFiltro = (f: CoberturaRow["semaforo"]) => setFiltro((cur) => (cur === f ? null : f));

  // filtro acento-insensitive: descricao OU id_produto OU grupo, combinado com o semáforo do card ativo
  const qn = norm(q.trim());
  const porSemaforo = filtro ? rows.filter((r) => r.semaforo === filtro) : rows;
  const filtered = qn
    ? porSemaforo.filter((r) => norm(r.descricao).includes(qn) || norm(r.id_produto).includes(qn) || norm(r.grupo).includes(qn))
    : porSemaforo;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <StatTile
          label="Quantidade Cadastrada" value={rows.length} sub={`de ${totalProdutos} produtos totais`}
          onClick={() => setFiltro(null)} active={filtro === null}
        />
        <StatTile
          label="Crítico" value={cnt.vermelho} accent="#f85149" num="#f85149" sub="ruptura iminente"
          onClick={() => toggleFiltro("vermelho")} active={filtro === "vermelho"}
        />
        <StatTile
          label="Alerta" value={cnt.amarelo} accent="#d29922" num="#d29922" sub="cobertura curta"
          onClick={() => toggleFiltro("amarelo")} active={filtro === "amarelo"}
        />
        <StatTile
          label="Cobertura OK" value={cnt.verde} accent="#2ea043" num="#2ea043" sub="folga de estoque"
          onClick={() => toggleFiltro("verde")} active={filtro === "verde"}
        />
        <StatTile
          label="Sem CMD" value={cnt.sem_cmd} sub="sem saída capturada"
          onClick={() => toggleFiltro("sem_cmd")} active={filtro === "sem_cmd"}
        />
      </div>

      <div style={{ background: "var(--asb-card)", border: "1px solid var(--asb-border)", borderRadius: 14, overflowX: "auto" }}>
        {/* Barra de busca (lupa) + filtro ativo, sticky no topo do card */}
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
            {filtro ? (
              <span style={{ color: SEM[filtro].cor, fontFamily: theme.font.label, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                filtro: {FILTRO_LABEL[filtro]}
              </span>
            ) : null}
            <span style={{ color: "#83879a", fontFamily: theme.font.label, fontSize: 11, whiteSpace: "nowrap" }}>{filtered.length} de {rows.length}</span>
            {q ? (
              <button
                onClick={() => setQ("")}
                aria-label="Limpar busca"
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              >
                <X size={14} color="#83879a" />
              </button>
            ) : null}
            {filtro ? (
              <button
                onClick={() => setFiltro(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 4, background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)",
                  borderRadius: 6, padding: "4px 9px", color: "#c8d2e6", fontFamily: theme.font.label, fontSize: 11, fontWeight: 650, cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                <X size={11} /> Limpar filtro
              </button>
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
              <tr><td colSpan={7} style={{ ...tdText, textAlign: "center", color: "#83879a", padding: 20 }}>Nenhum insumo encontrado{q ? ` para "${q}"` : ""}</td></tr>
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
    </>
  );
}
