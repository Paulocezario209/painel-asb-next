"use client";

// Feature 1 / DEBT-108: Calendário de Metas MULTI-MÊS no /dashboard/gerente.
// Navega qualquer mês (chama a RPC calendario_metas_mes) e reusa o MetaCalendarGrid
// (mesmo grid do /vendas). NÃO altera o /vendas (que segue mono-mês via v_calendario_metas).

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MetaCalendarGrid, type MetaCalDay } from "./meta-calendar-grid";
import GerenteDayModal from "@/components/dashboard/gerente-day-modal";
import { getDayPedidos, getDayCnb, getDayAusentes } from "@/app/dashboard/vendas/actions";

type RpcRow = MetaCalDay & {
  vendedor_routing_team: string;
  is_weekend: boolean;
  pct_atingido_dia: number | null;
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const VENDORS = [
  { k: "all", name: "Consolidado", accent: "#185FA5" },
  { k: "SETOR_SOROCABA_SAO_PAULO", name: "Ana Paula", accent: "#C8102E" },
  { k: "SETOR_CAMPINAS_JUNDIAI", name: "Alan", accent: "#22c55e" },
  { k: "SETOR_CUIT", name: "SETOR CUIT", accent: "#ff7b1c" },
];


export function MetasCalendarioGerente() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);     // 1-12
  const [vendor, setVendor] = useState<string>("all");
  const [rows, setRows] = useState<RpcRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [modalDia, setModalDia] = useState<string | null>(null);
  const [modalPedidos, setModalPedidos] = useState<any[]>([]);
  const [modalCnb, setModalCnb] = useState<any[]>([]);
  const [modalAusentes, setModalAusentes] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchMes = useCallback(async (a: number, m: number) => {
    setLoading(true); setErro(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("calendario_metas_mes", { p_ano: a, p_mes: m });
      if (error) { setErro(error.message); setRows([]); }
      else setRows((data ?? []) as RpcRow[]);
    } catch (e) {
      setErro(String(e)); setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMes(ano, mes); setDiaSel(null); }, [ano, mes, fetchMes]);

  // Filtra por vendedor (consolidado = soma por dia; recomputa status — mesma lógica do /vendas)
  const days: MetaCalDay[] = useMemo(() => {
    if (vendor !== "all") return rows.filter(r => r.vendedor_routing_team === vendor);
    const byDay = new Map<string, MetaCalDay & { is_weekend: boolean }>();
    for (const c of rows) {
      const ex = byDay.get(c.dia);
      if (!ex) {
        byDay.set(c.dia, { dia: c.dia, is_today: c.is_today, is_futuro: c.is_futuro, is_weekend: c.is_weekend, status_dia: c.status_dia, meta_diaria_brl: 0, realizado_brl: 0, faturado_brl: 0, is_dia_meta: false, realizado_meta_brl: 0 });
      }
      const cur = byDay.get(c.dia)!;
      cur.meta_diaria_brl = Number(cur.meta_diaria_brl) + Number(c.meta_diaria_brl);
      cur.realizado_brl = Number(cur.realizado_brl) + Number(c.realizado_brl);
      cur.faturado_brl = Number(cur.faturado_brl ?? 0) + Number((c as any).faturado_brl ?? 0);
      cur.is_dia_meta = cur.is_dia_meta || !!c.is_dia_meta;
      cur.realizado_meta_brl = Number(cur.realizado_meta_brl ?? 0) + Number(c.realizado_meta_brl ?? 0);
    }
    return Array.from(byDay.values()).map(c => {
      // DEBT-132: status do consolidado sobre o realizado FOLD (igual à view/RPC)
      const realMeta = Number(c.realizado_meta_brl ?? c.realizado_brl);
      return {
        ...c,
        status_dia: (c.is_weekend && c.meta_diaria_brl === 0) ? "weekend" :
                    c.is_futuro ? "futuro" :
                    realMeta >= c.meta_diaria_brl && c.meta_diaria_brl > 0 ? "batida" :
                    realMeta === 0 ? "sem_dado" : "abaixo",
      };
    }) as MetaCalDay[];
  }, [rows, vendor]);

  const handleDayClick = useCallback(async (dia: string) => {
    setDiaSel(dia);
    const d = days.find(x => x.dia === dia);
    if (!d || d.is_futuro) return;
    setModalLoading(true);
    setModalDia(dia);
    const teamFilter = vendor === "all" ? "all" : vendor;
    const [pedidos, cnb, ausentes] = await Promise.all([
      getDayPedidos(dia, teamFilter),
      getDayCnb(dia, teamFilter),
      getDayAusentes(dia, teamFilter),
    ]);
    setModalPedidos(pedidos);
    setModalCnb(cnb);
    setModalAusentes(ausentes);
    setModalLoading(false);
  }, [days, vendor]);

  const metaMes = useMemo(() => days.reduce((s, d) => s + Number(d.meta_diaria_brl), 0), [days]);
  const realMes = useMemo(() => days.reduce((s, d) => s + Number(d.realizado_brl), 0), [days]);
  const temPassado = days.some(d => !d.is_futuro && d.status_dia !== "weekend");
  const corHex = useMemo(() => {
    if (metaMes <= 0 || !temPassado) return "#e4e9f0";
    const r = realMes / metaMes;
    return r >= 1 ? "#22c55e" : r >= 0.8 ? "#D4A017" : r >= 0.5 ? "#BA7517" : "#C8102E";
  }, [metaMes, realMes, temPassado]);

  const mesLabel = `${MESES[mes - 1]} ${ano}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Navegação de mês */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setAno(a => a - 1)} style={navBtn(false)}>‹ {ano - 1}</button>
        {MESES.map((nm, i) => {
          const active = (i + 1) === mes;
          return (
            <button key={nm} onClick={() => setMes(i + 1)} style={navBtn(active)}>{nm}</button>
          );
        })}
        <button onClick={() => setAno(a => a + 1)} style={navBtn(false)}>{ano + 1} ›</button>
      </div>

      {/* Toggle vendedor */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#e4e9f0", fontFamily: "'Courier New', monospace" }}>Vendedor</span>
        {VENDORS.map(v => {
          const active = vendor === v.k;
          return (
            <button key={v.k} onClick={() => setVendor(v.k)} style={{
              padding: "6px 12px", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase",
              fontFamily: "'Courier New', monospace", fontWeight: 700,
              background: active ? v.accent : "transparent", color: active ? "#FFFFFF" : "#c0c8d8",
              border: `1px solid ${active ? v.accent : "#2a2a2a"}`, borderRadius: 3, cursor: "pointer", transition: "all .15s",
            }}>{v.name}</button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: "center", color: "#c0d0e0", fontFamily: "'Courier New', monospace", fontSize: 12 }}>Carregando {mesLabel}…</div>
      ) : erro ? (
        <div style={{ padding: 16, color: "#C8102E", fontFamily: "'Courier New', monospace", fontSize: 12 }}>Erro: {erro}</div>
      ) : (
        <>
          <MetaCalendarGrid
            days={days}
            selectedDay={diaSel}
            onDayClick={handleDayClick}
            mesLabel={mesLabel}
            metaMesBrl={metaMes}
            corHex={corHex}
          />

          <p style={{ fontSize: 10, color: "#e4e9f0", fontFamily: "'Courier New', monospace", textAlign: "center" }}>
            Clique num dia {temPassado ? "para ver pedidos, CNB e ausentes" : "(mês futuro: só meta)"}.
          </p>
        </>
      )}

      {modalDia && !modalLoading && (() => {
        const d = days.find(x => x.dia === modalDia);
        return (
          <GerenteDayModal
            dia={modalDia}
            vendorLabel={vendor === "all" ? "Consolidado" : vendor}
            pedidos={modalPedidos}
            cnb={modalCnb}
            ausentes={modalAusentes}
            meta={Number(d?.meta_diaria_brl ?? 0)}
            realizado={Number(d?.realizado_brl ?? 0)}
            faturado={Number(d?.faturado_brl ?? 0)}
            onClose={() => setModalDia(null)}
          />
        );
      })()}
      {modalLoading && modalDia && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "#c0c8d8", fontFamily: "'Courier New', monospace" }}>Carregando...</p>
        </div>
      )}
    </div>
  );
}

function navBtn(active: boolean): React.CSSProperties {
  return {
    padding: "5px 10px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase",
    fontFamily: "'Courier New', monospace", fontWeight: 700,
    background: active ? "#185FA5" : "transparent", color: active ? "#FFFFFF" : "#c0d0e0",
    border: `1px solid ${active ? "#185FA5" : "#2a2a2a"}`, borderRadius: 3, cursor: "pointer", transition: "all .15s",
  };
}
