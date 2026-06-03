"use client";

import { useMemo } from "react";

export type CampanhaRow = {
  campaign_name: string | null;
  leads: number;
  convertidos: number;
  conv_pct: number | null;
  receita_brl: number;
  gasto_total: number;
  cac_por_lead: number | null;
  custo_por_conversao: number | null;
  roas: number | null;
  primeiro_dia_gasto: string | null;
  ultimo_dia_gasto: string | null;
};

const mono = "'Courier New', monospace";

function fmtBRLc(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(frac: number | null) {
  if (frac == null) return "0%";
  return (Number(frac) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + "%";
}
function fmtRoas(v: number | null) {
  if (v == null || Number(v) <= 0) return "—";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "x";
}
function fmtData(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}

export function FunilCacClient({ rows }: { rows: CampanhaRow[] }) {
  // a view já vem ORDER BY gasto_total DESC; reordena defensivamente (fetch pode não preservar)
  const ordenadas = useMemo(
    () => [...rows].sort((a, b) => Number(b.gasto_total ?? 0) - Number(a.gasto_total ?? 0)),
    [rows],
  );
  const tot = useMemo(() => ordenadas.reduce(
    (a, r) => ({
      leads: a.leads + Number(r.leads),
      conv: a.conv + Number(r.convertidos),
      rec: a.rec + Number(r.receita_brl),
      gasto: a.gasto + Number(r.gasto_total ?? 0),
    }),
    { leads: 0, conv: 0, rec: 0, gasto: 0 },
  ), [ordenadas]);
  const cacTotal = tot.leads > 0 ? tot.gasto / tot.leads : null;
  const roasTotal = tot.gasto > 0 ? tot.rec / tot.gasto : null;
  const convPctTotal = tot.leads > 0 ? tot.conv / tot.leads : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, overflowX: "auto" }}>
        {ordenadas.length === 0 ? (
          <p style={{ color: "#556677", fontSize: 11, fontFamily: mono, textAlign: "center", padding: 20 }}>
            Sem campanhas com leads/gasto atribuídos ainda — captura e gasto começando a acumular.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: mono }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                <th style={{ ...th, textAlign: "left" }}>Campanha</th>
                <th style={th}>Leads</th>
                <th style={th}>Convertidos</th>
                <th style={th}>Conv. %</th>
                <th style={{ ...th, textAlign: "right" }}>Receita</th>
                <th style={{ ...th, textAlign: "right" }}>Gasto</th>
                <th style={{ ...th, textAlign: "right" }}>CAC</th>
                <th style={{ ...th, textAlign: "right" }}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((r, i) => {
                const cac = r.cac_por_lead != null ? Number(r.cac_por_lead) : null;
                const cpConv = r.custo_por_conversao != null ? fmtBRLc(Number(r.custo_por_conversao)) : "—";
                return (
                  <tr key={r.campaign_name ?? `sem-campanha-${i}`} style={{ borderTop: "1px solid #2a2a2a" }}>
                    <td style={{ ...td, color: "#FFFFFF" }} title={`gasto ${fmtData(r.primeiro_dia_gasto)}→${fmtData(r.ultimo_dia_gasto)}`}>
                      {r.campaign_name ?? <span style={{ color: "#556677" }}>(sem campanha)</span>}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>{r.leads}</td>
                    <td style={{ ...td, textAlign: "center", color: "#22c55e" }}>{r.convertidos}</td>
                    <td style={{ ...td, textAlign: "center", color: "#8899aa" }}>{fmtPct(r.conv_pct)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#22c55e", fontWeight: 700 }}>{fmtBRLc(Number(r.receita_brl))}</td>
                    <td style={{ ...td, textAlign: "right", color: "#e8b923" }}>{fmtBRLc(Number(r.gasto_total ?? 0))}</td>
                    <td style={{ ...td, textAlign: "right", color: cac != null ? "#FFFFFF" : "#556677", fontWeight: 700 }} title={`custo/conversão: ${cpConv}`}>
                      {cac != null ? fmtBRLc(cac) : "—"}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: r.roas != null && Number(r.roas) > 0 ? "#FFFFFF" : "#556677", fontWeight: 700 }}>
                      {fmtRoas(r.roas)}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid #2a2a2a" }}>
                <td style={{ ...td, color: "#FFFFFF", fontWeight: 700 }}>TOTAL</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{tot.leads}</td>
                <td style={{ ...td, textAlign: "center", color: "#22c55e", fontWeight: 700 }}>{tot.conv}</td>
                <td style={{ ...td, textAlign: "center", color: "#8899aa", fontWeight: 700 }}>{fmtPct(convPctTotal)}</td>
                <td style={{ ...td, textAlign: "right", color: "#22c55e", fontWeight: 700 }}>{fmtBRLc(tot.rec)}</td>
                <td style={{ ...td, textAlign: "right", color: "#e8b923", fontWeight: 700 }}>{fmtBRLc(tot.gasto)}</td>
                <td style={{ ...td, textAlign: "right", color: cacTotal != null ? "#FFFFFF" : "#556677", fontWeight: 700 }}>{cacTotal != null ? fmtBRLc(cacTotal) : "—"}</td>
                <td style={{ ...td, textAlign: "right", color: roasTotal != null && roasTotal > 0 ? "#FFFFFF" : "#556677", fontWeight: 700 }}>{fmtRoas(roasTotal)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <p style={{ color: "#556677", fontSize: 9, fontFamily: mono }}>
        Fonte: v_cac_por_campanha (rollup de v_cac_por_anuncio por campanha). CAC=gasto/leads · ROAS=receita/gasto. Datas em BRT.
      </p>
    </div>
  );
}

const th: React.CSSProperties = { fontSize: 9, color: "#556677", fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", padding: "6px 10px", textAlign: "center" };
const td: React.CSSProperties = { padding: "8px 10px", color: "#c8d8e8", fontFamily: mono };
