import Link from "next/link";

// Fase 1.2 (DEBT-286): cards de resumo das 4 abas de Leads (total + % · clicáveis → trocam aba).
// % = fatia do universo de LEAD (Ativos + Perdidos + Fora de Rota; convertidos já viraram Cliente).
// Parados é SUBCONJUNTO de Ativos (atenção), então mostra "% dos ativos", não entra na partição.

type Counts = { ativos: number; parados: number; perdidos: number; fora_de_rota: number };

const C = { line: "#22304a", panel: "#0f1826", txt: "#fff", muted: "#c0d0e0", dim: "#7f8ea8" };
const MONO: React.CSSProperties = { fontFamily: "'Courier New', monospace" };

export function LeadsCards({ counts, active }: { counts: Counts; active: string }) {
  const universo = counts.ativos + counts.perdidos + counts.fora_de_rota || 1;
  const pct = (n: number) => `${Math.round((n / universo) * 100)}%`;
  const pctAtivos = counts.ativos ? `${Math.round((counts.parados / counts.ativos) * 100)}%` : "—";

  const cards = [
    { key: "ativos", label: "Ativos", n: counts.ativos, sub: `${pct(counts.ativos)} do funil`, edge: "#3f7bf5" },
    { key: "parados", label: "Parados", n: counts.parados, sub: `${pctAtivos} dos ativos · atenção`, edge: "#f59e0b" },
    { key: "perdidos", label: "Perdidos", n: counts.perdidos, sub: `${pct(counts.perdidos)} · 180d`, edge: "#C8102E" },
    { key: "fora_de_rota", label: "Fora de Rota", n: counts.fora_de_rota, sub: `${pct(counts.fora_de_rota)} · sem cobertura`, edge: "#38bdf8" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
      {cards.map((c) => {
        const on = active === c.key;
        return (
          <Link key={c.key} href={`/dashboard/leads?view=${c.key}`} style={{ textDecoration: "none" }}>
            <div style={{
              position: "relative", background: "linear-gradient(180deg,#0f1826,#0b1220)",
              border: `1px solid ${on ? c.edge : C.line}`, borderTop: `2px solid ${c.edge}`, borderRadius: 10,
              padding: "13px 15px 12px", boxShadow: on ? `0 0 0 1px ${c.edge} inset` : "none", cursor: "pointer",
            }}>
              <div style={{ ...MONO, fontSize: 10, letterSpacing: ".13em", textTransform: "uppercase", color: c.edge }}>{c.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 9 }}>
                <span style={{ fontSize: 28, fontWeight: 800, lineHeight: 1, color: C.txt, fontVariantNumeric: "tabular-nums" }}>{c.n}</span>
              </div>
              <div style={{ ...MONO, fontSize: 9.5, color: C.dim, marginTop: 8, letterSpacing: ".04em" }}>{c.sub}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
