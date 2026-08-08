// Card "TOP 10 Clientes do Mês" — visual limpo (grafite sobre claro).
// Server Component self-contained.
// Fonte primária: RPC fn_top10_clientes_grupos — mesma régua VIVA do card (FATURADO,
// data_faturamento, BRT), consolidando redes de grupos_economicos numa entrada única
// (Grupo Alemão = ARES 171+1392+1892); filtros mês/vendedor aplicam ANTES de consolidar.
// Fallback: v_top10_clientes_mes + v_top10_share_mes (comportamento antigo, sem grupos)
// se a RPC falhar — reversível sem deploy.
import { createClient } from "@/lib/supabase/server";
import { theme } from "@/lib/theme";
import { Star } from "lucide-react";
import { brl } from "@/lib/top10-share";
import {
  ordenarELimitar,
  composicaoConfere,
  shareConsolidado,
  type Top10GrupoRow,
} from "@/lib/top10-grupos";

const sans = theme.font.label;
const num = theme.font.num;

function fmtTel(raw: string | null): string {
  if (!raw) return "—";
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw.trim().slice(0, 20);
}

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

type ViewRowLegacy = {
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

async function carregar(mes: string | null, vendedor: string | null): Promise<Top10GrupoRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_top10_clientes_grupos", {
    p_mes: mes,
    p_vendedor: vendedor,
  });
  if (!error && Array.isArray(data)) return data as Top10GrupoRow[];

  // Fallback (RPC indisponível): comportamento antigo — sem consolidação de grupos.
  const [{ data: viewData }, { data: shareData }] = await Promise.all([
    supabase
      .from("v_top10_clientes_mes")
      .select("ares_pessoa_id, nome_fantasia, contato, bairro, vendedor_routing_team, vendedor_nome, pedidos_mes, receita_mes, recorrencia_semanal, ticket_medio")
      .order("receita_mes", { ascending: false })
      .limit(10),
    supabase.from("v_top10_share_mes").select("faturamento_mensal_total").maybeSingle(),
  ]);
  const total = Number((shareData as { faturamento_mensal_total?: number | string } | null)?.faturamento_mensal_total ?? 0) || null;
  return ((viewData ?? []) as ViewRowLegacy[]).map((r) => ({
    ...r,
    chave: `cliente:${r.ares_pessoa_id}`,
    eh_grupo: false,
    nome_exibicao: r.nome_fantasia,
    unidades: 1,
    composicao: null,
    receita_total_mes: total,
  }));
}

export async function CardTop10ClientesMes({
  mes = null,
  vendedor = null,
  previewRows,
}: { mes?: string | null; vendedor?: string | null; previewRows?: Top10GrupoRow[] } = {}) {
  const all = previewRows ?? (await carregar(mes, vendedor));
  const rows = ordenarELimitar(all, 10);
  if (rows.length === 0) return null;

  const total = rows.reduce((s, r) => s + Number(r.receita_mes || 0), 0);
  const share = shareConsolidado(total, rows[0]?.receita_total_mes);
  const maxRev = Math.max(...rows.map((r) => Number(r.receita_mes || 0)), 1);

  const hoje = new Date();
  const mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const mesSel = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : mesCorrente;
  const [anoLbl, mesLbl] = mesSel.split("-");
  const periodoDesc = mesSel === mesCorrente
    ? `Receita faturada de 01/${mesLbl} até hoje`
    : `Receita faturada em ${mesLbl}/${anoLbl}`;

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
            {periodoDesc} · ordenado por receita · redes consolidadas (grupo econômico)
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right", minWidth: 224 }}>
          <div style={{ fontSize: 10.5, color: "#83879a", fontFamily: sans, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Receita Top {rows.length}</div>
          <div style={{ fontSize: 19, fontWeight: 800, color: "#22C55E", fontFamily: num, fontVariantNumeric: "tabular-nums" }}>{brl(total)}</div>
          {share.show && (
            <>
              <div style={{ height: 6, borderRadius: 999, background: "var(--asb-card-hi)", marginTop: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${share.barPct}%`, background: "linear-gradient(90deg,#C8102E,#6E86FF)", borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: 11.5, color: "#aeb7cc", fontFamily: sans, marginTop: 5 }}>
                <span style={{ color: "#fff", fontWeight: 800, fontFamily: num, fontVariantNumeric: "tabular-nums" }}>{share.pctLabel}</span>
                {" "}do faturamento do período
              </div>
              <div style={{ fontSize: 10.5, color: "#83879a", fontFamily: sans, marginTop: 1 }}>
                de <span style={{ fontFamily: num, fontVariantNumeric: "tabular-nums" }}>{share.totalLabel}</span> faturados · base: pedidos faturados
              </div>
            </>
          )}
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
              const mostraComposicao = composicaoConfere(r);
              return (
                <tr key={r.chave}>
                  <td style={td}><span style={rankStyle(i)}>{i + 1}</span></td>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: "#fff" }}>{r.nome_exibicao || "—"}</span>
                      {r.eh_grupo && (
                        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em", color: "#E0A93E", border: "1px solid #E0A93E66", background: "#E0A93E14", borderRadius: 999, padding: "2px 8px", fontFamily: sans }}>
                          REDE · {r.unidades} unidades
                        </span>
                      )}
                    </div>
                    {r.eh_grupo ? (
                      mostraComposicao ? (
                        <details style={{ marginTop: 3 }}>
                          <summary style={{ fontSize: 11, color: "#83879a", cursor: "pointer", fontFamily: sans }}>
                            ver composição por unidade
                          </summary>
                          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                            {r.composicao!.map((u) => (
                              <div key={u.ares_pessoa_id} style={{ display: "flex", gap: 10, fontSize: 11, color: "#aeb7cc" }}>
                                <span style={{ minWidth: 170 }}>{u.nome || `cliente ${u.ares_pessoa_id}`}</span>
                                <span style={numCell}>{brl(Number(u.receita_mes || 0))}</span>
                                <span style={{ color: "#83879a", ...numCell }}>{u.pedidos_mes} ped · ID {u.ares_pessoa_id}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <div style={{ fontSize: 11, color: "#83879a", ...numCell }}>{r.unidades} cadastros ARES</div>
                      )
                    ) : (
                      <div style={{ fontSize: 11, color: "#83879a", ...numCell }}>ID {r.ares_pessoa_id}</div>
                    )}
                  </td>
                  <td style={{ ...td, color: "#aeb7cc", ...numCell }}>{r.eh_grupo ? "—" : fmtTel(r.contato)}</td>
                  <td style={{ ...td, color: "#aeb7cc" }}>{r.eh_grupo ? "múltiplos" : (r.bairro || "—")}</td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: sc, flexShrink: 0 }} />
                      <span style={{ color: "#c8d2e6" }}>{r.vendedor_nome || "—"}</span>
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#fff", ...numCell }}>{r.pedidos_mes}</td>
                  <td style={{ ...td, textAlign: "right", minWidth: 190 }}>
                    <div style={{ fontWeight: 750, color: "#22C55E", ...numCell }}>{brl(Number(r.receita_mes || 0))}</div>
                    <div style={{ height: 5, borderRadius: 999, background: "var(--asb-card-hi)", marginTop: 6, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(Number(r.receita_mes || 0) / maxRev) * 100}%`, background: "linear-gradient(90deg,#C8102E,#6E86FF)", borderRadius: 999 }} />
                    </div>
                  </td>
                  <td style={td}>
                    <span style={{ display: "inline-flex", padding: "3px 9px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: recColor + "22", color: recColor, ...numCell }}>
                      {rec.toFixed(1)}x/sem
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", color: "#aeb7cc", ...numCell }}>{brl(Number(r.ticket_medio || 0))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
