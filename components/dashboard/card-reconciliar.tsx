// Card "Clientes a reconciliar" — Opção A (DEBT-001 3b). Server Component self-contained.
// Lê v_clientes_a_reconciliar (leads que compraram mas seguem em stage LEAD). Só gestor vê.
// READ-ONLY: apenas sinaliza; a transição é manual (gestor clica no lead).
// v2 (2026-05-27): + ID cliente (ARES), nome ARES, datas de compra, dias sem comprar, vendedor.
//   Link corrigido p/ /dashboard/leads/{phone} (a page é keyed por phone, igual ao resto do painel).
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

const mono = "'Courier New', monospace";
const brl = (n: number) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// routing_team -> nome do vendedor (mesmo mapa da página de lead)
const VENDOR_LABELS: Record<string, string> = {
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula",
  SETOR_CAMPINAS_JUNDIAI: "Alan",
  SETOR_CUIT: "CUIT",
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return y && m && day ? `${day}/${m}/${y}` : "—";
}

function fmtDias(n: number | null): string {
  if (n == null) return "—";
  if (n <= 0) return "hoje";
  return `${n} ${n === 1 ? "dia" : "dias"}`;
}

type Row = {
  lead_id: string; phone: string; name: string | null; funnel_atual: string;
  stage_sugerido: string; n_pedidos: number; receita_brl: number; routing_team: string | null;
  ares_pessoa_id: number | null; nome_ares: string | null;
  primeiro_pedido: string | null; ultimo_pedido: string | null; dias_desde_ultimo_pedido: number | null;
  ares_vendedor_nome: string | null; ares_routing_team: string | null;
};

// Vendedor REAL do ARES (dono do pedido mais recente); cai p/ label do routing ARES, depois routing SDR.
function vendedorReal(r: Row): string {
  if (r.ares_vendedor_nome) return r.ares_vendedor_nome;
  if (r.ares_routing_team) return VENDOR_LABELS[r.ares_routing_team] ?? r.ares_routing_team.replace("SETOR_", "");
  if (r.routing_team) return VENDOR_LABELS[r.routing_team] ?? r.routing_team.replace("SETOR_", "");
  return "—";
}

export async function CardReconciliar() {
  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "gestor") return null; // alerta operacional do gestor (Fernando)

  const supabase = await createClient();
  const { data } = await supabase
    .from("v_clientes_a_reconciliar")
    .select("lead_id, phone, name, funnel_atual, stage_sugerido, n_pedidos, receita_brl, routing_team, ares_pessoa_id, nome_ares, primeiro_pedido, ultimo_pedido, dias_desde_ultimo_pedido, ares_vendedor_nome, ares_routing_team")
    .order("receita_brl", { ascending: false });
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + Number(r.receita_brl || 0), 0);
  const td: React.CSSProperties = { padding: "7px 8px", color: "#c8d8e8", fontFamily: mono, fontSize: 12, whiteSpace: "nowrap" };
  const th: React.CSSProperties = { fontSize: 9, color: "#556677", fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", padding: "6px 8px", textAlign: "left", borderBottom: "1px solid #2a2a2a", whiteSpace: "nowrap" };

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
            <th style={th}>Cliente</th>
            <th style={{ ...th, textAlign: "right" }}>ID ARES</th>
            <th style={th}>Vendedor (ARES)</th>
            <th style={{ ...th, textAlign: "right" }}>Pedidos</th>
            <th style={{ ...th, textAlign: "right" }}>Receita</th>
            <th style={th}>1ª compra</th>
            <th style={th}>Últ. compra</th>
            <th style={{ ...th, textAlign: "right" }}>Sem comprar</th>
            <th style={th}>Funil atual</th>
            <th style={th}>→ Sugerido</th>
            <th style={th}></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.lead_id} style={{ borderBottom: "1px solid #222" }}>
                <td style={{ ...td, color: "#FFFFFF" }}>{r.name || r.nome_ares || r.phone}</td>
                <td style={{ ...td, textAlign: "right", color: "#8899aa", fontSize: 10 }}>{r.ares_pessoa_id ?? "—"}</td>
                <td style={{ ...td, color: "#8899aa", fontSize: 11 }}>{vendedorReal(r)}</td>
                <td style={{ ...td, textAlign: "right" }}>{r.n_pedidos}</td>
                <td style={{ ...td, textAlign: "right", color: "#2ea043", fontWeight: 700 }}>{brl(r.receita_brl)}</td>
                <td style={{ ...td, color: "#8899aa", fontSize: 11 }}>{fmtDate(r.primeiro_pedido)}</td>
                <td style={{ ...td, color: "#c8d8e8", fontSize: 11 }}>{fmtDate(r.ultimo_pedido)}</td>
                <td style={{ ...td, textAlign: "right", color: (r.dias_desde_ultimo_pedido ?? 0) > 30 ? "#d29922" : "#8899aa", fontSize: 11 }}>{fmtDias(r.dias_desde_ultimo_pedido)}</td>
                <td style={{ ...td, color: "#d29922" }}>{r.funnel_atual}</td>
                <td style={{ ...td, color: "#22C55E" }}>{r.stage_sugerido}</td>
                <td style={td}><Link href={`/dashboard/leads/${encodeURIComponent(r.phone)}`} style={{ color: "#2ea043", textDecoration: "none", fontSize: 11 }}>abrir →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
