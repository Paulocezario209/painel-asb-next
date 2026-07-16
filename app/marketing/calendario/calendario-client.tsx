"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { CalendarDays } from "lucide-react";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { SectionHead } from "@/app/dashboard/lib/ui";

export type DiaRow = {
  data: string;            // YYYY-MM-DD
  ad_id: string;
  ad_name: string | null;
  spend: number;
  leads: number;
  cpl: number | null;
};

import { RED, GREEN, YELLOW, MUT, MESES as MESES_ABR, fmtBRL, fmtBRLc } from "@/lib/marketing/ui";

const MESES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DOW = ["D", "S", "T", "Q", "Q", "S", "S"];

const pad2 = (n: number) => String(n).padStart(2, "0");
function pctDelta(a: number, b: number): number | null {
  if (!b) return null;
  return Math.round(((a - b) / b) * 100);
}

type DiaAgg = { gasto: number; leads: number; ads: Set<string>; bestName: string | null; bestCpl: number };

export function CalendarioClient({ ano, rows }: { ano: number; rows: DiaRow[] }) {
  const [mesAberto, setMesAberto] = useState<number | null>(null);
  const [diaSel, setDiaSel] = useState<string | null>(null);

  const { byDia, byMes, maxGastoDia } = useMemo(() => {
    const dia = new Map<string, DiaAgg>();
    for (const r of rows) {
      let d = dia.get(r.data);
      if (!d) { d = { gasto: 0, leads: 0, ads: new Set(), bestName: null, bestCpl: Infinity }; dia.set(r.data, d); }
      d.gasto += Number(r.spend ?? 0);
      d.leads += Number(r.leads ?? 0);
      if (r.ad_id) d.ads.add(r.ad_id);
      const cpl = r.cpl != null ? Number(r.cpl) : null;
      if (cpl != null && cpl < d.bestCpl) { d.bestCpl = cpl; d.bestName = r.ad_name ?? r.ad_id; }
    }
    const mes = new Map<number, { gasto: number; leads: number }>();
    let maxG = 0;
    for (const [k, d] of dia) {
      const m = Number(k.slice(5, 7)) - 1;
      let mm = mes.get(m); if (!mm) { mm = { gasto: 0, leads: 0 }; mes.set(m, mm); }
      mm.gasto += d.gasto; mm.leads += d.leads;
      if (d.gasto > maxG) maxG = d.gasto;
    }
    return { byDia: dia, byMes: mes, maxGastoDia: maxG || 1 };
  }, [rows]);

  // Comparativo: último mês com dado vs o anterior
  const comp = useMemo(() => {
    const ms = Array.from(byMes.keys()).sort((a, b) => a - b);
    if (ms.length < 2) return null;
    const cur = ms[ms.length - 1], prev = ms[ms.length - 2];
    const c = byMes.get(cur)!, p = byMes.get(prev)!;
    const cacC = c.leads > 0 ? c.gasto / c.leads : null;
    const cacP = p.leads > 0 ? p.gasto / p.leads : null;
    return {
      cur, prev, c, p, cacC, cacP,
      dGasto: pctDelta(c.gasto, p.gasto),
      dLeads: c.leads - p.leads,
      dCac: (cacC != null && cacP != null) ? pctDelta(cacC, cacP) : null,
    };
  }, [byMes]);

  const detalheDia = diaSel ? byDia.get(diaSel) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Nav de ano */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Link href={`?ano=${ano - 1}`} style={navBtn}>← {ano - 1}</Link>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: theme.font.num, letterSpacing: ".1em" }}>{ano}</span>
        <Link href={`?ano=${ano + 1}`} style={navBtn}>{ano + 1} →</Link>
        {rows.length === 0 && <span style={{ color: MUT, fontSize: 10, fontFamily: theme.font.label }}>sem dado de gasto neste ano</span>}
      </div>

      {/* Comparativo automático */}
      {comp && (
        <div style={{ ...S.card, padding: "10px 14px", display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ color: "#fff", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700 }}>
            {MESES_ABR[comp.cur]} vs {MESES_ABR[comp.prev]}
          </span>
          <Delta label="CAC" valor={comp.dCac} inverso />
          <Delta label="Gasto" valor={comp.dGasto} />
          <span style={{ color: comp.dLeads >= 0 ? GREEN : RED, fontSize: 11, fontFamily: theme.font.label }}>
            Leads {comp.dLeads >= 0 ? "+" : ""}{comp.dLeads}
          </span>
        </div>
      )}

      {/* Grid 12 meses */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        {MESES_FULL.map((nome, m) => {
          const mm = byMes.get(m);
          const ativo = mesAberto === m;
          const temDado = !!mm && mm.gasto > 0;
          return (
            <button key={m} onClick={() => { setMesAberto(ativo ? null : m); setDiaSel(null); }} style={{
              ...S.card, textAlign: "left", cursor: "pointer",
              background: ativo ? "rgba(200,16,46,.12)" : "var(--asb-card)",
              border: `1px solid ${ativo ? RED : "var(--asb-border)"}`, padding: "10px 12px", transition: "all .15s",
              opacity: temDado ? 1 : 0.5,
            }}>
              <div style={{ color: ativo ? "#fff" : "#c8d8e8", fontSize: 12.5, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: "-.01em" }}>{nome}</div>
              <div style={{ color: YELLOW, fontSize: 15, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontWeight: 800, letterSpacing: "-.02em", marginTop: 5 }}>{mm ? fmtBRL(mm.gasto) : "—"}</div>
              <div style={{ color: MUT, fontSize: 10, fontFamily: theme.font.label, marginTop: 2 }}>{mm ? (mm.leads > 0 ? `${mm.leads} leads` : "sem atribuição") : "sem gasto"}</div>
            </button>
          );
        })}
      </div>

      {/* Mês expandido: heatmap diário + detalhe */}
      {mesAberto != null && (
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <SectionHead Icon={CalendarDays} color="#C8102E" title={`${MESES_FULL[mesAberto]} ${ano}`} desc="Gasto diário — clique num dia para o detalhe" />
          <MonthGrid ano={ano} mes={mesAberto} byDia={byDia} maxGastoDia={maxGastoDia} diaSel={diaSel} onSel={setDiaSel} />

          {/* Detalhe do dia selecionado */}
          <div style={{ marginTop: 14, borderTop: "1px solid var(--asb-border)", paddingTop: 12 }}>
            {detalheDia ? (
              <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "baseline" }}>
                <span style={{ color: "#fff", fontSize: 12, fontFamily: theme.font.num, fontWeight: 700 }}>{fmtDiaBR(diaSel!)}</span>
                <KV label="Gasto" valor={fmtBRLc(detalheDia.gasto)} cor={YELLOW} />
                <KV label="Leads" valor={String(detalheDia.leads)} cor="#c8d8e8" />
                <KV label="CPL" valor={detalheDia.leads > 0 ? fmtBRLc(detalheDia.gasto / detalheDia.leads) : "—"} cor="#fff" />
                <KV label="Anúncios" valor={String(detalheDia.ads.size)} cor="#c0d0e0" />
                <KV label="Melhor criativo" valor={detalheDia.bestName ? `${detalheDia.bestName} (${fmtBRLc(detalheDia.bestCpl)})` : "—"} cor={GREEN} />
              </div>
            ) : (
              <p style={{ color: MUT, fontSize: 10, fontFamily: theme.font.label }}>Clique num dia para ver gasto · leads · CPL · melhor criativo.</p>
            )}
          </div>
        </div>
      )}

      <p style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label }}>
        Fonte: v_performance_diaria (agregada por dia no cliente). Intensidade da célula = gasto do dia ÷ maior gasto diário do ano. Melhor criativo = menor CPL do dia. Leads atribuídos desde 02/06.
      </p>
    </div>
  );
}

function MonthGrid({ ano, mes, byDia, maxGastoDia, diaSel, onSel }: {
  ano: number; mes: number; byDia: Map<string, DiaAgg>; maxGastoDia: number;
  diaSel: string | null; onSel: (k: string) => void;
}) {
  const diasNoMes = new Date(ano, mes + 1, 0).getDate();
  const primeiroDOW = new Date(ano, mes, 1).getDay();
  const celulas: (number | null)[] = [];
  for (let i = 0; i < primeiroDOW; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {DOW.map((d, i) => <div key={i} style={{ textAlign: "center", color: MUT, fontSize: 8, fontFamily: theme.font.label }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {celulas.map((d, i) => {
          if (d == null) return <div key={i} />;
          const key = `${ano}-${pad2(mes + 1)}-${pad2(d)}`;
          const agg = byDia.get(key);
          const intensidade = agg ? agg.gasto / maxGastoDia : 0;
          const sel = diaSel === key;
          const bg = agg ? `rgba(200,16,46,${(0.12 + 0.75 * intensidade).toFixed(3)})` : "var(--asb-card-hi)";
          return (
            <button key={i} onClick={() => onSel(key)}
              title={agg ? `${pad2(d)}/${pad2(mes + 1)} · gasto ${fmtBRLc(agg.gasto)} · ${agg.leads} leads · CPL ${agg.leads > 0 ? fmtBRLc(agg.gasto / agg.leads) : "—"}${agg.bestName ? ` · melhor: ${agg.bestName}` : ""}` : `${pad2(d)}/${pad2(mes + 1)} · sem gasto`}
              style={{
                aspectRatio: "1", borderRadius: 3, cursor: agg ? "pointer" : "default",
                background: bg, border: sel ? `2px solid ${YELLOW}` : "1px solid var(--asb-border)",
                color: intensidade > 0.45 ? "#fff" : "#c0d0e0", fontSize: 9, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{d}</button>
          );
        })}
      </div>
    </div>
  );
}

function Delta({ label, valor, inverso }: { label: string; valor: number | null; inverso?: boolean }) {
  if (valor == null) return <span style={{ color: MUT, fontSize: 11, fontFamily: theme.font.label }}>{label} —</span>;
  // inverso=true (CAC): cair é bom (verde)
  const bom = inverso ? valor < 0 : valor > 0;
  const cor = valor === 0 ? "#c8d8e8" : bom ? GREEN : RED;
  return <span style={{ color: cor, fontSize: 11, fontFamily: theme.font.label }}>{label} {valor > 0 ? "+" : ""}{valor}%</span>;
}
function KV({ label, valor, cor }: { label: string; valor: string; cor: string }) {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column" }}>
      <span style={{ color: MUT, fontSize: 8, fontFamily: theme.font.label, letterSpacing: ".08em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ color: cor, fontSize: 12, fontFamily: theme.font.num, fontWeight: 700 }}>{valor}</span>
    </span>
  );
}
function fmtDiaBR(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

const navBtn: React.CSSProperties = {
  padding: "6px 13px", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".02em",
  color: "#c0c8d8", background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)", borderRadius: 8, textDecoration: "none",
};
