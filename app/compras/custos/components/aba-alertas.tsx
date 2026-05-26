"use client";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { C, mono, sCard, sLabel } from "../lib/ui";
import { brl } from "../lib/formatadores";

type Card = { nivel: string; count: number; faixa: string; cor: string };
type Ativo = { ano_mes: string; custo_medio_kg: number; nivel: string; cor: string; label: string };

const ICONE: Record<string, string> = { critico: "🔴", alerta: "🟠", atencao: "🟡", ideal: "🟢" };
const NOME: Record<string, string> = { critico: "Crítico", alerta: "Alerta", atencao: "Atenção", ideal: "Ideal" };

export function AbaAlertas() {
  const [cards, setCards] = useState<Card[]>([]);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { fetch("/api/compras/custos/alertas-resumo").then((r) => r.json()).then((j) => j.error ? setErr(j.error) : (setCards(j.cards), setAtivos(j.ativos))).catch((e) => setErr(String(e))); }, []);
  if (err) return <p style={{ color: C.vermelho, fontFamily: mono, fontSize: 12 }}>{err}</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
        {cards.map((c) => (
          <div key={c.nivel} style={{ ...sCard, padding: "12px 14px", borderColor: c.cor }}>
            <p style={{ ...sLabel, marginBottom: 4 }}>{ICONE[c.nivel]} {NOME[c.nivel]}</p>
            <p style={{ fontSize: 26, color: c.cor, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>{c.count}</p>
            <p style={{ fontSize: 9, color: C.mut2, fontFamily: mono }}>{c.faixa}</p>
          </div>
        ))}
      </div>
      <div style={{ ...sCard, padding: 16 }}>
        <p style={{ color: C.branco, fontSize: 12, fontWeight: 700, fontFamily: mono, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>Alertas Ativos</p>
        {ativos.length === 0 ? <p style={{ color: C.verde2, fontSize: 12, fontFamily: mono }}>Nenhum mês acima do alvo.</p> :
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ativos.map((a) => (
              <div key={a.ano_mes} style={{ borderLeft: `3px solid ${a.cor}`, background: `${a.cor}11`, borderRadius: 4, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                <AlertTriangle size={14} color={a.cor} />
                <span style={{ color: C.branco, fontSize: 12, fontFamily: mono, fontWeight: 700 }}>{a.ano_mes}</span>
                <span style={{ color: a.cor, fontSize: 11, fontFamily: mono }}>{brl(a.custo_medio_kg)}/kg · {a.label}</span>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}
