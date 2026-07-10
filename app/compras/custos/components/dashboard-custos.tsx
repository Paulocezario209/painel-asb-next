"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, CalendarDays, LineChart, Package, Target, Settings, FileText, Bell,
  Plus, Layers, Save, RefreshCw, Loader2, Trash2, Database, ArrowLeft,
} from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { C, sCard, sLabel, sInput, btn, btnGhost } from "../lib/ui";
import { theme } from "@/lib/theme";
import { brl, kg, num } from "../lib/formatadores";
import { THRESHOLDS_DEFAULT, STATUS_COR, STATUS_LABEL, type Thresholds, type Status } from "../lib/classificar";
import { calcularProjecao } from "../lib/calcular-projecao";
import { api, type Registro, type InsumoDiario, type InsumoComparativo, type InsumoMensal, CAT_RECORTE, CAT_GORDURA } from "../lib/storage-supabase";
import { Calendario } from "./calendario";
import { AbaGerencial, type MesGer } from "./aba-gerencial";
import { ModalProducao, ModalLote, ModalInsumo } from "./modais";
import { ShewartIMRChart } from "./shewhart-imr-chart";
import { ComparativoInsumosChart } from "./comparativo-insumos-chart";
import { RelatorioInsumos } from "./relatorio-insumos";
import { AbaProjecao12 } from "./aba-projecao12";
import { AbaAlertas } from "./aba-alertas";
import { AbaRelatorio } from "./aba-relatorio";

type Insumo = { id: number; data: string; materia: string; fornecedor: string | null; quantidade: number; unidade: string; custo_unit: number; lote: string | null; validade: string | null; sif: string | null };
type MesAgg = MesGer & { ano: number; mes: number; valor_total: number; dias: number; ops_total: number };
type AlertaAtivo = { ano_mes: string; custo_medio_kg: number; nivel: string; cor: string; label: string };

const ABAS = [
  { id: "geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "meses", label: "Meses 2026", icon: CalendarDays },
  { id: "projecao", label: "Projeção", icon: Target },
  { id: "alertas", label: "Alertas", icon: Bell },
  { id: "insumos", label: "Insumos", icon: Package },
  { id: "relatorio", label: "Relatório", icon: FileText },
  { id: "gerencial", label: "Gerencial", icon: LineChart },
  { id: "config", label: "Config", icon: Settings },
] as const;
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function agregar(regs: Registro[]): MesAgg[] {
  const map = new Map<string, MesAgg>();
  for (const r of regs) {
    const key = r.data.slice(0, 7);
    let m = map.get(key);
    if (!m) { m = { ano_mes: key, ano: +key.slice(0, 4), mes: +key.slice(5, 7), kg_total: 0, valor_total: 0, custo_medio_kg: 0, dias: 0, ops_total: 0, horas_moagem_total: 0, horas_modelagem_total: 0, horas_embalamento_total: 0 }; map.set(key, m); }
    m.kg_total += Number(r.kg_produzido || 0); m.valor_total += Number(r.custo_total || 0);
    if (r.kg_produzido > 0) m.dias += 1;
    m.ops_total += Number(r.ops || 0);
    m.horas_moagem_total += Number(r.horas_moagem || 0); m.horas_modelagem_total += Number(r.horas_modelagem || 0); m.horas_embalamento_total += Number(r.horas_embalamento || 0);
  }
  const arr = [...map.values()];
  for (const m of arr) m.custo_medio_kg = m.kg_total > 0 ? Math.round((m.valor_total / m.kg_total) * 100) / 100 : 0;
  return arr.sort((a, b) => a.ano_mes.localeCompare(b.ano_mes));
}

export function DashboardCustos() {
  const [aba, setAba] = useState<string>("geral");
  const [regs, setRegs] = useState<Registro[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [insumosCons, setInsumosCons] = useState<{ diario: InsumoDiario[]; comparativo: InsumoComparativo[]; mensal: InsumoMensal[] }>({ diario: [], comparativo: [], mensal: [] });
  const [thresholds, setThresholds] = useState<Thresholds>(THRESHOLDS_DEFAULT);
  const [custoHora, setCustoHora] = useState<Record<string, number>>({ moagem: 0, modelagem: 0, embalamento: 0 });
  const [alertasAtivos, setAlertasAtivos] = useState<AlertaAtivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { tipo: "dia" | "lote" | "insumo"; reg?: Registro | null; data?: string }>(null);
  const [selAno, setSelAno] = useState(2026);
  const [selMes, setSelMes] = useState(5);

  // deeplink ?mes=&ano= → abre Meses 2026 no mês alvo
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const m = Number(sp.get("mes")), a = Number(sp.get("ano"));
    if (m >= 1 && m <= 12) { setSelMes(m); setAba("meses"); }
    if (a) setSelAno(a);
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const [r, ins, ac, pc, ar, ic] = await Promise.all([
        api.carregarTodos(), api.insumos().catch(() => []), api.alertasConfig().catch(() => null), api.processoConfig().catch(() => null),
        fetch("/api/compras/custos/alertas-resumo").then((x) => x.json()).catch(() => null),
        api.insumosConsumo().catch(() => ({ diario: [], comparativo: [], mensal: [] })), // endpoint novo: falha NUNCA derruba o dashboard
      ]);
      setRegs(r); setInsumos(ins as Insumo[]); setInsumosCons(ic);
      if (Array.isArray(ac)) { const f = (n: string) => ac.find((x: { nivel: string }) => x.nivel === n)?.valor_max; setThresholds({ IDEAL: f("ideal") ?? THRESHOLDS_DEFAULT.IDEAL, ATENCAO: f("atencao") ?? THRESHOLDS_DEFAULT.ATENCAO, ALERTA: f("alerta") ?? THRESHOLDS_DEFAULT.ALERTA }); }
      if (Array.isArray(pc)) { const o: Record<string, number> = {}; pc.forEach((x: { etapa: string; custo_hora: number }) => (o[x.etapa] = Number(x.custo_hora))); setCustoHora({ moagem: o.moagem ?? 0, modelagem: o.modelagem ?? 0, embalamento: o.embalamento ?? 0 }); }
      if (ar?.ativos) setAlertasAtivos(ar.ativos);
    } catch (e) { setErro((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const regMap = useMemo(() => Object.fromEntries(regs.map((r) => [r.data, r])) as Record<string, Registro>, [regs]);
  const meses = useMemo(() => agregar(regs), [regs]);
  const totalKg = useMemo(() => regs.reduce((s, r) => s + Number(r.kg_produzido || 0), 0), [regs]);
  const totalCusto = useMemo(() => regs.reduce((s, r) => s + Number(r.custo_total || 0), 0), [regs]);
  const custoMedioGeral = totalKg > 0 ? totalCusto / totalKg : 0;
  const mesesComDados = meses.filter((m) => m.kg_total > 0).length;
  const regComKg = regs.filter((r) => r.kg_produzido > 0).length;
  const projAnualKg = mesesComDados > 0 ? Math.round((totalKg / mesesComDados) * 12) : 0;
  const custoHoraZero = custoHora.moagem === 0 && custoHora.modelagem === 0 && custoHora.embalamento === 0;
  const projecao = useMemo(() => calcularProjecao(meses.map((m) => ({ ano_mes: m.ano_mes, kg_total: m.kg_total, custo_medio_kg: m.custo_medio_kg }))), [meses]);

  const mesKey = `${selAno}-${String(selMes).padStart(2, "0")}`; // predicado de mês único (reusado por diasDoMes e insumos)
  const diasDoMes = regs.filter((r) => r.data.slice(0, 7) === mesKey).sort((a, b) => a.data.localeCompare(b.data));
  const mesSel = meses.find((m) => m.ano === selAno && m.mes === selMes);
  const corCusto = (v: number) => (v <= thresholds.IDEAL ? C.verde2 : v <= thresholds.ATENCAO ? C.amarelo : v <= thresholds.ALERTA ? C.laranja : C.vermelho);

  // séries Shewhart I-MR mês-escopadas — derivadas de diasDoMes (já ordenado asc), mesma forma {label,value}
  const sCustoKgMes = diasDoMes.filter((r) => r.kg_produzido > 0 && r.custo_kg != null).map((r) => ({ label: r.data.slice(5), value: Number(r.custo_kg) }));
  const sKgMes = diasDoMes.filter((r) => r.kg_produzido > 0).map((r) => ({ label: r.data.slice(5), value: Number(r.kg_produzido) }));
  const sTempMes = diasDoMes.filter((r) => r.kg_produzido > 0).map((r) => ({ label: r.data.slice(5), value: Number(r.temperatura) }));
  const sOpsMes = diasDoMes.filter((r) => r.ops > 0).map((r) => ({ label: r.data.slice(5), value: Number(r.ops) }));
  const temHoras = regs.some((r) => (r.horas_moagem || 0) > 0 || (r.horas_modelagem || 0) > 0 || (r.horas_embalamento || 0) > 0);

  // Consumo de insumos do mês (Etapa 2 itens 1-2) — reusa mesKey; chaveia por CAT_* (sem string hardcoded). Mesma forma {label,value} dos I-MR.
  const diarioMes = insumosCons.diario.filter((d) => d.data.slice(0, 7) === mesKey).sort((a, b) => a.data.localeCompare(b.data));
  const sRecorteMes = diarioMes.filter((d) => d.categoria === CAT_RECORTE).map((d) => ({ label: d.data.slice(5), value: Number(d.kg) }));
  const sGorduraMes = diarioMes.filter((d) => d.categoria === CAT_GORDURA).map((d) => ({ label: d.data.slice(5), value: Number(d.kg) }));
  // Comparativo % gordura/recorte do mês (Etapa 2 item 3) — pct null = gap; reusa mesKey
  const comparativoMes = insumosCons.comparativo.filter((c) => c.data.slice(0, 7) === mesKey).sort((a, b) => a.data.localeCompare(b.data));
  const sComparativoMes = comparativoMes.map((c) => ({ label: c.data.slice(5), pct: c.pct_gordura, recorte: Number(c.recorte_kg), gordura: Number(c.gordura_kg) }));
  // Consumo mensal Recorte vs Gordura (Etapa 2 item 4 — Gerencial) — pivot de v_insumos_consumo_mensal por ano_mes
  const insumosMensal = useMemo(() => {
    const map = new Map<string, { ano_mes: string; recorte: number; gordura: number }>();
    for (const m of insumosCons.mensal) {
      let e = map.get(m.ano_mes);
      if (!e) { e = { ano_mes: m.ano_mes, recorte: 0, gordura: 0 }; map.set(m.ano_mes, e); }
      if (m.categoria === CAT_RECORTE) e.recorte += Number(m.kg);
      else if (m.categoria === CAT_GORDURA) e.gordura += Number(m.kg);
    }
    return [...map.values()].sort((a, b) => a.ano_mes.localeCompare(b.ano_mes));
  }, [insumosCons.mensal]);

  async function acao(nome: string, fn: () => Promise<unknown>) {
    setBusy(nome); setErro(null);
    try { await fn(); await carregar(); } catch (e) { setErro((e as Error).message); } finally { setBusy(null); }
  }

  const tip = { contentStyle: { background: C.card2, border: `1px solid ${C.borda}`, borderRadius: 6, fontFamily: theme.font.num, fontSize: 11 }, labelStyle: { color: C.branco } };
  const axis = { tick: { fill: C.mut, fontSize: 10, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }, stroke: C.borda };
  const th: React.CSSProperties = { ...sLabel, padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.borda}` };
  const td: React.CSSProperties = { padding: "6px 10px", color: C.texto, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontSize: 12, textAlign: "right" };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.mut, fontFamily: theme.font.label }}><Loader2 className="animate-spin" style={{ margin: "0 auto 10px" }} /> Carregando custos...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: C.branco, fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>Custo de Produção</h1>
          <p style={{ color: C.mut, fontSize: 11, fontFamily: theme.font.label }}>Dashboard ASB 2026 · realizado, projeção, alertas, relatório e controle estatístico</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => acao("ares", () => api.aresSync())} disabled={!!busy} style={btnGhost}><Database size={14} /> {busy === "ares" ? "Sync..." : "Sync ARES"}</button>
          <button onClick={() => acao("backup", () => api.criarBackup(`Backup ${new Date().toLocaleString("pt-BR")}`))} disabled={!!busy} style={btnGhost}><Save size={14} /> Backup</button>
          <button onClick={() => carregar()} style={btnGhost}><RefreshCw size={14} /></button>
        </div>
      </div>

      {erro && <div style={{ border: `1px solid ${C.vermelho}`, background: `${C.vermelho}11`, borderRadius: 6, padding: "8px 12px", color: C.vermelho, fontSize: 11, fontFamily: theme.font.label }}>{erro}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1px solid ${C.borda}`, paddingBottom: 2 }}>
        {ABAS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setAba(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", border: "none", borderBottom: aba === id ? `2px solid ${C.verde}` : "2px solid transparent", background: "transparent", color: aba === id ? C.branco : C.mut, fontSize: 10, fontFamily: theme.font.label, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer" }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* === VISÃO GERAL (5.3.1) === */}
      {aba === "geral" && (
        <>
          {alertasAtivos.length > 0 && (
            <div style={{ border: `1px solid ${C.laranja}`, background: `${C.laranja}11`, borderRadius: 6, padding: "10px 14px" }}>
              <p style={{ color: C.laranja, fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, marginBottom: 6 }}>{alertasAtivos.length} alerta(s) ativo(s)</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {alertasAtivos.map((a) => {
                  const m = Number(a.ano_mes.slice(5));
                  return <button key={a.ano_mes} onClick={() => { setSelMes(m); setSelAno(Number(a.ano_mes.slice(0, 4))); setAba("meses"); }} style={{ background: `${a.cor}22`, border: `1px solid ${a.cor}`, color: a.cor, borderRadius: 4, padding: "3px 8px", fontSize: 10, fontFamily: theme.font.label, fontWeight: 700, cursor: "pointer" }}>{MESES[m - 1]}: {brl(a.custo_medio_kg)}/kg ({a.label})</button>;
                })}
              </div>
            </div>
          )}
          {custoHoraZero && <div style={{ border: `1px solid ${C.amarelo}`, background: `${C.amarelo}11`, borderRadius: 6, padding: "8px 12px" }}><p style={{ color: C.amarelo, fontSize: 11, fontFamily: theme.font.label }}>CUSTO_HORA = R$ 0,00 — aguardando RH/financeiro (DEBT-075).</p></div>}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
            <Kpi label="Kg Realizado" value={kg(totalKg)} cor={C.branco} sub={`${mesesComDados}/12 meses · ${regComKg} registros`} />
            <Kpi label="Valor Realizado" value={brl(totalCusto)} cor={C.texto} sub="Custo acumulado" />
            <Kpi label="Custo Médio/Kg" value={brl(custoMedioGeral)} cor={corCusto(custoMedioGeral)} sub={custoMedioGeral <= thresholds.IDEAL ? "IDEAL" : custoMedioGeral <= thresholds.ALERTA ? "ATENÇÃO" : "CRÍTICO"} />
            <Kpi label="Projeção Anual 2026" value={num(projAnualKg)} cor={C.verde} sub={`${kg(projAnualKg)} · ${brl(custoMedioGeral)}/kg`} />
          </div>
          <div style={{ ...sCard, padding: "14px 8px 6px" }}>
            <p style={{ ...sLabel, padding: "0 6px 8px" }}>Custo médio/kg por mês</p>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={meses}>
                <CartesianGrid stroke={C.borda} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ano_mes" {...axis} /><YAxis {...axis} domain={["auto", "auto"]} />
                <Tooltip {...tip} formatter={(value) => [brl(Number(value)), "custo/kg"]} />
                <ReferenceLine y={thresholds.IDEAL} stroke={C.verde2} strokeDasharray="4 2" label={{ value: "ideal", fill: C.verde2, fontSize: 9 }} />
                <ReferenceLine y={thresholds.ALERTA} stroke={C.vermelho} strokeDasharray="4 2" label={{ value: "alerta", fill: C.vermelho, fontSize: 9 }} />
                <Line type="monotone" dataKey="custo_medio_kg" stroke={C.verde} strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* === MESES 2026 (5.3.2) === */}
      {aba === "meses" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => setAba("geral")} style={btnGhost}><ArrowLeft size={14} /> Voltar</button>
              <MesSelector ano={selAno} mes={selMes} setAno={setSelAno} setMes={setSelMes} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => acao("copiar", () => api.copiarMes(selMes === 1 ? 12 : selMes - 1, selMes, selAno))} disabled={!!busy} style={btnGhost}>Copiar {MESES[(selMes === 1 ? 12 : selMes - 1) - 1]}</button>
              <button onClick={() => setModal({ tipo: "lote" })} style={btnGhost}><Layers size={14} /> Lote Semanal</button>
              <button onClick={() => setModal({ tipo: "dia", data: `${selAno}-${String(selMes).padStart(2, "0")}-01` })} style={btn()}><Plus size={14} /> Registrar</button>
              <button onClick={() => { if (confirm(`Limpar TODOS os registros de ${MESES[selMes - 1]}/${selAno}?`)) acao("limpar", () => api.limparMes(selAno, selMes)); }} disabled={!!busy} style={{ ...btnGhost, borderColor: C.vermelho, color: C.vermelho }}><Trash2 size={14} /> Limpar Mês</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            <Kpi label="Registros" value={`${diasDoMes.length}`} cor={C.texto} sub={`${mesSel?.dias ?? 0} c/ produção`} />
            <Kpi label="Kg Total" value={kg(mesSel?.kg_total ?? 0)} cor={C.branco} />
            <Kpi label="Custo Médio/Kg" value={brl(mesSel?.custo_medio_kg ?? 0)} cor={corCusto(mesSel?.custo_medio_kg ?? 0)} />
            <Kpi label="Valor Total" value={brl(mesSel?.valor_total ?? 0)} cor={C.texto} />
          </div>
          <div style={{ ...sCard, padding: 16 }}>
            <Calendario ano={selAno} mes={selMes} registros={regMap} onPickDia={(data, r) => setModal({ tipo: "dia", data, reg: r })} />
            <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
              {(["ideal", "atencao", "alerta", "critico", "feriado"] as Status[]).map((s) => (<span key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: C.mut, fontFamily: theme.font.label }}><span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COR[s] }} /> {STATUS_LABEL[s]}</span>))}
            </div>
          </div>
          <div style={{ ...sCard, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>Data</th><th style={th}>Kg</th><th style={th}>Custo R$</th><th style={th}>Custo/Kg</th><th style={th}>Temp</th><th style={th}>OPs</th><th style={{ ...th, textAlign: "center" }}>Status</th><th style={{ ...th, textAlign: "center" }}>Ações</th></tr></thead>
              <tbody>
                {diasDoMes.length === 0 ? <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: C.mut2, padding: 20 }}>sem registros neste mês</td></tr> :
                  diasDoMes.map((r) => { const st = (r.status as Status) ?? "sem_dados"; return (
                    <tr key={r.data} style={{ borderBottom: "1px solid #0b0f1d" }}>
                      <td style={{ ...td, textAlign: "left", color: C.branco }}>{r.data}</td>
                      <td style={td}>{num(r.kg_produzido, 1)}</td><td style={td}>{brl(r.custo_total)}</td>
                      <td style={{ ...td, color: STATUS_COR[st], fontWeight: 700 }}>{r.custo_kg != null ? brl(r.custo_kg) : "—"}</td>
                      <td style={td}>{num(r.temperatura, 1)}</td><td style={td}>{r.ops}</td>
                      <td style={{ ...td, textAlign: "center" }}><span style={{ color: STATUS_COR[st], fontSize: 9, fontWeight: 700, border: `1px solid ${STATUS_COR[st]}`, borderRadius: 3, padding: "2px 5px" }}>{STATUS_LABEL[st]}</span></td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <button onClick={() => setModal({ tipo: "dia", data: r.data, reg: r })} style={{ background: "none", border: "none", color: C.mut, cursor: "pointer", marginRight: 6 }} title="editar"><Settings size={13} /></button>
                        <button onClick={() => acao("del", () => api.removerRegistro(r.data))} style={{ background: "none", border: "none", color: C.vermelho, cursor: "pointer" }} title="remover"><Trash2 size={13} /></button>
                      </td>
                    </tr>); })}
              </tbody>
            </table>
          </div>

          {/* Controle diário I-MR — escopado ao mês selecionado (movido de Gerencial, Etapa 1) */}
          <div>
            <p style={{ ...sLabel, marginBottom: 10 }}>CONTROLE DIÁRIO — {selMes}/{selAno}</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(440px,1fr))", gap: 20 }}>
              <ShewartIMRChart title="Variação de Custo (R$/kg)" data={sCustoKgMes} unit="R$" thresholds={{ ideal: thresholds.IDEAL, alerta: thresholds.ATENCAO, critico: thresholds.ALERTA }} />
              <ShewartIMRChart title="Controle de Peso (kg)" data={sKgMes} unit="kg" />
              <ShewartIMRChart title="Controle de Temperatura (°C)" data={sTempMes} unit="°C" />
              <ShewartIMRChart title="Controle de OPs" data={sOpsMes} unit="ops" />
            </div>
          </div>

          {/* Consumo de insumos diário (Etapa 2 itens 1-2) — após CONTROLE DIÁRIO, mesmo mês */}
          <div>
            <p style={{ ...sLabel, marginBottom: 10 }}>CONSUMO DE INSUMOS — {selMes}/{selAno}</p>
            {diarioMes.length === 0 ? (
              <div style={{ ...sCard, padding: 16 }}><p style={{ color: C.mut, fontSize: 11, fontFamily: theme.font.label }}>sem lançamentos de insumo no mês</p></div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(440px,1fr))", gap: 20 }}>
                  <ShewartIMRChart title="Consumo Estatístico de Recorte Bovino (kg)" data={sRecorteMes} unit="kg" />
                  <ShewartIMRChart title="Consumo Estatístico de Gordura Bovina (kg)" data={sGorduraMes} unit="kg" />
                </div>
                <div style={{ marginTop: 20 }}>
                  <ComparativoInsumosChart data={sComparativoMes} />
                </div>
              </>
            )}
          </div>

          {/* Relatório de insumos do mês (Etapa 2 item 5) — read-only */}
          <RelatorioInsumos mesLabel={`${MESES[selMes - 1]}/${selAno}`} diario={diarioMes} comparativo={comparativoMes} />
        </div>
      )}

      {/* === PROJEÇÃO (5.3.3) === */}
      {aba === "projecao" && <AbaProjecao12 ano={selAno} />}

      {/* === ALERTAS (5.3.4) === */}
      {aba === "alertas" && <AbaAlertas />}

      {/* === INSUMOS === */}
      {aba === "insumos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={() => setModal({ tipo: "insumo" })} style={btn()}><Plus size={14} /> Novo insumo</button></div>
          <div style={{ ...sCard, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>Data</th><th style={{ ...th, textAlign: "left" }}>Matéria</th><th style={{ ...th, textAlign: "left" }}>Fornecedor</th><th style={th}>Qtd</th><th style={th}>Un</th><th style={th}>Custo Un</th><th style={{ ...th, textAlign: "center" }}></th></tr></thead>
              <tbody>
                {insumos.length === 0 ? <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: C.mut2, padding: 20 }}>nenhum insumo</td></tr> :
                  insumos.map((i) => (
                    <tr key={i.id} style={{ borderBottom: "1px solid #0b0f1d" }}>
                      <td style={{ ...td, textAlign: "left" }}>{i.data}</td><td style={{ ...td, textAlign: "left", color: C.branco }}>{i.materia}</td><td style={{ ...td, textAlign: "left", color: C.mut }}>{i.fornecedor ?? "—"}</td>
                      <td style={td}>{num(i.quantidade, 2)}</td><td style={td}>{i.unidade}</td><td style={td}>{brl(i.custo_unit)}</td>
                      <td style={{ ...td, textAlign: "center" }}><button onClick={() => acao("delins", () => api.removerInsumo(i.id))} style={{ background: "none", border: "none", color: C.vermelho, cursor: "pointer" }}><Trash2 size={13} /></button></td>
                    </tr>))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === RELATÓRIO (5.3.7) === */}
      {aba === "relatorio" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <MesSelector ano={selAno} mes={selMes} setAno={setSelAno} setMes={setSelMes} />
          <AbaRelatorio ano={selAno} mes={selMes} />
        </div>
      )}

      {/* === GERENCIAL (5.3.5/6) === */}
      {aba === "gerencial" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <AbaGerencial meses={meses} registros={regs} thresholds={thresholds} insumosMensal={insumosMensal} />
          <RelatorioInsumos mesLabel={`${MESES[selMes - 1]}/${selAno}`} diario={diarioMes} comparativo={comparativoMes} />
          {!temHoras && (
            <div style={{ ...sCard, padding: 16 }}>
              <p style={{ ...sLabel, marginBottom: 6 }}>Horas vs Kg (Moagem / Modelagem / Embalamento)</p>
              <p style={{ color: C.mut, fontSize: 11, fontFamily: theme.font.label }}>São necessários pelo menos 2 dias com horas de processo e kg registrados. (Apontamento de horas via upload XLSX — Fase 5.1.)</p>
            </div>
          )}
        </div>
      )}

      {/* === CONFIG === */}
      {aba === "config" && <ConfigTab thresholds={thresholds} custoHora={custoHora} onReload={carregar} />}

      {/* Modais */}
      {modal?.tipo === "dia" && <ModalProducao registro={modal.reg ?? (modal.data ? regMap[modal.data] : null)} onClose={() => setModal(null)} onSaved={carregar} />}
      {modal?.tipo === "lote" && <ModalLote semanaInicio={`${selAno}-${String(selMes).padStart(2, "0")}-01`} onClose={() => setModal(null)} onSaved={carregar} />}
      {modal?.tipo === "insumo" && <ModalInsumo onClose={() => setModal(null)} onSaved={carregar} />}
    </div>
  );
}

function Kpi({ label, value, cor, sub }: { label: string; value: string; cor: string; sub?: string }) {
  return (
    <div style={{ ...sCard, padding: "12px 14px" }}>
      <p style={{ ...sLabel, marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, color: cor, fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: C.mut2, fontFamily: theme.font.label, marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function MesSelector({ ano, mes, setAno, setMes }: { ano: number; mes: number; setAno: (n: number) => void; setMes: (n: number) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select value={mes} onChange={(e) => setMes(+e.target.value)} style={{ ...sInput, width: "auto" }}>{MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select>
      <select value={ano} onChange={(e) => setAno(+e.target.value)} style={{ ...sInput, width: "auto" }}>{[2025, 2026, 2027].map((a) => <option key={a} value={a}>{a}</option>)}</select>
    </div>
  );
}

function ConfigTab({ thresholds, custoHora, onReload }: { thresholds: Thresholds; custoHora: Record<string, number>; onReload: () => void }) {
  const [ch, setCh] = useState(custoHora);
  const [th, setTh] = useState(thresholds);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function salvar() {
    setSaving(true); setMsg(null);
    try {
      const P = (url: string, body: unknown) => fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await Promise.all([
        P("/api/compras/custos/processo/config", { etapa: "moagem", custo_hora: ch.moagem }),
        P("/api/compras/custos/processo/config", { etapa: "modelagem", custo_hora: ch.modelagem }),
        P("/api/compras/custos/processo/config", { etapa: "embalamento", custo_hora: ch.embalamento }),
        P("/api/compras/custos/alertas/config", { nivel: "ideal", valor_max: th.IDEAL }),
        P("/api/compras/custos/alertas/config", { nivel: "atencao", valor_max: th.ATENCAO }),
        P("/api/compras/custos/alertas/config", { nivel: "alerta", valor_max: th.ALERTA }),
      ]);
      setMsg("Salvo."); onReload();
    } catch (e) { setMsg((e as Error).message); }
    setSaving(false);
  }
  const campo = (label: string, val: number, on: (n: number) => void) => (<div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={sLabel}>{label}</span><input type="number" step="0.01" value={val} onChange={(e) => on(Number(e.target.value))} style={sInput} /></div>);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600 }}>
      <div style={{ ...sCard, padding: 16 }}>
        <p style={{ ...sLabel, marginBottom: 10 }}>Custo-hora por etapa (R$/h) — DEBT-075</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>{campo("Moagem", ch.moagem, (n) => setCh({ ...ch, moagem: n }))}{campo("Modelagem", ch.modelagem, (n) => setCh({ ...ch, modelagem: n }))}{campo("Embalamento", ch.embalamento, (n) => setCh({ ...ch, embalamento: n }))}</div>
      </div>
      <div style={{ ...sCard, padding: 16 }}>
        <p style={{ ...sLabel, marginBottom: 10 }}>Thresholds custo/kg (limite superior de cada faixa)</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>{campo("Ideal ≤", th.IDEAL, (n) => setTh({ ...th, IDEAL: n }))}{campo("Atenção ≤", th.ATENCAO, (n) => setTh({ ...th, ATENCAO: n }))}{campo("Alerta ≤", th.ALERTA, (n) => setTh({ ...th, ALERTA: n }))}</div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}><button onClick={salvar} disabled={saving} style={btn(!saving)}>{saving ? "Salvando..." : "Salvar configurações"}</button>{msg && <span style={{ color: msg === "Salvo." ? C.verde2 : C.vermelho, fontSize: 11, fontFamily: theme.font.label }}>{msg}</span>}</div>
    </div>
  );
}
