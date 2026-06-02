"use client";

import { useMemo } from "react";

export type AnuncioRow = {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  leads: number;
  convertidos: number;
  receita_brl: number;
  primeiro_lead: string | null;
  ultimo_lead: string | null;
};

const mono = "'Courier New', monospace";
const RED = "#C8102E";

function fmtBRL(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function AnunciosClient({ rows }: { rows: AnuncioRow[] }) {
  const ordenadas = useMemo(
    () => [...rows].sort((a, b) => Number(b.leads) - Number(a.leads)),
    [rows],
  );
  const tot = useMemo(() => ordenadas.reduce(
    (a, r) => ({ leads: a.leads + Number(r.leads), conv: a.conv + Number(r.convertidos), rec: a.rec + Number(r.receita_brl) }),
    { leads: 0, conv: 0, rec: 0 },
  ), [ordenadas]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Banner: captura ainda acumulando */}
      <div style={{ background: "rgba(200,16,46,.06)", border: `1px solid rgba(200,16,46,.3)`, borderRadius: 6, padding: "10px 14px" }}>
        <p style={{ color: "#c0c8d8", fontSize: 11, fontFamily: mono, lineHeight: 1.6 }}>
          Captura de anúncio (<code>ad_id</code>) ativa desde <b style={{ color: RED }}>02/06 06:05 BRT</b> — volume acumulando.
          <b>Gasto</b> e <b>CAC</b> aguardam o ETL de gasto do Engine (<b style={{ color: RED }}>DEBT-115</b>): hoje só o lado-lead do CAC está disponível.
        </p>
      </div>

      {/* Tabela anúncio × leads × convertidos × receita × gasto × CAC */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, overflowX: "auto" }}>
        {ordenadas.length === 0 ? (
          <p style={{ color: "#556677", fontSize: 11, fontFamily: mono, textAlign: "center", padding: 20 }}>
            Sem leads atribuídos a anúncio ainda — captura iniciada em 02/06, volume começando a acumular.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: mono }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                <th style={{ ...th, textAlign: "left" }}>Campanha</th>
                <th style={{ ...th, textAlign: "left" }}>Anúncio</th>
                <th style={th}>Leads</th>
                <th style={th}>Convertidos</th>
                <th style={th}>Conv. %</th>
                <th style={{ ...th, textAlign: "right" }}>Receita</th>
                <th style={{ ...th, textAlign: "right" }}>Gasto</th>
                <th style={{ ...th, textAlign: "right" }}>CAC</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map(r => {
                const pct = Number(r.leads) > 0 ? Math.round((Number(r.convertidos) / Number(r.leads)) * 1000) / 10 : 0;
                return (
                  <tr key={r.ad_id} style={{ borderTop: "1px solid #2a2a2a" }}>
                    <td style={{ ...td, color: "#c8d8e8" }}>{r.campaign_name ?? "—"}</td>
                    <td style={{ ...td, color: "#FFFFFF" }} title={`ad_id ${r.ad_id} · ${fmtData(r.primeiro_lead)}→${fmtData(r.ultimo_lead)}`}>
                      {r.ad_name ?? <span style={{ color: "#556677" }}>{r.ad_id}</span>}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>{r.leads}</td>
                    <td style={{ ...td, textAlign: "center", color: "#22c55e" }}>{r.convertidos}</td>
                    <td style={{ ...td, textAlign: "center", color: "#8899aa" }}>{pct}%</td>
                    <td style={{ ...td, textAlign: "right", color: "#22c55e", fontWeight: 700 }}>{fmtBRL(Number(r.receita_brl))}</td>
                    <td style={{ ...td, textAlign: "right", color: "#556677" }} title="Aguardando ETL de gasto do Engine (DEBT-115)">—</td>
                    <td style={{ ...td, textAlign: "right", color: "#556677" }} title="Aguardando ETL de gasto do Engine (DEBT-115)">—</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid #2a2a2a" }}>
                <td style={{ ...td, color: "#FFFFFF", fontWeight: 700 }} colSpan={2}>TOTAL</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{tot.leads}</td>
                <td style={{ ...td, textAlign: "center", color: "#22c55e", fontWeight: 700 }}>{tot.conv}</td>
                <td style={{ ...td, textAlign: "center", color: "#8899aa", fontWeight: 700 }}>{tot.leads > 0 ? Math.round((tot.conv / tot.leads) * 1000) / 10 : 0}%</td>
                <td style={{ ...td, textAlign: "right", color: "#22c55e", fontWeight: 700 }}>{fmtBRL(tot.rec)}</td>
                <td style={{ ...td, textAlign: "right", color: "#556677" }}>—</td>
                <td style={{ ...td, textAlign: "right", color: "#556677" }}>—</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <p style={{ color: "#556677", fontSize: 9, fontFamily: mono }}>
        Fonte: v_leads_por_anuncio (agregada no Postgres, enriquecida por dim_meta_ads). CAC = gasto Meta ÷ convertidos — gasto pendente DEBT-115 (Engine). Datas em BRT.
      </p>
    </div>
  );
}

const th: React.CSSProperties = { fontSize: 9, color: "#556677", fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", padding: "6px 10px", textAlign: "center" };
const td: React.CSSProperties = { padding: "8px 10px", color: "#c8d8e8", fontFamily: mono };
