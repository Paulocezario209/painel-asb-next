"use client";

import { useState, useMemo } from "react";

export type CanalRow = {
  canal: string;
  segmento: "atribuido" | "pre_captura";
  leads: number;
  convertidos: number;
  faturamento_brl: number;
  primeira_atribuicao: string | null;
};

const mono = "'Courier New', monospace";
const RED = "#C8102E";

function fmtBRL(v: number) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtData(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" });
}

export function OrigemClient({ rows, primeiraAtribuicao }: { rows: CanalRow[]; primeiraAtribuicao: string | null }) {
  const [tab, setTab] = useState<"atribuido" | "pre_captura">(
    rows.some(r => r.segmento === "atribuido") ? "atribuido" : "pre_captura",
  );

  const filtradas = useMemo(
    () => rows.filter(r => r.segmento === tab).sort((a, b) => b.leads - a.leads),
    [rows, tab],
  );
  const tot = useMemo(() => filtradas.reduce(
    (a, r) => ({ leads: a.leads + Number(r.leads), conv: a.conv + Number(r.convertidos), fat: a.fat + Number(r.faturamento_brl) }),
    { leads: 0, conv: 0, fat: 0 },
  ), [filtradas]);

  const countAtrib = rows.filter(r => r.segmento === "atribuido").reduce((a, r) => a + Number(r.leads), 0);
  const countPre = rows.filter(r => r.segmento === "pre_captura").reduce((a, r) => a + Number(r.leads), 0);
  const dataAtrib = fmtData(primeiraAtribuicao);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Nota de atribuição */}
      <div style={{ background: "rgba(200,16,46,.06)", border: `1px solid rgba(200,16,46,.3)`, borderRadius: 6, padding: "10px 14px" }}>
        <p style={{ color: "#c0c8d8", fontSize: 11, fontFamily: mono, lineHeight: 1.6 }}>
          {dataAtrib
            ? <>Atribuição de origem ativa desde <b style={{ color: RED }}>{dataAtrib}</b>. Leads anteriores não têm origem real (segmento <b>Pré-captura</b>).</>
            : <>Atribuição de origem <b style={{ color: RED }}>recém-ativada</b> — ainda sem leads atribuídos. Os {countPre} leads atuais são <b>Pré-captura</b> (sem origem real, não confundir com orgânico).</>}
        </p>
      </div>

      {/* Tabs Atribuído vs Pré-captura */}
      <div style={{ display: "flex", gap: 8 }}>
        {([["atribuido", `Atribuído (${countAtrib})`], ["pre_captura", `Pré-captura (${countPre})`]] as const).map(([k, label]) => {
          const active = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: "6px 14px", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
              fontFamily: mono, fontWeight: 700, cursor: "pointer", borderRadius: 3,
              background: active ? RED : "transparent", color: active ? "#fff" : "#c0c8d8",
              border: `1px solid ${active ? RED : "#2a2a2a"}`, transition: "all .15s",
            }}>{label}</button>
          );
        })}
      </div>

      {/* Tabela canal × leads × convertidos × faturamento */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, overflowX: "auto" }}>
        {filtradas.length === 0 ? (
          <p style={{ color: "#556677", fontSize: 11, fontFamily: mono, textAlign: "center", padding: 20 }}>
            Sem leads neste segmento.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: mono }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                <th style={{ ...th, textAlign: "left" }}>Canal</th>
                <th style={th}>Leads</th>
                <th style={th}>Convertidos</th>
                <th style={th}>Conv. %</th>
                <th style={{ ...th, textAlign: "right" }}>Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(r => {
                const pct = Number(r.leads) > 0 ? Math.round((Number(r.convertidos) / Number(r.leads)) * 1000) / 10 : 0;
                return (
                  <tr key={r.canal} style={{ borderTop: "1px solid #2a2a2a" }}>
                    <td style={{ ...td, color: "#FFFFFF", textTransform: "uppercase" }}>{r.canal}</td>
                    <td style={{ ...td, textAlign: "center" }}>{r.leads}</td>
                    <td style={{ ...td, textAlign: "center", color: "#22c55e" }}>{r.convertidos}</td>
                    <td style={{ ...td, textAlign: "center", color: "#8899aa" }}>{pct}%</td>
                    <td style={{ ...td, textAlign: "right", color: "#22c55e", fontWeight: 700 }}>{fmtBRL(Number(r.faturamento_brl))}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid #2a2a2a" }}>
                <td style={{ ...td, color: "#FFFFFF", fontWeight: 700 }}>TOTAL</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{tot.leads}</td>
                <td style={{ ...td, textAlign: "center", color: "#22c55e", fontWeight: 700 }}>{tot.conv}</td>
                <td style={{ ...td, textAlign: "center", color: "#8899aa", fontWeight: 700 }}>{tot.leads > 0 ? Math.round((tot.conv / tot.leads) * 1000) / 10 : 0}%</td>
                <td style={{ ...td, textAlign: "right", color: "#22c55e", fontWeight: 700 }}>{fmtBRL(tot.fat)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <p style={{ color: "#556677", fontSize: 9, fontFamily: mono }}>
        Fonte: v_leads_por_canal (agregada no Postgres). CAC = gasto (F1 Anúncios) ÷ convertidos por canal.
      </p>
    </div>
  );
}

const th: React.CSSProperties = { fontSize: 9, color: "#556677", fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", padding: "6px 10px", textAlign: "center" };
const td: React.CSSProperties = { padding: "8px 10px", color: "#c8d8e8", fontFamily: mono };
