// Card "Reconciliar lead ↔ ARES" (MOV.2b). Server Component, só gestor vê.
// Lê v_lead_ares_pendentes (leads SEM ares_pessoa_id que casam por telefone).
// Fila principal = is_unico (1 candidato). Ambíguos (is_unico=false) = seção separada.
// Grava via RPC confirm_lead_ares_match (botão client). Aditivo: NÃO toca o TOP10.
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";
import { ConfirmMatchButton } from "./confirm-match-button";

const mono = "'Courier New', monospace";
const brl = (n: number) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VENDOR_LABELS: Record<string, string> = {
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula",
  SETOR_CAMPINAS_JUNDIAI: "Alan",
  SETOR_CUIT: "CUIT",
};

function fmtVendor(team: string | null): string {
  if (!team) return "—";
  return VENDOR_LABELS[team] ?? team.replace("SETOR_", "");
}

// Badge de origem: pago (instagram/lp/google/meta) destacado; organico/null mudo.
function OrigemBadge({ canal, adId }: { canal: string | null; adId: string | null }) {
  const pago = !!canal && canal !== "organico";
  const bg = pago ? "rgba(210,153,34,.12)" : "rgba(136,153,170,.08)";
  const fg = pago ? "#d29922" : "#c0d0e0";
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          background: bg, color: fg, border: `1px solid ${fg}33`,
          borderRadius: 3, padding: "1px 6px", fontSize: 9, fontFamily: mono,
          letterSpacing: ".06em", textTransform: "uppercase", width: "fit-content",
        }}
      >
        {canal ?? "—"}
      </span>
      {adId ? (
        <span style={{ color: "#e4e9f0", fontSize: 9, fontFamily: mono }}>ad {adId}</span>
      ) : null}
    </span>
  );
}

type Row = {
  lead_id: string;
  phone: string;
  name: string | null;
  funnel_stage: string | null;
  routing_team: string | null;
  origem_canal: string | null;
  ad_id: string | null;
  origem_codigo: string | null;
  ares_pessoa_id: number;
  nome_ares: string | null;
  fantasia: string | null;
  cidade: string | null;
  cnpj: string | null;
  n_pedidos: number;
  receita_brl: number;
  vendedor_routing_team: string | null;
  vendedor_nome: string | null;
  n_candidatos: number;
  is_unico: boolean;
};

const th: React.CSSProperties = {
  fontSize: 9, color: "#e4e9f0", fontFamily: mono, letterSpacing: ".1em",
  textTransform: "uppercase", padding: "6px 8px", textAlign: "left",
  borderBottom: "1px solid #2a2a2a", whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "7px 8px", color: "#c8d8e8", fontFamily: mono, fontSize: 12, whiteSpace: "nowrap",
};

function MatchRow({ r }: { r: Row }) {
  return (
    <tr style={{ borderBottom: "1px solid #222" }}>
      <td style={{ ...td, color: "#FFFFFF" }}>
        {r.name || r.fantasia || r.phone}
        <span style={{ color: "#e4e9f0", fontSize: 10, marginLeft: 6 }}>
          {String(r.phone).slice(-4)}
        </span>
      </td>
      <td style={td}><OrigemBadge canal={r.origem_canal} adId={r.ad_id} /></td>
      <td style={{ ...td, color: "#c0d0e0" }}>
        {r.fantasia || r.nome_ares || "—"}
        <span style={{ color: "#e4e9f0", fontSize: 10, marginLeft: 6 }}>#{r.ares_pessoa_id}</span>
      </td>
      <td style={{ ...td, color: "#c0d0e0", fontSize: 11 }}>{r.cidade || "—"}</td>
      <td style={{ ...td, textAlign: "right" }}>{r.n_pedidos}</td>
      <td style={{ ...td, textAlign: "right", color: "#2ea043", fontWeight: 700 }}>{brl(r.receita_brl)}</td>
      <td style={{ ...td, color: "#c0d0e0", fontSize: 11 }}>{fmtVendor(r.vendedor_routing_team)}</td>
      <td style={{ ...td, textAlign: "right" }}>
        <ConfirmMatchButton leadId={r.lead_id} aresPessoaId={r.ares_pessoa_id} />
      </td>
    </tr>
  );
}

export async function CardReconciliarAres() {
  const ctx = await getUserContext();
  if (!ctx || !ctx.isGestor) return null; // worklist do gestor

  const supabase = await createClient();
  const { data } = await supabase
    .from("v_lead_ares_pendentes")
    .select(
      "lead_id, phone, name, funnel_stage, routing_team, origem_canal, ad_id, origem_codigo, ares_pessoa_id, nome_ares, fantasia, cidade, cnpj, n_pedidos, receita_brl, vendedor_routing_team, vendedor_nome, n_candidatos, is_unico"
    );
  const rows = (data ?? []) as Row[];

  const unicos = rows.filter((r) => r.is_unico); // já ordenados pela view (pagos→receita)
  const ambiguos = rows.filter((r) => !r.is_unico);

  // agrupar ambíguos por lead
  const ambByLead = new Map<string, Row[]>();
  for (const r of ambiguos) {
    const arr = ambByLead.get(r.lead_id) ?? [];
    arr.push(r);
    ambByLead.set(r.lead_id, arr);
  }

  const card: React.CSSProperties = {
    background: "#1a1a1a", border: "1px solid #d29922", borderRadius: 8, padding: "20px 24px",
  };

  // Empty state honesto
  if (unicos.length === 0 && ambByLead.size === 0) {
    return (
      <div style={{ ...card, border: "1px solid #2a2a2a" }}>
        <p style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#e4e9f0", fontFamily: mono, marginBottom: 4 }}>
          Reconciliar lead ↔ ARES
        </p>
        <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: mono }}>
          Fila zerada — nenhum lead pendente casa por telefone no momento.
        </p>
      </div>
    );
  }

  const totalRev = unicos.reduce((s, r) => s + Number(r.receita_brl || 0), 0);

  return (
    <div style={card}>
      <p style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#d29922", fontFamily: mono, marginBottom: 4 }}>
        <span style={{ marginRight: 6 }}>⚲</span>Reconciliar lead ↔ ARES ({unicos.length} match{unicos.length === 1 ? "" : "es"} único{unicos.length === 1 ? "" : "s"}) · {brl(totalRev)} em receita
      </p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: mono, marginBottom: 12 }}>
        Leads que casam um cliente ARES por telefone mas ainda sem elo. Confirme p/ ligar origem→receita (pagos no topo).
      </p>

      {/* FILA PRINCIPAL — match único */}
      {unicos.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={th}>Lead</th>
              <th style={th}>Origem</th>
              <th style={th}>Cliente ARES</th>
              <th style={th}>Cidade</th>
              <th style={{ ...th, textAlign: "right" }}>Pedidos</th>
              <th style={{ ...th, textAlign: "right" }}>Receita</th>
              <th style={th}>Vendedor</th>
              <th style={{ ...th, textAlign: "right" }}></th>
            </tr></thead>
            <tbody>
              {unicos.map((r) => <MatchRow key={r.lead_id} r={r} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* AMBÍGUOS — decisão manual (N candidatos por lead) */}
      {ambByLead.size > 0 && (
        <div style={{ marginTop: 18 }}>
          <p style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: "#C8102E", fontFamily: mono, marginBottom: 8 }}>
            ⚠ Ambíguos — decisão manual ({ambByLead.size} lead{ambByLead.size === 1 ? "" : "s"})
          </p>
          {[...ambByLead.entries()].map(([leadId, cands]) => (
            <div key={leadId} style={{ marginBottom: 12, border: "1px solid #2a2a2a", borderRadius: 6, padding: "8px 12px" }}>
              <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: mono, marginBottom: 6 }}>
                {cands[0].name || cands[0].phone}
                <span style={{ color: "#e4e9f0", marginLeft: 8 }}>{cands[0].n_candidatos} candidatos — escolha 1</span>
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {cands.map((r) => (
                    <tr key={`${leadId}-${r.ares_pessoa_id}`} style={{ borderBottom: "1px solid #1f1f1f" }}>
                      <td style={{ ...td, color: "#c0d0e0" }}>
                        {r.fantasia || r.nome_ares || "—"}
                        <span style={{ color: "#e4e9f0", fontSize: 10, marginLeft: 6 }}>#{r.ares_pessoa_id}</span>
                      </td>
                      <td style={{ ...td, color: "#c0d0e0", fontSize: 11 }}>{r.cidade || "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{r.n_pedidos} ped</td>
                      <td style={{ ...td, textAlign: "right", color: "#2ea043" }}>{brl(r.receita_brl)}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <ConfirmMatchButton leadId={r.lead_id} aresPessoaId={r.ares_pessoa_id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
