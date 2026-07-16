"use client";

import { useState, useMemo } from "react";
import { theme } from "@/lib/theme";
import { RED, GREEN, YELLOW, MUT, fmtBRLc, th, td, PERIODOS_RANKING } from "@/lib/marketing/ui";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { SectionHead } from "@/app/dashboard/lib/ui";
import { BarChart3 } from "lucide-react";

export type RankRow = {
  ad_id: string;
  ad_name: string | null;
  campaign_name: string | null;
  periodo: string;          // '30d' | '60d' | '90d' | '6m' | '12m' (v3 — os 5 vivos no banco)
  spend: number;
  leads: number;
  cpl: number | null;
  roas: number | null;
  status_meta: string | null;
};
export type SparkRow = { ad_id: string; data: string; spend: number };

// status_meta → label + cor (ATIVO verde · PAUSADO/ADSET_PAUSED/CAMPAIGN_PAUSED cinza · WITH_ISSUES amarelo)
function statusInfo(s: string | null): { label: string; cor: string } {
  if (!s) return { label: "—", cor: MUT };
  if (s === "ACTIVE") return { label: "ATIVO", cor: GREEN };
  if (s === "WITH_ISSUES") return { label: "COM ISSUES", cor: YELLOW };
  if (s.includes("PAUSED")) {
    const lbl = s === "ADSET_PAUSED" ? "ADSET PAUS." : s === "CAMPAIGN_PAUSED" ? "CAMP. PAUS." : "PAUSADO";
    return { label: lbl, cor: "#c0d0e0" };
  }
  return { label: s, cor: "#c0d0e0" };
}

function StatusBadge({ status }: { status: string | null }) {
  const { label, cor } = statusInfo(status);
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 3, fontSize: 8.5,
      fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".06em",
      color: cor, border: `1px solid ${cor}`, background: `${cor}1a`,
    }}>{label}</span>
  );
}

type SortKey = "cpl" | "roas" | "spend";

export function AnunciosClient({ rank, spark }: { rank: RankRow[]; spark: SparkRow[] }) {
  const [periodo, setPeriodo] = useState<string>("30d");
  const [campanha, setCampanha] = useState<string>("todas");
  const [sortKey, setSortKey] = useState<SortKey>("cpl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const campanhas = useMemo(
    () => Array.from(new Set(rank.map(r => r.campaign_name).filter(Boolean) as string[])).sort(),
    [rank],
  );

  // sparkline: ad_id -> série de spend (7d)
  const sparkMap = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const s of spark) {
      const arr = m.get(s.ad_id) ?? [];
      arr.push(Number(s.spend ?? 0));
      m.set(s.ad_id, arr);
    }
    return m;
  }, [spark]);

  const linhas = useMemo(() => {
    let r = rank.filter(x => x.periodo === periodo);
    if (campanha !== "todas") r = r.filter(x => x.campaign_name === campanha);
    const dir = sortDir === "asc" ? 1 : -1;
    return [...r].sort((a, b) => {
      const va = a[sortKey] == null ? null : Number(a[sortKey]);
      const vb = b[sortKey] == null ? null : Number(b[sortKey]);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;   // nulls sempre por último
      if (vb == null) return -1;
      return (va - vb) * dir;
    });
  }, [rank, periodo, campanha, sortKey, sortDir]);

  // DEBT-119: anúncios com gasto e ZERO lead atribuído — extraídos pra um bloco no topo,
  // fora do CPL/CAC da tabela (senão somem com "—" e inflam a leitura de eficiência).
  const semRetorno = useMemo(
    () => linhas.filter(r => Number(r.spend ?? 0) > 0 && Number(r.leads ?? 0) === 0),
    [linhas],
  );
  const comRetorno = useMemo(
    () => linhas.filter(r => !(Number(r.spend ?? 0) > 0 && Number(r.leads ?? 0) === 0)),
    [linhas],
  );
  const semRetornoTot = useMemo(
    () => semRetorno.reduce((a, r) => a + Number(r.spend ?? 0), 0),
    [semRetorno],
  );

  const tot = useMemo(() => comRetorno.reduce(
    (a, r) => ({ spend: a.spend + Number(r.spend ?? 0), leads: a.leads + Number(r.leads ?? 0) }),
    { spend: 0, leads: 0 },
  ), [comRetorno]);
  const cacTot = tot.leads > 0 ? tot.spend / tot.leads : null;

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "cpl" ? "asc" : "desc"); }
  }
  const seta = (k: SortKey) => (sortKey === k ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {PERIODOS_RANKING.map(p => {
            const active = periodo === p;
            return (
              <button key={p} onClick={() => setPeriodo(p)} style={{
                padding: "5px 12px", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
                fontFamily: theme.font.label, fontWeight: 700, cursor: "pointer", borderRadius: 3,
                background: active ? RED : "transparent", color: active ? "#fff" : "#c0c8d8",
                border: `1px solid ${active ? RED : "var(--asb-border)"}`,
              }}>{p}</button>
            );
          })}
        </div>
        <select value={campanha} onChange={e => setCampanha(e.target.value)} style={{
          padding: "5px 10px", fontSize: 11, fontFamily: theme.font.label, background: "var(--asb-card-hi)",
          color: "#c8d8e8", border: "1px solid var(--asb-border)", borderRadius: 3,
        }}>
          <option value="todas">Todas as campanhas</option>
          {campanhas.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label }}>ordenar:</span>
        {(["cpl", "roas", "spend"] as const).map(k => (
          <button key={k} onClick={() => toggleSort(k)} style={{
            padding: "4px 9px", fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase",
            fontFamily: theme.font.label, fontWeight: 600, cursor: "pointer", borderRadius: 3,
            background: sortKey === k ? "rgba(200,16,46,.14)" : "transparent",
            color: sortKey === k ? "#fff" : "#c0d0e0", border: "1px solid var(--asb-border)",
          }}>{k}{seta(k)}</button>
        ))}
      </div>

      {/* Gasto sem retorno atribuído (DEBT-119) — destacado no topo */}
      {semRetorno.length > 0 && (
        <div style={{ ...S.card, background: "rgba(200,16,46,.10)", borderLeft: `3px solid ${RED}`, padding: "16px 20px" }}>
          <p style={{ color: RED, fontSize: 13.5, fontWeight: 750, fontFamily: theme.font.label, letterSpacing: "-.01em", marginBottom: 6 }}>
            Gasto Sem Retorno Atribuído — DEBT-119
          </p>
          <div style={{ display: "flex", gap: 24, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ color: YELLOW, fontSize: 20, fontWeight: 700, fontFamily: theme.font.num }}>{fmtBRLc(semRetornoTot)}</span>
            <span style={{ color: "#c8d8e8", fontSize: 12, fontFamily: theme.font.label }}>{semRetorno.length} anúncio{semRetorno.length > 1 ? "s" : ""} · 0 leads atribuídos</span>
          </div>
          <p style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label, marginTop: 8 }}>
            Anúncios site/[LEAD]-SP com gasto e nenhum lead atribuível (botões wa.me genéricos — DEBT-119). Não entram no CPL/CAC da tabela abaixo.
          </p>
        </div>
      )}

      {/* Tabela */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={BarChart3} color="#8bb4ff" title="Ranking de Criativos" desc="Gasto · leads · CPL · ROAS por anúncio" />
        <div style={{ overflowX: "auto" }}>
        {comRetorno.length === 0 ? (
          <p style={{ color: MUT, fontSize: 11, fontFamily: theme.font.label, textAlign: "center", padding: 20 }}>
            Sem anúncios com lead atribuído neste período/campanha.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: theme.font.num }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--asb-border)" }}>
                <th style={{ ...th, textAlign: "left" }}>Campanha</th>
                <th style={{ ...th, textAlign: "left" }}>Anúncio</th>
                <th style={{ ...th, textAlign: "center" }}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Gasto</th>
                <th style={th}>Leads</th>
                <th style={{ ...th, textAlign: "right" }}>CPL</th>
                <th style={{ ...th, textAlign: "right" }}>ROAS</th>
                <th style={{ ...th, textAlign: "center" }}>7d</th>
              </tr>
            </thead>
            <tbody>
              {comRetorno.map(r => {
                const cpl = r.cpl != null ? Number(r.cpl) : null;
                const roas = r.roas != null ? Number(r.roas) : null;
                const semLead = Number(r.spend ?? 0) > 0 && Number(r.leads ?? 0) === 0;
                return (
                  <tr key={r.ad_id} style={{ borderTop: "1px solid var(--asb-border)", background: semLead ? "rgba(200,16,46,.12)" : "transparent" }}
                    title={semLead ? "Gasto sem nenhum lead atribuído — considere revisar/pausar" : undefined}>
                    <td style={{ ...td, color: "#c8d8e8" }}>{r.campaign_name ?? "—"}</td>
                    <td style={{ ...td, color: "#FFFFFF" }} title={`ad_id ${r.ad_id}`}>
                      {semLead && <span style={{ color: RED, marginRight: 5 }}>⚠</span>}
                      {r.ad_name ?? <span style={{ color: MUT }}>{r.ad_id}</span>}
                    </td>
                    <td style={{ ...td, textAlign: "center" }}><StatusBadge status={r.status_meta} /></td>
                    <td style={{ ...td, textAlign: "right", color: YELLOW }}>{fmtBRLc(Number(r.spend ?? 0))}</td>
                    <td style={{ ...td, textAlign: "center" }}>{r.leads}</td>
                    <td style={{ ...td, textAlign: "right", color: cpl != null ? "#FFFFFF" : MUT, fontWeight: 700 }}>{cpl != null ? fmtBRLc(cpl) : "—"}</td>
                    <td style={{ ...td, textAlign: "right", color: roas != null && roas >= 1 ? GREEN : "#c8d8e8" }}>{roas != null ? `${roas.toFixed(2)}×` : "—"}</td>
                    <td style={{ ...td, textAlign: "center" }}><Sparkline serie={sparkMap.get(r.ad_id) ?? []} /></td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid var(--asb-border2)" }}>
                <td style={{ ...td, color: "#FFFFFF", fontWeight: 700 }} colSpan={3}>TOTAL com retorno ({comRetorno.length}) — CPL exclui o bloco DEBT-119</td>
                <td style={{ ...td, textAlign: "right", color: YELLOW, fontWeight: 700 }}>{fmtBRLc(tot.spend)}</td>
                <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{tot.leads}</td>
                <td style={{ ...td, textAlign: "right", color: cacTot != null ? "#FFFFFF" : MUT, fontWeight: 700 }}>{cacTot != null ? fmtBRLc(cacTot) : "—"}</td>
                <td style={td} colSpan={2} />
              </tr>
            </tbody>
          </table>
        )}
        </div>
      </div>
      <p style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label }}>
        Fonte: v_ranking_criativo (CPL/ROAS por ad_id, janela {periodo}) + v_performance_diaria (sparkline gasto 7d). CPL = gasto ÷ leads · ROAS = receita ÷ gasto. Anúncios sem leads atribuíveis (site/[LEAD]-SP — DEBT-119) estão destacados no bloco acima.
      </p>
    </div>
  );
}

// Sparkline SVG minimalista (gasto dos últimos dias)
function Sparkline({ serie }: { serie: number[] }) {
  if (!serie || serie.length < 2) return <span style={{ color: MUT, fontSize: 10, fontFamily: theme.font.num }}>—</span>;
  const w = 72, h = 22, pad = 2;
  const max = Math.max(...serie, 1);
  const min = Math.min(...serie, 0);
  const rng = max - min || 1;
  const step = (w - pad * 2) / (serie.length - 1);
  const pts = serie.map((v, i) => {
    const x = pad + i * step;
    const y = h - pad - ((v - min) / rng) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "inline-block", verticalAlign: "middle" }}>
      <polyline points={pts} fill="none" stroke={RED} strokeWidth={1.5} />
    </svg>
  );
}

