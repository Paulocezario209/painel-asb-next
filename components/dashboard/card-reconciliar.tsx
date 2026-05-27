// Card "Clientes a reconciliar" — Opção A (DEBT-001 3b). Server Component self-contained.
// Lê v_clientes_a_reconciliar (leads que compraram mas seguem em stage LEAD). Só gestor vê.
// READ-ONLY: apenas sinaliza; a transição é manual (gestor clica no lead).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

const mono = "'Courier New', monospace";
const brl = (n: number) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Row = {
  lead_id: string; phone: string; name: string | null; funnel_atual: string;
  stage_sugerido: string; n_pedidos: number; receita_brl: number; routing_team: string | null;
};

export async function CardReconciliar() {
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "gestor") return null; // alerta operacional do gestor (Fernando)

  const supabase = await createClient();
  const { data } = await supabase
    .from("v_clientes_a_reconciliar")
    .select("lead_id, phone, name, funnel_atual, stage_sugerido, n_pedidos, receita_brl, routing_team")
    .order("receita_brl", { ascending: false });
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + Number(r.receita_brl || 0), 0);
  const td: React.CSSProperties = { padding: "7px 8px", color: "#c8d8e8", fontFamily: mono, fontSize: 12 };
  const th: React.CSSProperties = { fontSize: 9, color: "#556677", fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #2a2a2a" };

  return (
    <div style={{ background: "#1a1a1a", border: "1px solid #d29922", borderRadius: 8, padding: "20px 24px" }}>
      <p style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#d29922", fontFamily: mono, marginBottom: 4 }}>
        <span style={{ marginRight: 6 }}>⚠</span>Clientes a reconciliar ({rows.length}) · {brl(total)} em jogo
      </p>
      <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono, marginBottom: 12 }}>
        Compraram no ARES mas seguem em etapa de LEAD. Revise e marque como cliente (transição manual).
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>Telefone</th><th style={th}>Time</th>
            <th style={{ ...th, textAlign: "right" }}>Pedidos</th><th style={{ ...th, textAlign: "right" }}>Receita</th>
            <th style={th}>Funil atual</th><th style={th}>→ Sugerido</th><th style={th}></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.lead_id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ ...td, color: "#FFFFFF" }}>{r.name || r.phone}</td>
                <td style={{ ...td, color: "#8899aa", fontSize: 10 }}>{(r.routing_team || "—").replace("SETOR_", "")}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.n_pedidos}</td>
                <td style={{ ...td, textAlign: "right", color: "#2ea043", fontWeight: 700 }}>{brl(r.receita_brl)}</td>
                <td style={{ ...td, color: "#d29922" }}>{r.funnel_atual}</td>
                <td style={{ ...td, color: "#22C55E" }}>{r.stage_sugerido}</td>
                <td style={td}><Link href={`/dashboard/leads/${r.lead_id}`} style={{ color: "#2ea043", textDecoration: "none", fontSize: 11 }}>abrir →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
