"use client";
// Etapa 2 item 5: relatório mensal de insumos — READ-ONLY (resumo das views + apontamentos automáticos).
// Sem persistência/tabela. Montado em 2 lugares (Meses 2026 + Gerencial) com a MESMA lógica.
import { C, mono, sCard, sLabel } from "../lib/ui";
import { brl, num } from "../lib/formatadores";
import { CAT_RECORTE, CAT_GORDURA, type InsumoDiario, type InsumoComparativo } from "../lib/storage-supabase";

type Apont = { tipo: "alerta" | "atencao" | "positivo" | "info"; txt: string };
const COR = { alerta: C.vermelho, atencao: C.amarelo, positivo: C.verde2, info: C.mut };

export function RelatorioInsumos({ mesLabel, diario, comparativo }: { mesLabel: string; diario: InsumoDiario[]; comparativo: InsumoComparativo[] }) {
  const recorteKg = diario.filter((d) => d.categoria === CAT_RECORTE).reduce((s, d) => s + Number(d.kg), 0);
  const gorduraKg = diario.filter((d) => d.categoria === CAT_GORDURA).reduce((s, d) => s + Number(d.kg), 0);
  const outrosKg = diario.filter((d) => d.categoria !== CAT_RECORTE && d.categoria !== CAT_GORDURA).reduce((s, d) => s + Number(d.kg), 0);
  const custoTotal = diario.reduce((s, d) => s + Number(d.custo_brl), 0);
  const pctMedio = recorteKg > 0 ? (gorduraKg / recorteKg) * 100 : null;

  const comDados = comparativo.filter((c) => c.pct_gordura != null) as (InsumoComparativo & { pct_gordura: number })[];
  const diasAlto = comDados.filter((c) => c.pct_gordura > 14);
  const diasBaixo = comDados.filter((c) => c.pct_gordura < 6);
  const diasSemRecorte = comparativo.filter((c) => c.pct_gordura == null && Number(c.gordura_kg) > 0);

  const apont: Apont[] = [];
  if (diasAlto.length) apont.push({ tipo: "alerta", txt: `${diasAlto.length} dia(s) com % acima de 14% (alto) — ${diasAlto.map((d) => d.data.slice(8)).join(", ")}.` });
  if (diasBaixo.length) apont.push({ tipo: "atencao", txt: `${diasBaixo.length} dia(s) abaixo de 6% (baixo) — ${diasBaixo.map((d) => d.data.slice(8)).join(", ")}.` });
  if (diasSemRecorte.length) apont.push({ tipo: "atencao", txt: `${diasSemRecorte.length} dia(s) com Gordura sem Recorte lançado (% indefinido) — ${diasSemRecorte.map((d) => d.data.slice(8)).join(", ")}.` });
  if (pctMedio != null && pctMedio >= 6 && pctMedio <= 14 && !diasAlto.length && !diasBaixo.length) apont.push({ tipo: "positivo", txt: `Mês dentro da faixa ideal — % médio ${pctMedio.toFixed(1)}%.` });

  const card = (label: string, valor: string, cor: string, sub?: string) => (
    <div style={{ ...sCard, padding: "12px 14px" }}>
      <p style={{ ...sLabel, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, color: cor, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>{valor}</p>
      {sub && <p style={{ fontSize: 9, color: C.mut2, fontFamily: mono, marginTop: 2 }}>{sub}</p>}
    </div>
  );
  const corPct = pctMedio == null ? C.mut : pctMedio < 6 ? C.amarelo : pctMedio > 14 ? C.vermelho : C.verde2;

  return (
    <div style={{ ...sCard, padding: 16 }}>
      <p style={{ color: C.branco, fontSize: 12, fontWeight: 700, fontFamily: mono, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>
        Relatório de Insumos — {mesLabel}
      </p>
      {diario.length === 0 ? (
        <p style={{ color: C.mut, fontSize: 11, fontFamily: mono }}>sem lançamentos de insumo no mês.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 14 }}>
            {card("Recorte 80/20", `${num(recorteKg, 1)} kg`, C.branco)}
            {card("Gordura", `${num(gorduraKg, 1)} kg`, C.branco)}
            {card("% Gordura / Recorte", pctMedio == null ? "—" : `${pctMedio.toFixed(1)}%`, corPct, "ideal 10% · faixa 6–14%")}
            {card("Custo total", brl(custoTotal), C.texto, outrosKg > 0 ? `+ ${num(outrosKg, 1)} kg outros` : undefined)}
          </div>
          <p style={{ ...sLabel, marginBottom: 8 }}>Apontamentos do mês (automáticos)</p>
          {apont.length === 0 ? (
            <p style={{ color: C.mut, fontSize: 11, fontFamily: mono }}>Sem desvios — nenhum dia fora da faixa 6–14%.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {apont.map((a, i) => (
                <div key={i} style={{ borderLeft: `3px solid ${COR[a.tipo]}`, background: `${COR[a.tipo]}11`, borderRadius: 4, padding: "8px 12px" }}>
                  <p style={{ color: C.texto, fontSize: 11, fontFamily: mono }}>{a.txt}</p>
                </div>
              ))}
            </div>
          )}
          <p style={{ color: C.mut2, fontSize: 9, fontFamily: mono, textAlign: "center", letterSpacing: ".05em", marginTop: 14 }}>
            AMERICAN STEAK BRASIL · RELATÓRIO DE INSUMOS {mesLabel} · GERADO AUTOMATICAMENTE · USO INTERNO
          </p>
        </>
      )}
    </div>
  );
}
