"use client";

import { useState, useMemo, useTransition } from "react";
import { theme } from "@/lib/theme";
import Link from "next/link";
import { getDayPedidos, getDayCnb, getDayAusentes, type EstrategiasResponse } from "./actions";
import GerenteDayModal from "@/components/dashboard/gerente-day-modal";
import { MetaCalendarGrid } from "@/components/dashboard/meta-calendar-grid";
import { MissaoDoDia } from "./missao-do-dia";
import { PainelGestor } from "./painel-gestor";
import { PreviewMissaoModal } from "./preview-missao-modal";
import { VENDOR_LABELS as VENDOR_NAMES } from "@/lib/vendor-labels";

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
  realizado_meta_brl?: number; // DEBT-132: fold §9 (meta terminal combina até sexta)
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

// Nomes vêm da fonte única (@/lib/vendor-labels); region/accent são detalhes locais desta tela.
const VENDOR_LABELS: Record<string, { name: string; region: string; accent: string }> = {
  SETOR_CUIT:                { name: VENDOR_NAMES.SETOR_CUIT,                region: "CUIT — key accounts",  accent: theme.colors.accent },
  SETOR_SOROCABA_SAO_PAULO:  { name: VENDOR_NAMES.SETOR_SOROCABA_SAO_PAULO,  region: "Sorocaba / Grande SP", accent: theme.colors.critical },
  SETOR_CAMPINAS_JUNDIAI:    { name: VENDOR_NAMES.SETOR_CAMPINAS_JUNDIAI,    region: "Campinas / Jundiai",   accent: theme.colors.success },
};
const ORDER = ["SETOR_CUIT", "SETOR_SOROCABA_SAO_PAULO", "SETOR_CAMPINAS_JUNDIAI"];
const COR_HEX: Record<string, string> = {
  verde:    theme.colors.success,
  amarelo:  theme.colors.warning,
  laranja:  "#BA7517",
  vermelho: theme.colors.critical,
  cinza:    theme.colors.neutral,
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
            realizado_meta_brl: 0,
          });
        }
        const cur = byDay.get(c.dia)!;
        cur.meta_diaria_brl = Number(cur.meta_diaria_brl) + Number(c.meta_diaria_brl);
        cur.realizado_brl = Number(cur.realizado_brl) + Number(c.realizado_brl);
        cur.faturado_brl = Number(cur.faturado_brl) + Number(c.faturado_brl);
        cur.pedidos_total = Number(cur.pedidos_total) + Number(c.pedidos_total);
        cur.clientes_total = Number(cur.clientes_total) + Number(c.clientes_total);
        cur.realizado_meta_brl = Number(cur.realizado_meta_brl ?? 0) + Number(c.realizado_meta_brl ?? 0);
      }
      return Array.from(byDay.values()).map(c => {
        // DEBT-132: ✓/✗ e % do consolidado sobre o realizado FOLD (igual à view)
        const realMeta = Number(c.realizado_meta_brl ?? c.realizado_brl);
        return {
          ...c,
          // FIX: dia de meta tem prioridade sobre weekend (Alan SAB = dia-meta)
          status_dia: (c.is_weekend && c.meta_diaria_brl === 0) ? "weekend" :
                      c.is_futuro ? "futuro" :
                      realMeta >= c.meta_diaria_brl && c.meta_diaria_brl > 0 ? "batida" :
                      realMeta === 0 ? "sem_dado" : "abaixo",
          pct_atingido_dia: c.meta_diaria_brl > 0 && realMeta > 0
            ? Math.round((realMeta / c.meta_diaria_brl) * 1000) / 10
            : null,
        };
      }) as DayCell[];
    }
    return calendario.filter(c => c.vendedor_routing_team === vendor);
  }, [calendario, vendor]);

  const resumoAtivo = vendor === "all" ? resumoConsolidado : resumos.find(r => r.vendedor_routing_team === vendor) ?? resumoConsolidado;

  // Monta grid mes (semanas)
  const diasOrdenados = useMemo(() => [...calendarioFiltrado].sort((a, b) => a.dia.localeCompare(b.dia)), [calendarioFiltrado]);

  // (padding do grid agora é interno ao MetaCalendarGrid)
  const dataSelecionada = diasOrdenados.find(d => d.is_today) ?? diasOrdenados[0];
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(dataSelecionada?.dia ?? null);

  // Drill-down: modal de pedidos do dia
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDia, setModalDia] = useState<string>("");
  const [modalPedidos, setModalPedidos] = useState<any[]>([]);
  const [modalCnb, setModalCnb] = useState<any[]>([]);
  const [modalAusentes, setModalAusentes] = useState<any[]>([]);
  const [pendingModal, startModalTransition] = useTransition();

  function openDayModal(dia: string) {
    setDiaSelecionado(dia);
    setModalDia(dia);
    setModalPedidos([]);
    setModalCnb([]);
    setModalAusentes([]);
    setModalOpen(true);
    // FIX-ETAPA2: /vendas usa o modal completo do gerente (ARES+CNB+pizza+ausentes).
    // teamFilter = vendedor logado (restrictedToVendor) ou o toggle; "all" no consolidado.
    const teamFilter = restrictedToVendor ?? (vendor === "all" ? "all" : vendor);
    startModalTransition(async () => {
      const [pedidos, cnb, ausentes] = await Promise.all([
        getDayPedidos(dia, teamFilter),
        getDayCnb(dia, teamFilter),
        getDayAusentes(dia, teamFilter),
      ]);
      setModalPedidos(pedidos);
      setModalCnb(cnb);
      setModalAusentes(ausentes);
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
          <span style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: theme.colors.neutral, fontFamily: theme.font.label }}>
            Vendedor
          </span>
          {[{ k: "all", label: "Consolidado" }, ...ORDER.map(k => ({ k, label: VENDOR_LABELS[k]?.name ?? k }))].map(({ k, label }) => {
            const active = vendor === k;
            const accent = k === "all" ? theme.colors.brandAsb : VENDOR_LABELS[k]?.accent ?? theme.colors.brandAsb;
            return (
              <button
                key={k}
                onClick={() => setVendor(k)}
                style={{
                  padding: "6px 12px",
                  fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
                  fontFamily: theme.font.label, fontWeight: 700,
                  background: active ? accent : "transparent",
                  color: active ? "#FFFFFF" : theme.colors.textPrimary,
                  border: `1px solid ${active ? accent : theme.colors.borderDefault}`,
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
                border: `1px solid ${vendor === rt ? v.accent : theme.colors.borderDefault}`,
                borderTop: `3px solid ${v.accent}`,
                borderRadius: 4,
                padding: 20,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: v.accent, fontFamily: theme.font.label, textTransform: "uppercase", letterSpacing: ".1em" }}>
                    {v.name}
                  </p>
                  <p style={{ fontSize: 9, color: "#c0d0e0", marginTop: 2, fontFamily: theme.font.label }}>{v.region}</p>
                </div>
                <span
                  style={{
                    background: corMes, color: "#fff",
                    padding: "3px 8px", borderRadius: 3, fontSize: 9,
                    fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
                    fontFamily: theme.font.label,
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
                    c: theme.colors.accent
                  },
                  {
                    label: "Realizado (ciclo)",
                    value: <span className="priv-brl">{fmtBRL(realizadoCiclo)}</span>,
                    c: realizadoCiclo >= metaProx && metaProx > 0 ? theme.colors.success : realizadoCiclo > 0 ? theme.colors.warning : theme.colors.neutral
                  },
                  {
                    label: "Saldo dia",
                    value: <span className="priv-brl">{(saldoDiaPositivo ? "+" : "") + fmtBRL(saldoDia)}</span>,
                    c: saldoDiaPositivo ? theme.colors.success : theme.colors.critical
                  },
                  { label: "Acumulado",  value: <span className="priv-brl">{fmtBRL(acumuladoEmissao)}</span>, c: "#FFFFFF" },
                  { label: "Esperado",   value: <span className="priv-brl">{fmtBRL(r.meta_acumulada_brl)}</span>, c: "#c0d0e0" },
                  { label: "Saldo mês",  value: <span className="priv-brl">{(saldoPositivo ? "+" : "") + fmtBRL(saldoMes)}</span>, c: saldoPositivo ? theme.colors.success : theme.colors.critical },
                  { label: "Total §5 (ARES+CNB)", value: <span className="priv-brl">{fmtBRL(totalSf)}</span>, c: theme.colors.success },
                  { label: "↳ ARES (fiscal)", value: <span className="priv-brl">{fmtBRL(aresPart)}</span>, c: "#c0d0e0" },
                  { label: `↳ CNB ${v.name}`, value: <span className="priv-brl">{fmtBRL(cnbVend)}</span>, c: cnbVend > 0 ? theme.colors.accent : theme.colors.neutral },
                ];})().map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: theme.colors.neutral, fontFamily: theme.font.label, fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase" }}>{row.label}</span>
                    <span style={{ color: row.c, fontWeight: 700, fontFamily: theme.font.num }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid rgba(27,42,107,.3)", marginTop: 12, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                <span style={{ color: "#c0d0e0", fontFamily: theme.font.label }}>
                  ✓ <span style={{ color: theme.colors.success, fontWeight: 700 }}>{r.dias_batidos}</span> &nbsp;
                  ✗ <span style={{ color: theme.colors.critical, fontWeight: 700 }}>{r.dias_abaixo}</span>
                </span>
                <span style={{ color: "#c0d0e0", fontFamily: theme.font.label }}>
                  {r.dias_uteis_decorridos}/{r.dias_uteis_mes} dias úteis
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendario + Detalhe lateral */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        {/* Calendario (grid extraído p/ MetaCalendarGrid — reuso /vendas + /gerente, DEBT-108) */}
        <MetaCalendarGrid
          days={diasOrdenados}
          selectedDay={diaSelecionado}
          onDayClick={openDayModal}
          mesLabel={new Date((diasOrdenados[0]?.dia ?? new Date().toISOString().slice(0, 10)) + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          metaMesBrl={Number(resumoAtivo.meta_total_mes_brl)}
          corHex={corCardHex}
        />

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
        <div style={{ background: "#1a1a1a", border: `1px solid ${theme.colors.borderDefault}`, borderRadius: 8, padding: 20, maxHeight: 540, overflowY: "auto", display: "none" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: theme.colors.textPrimary, fontFamily: theme.font.label, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 12 }}>
            Detalhe por dia (legacy — escondido se estrategias presente)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* FIX: incluir sábado/domingo se for dia-meta + esconder dias completamente vazios */}
            {diasOrdenados
              .filter(d => d.status_dia !== "weekend")
              .filter(d => d.is_dia_meta) // v2: só dias de meta do vendedor; dias sem meta = célula neutra (não renderiza R$ solto)
              .map(d => {
              const isSelected = diaSelecionado === d.dia;
              const dt = new Date(d.dia + "T00:00:00");
              const diaNum = dt.getDate();
              const dow = DOW[dt.getDay()];
              // v2: célula de dia-meta exibe SÓ realizado_meta_brl (fold) vs meta do vendedor
              const realCoerente = Number(d.realizado_meta_brl ?? d.realizado_brl);
              const saldo = realCoerente - Number(d.meta_diaria_brl);
              const isEncaixe = false;
              let accent: string = theme.colors.neutral;
              if (d.status_dia === "batida") accent = theme.colors.success;
              else if (d.status_dia === "abaixo") accent = theme.colors.critical;
              else if (d.status_dia === "futuro") accent = Number(d.realizado_brl) > 0 ? theme.colors.accent : theme.colors.borderDefault;
              else if (isEncaixe) accent = theme.colors.brandAsb;

              return (
                <div
                  key={d.dia}
                  onClick={() => openDayModal(d.dia)}
                  style={{
                    background: isSelected ? "#15203d" : "#0a0f1f",
                    border: `1px solid ${isSelected ? theme.colors.textPrimary : accent}`,
                    borderLeft: `3px solid ${accent}`,
                    borderRadius: 3, padding: "10px 12px",
                    cursor: "pointer", transition: "all .15s",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <span style={{ color: theme.colors.textPrimary, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontSize: 11, fontWeight: 700 }}>
                      {String(diaNum).padStart(2, "0")} ({dow})
                    </span>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {d.is_today && <span style={{ background: theme.colors.accent, color: "#fff", padding: "1px 6px", borderRadius: 3, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", fontFamily: theme.font.label }}>HOJE</span>}
                      {isEncaixe && <span style={{ background: "rgba(24,95,165,.15)", color: theme.colors.brandAsb, padding: "1px 6px", borderRadius: 3, fontSize: 8, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", fontFamily: theme.font.label }}>ENCAIXE</span>}
                      {d.is_dia_meta && !d.is_futuro && d.status_dia === "batida" && <span style={{ color: theme.colors.success, fontSize: 13, fontWeight: 900 }}>✓</span>}
                      {d.is_dia_meta && !d.is_futuro && d.status_dia === "abaixo" && <span style={{ color: theme.colors.critical, fontSize: 13, fontWeight: 900 }}>✗</span>}
                      {d.is_dia_meta && d.is_futuro && Number(d.realizado_brl) > 0 && <span style={{ color: theme.colors.accent, fontSize: 13, fontWeight: 900 }}>▸</span>}
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 4, fontSize: 10, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>
                    {d.is_dia_meta && (
                      <>
                        <span style={{ color: theme.colors.neutral }}>Meta:</span>
                        <span style={{ color: "#c8d8e8", textAlign: "right" }}><span className="priv-brl">{fmtBRL(d.meta_diaria_brl)}</span></span>
                      </>
                    )}
                    <span style={{ color: theme.colors.neutral }}>Real (meta):</span>
                    <span style={{ color: realCoerente > 0 ? "#FFFFFF" : "#3a4555", textAlign: "right" }}><span className="priv-brl">{fmtBRL(realCoerente)}</span></span>
                    {d.is_dia_meta && !d.is_futuro && (
                      <>
                        <span style={{ color: theme.colors.neutral }}>{saldo >= 0 ? "Super." : "Déb.:"}</span>
                        <span style={{ color: saldo >= 0 ? theme.colors.success : theme.colors.critical, fontWeight: 700, textAlign: "right" }}>
                          <span className="priv-brl">{(saldo >= 0 ? "+" : "") + fmtBRL(saldo)}</span>
                        </span>
                      </>
                    )}
                    {d.is_dia_meta && d.pct_atingido_dia !== null && (
                      <>
                        <span style={{ color: theme.colors.neutral }}>%:</span>
                        <span style={{ color: d.status_dia === "batida" ? theme.colors.success : d.is_futuro ? theme.colors.accent : theme.colors.critical, fontWeight: 700, textAlign: "right" }}><span className="priv-pct">{d.pct_atingido_dia}%</span></span>
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

      {modalOpen && !pendingModal && (() => {
        // FIX-ETAPA2: modal completo (GerenteDayModal). D2/D5: split meta × dia-próprio × fora-de-meta.
        // Re-agrega colunas que a view JÁ entrega (realizado_brl/realizado_meta_brl); NÃO recalcula fold.
        const cell = diasOrdenados.find(d => d.dia === modalDia);
        const teamScope = restrictedToVendor ?? vendor;
        const dayRows = calendario.filter(c => c.dia === modalDia
          && (teamScope === "all" ? true : c.vendedor_routing_team === teamScope));
        // v2: só os vendedores COM dia-meta no dia entram na meta e no % (fold). Sexta = só Alan.
        const comMeta = dayRows.filter(c => c.is_dia_meta && Number(c.meta_diaria_brl) > 0);
        const metaDia = comMeta.reduce((s, c) => s + Number(c.meta_diaria_brl), 0);
        const realizadoMeta = comMeta.reduce((s, c) => s + Number(c.realizado_meta_brl ?? 0), 0);
        // Faturado FÍSICO do dia (por data_faturamento, inclui CNB) — só informativo, NUNCA entra no %
        const faturadoDia = dayRows.reduce((s, c) => s + Number(c.realizado_brl), 0);
        const hojeStr = new Date().toISOString().slice(0, 10);
        return (
          <GerenteDayModal
            dia={modalDia}
            vendorLabel={vendor === "all" ? "Consolidado" : VENDOR_LABELS[vendor]?.name ?? vendor}
            pedidos={modalPedidos}
            cnb={modalCnb}
            ausentes={modalAusentes}
            metaDia={metaDia}
            realizadoMeta={realizadoMeta}
            faturadoDia={faturadoDia}
            faturado={Number(cell?.faturado_brl ?? 0)}
            agendado={modalDia > hojeStr}
            onClose={() => setModalOpen(false)}
          />
        );
      })()}
      {modalOpen && pendingModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: theme.colors.textPrimary, fontFamily: theme.font.label }}>Carregando…</p>
        </div>
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
