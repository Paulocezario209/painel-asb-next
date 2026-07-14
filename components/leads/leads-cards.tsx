import Link from "next/link";
import { theme } from "@/lib/theme";

// DEBT-286/290: cards de resumo das 4 abas de Leads (total + descritor · clicáveis → trocam aba).
// Linha do tempo por idade no SDR (Paulo 2026-07-14): Leads SDR (entrou hoje) → Parados (1-30d)
// → Perdidos. Sem cross-percentuais (quebravam com o volume diário pequeno de "hoje").

type Counts = { ativos: number; parados: number; perdidos: number; fora_de_rota: number };

const C = { line: "#22304a", panel: "#0f1826", txt: "#fff", muted: "#c0d0e0", dim: "#7f8ea8" };
// Tipografia padrão do painel (commit 112f221): label/texto = Geist Sans · número = Geist Mono.
const LABEL_FONT = theme.font.label;
const NUM_FONT = theme.font.num;

export function LeadsCards({ counts, active }: { counts: Counts; active: string }) {
  const cards = [
    { key: "ativos", label: "Leads SDR", n: counts.ativos, sub: "entraram hoje", edge: "#3f7bf5" },
    { key: "parados", label: "Parados", n: counts.parados, sub: "1–30 dias no funil", edge: "#f59e0b" },
    { key: "perdidos", label: "Perdidos", n: counts.perdidos, sub: "últimos 180 dias", edge: "#C8102E" },
    { key: "fora_de_rota", label: "Fora de Rota", n: counts.fora_de_rota, sub: "sem cobertura", edge: "#38bdf8" },
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
              <div style={{ fontFamily: LABEL_FONT, fontSize: 10, letterSpacing: ".13em", textTransform: "uppercase", fontWeight: 700, color: c.edge }}>{c.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 9 }}>
                <span style={{ fontFamily: NUM_FONT, fontSize: 26, fontWeight: 800, lineHeight: 1, color: C.txt, fontVariantNumeric: "tabular-nums" }}>{c.n}</span>
              </div>
              <div style={{ fontFamily: LABEL_FONT, fontSize: 10, color: C.dim, marginTop: 8 }}>{c.sub}</div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
