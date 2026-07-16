"use client";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { C, sCard } from "../lib/ui";
import { StatTile, SectionHead } from "@/app/dashboard/lib/ui";
import { theme } from "@/lib/theme";
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
  if (err) return <p style={{ color: C.vermelho, fontFamily: theme.font.label, fontSize: 12 }}>{err}</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
        {cards.map((c) => (
          <StatTile key={c.nivel} label={`${ICONE[c.nivel]} ${NOME[c.nivel]}`} value={c.count} num={c.cor} accent={c.cor} sub={c.faixa} />
        ))}
      </div>
      <div style={{ ...sCard, padding: 16 }}>
        <SectionHead Icon={AlertTriangle} color={C.laranja} title="Alertas ativos" desc="Meses acima do alvo de custo/kg" />
        {ativos.length === 0 ? <p style={{ color: C.verde2, fontSize: 12, fontFamily: theme.font.label }}>Nenhum mês acima do alvo.</p> :
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ativos.map((a) => (
              <div key={a.ano_mes} style={{ borderLeft: `3px solid ${a.cor}`, background: `${a.cor}11`, borderRadius: 4, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                <AlertTriangle size={14} color={a.cor} />
                <span style={{ color: C.branco, fontSize: 12, fontFamily: theme.font.label, fontWeight: 700 }}>{a.ano_mes}</span>
                <span style={{ color: a.cor, fontSize: 11, fontFamily: theme.font.label }}>{brl(a.custo_medio_kg)}/kg · {a.label}</span>
              </div>
            ))}
          </div>}
      </div>
    </div>
  );
}
