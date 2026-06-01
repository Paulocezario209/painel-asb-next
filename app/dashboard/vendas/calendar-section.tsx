"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { getDayPedidos, type DayPedido, type EstrategiasResponse } from "./actions";
import { DayDetailModal } from "./day-detail-modal";
import { MissaoDoDia } from "./missao-do-dia";
import { PainelGestor } from "./painel-gestor";
import { PreviewMissaoModal } from "./preview-missao-modal";

type DayCell = {
  dia: string;
  vendedor_routing_team: string;
  meta_diaria_brl: number;
  realizado_brl: number;
  faturado_brl: number;
  pedidos_total: number;
  clientes_total: number;
  is_weekend: boolean;
  is_today: boolean;
  is_futuro: boolean;
  is_dia_meta?: boolean;
  dia_semana?: number;
  status_dia: "weekend" | "futuro" | "batida" | "abaixo" | "sem_dado" | "nao_rota";
  pct_atingido_dia: number | null;
};

type ResumoVendor = {
  vendedor_routing_team: string;
  meta_diaria_brl: number;
  meta_acumulada_brl: number;
  meta_total_mes_brl: number;
  realizado_acumulado_brl: number;
  realizado_hoje_brl: number;  // refactor 2026-05-21: agora = realizado da PRÓXIMA data padrão de meta
  realizado_dia_atual_brl?: number;
  proxima_data_meta?: string | null;
  meta_proxima_data_brl?: number;
  saldo_brl: number;          // saldo do MÊS (Acumulado − Esperado até hoje)
  saldo_dia_brl?: number;     // saldo do DIA (Realizado próx meta − Meta próx data)
  realizado_mes_brl?: number;   // §5 do mês (ARES+CNB) — = realizado_acumulado_brl no mês corrente
  pct_atingido_acumulado: number | null;
  pct_atingido_mes: number | null;
  dias_batidos: number;
  dias_abaixo: number;
  dias_uteis_decorridos: number;
  dias_uteis_mes: number;
  cor_card_mes: "verde" | "amarelo" | "laranja" | "vermelho" | "cinza";
};

const VENDOR_LABELS: Record<string, { name: string; region: string; accent: string }> = {
  SETOR_CUIT:                { name: "Paulo Cezario", region: "CUIT — key accounts",    accent: "#ff7b1c" },
  SETOR_SOROCABA_SAO_PAULO:  { name: "Ana Paula",     region: "Sorocaba / Grande SP",   accent: "#C8102E" },
  SETOR_CAMPINAS_JUNDIAI:    { name: "Alan",          region: "Campinas / Jundiai",     accent: "#22c55e" },
};
const ORDER = ["SETOR_CUIT", "SETOR_SOROCABA_SAO_PAULO", "SETOR_CAMPINAS_JUNDIAI"];
const COR_HEX: Record<string, string> = {
  verde:    "#22c55e",
  amarelo:  "#D4A017",
  laranja:  "#BA7517",
  vermelho: "#C8102E",
  cinza:    "#556677",
};
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function fmtBRL(v: number, frac = 0): string {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: frac, maximumFractionDigits: frac });
}

export function CalendarSection({
  calendario,
  resumos,
  emissaoByVendor,
  cnbByVendor,
  restrictedToVendor,
  estrategias,
}: {
  calendario: DayCell[];
  resumos: ResumoVendor[];
  emissaoByVendor?: Record<string, { realizadoMes: number; realizadoCiclo: number; qtdCiclo: number; windowStart: string }>;
  cnbByVendor?: Record<string, number>;
  restrictedToVendor?: string | null;
  estrategias?: EstrategiasResponse | null;
}) {
  const [vendor, setVendor] = useState<string>(restrictedToVendor ?? "all");
  const isRestricted = !!restrictedToVendor;

  const resumoConsolidado: ResumoVendor = useMemo(() => {
    const sumMeta = resumos.reduce((a, r) => a + Number(r.meta_diaria_brl), 0);
    const sumMetaAcum = resumos.reduce((a, r) => a + Number(r.meta_acumulada_brl), 0);
    const sumMetaTotal = resumos.reduce((a, r) => a + Number(r.meta_total_mes_brl), 0);
    const sumRealAcum = resumos.reduce((a, r) => a + Number(r.realizado_acumulado_brl), 0);
    const sumRealHoje = resumos.reduce((a, r) => a + Number(r.realizado_hoje_brl), 0);
    const sumBatidos = resumos.reduce((a, r) => a + Number(r.dias_batidos), 0);
    const sumAbaixo = resumos.reduce((a, r) => a + Number(r.dias_abaixo), 0);
    const pctAcum = sumMetaAcum > 0 ? (sumRealAcum / sumMetaAcum) * 100 : null;
    const pctMes = sumMetaTotal > 0 ? (sumRealAcum / sumMetaTotal) * 100 : null;
    let cor: ResumoVendor["cor_card_mes"] = "cinza";
    if (sumMetaTotal > 0) {
      const r = sumRealAcum / sumMetaTotal;
      if (r >= 1)        cor = "verde";
      else if (r >= 0.8) cor = "amarelo";
      else if (r >= 0.5) cor = "laranja";
      else               cor = "vermelho";
    }
    return {
      vendedor_routing_team: "ALL",
      meta_diaria_brl: sumMeta,
      meta_acumulada_brl: sumMetaAcum,
      meta_total_mes_brl: sumMetaTotal,
      realizado_acumulado_brl: sumRealAcum,
      realizado_hoje_brl: sumRealHoje,
      saldo_brl: sumRealAcum - sumMetaAcum,
      pct_atingido_acumulado: pctAcum,
      pct_atingido_mes: pctMes,
      dias_batidos: sumBatidos,
      dias_abaixo: sumAbaixo,
      dias_uteis_decorridos: resumos[0]?.dias_uteis_decorridos ?? 0,
      dias_uteis_mes: resumos[0]?.dias_uteis_mes ?? 0,
      cor_card_mes: cor,
    };
  }, [resumos]);

  const calendarioFiltrado = useMemo(() => {
    if (vendor === "all") {
      const byDay = new Map<string, DayCell>();
      for (const c of calendario) {
        const ex = byDay.get(c.dia);
        if (!ex) {
          byDay.set(c.dia, {
            ...c,
            vendedor_routing_team: "ALL",
            meta_diaria_brl: 0,
            realizado_brl: 0,
            faturado_brl: 0,
            pedidos_total: 0,
            clientes_total: 0,
          });
        }
        const cur = byDay.get(c.dia)!;
        cur.meta_diaria_brl = Number(cur.meta_diaria_brl) + Number(c.meta_diaria_brl);
        cur.realizado_brl = Number(cur.realizado_brl) + Number(c.realizado_brl);
        cur.faturado_brl = Number(cur.faturado_brl) + Number(c.faturado_brl);
        cur.pedidos_total = Number(cur.pedidos_total) + Number(c.pedidos_total);
        cur.clientes_total = Number(cur.clientes_total) + Number(c.clientes_total);
      }
      return Array.from(byDay.values()).map(c => ({
        ...c,
        // FIX: dia de meta tem prioridade sobre weekend (Alan SAB = dia-meta)
        status_dia: (c.is_weekend && c.meta_diaria_brl === 0) ? "weekend" :
                    c.is_futuro ? "futuro" :
                    c.realizado_brl >= c.meta_diaria_brl && c.meta_diaria_brl > 0 ? "batida" :
                    c.realizado_brl === 0 ? "sem_dado" : "abaixo",
        pct_atingido_dia: c.meta_diaria_brl > 0 && c.realizado_brl > 0
          ? Math.round((c.realizado_brl / c.meta_diaria_brl) * 1000) / 10
          : null,
      })) as DayCell[];
    }
    return calendario.filter(c => c.vendedor_routing_team === vendor);
  }, [calendario, vendor]);

  const resumoAtivo = vendor === "all" ? resumoConsolidado : resumos.find(r => r.vendedor_routing_team === vendor) ?? resumoConsolidado;

  // Monta grid mes (semanas)
  const diasOrdenados = useMemo(() => [...calendarioFiltrado].sort((a, b) => a.dia.localeCompare(b.dia)), [calendarioFiltrado]);

  // Encontra primeiro dia do mes pra fazer padding
  const primeiroDia = diasOrdenados[0];
  const padding = primeiroDia ? new Date(primeiroDia.dia + "T00:00:00").getDay() : 0;
  const dataSelecionada = diasOrdenados.find(d => d.is_today) ?? diasOrdenados[0];
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(dataSelecionada?.dia ?? null);

  // Drill-down: modal de pedidos do dia
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDia, setModalDia] = useState<string>("");
  const [modalPedidos, setModalPedidos] = useState<DayPedido[]>([]);
  const [pendingModal, startModalTransition] = useTransition();

  function openDayModal(dia: string) {
    setDiaSelecionado(dia);
    setModalDia(dia);
    setModalPedidos([]);
    setModalOpen(true);
    const teamFilter = vendor === "all" ? null : vendor;
    startModalTransition(async () => {
      const list = await getDayPedidos(dia, teamFilter);
      setModalPedidos(list);
    });
  }

  // Preview missão de outro vendedor (gestor pode ver como cada vendedor vê)
  const [previewVendor, setPreviewVendor] = useState<string | null>(null);

  const corCardHex = COR_HEX[resumoAtivo.cor_card_mes];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Toggle vendedor — escondido pra vendedor (vê só os próprios dados) */}
      {!isRestricted && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#556677", fontFamily: "'Courier New', monospace" }}>
            Vendedor
          </span>
          {[{ k: "all", label: "Consolidado" }, ...ORDER.map(k => ({ k, label: VENDOR_LABELS[k]?.name ?? k }))].map(({ k, label }) => {
            const active = vendor === k;
            const accent = k === "all" ? "#185FA5" : VENDOR_LABELS[k]?.accent ?? "#185FA5";
            return (
              <button
                key={k}
                onClick={() => setVendor(k)}
                style={{
                  padding: "6px 12px",
                  fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
                  fontFamily: "'Courier New', monospace", fontWeight: 700,
                  background: active ? accent : "transparent",
                  color: active ? "#FFFFFF" : "#c0c8d8",
                  border: `1px solid ${active ? accent : "#2a2a2a"}`,
                  borderRadius: 3,
                  cursor: "pointer", transition: "all .15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Cards individuais por vendedor (vendedor: só o próprio) */}
      <div className="asb-grid-kpi">
        {ORDER.filter(rt => !isRestricted || rt === restrictedToVendor).map(rt => {
          const r = resumos.find(x => x.vendedor_routing_team === rt);
          if (!r) return null;
          const v = VENDOR_LABELS[rt];
          const corMes = COR_HEX[r.cor_card_mes];
          // RESTAURA emissão tempo-real no card (REALIZADO DIA / ACUMULADO / %).
          // Faturado §5 (v_resumo) preservado em linha separada "Faturado (oficial)".
          const em = emissaoByVendor?.[rt];
          const metaProx = Number(r.meta_proxima_data_brl ?? r.meta_diaria_brl);
          // REALIZADO (CICLO) v2 (§2): só pedidos cujo dia de faturamento = proxima_data_meta (este card); ACUMULADO = mês corrente.
          const realizadoCiclo = em ? em.realizadoCiclo : r.realizado_hoje_brl;
          const acumuladoEmissao = em ? em.realizadoMes : r.realizado_acumulado_brl;
          // Feature 2: §5 oficial (ARES+CNB) decomposto — número total inalterado, só separa CNB.
          const totalSf = Number(r.realizado_acumulado_brl);          // §5 oficial (já = ARES+CNB)
          const cnbVend = Number(cnbByVendor?.[rt] ?? 0);             // parte CNB (v_cnb_mes_vendedor)
          const aresPart = totalSf - cnbVend;                         // parte ARES (fiscal) = §5 − CNB
          const saldoMes = acumuladoEmissao - Number(r.meta_acumulada_brl);
          const saldoPositivo = saldoMes >= 0;
          const pctCiclo = metaProx > 0
            ? Math.round((realizadoCiclo / metaProx) * 1000) / 10
            : r.pct_atingido_mes;
          return (
            <div
              key={rt}
              style={{
                background: "#1a1a1a",
                border: `1px solid ${vendor === rt ? v.accent : "#2a2a2a"}`,
                borderTop: `3px solid ${v.accent}`,
                borderRadius: 4,
                padding: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: v.accent, fontFamily: "'Courier New', monospace", textTransform: "uppercase", letterSpacing: ".1em" }}>
                    {v.name}
                  </p>
                  <p style={{ fontSize: 9, color: "#8899aa", marginTop: 2, fontFamily: "'Courier New', monospace" }}>{v.region}</p>
                </div>
                <span
                  style={{
                    background: corMes, color: "#fff",
                    padding: "3px 8px", borderRadius: 3, fontSize: 9,
                    fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  {pctCiclo !== null ? <span className="priv-pct">{`${pctCiclo}%`}</span> : "—"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 14 }}>
                {(() => {
                  const saldoDia = realizadoCiclo - metaProx;   // ciclo (janela) − meta próx
                  const saldoDiaPositivo = saldoDia >= 0;
                  return [
                  {
                    label: r.proxima_data_meta
                      ? `Meta ${new Date(r.proxima_data_meta + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }).replace(",", "").toUpperCase()}`
                      : "Meta próx.",
                    value: <span className="priv-brl">{fmtBRL(metaProx)}</span>,
                    c: "#ff7b1c"
                  },
                  {
                    label: "Realizado (ciclo)",
                    value: <span className="priv-brl">{fmtBRL(realizadoCiclo)}</span>,
                    c: realizadoCiclo >= metaProx && metaProx > 0 ? "#22c55e" : realizadoCiclo > 0 ? "#D4A017" : "#556677"
                  },
                  {
                    label: "Saldo dia",
                    value: <span className="priv-brl">{(saldoDiaPositivo ? "+" : "") + fmtBRL(saldoDia)}</span>,
                    c: saldoDiaPositivo ? "#22c55e" : "#C8102E"
                  },
                  { label: "Acumulado",  value: <span className="priv-brl">{fmtBRL(acumuladoEmissao)}</span>, c: "#FFFFFF" },
                  { label: "Esperado",   value: <span className="priv-brl">{fmtBRL(r.meta_acumulada_brl)}</span>, c: "#8899aa" },
                  { label: "Saldo mês",  value: <span className="priv-brl">{(saldoPositivo ? "+" : "") + fmtBRL(saldoMes)}</span>, c: saldoPositivo ? "#22c55e" : "#C8102E" },
                  { label: "Total §5 (ARES+CNB)", value: <span className="priv-brl">{fmtBRL(totalSf)}</span>, c: "#22c55e" },
                  { label: "↳ ARES (fiscal)", value: <span className="priv-brl">{fmtBRL(aresPart)}</span>, c: "#8899aa" },
                  { label: `↳ CNB ${v.name}`, value: <span className="priv-brl">{fmtBRL(cnbVend)}</span>, c: cnbVend > 0 ? "#ff7b1c" : "#556677" },
                ];})().map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "#556677", fontFamily: "'Courier New', monospace", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase" }}>{row.label}</span>
                    <span style={{ color: row.c, fontWeight: 700, fontFamily: "'Courier New', monospace" }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid rgba(27,42,107,.3)", marginTop: 12, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <span style={{ color: "#8899aa", fontFamily: "'Courier New', monospace" }}>
                  ✓ <span style={{ color: "#22c55e", fontWeight: 700 }}>{r.dias_batidos}</span> &nbsp;
                  ✗ <span style={{ color: "#C8102E", fontWeight: 700 }}>{r.dias_abaixo}</span>
                </span>
                <span style={{ color: "#8899aa", fontFamily: "'Courier New', monospace" }}>
                  {r.dias_uteis_decorridos}/{r.dias_uteis_mes} dias úteis
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendario + Detalhe lateral */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        {/* Calendario */}
        <div
          style={{
            background: "#1a1a1a",
            border: `2px solid ${corCardHex}`,
            borderRadius: 4,
            padding: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#c0c8d8", fontFamily: "'Courier New', monospace", textTransform: "uppercase", letterSpacing: ".1em" }}>
              📅 Calendário — {new Date((diasOrdenados[0]?.dia ?? new Date().toISOString().slice(0, 10)) + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </p>
            <span
              style={{
                background: corCardHex, color: "#fff",
                padding: "3px 10px", borderRadius: 3, fontSize: 10,
                fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
                fontFamily: "'Courier New', monospace",
              }}
            >
              Meta mês: <span className="priv-brl">{fmtBRL(Number(resumoAtivo.meta_total_mes_brl))}</span>
            </span>
          </div>

          {/* DOW header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
            {DOW.map(d => (
              <div key={d} style={{ fontSize: 9, color: "#556677", textAlign: "center", fontFamily: "'Courier New', monospace", textTransform: "uppercase", letterSpacing: ".1em" }}>{d}</div>
            ))}
          </div>

          {/* Grid dias */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {Array.from({ length: padding }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {diasOrdenados.map(d => {
              const dia = new Date(d.dia + "T00:00:00").getDate();
              const selected = diaSelecionado === d.dia;
              const isToday = d.is_today;
              let bg = "#0a0f1f", border = "1px solid #2a2a2a", color = "#c8d8e8", marker = "", markerColor = "transparent";
              if (d.status_dia === "weekend") {
                bg = "#0a0f1f"; color = "#3a4555"; border = "1px solid #15203d";
              } else if (d.status_dia === "nao_rota") {
                // Dia útil sem meta do vendedor. Se houve venda (encaixe), mostra "+"
                bg = "#0a0f1f"; color = "#6a7a8a"; border = "1px solid #15203d";
                if (Number(d.realizado_brl) > 0) {
                  marker = "+"; markerColor = "#185FA5";
                }
              } else if (d.status_dia === "futuro") {
                bg = "#0a0f1f"; color = "#556677"; border = "1px solid #2a2a2a";
                // Dia futuro COM lançamentos em curso = marca laranja ▶
                if (Number(d.realizado_brl) > 0) {
                  marker = "▸"; markerColor = "#ff7b1c";
                }
              } else if (d.status_dia === "batida") {
                marker = "✓"; markerColor = "#22c55e";
              } else if (d.status_dia === "abaixo") {
                marker = "✗"; markerColor = "#C8102E";
              }
              if (isToday) {
                border = "2px solid #ff7b1c";
              }
              if (selected) {
                border = "2px solid #c0c8d8";
              }
              return (
                <button
                  key={d.dia}
                  onClick={() => openDayModal(d.dia)}
                  style={{
                    background: bg, border, borderRadius: 3,
                    color, padding: "6px 4px", textAlign: "center",
                    cursor: d.status_dia === "weekend" ? "default" : "pointer",
                    fontFamily: "'Courier New', monospace", fontSize: 11,
                    fontWeight: 700, position: "relative", minHeight: 44,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                    transition: "all .15s",
                  }}
                  disabled={d.status_dia === "weekend"}
                >
                  <span>{dia}</span>
                  {marker && (
                    <span style={{ color: markerColor, fontSize: 13, fontWeight: 900, lineHeight: 1 }}>
                      {marker}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(27,42,107,.3)", display: "flex", gap: 14, fontSize: 9, color: "#8899aa", fontFamily: "'Courier New', monospace", flexWrap: "wrap" }}>
            <span><span style={{ color: "#22c55e", fontWeight: 900 }}>✓</span> Meta batida</span>
            <span><span style={{ color: "#C8102E", fontWeight: 900 }}>✗</span> Abaixo</span>
            <span><span style={{ color: "#185FA5", fontWeight: 900 }}>+</span> Encaixe (fora rota)</span>
            <span style={{ color: "#6a7a8a" }}>○ Dia útil sem meta</span>
            <span style={{ color: "#3a4555" }}>■ Sáb/Dom</span>
            <span style={{ color: "#ff7b1c" }}>● Hoje</span>
          </div>
        </div>

        {/* Vendedor → Missão pessoal · Gestor consolidado → Painel analítico · Gestor com vendedor selecionado → Missão daquele */}
        {estrategias ? (
          isRestricted ? (
            <MissaoDoDia data={estrategias} vendor={restrictedToVendor!} />
          ) : vendor === "all" ? (
            <PainelGestor data={estrategias} onVendorClick={setPreviewVendor} />
          ) : (
            <MissaoDoDia data={estrategias} vendor={vendor} />
          )
        ) : (
        <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 20, maxHeight: 540, overflowY: "auto", display: "none" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#c0c8d8", fontFamily: "'Courier New', monospace", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12 }}>
            Detalhe por dia (legacy — escondido se estrategias presente)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* FIX: incluir sábado/domingo se for dia-meta + esconder dias completamente vazios */}
            {diasOrdenados
              .filter(d => d.status_dia !== "weekend")
              .filter(d => d.is_dia_meta || Number(d.realizado_brl) > 0) // esconder Meta=0 + Real=0
              .map(d => {
              const isSelected = diaSelecionado === d.dia;
              const dt = new Date(d.dia + "T00:00:00");
              const diaNum = dt.getDate();
              const dow = DOW[dt.getDay()];
              const saldo = Number(d.realizado_brl) - Number(d.meta_diaria_brl);
              const isEncaixe = !d.is_dia_meta && Number(d.realizado_brl) > 0;
              let accent = "#556677";
              if (d.status_dia === "batida") accent = "#22c55e";
              else if (d.status_dia === "abaixo") accent = "#C8102E";
              else if (d.status_dia === "futuro") accent = Number(d.realizado_brl) > 0 ? "#ff7b1c" : "#2a2a2a";
              else if (isEncaixe) accent = "#185FA5";

              return (
                <div
                  key={d.dia}
                  onClick={() => openDayModal(d.dia)}
                  style={{
                    background: isSelected ? "#15203d" : "#0a0f1f",
                    border: `1px solid ${isSelected ? "#c0c8d8" : accent}`,
                    borderLeft: `3px solid ${accent}`,
                    borderRadius: 3, padding: "10px 12px",
                    cursor: "pointer", transition: "all .15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ color: "#c0c8d8", fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700 }}>
                      {String(diaNum).padStart(2, "0")} ({dow})
                    </span>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {d.is_today && <span style={{ background: "#ff7b1c", color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>HOJE</span>}
                      {isEncaixe && <span style={{ background: "rgba(24,95,165,.15)", color: "#185FA5", padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>ENCAIXE</span>}
                      {d.is_dia_meta && !d.is_futuro && d.status_dia === "batida" && <span style={{ color: "#22c55e", fontSize: 13, fontWeight: 900 }}>✓</span>}
                      {d.is_dia_meta && !d.is_futuro && d.status_dia === "abaixo" && <span style={{ color: "#C8102E", fontSize: 13, fontWeight: 900 }}>✗</span>}
                      {d.is_dia_meta && d.is_futuro && Number(d.realizado_brl) > 0 && <span style={{ color: "#ff7b1c", fontSize: 13, fontWeight: 900 }}>▸</span>}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 4, fontSize: 10, fontFamily: "'Courier New', monospace" }}>
                    {d.is_dia_meta && (
                      <>
                        <span style={{ color: "#556677" }}>Meta:</span>
                        <span style={{ color: "#c8d8e8", textAlign: "right" }}><span className="priv-brl">{fmtBRL(d.meta_diaria_brl)}</span></span>
                      </>
                    )}
                    <span style={{ color: "#556677" }}>{isEncaixe ? "Encaixe:" : "Real:"}</span>
                    <span style={{ color: d.realizado_brl > 0 ? "#FFFFFF" : "#3a4555", textAlign: "right" }}><span className="priv-brl">{fmtBRL(d.realizado_brl)}</span></span>
                    {d.is_dia_meta && !d.is_futuro && (
                      <>
                        <span style={{ color: "#556677" }}>{saldo >= 0 ? "Super." : "Déb.:"}</span>
                        <span style={{ color: saldo >= 0 ? "#22c55e" : "#C8102E", fontWeight: 700, textAlign: "right" }}>
                          <span className="priv-brl">{(saldo >= 0 ? "+" : "") + fmtBRL(saldo)}</span>
                        </span>
                      </>
                    )}
                    {d.is_dia_meta && d.pct_atingido_dia !== null && (
                      <>
                        <span style={{ color: "#556677" }}>%:</span>
                        <span style={{ color: d.status_dia === "batida" ? "#22c55e" : d.is_futuro ? "#ff7b1c" : "#C8102E", fontWeight: 700, textAlign: "right" }}><span className="priv-pct">{d.pct_atingido_dia}%</span></span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}
      </div>

      {modalOpen && (
        <DayDetailModal
          dia={modalDia}
          vendorLabel={
            vendor === "all"
              ? "Consolidado"
              : VENDOR_LABELS[vendor]?.name ?? vendor
          }
          pedidos={pendingModal ? [] : modalPedidos}
          onClose={() => setModalOpen(false)}
        />
      )}

      {previewVendor && estrategias && (
        <PreviewMissaoModal
          vendor={previewVendor}
          data={estrategias}
          onClose={() => setPreviewVendor(null)}
        />
      )}
    </div>
  );
}
