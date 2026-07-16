// Card "TOP 10 Clientes do Mês" — visual limpo (grafite sobre claro).
// Server Component self-contained. Lê v_top10_clientes_mes (receita do mês corrente, pedidos_espelho).
import { createClient } from "@/lib/supabase/server";
import { theme } from "@/lib/theme";
import { Star } from "lucide-react";

const sans = theme.font.label;
const num = theme.font.num;
const brl = (n: number) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtTel(raw: string | null): string {
  if (!raw) return "—";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw.trim().slice(0, 20);
}

type Row = {
  ares_pessoa_id: number;
  nome_fantasia: string | null;
  contato: string | null;
  bairro: string | null;
  vendedor_routing_team: string | null;
  vendedor_nome: string | null;
  pedidos_mes: number;
  receita_mes: number;
  recorrencia_semanal: number;
  ticket_medio: number;
};

// Cores de vendedor (ponto de identidade)
function sellerColor(name: string | null): string {
  const n = (name || "").toLowerCase();
  if (n.includes("ana")) return "#C8102E";
  if (n.includes("paulo")) return "#2A3F8F";
  if (n.includes("alan")) return "#2ea043";
  return "#8B90A3";
}

// Badge de rank: medalha p/ 1/2/3, grafite p/ o resto
function rankStyle(i: number): React.CSSProperties {
  const base: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 8, display: "inline-grid", placeItems: "center",
    fontSize: 12.5, fontWeight: 800, fontFamily: num, color: "#fff",
  };
  if (i === 0) return { ...base, background: "linear-gradient(135deg,#E01235,#C8102E)" };
  if (i === 1) return { ...base, background: "linear-gradient(135deg,#3A52A8,#1B2A6B)" };
  if (i === 2) return { ...base, background: "linear-gradient(135deg,#E0A93E,#9A6B18)" };
  return { ...base, background: "var(--asb-card-hi)", color: "#c8d2e6" };
}

export async function CardTop10ClientesMes({ previewRows }: { previewRows?: Row[] } = {}) {
  let rows: Row[];
  if (previewRows) {
    rows = previewRows;
  } else {
    const supabase = await createClient();
    const { data } = await supabase
      .from("v_top10_clientes_mes")
      .select(
        "ares_pessoa_id, nome_fantasia, contato, bairro, vendedor_routing_team, vendedor_nome, pedidos_mes, receita_mes, recorrencia_semanal, ticket_medio"
      )
      .order("receita_mes", { ascending: false })
      .limit(10);
    rows = (data ?? []) as Row[];
  }
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + Number(r.receita_mes || 0), 0);
  const maxRev = Math.max(...rows.map((r) => Number(r.receita_mes || 0)), 1);
  const mesLabel = String(new Date().getMonth() + 1).padStart(2, "0");

  const th: React.CSSProperties = {
    fontSize: 10.5, color: "#83879a", fontFamily: sans, letterSpacing: ".06em", fontWeight: 700,
    textTransform: "uppercase", padding: "11px 14px", textAlign: "left",
    borderBottom: "1px solid var(--asb-border)", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "12px 14px", color: "#c8d2e6", fontFamily: sans, fontSize: 13, whiteSpace: "nowrap",
    borderBottom: "1px solid var(--asb-border)", verticalAlign: "middle",
  };
  const numCell: React.CSSProperties = { fontFamily: num, fontVariantNumeric: "tabular-nums" };

  return (
    <div className="asb-card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "18px 22px", borderBottom: "1px solid var(--asb-border)", flexWrap: "wrap" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "linear-gradient(140deg,#C8102E,#1B2A6B)", flexShrink: 0 }}>
          <Star size={17} color="#fff" fill="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 750, color: "#fff", fontFamily: sans, letterSpacing: "-.01em" }}>
            Top {rows.length} clientes do mês
          </div>
          <div style={{ fontSize: 12.5, color: "#aeb7cc", fontFamily: sans, marginTop: 1 }}>
            Receita acumulada de 01/{mesLabel} até hoje · ordenado por receita
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 10.5, color: "#83879a", fontFamily: sans, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Receita Top {rows.length}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#22C55E", fontFamily: num, fontVariantNumeric: "tabular-nums" }}>{brl(total)}</div>
        </div>
      </div>

      {/* Tabela */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Cliente</th>
              <th style={th}>Contato</th>
              <th style={th}>Bairro</th>
              <th style={th}>Vendedor</th>
              <th style={{ ...th, textAlign: "right" }}>Pedidos</th>
              <th style={{ ...th, textAlign: "right" }}>Receita mês</th>
              <th style={th}>Recorrência</th>
              <th style={{ ...th, textAlign: "right" }}>Ticket méd</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rec = Number(r.recorrencia_semanal);
              const recColor = rec >= 3 ? "#22C55E" : rec >= 2 ? "#5B8DEF" : "#9aa6bd";
              const sc = sellerColor(r.vendedor_nome);
              return (
                <tr key={r.ares_pessoa_id}>
                  <td style={td}><span style={rankStyle(i)}>{i + 1}</span></td>
                  <td style={td}>
                    <div style={{ fontWeight: 700, color: "#fff" }}>{r.nome_fantasia || "—"}</div>
                    <div style={{ fontSize: 11, color: "#83879a", ...numCell }}>ID {r.ares_pessoa_id}</div>
                  </td>
                  <td style={{ ...td, color: "#aeb7cc", ...numCell }}>{fmtTel(r.contato)}</td>
                  <td style={{ ...td, color: "#aeb7cc" }}>{r.bairro || "—"}</td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc, flexShrink: 0 }} />
                      <span style={{ color: "#c8d2e6" }}>{r.vendedor_nome || "—"}</span>
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#fff", ...numCell }}>{r.pedidos_mes}</td>
                  <td style={{ ...td, textAlign: "right", minWidth: 190 }}>
                    <div style={{ fontWeight: 750, color: "#22C55E", ...numCell }}>{brl(r.receita_mes)}</div>
                    <div style={{ height: 5, borderRadius: 999, background: "var(--asb-card-hi)", marginTop: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(Number(r.receita_mes || 0) / maxRev) * 100}%`, background: "linear-gradient(90deg,#C8102E,#6E86FF)", borderRadius: 999 }} />
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: recColor + "22", color: recColor, ...numCell }}>
                      {rec.toFixed(1)}x/sem
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", color: "#aeb7cc", ...numCell }}>{brl(r.ticket_medio)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
