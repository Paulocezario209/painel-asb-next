"use client";
import { useEffect, useState } from "react";
import { C, mono, sCard, sLabel } from "../lib/ui";
import { brl, num } from "../lib/formatadores";

type Linha = { mes: number; nome: string; status: string; kg: number; custo_kg: number; valor: number; nivel: string; cor: string; label: string };
type Resp = { ano: number; linhas: Linha[]; total: { kg: number; valor: number; custo_kg: number } };

export function AbaProjecao12({ ano = 2026 }: { ano?: number }) {
  const [d, setD] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { fetch(`/api/compras/custos/projecao-12-meses?ano=${ano}`).then((r) => r.json()).then((j) => j.error ? setErr(j.error) : setD(j)).catch((e) => setErr(String(e))); }, [ano]);
  const th: React.CSSProperties = { ...sLabel, padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.borda}` };
  const td: React.CSSProperties = { padding: "6px 10px", color: C.texto, fontFamily: mono, fontSize: 12, textAlign: "right" };
  if (err) return <p style={{ color: C.vermelho, fontFamily: mono, fontSize: 12 }}>{err}</p>;
  if (!d) return <p style={{ color: C.mut, fontFamily: mono, fontSize: 12 }}>carregando...</p>;
  return (
    <div style={{ ...sCard, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={{ ...th, textAlign: "left" }}>Mês {d.ano}</th><th style={{ ...th, textAlign: "center" }}>Status</th><th style={th}>Kg</th><th style={th}>Custo/Kg</th><th style={th}>Valor</th><th style={{ ...th, textAlign: "center" }}>Alerta</th></tr></thead>
        <tbody>
          {d.linhas.map((l) => (
            <tr key={l.mes} style={{ borderBottom: "1px solid #0b0f1d", opacity: l.status === "projecao" ? 0.7 : 1 }}>
              <td style={{ ...td, textAlign: "left", color: C.branco }}>{l.nome}</td>
              <td style={{ ...td, textAlign: "center" }}><span style={{ fontSize: 9, fontWeight: 700, fontFamily: mono, color: l.status === "realizado" ? C.verde2 : C.mut2, border: `1px solid ${l.status === "realizado" ? C.verde2 : C.mut2}`, borderRadius: 3, padding: "2px 6px" }}>{l.status === "realizado" ? "REALIZADO" : "PROJEÇÃO"}</span></td>
              <td style={td}>{num(l.kg, 0)}</td>
              <td style={{ ...td, color: l.cor, fontWeight: 700 }}>{brl(l.custo_kg)}</td>
              <td style={td}>{brl(l.valor)}</td>
              <td style={{ ...td, textAlign: "center" }}>{l.nivel !== "ideal" && l.nivel !== "projecao" ? <span style={{ fontSize: 9, color: l.cor, fontWeight: 700, fontFamily: mono }}>{l.label}</span> : "—"}</td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid ${C.borda}` }}>
            <td style={{ ...td, textAlign: "left", color: C.branco, fontWeight: 700 }}>TOTAL {d.ano}</td><td />
            <td style={{ ...td, fontWeight: 700, color: C.branco }}>{num(d.total.kg, 0)}</td>
            <td style={{ ...td, fontWeight: 700, color: C.branco }}>{brl(d.total.custo_kg)}</td>
            <td style={{ ...td, fontWeight: 700, color: C.branco }}>{brl(d.total.valor)}</td><td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
