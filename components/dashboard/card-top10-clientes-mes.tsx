// Card "TOP 10 Clientes do Mês" — substitui CardReconciliar no /dashboard.
// Server Component self-contained. Lê v_top10_clientes_mes (receita do mês corrente, pedidos_espelho).
// Visibilidade: mesmo padrão dos demais cards do dashboard (createClient direto, todos veem tudo).
// Vitrine de informação — SEM link clicável (DEBT-040: rota ARES pura ainda não existe).
import { createClient } from "@/lib/supabase/server";

const mono = "'Courier New', monospace";
const brl = (n: number) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// telefone sujo (ex: "11965020442 DANI", "20616660") → (xx) xxxxx-xxxx best-effort
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

export async function CardTop10ClientesMes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_top10_clientes_mes")
    .select(
      "ares_pessoa_id, nome_fantasia, contato, bairro, vendedor_routing_team, vendedor_nome, pedidos_mes, receita_mes, recorrencia_semanal, ticket_medio"
    )
    .order("receita_mes", { ascending: false })
    .limit(10);

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + Number(r.receita_mes || 0), 0);
  const mesLabel = String(new Date().getMonth() + 1).padStart(2, "0");

  const th: React.CSSProperties = {
    fontSize: 9, color: "#e4e9f0", fontFamily: mono, letterSpacing: ".1em",
    textTransform: "uppercase", padding: "6px 8px", textAlign: "left",
    borderBottom: "1px solid #2a2a2a", whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "7px 8px", color: "#c8d8e8", fontFamily: mono, fontSize: 12, whiteSpace: "nowrap",
  };

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #22c55e", borderRadius: 8, padding: "20px 24px" }}>
      <p style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#22c55e", fontFamily: mono, marginBottom: 4 }}>
        <span style={{ marginRight: 6 }}>★</span>Top {rows.length} clientes do mês · {brl(total)}
      </p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: mono, marginBottom: 12 }}>
        Receita acumulada de 01/{mesLabel} até hoje, ordenado por receita.
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "right" }}>#</th>
              <th style={{ ...th, textAlign: "right" }}>ID</th>
              <th style={th}>Cliente</th>
              <th style={th}>Contato</th>
              <th style={th}>Bairro</th>
              <th style={th}>Vendedor</th>
              <th style={{ ...th, textAlign: "right" }}>Pedidos</th>
              <th style={{ ...th, textAlign: "right" }}>Receita mês</th>
              <th style={{ ...th, textAlign: "right" }}>Recorrência</th>
              <th style={{ ...th, textAlign: "right" }}>Ticket méd</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.ares_pessoa_id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ ...td, textAlign: "right", color: "#22c55e", fontWeight: 700 }}>{i + 1}</td>
                <td style={{ ...td, textAlign: "right", color: "#c0d0e0", fontSize: 10 }}>{r.ares_pessoa_id}</td>
                <td style={{ ...td, color: "#FFFFFF" }}>{r.nome_fantasia || "—"}</td>
                <td style={{ ...td, color: "#c0d0e0", fontSize: 11 }}>{fmtTel(r.contato)}</td>
                <td style={{ ...td, color: "#c0d0e0", fontSize: 11 }}>{r.bairro || "—"}</td>
                <td style={{ ...td, color: "#c8d8e8", fontSize: 11 }}>{r.vendedor_nome || "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.pedidos_mes}</td>
                <td style={{ ...td, textAlign: "right", color: "#2ea043", fontWeight: 700 }}>{brl(r.receita_mes)}</td>
                <td style={{ ...td, textAlign: "right", color: "#c0d0e0", fontSize: 11 }}>{Number(r.recorrencia_semanal).toFixed(1)}x/sem</td>
                <td style={{ ...td, textAlign: "right", color: "#c0d0e0", fontSize: 11 }}>{brl(r.ticket_medio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
