"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, CalendarDays, Table2, LineChart, Package, Target, Settings,
  Plus, Layers, Save, RefreshCw, Loader2, Trash2, Database,
} from "lucide-react";
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import { C, mono, sCard, sLabel, sInput, btn, btnGhost } from "../lib/ui";
import { brl, kg, num } from "../lib/formatadores";
import { THRESHOLDS_DEFAULT, STATUS_COR, STATUS_LABEL, type Thresholds, type Status } from "../lib/classificar";
import { calcularProjecao } from "../lib/calcular-projecao";
import { api, type Registro } from "../lib/storage-supabase";
import { Calendario } from "./calendario";
import { AbaGerencial, type MesGer } from "./aba-gerencial";
import { ModalProducao, ModalLote, ModalInsumo } from "./modais";

type Insumo = { id: number; data: string; materia: string; fornecedor: string | null; quantidade: number; unidade: string; custo_unit: number; lote: string | null; validade: string | null; sif: string | null };
type MesAgg = MesGer & { ano: number; mes: number; valor_total: number; dias: number; ops_total: number };

const ABAS = [
  { id: "geral", label: "Visão Geral", icon: LayoutDashboard },
  { id: "calendario", label: "Calendário", icon: CalendarDays },
  { id: "detalhe", label: "Detalhe Mês", icon: Table2 },
  { id: "gerencial", label: "Gerencial", icon: LineChart },
  { id: "insumos", label: "Insumos", icon: Package },
  { id: "projecao", label: "Projeção", icon: Target },
  { id: "config", label: "Config", icon: Settings },
] as const;

function agregar(regs: Registro[]): MesAgg[] {
  const map = new Map<string, MesAgg>();
  for (const r of regs) {
    const key = r.data.slice(0, 7);
    let m = map.get(key);
    if (!m) { m = { ano_mes: key, ano: +key.slice(0, 4), mes: +key.slice(5, 7), kg_total: 0, valor_total: 0, custo_medio_kg: 0, dias: 0, ops_total: 0, horas_moagem_total: 0, horas_modelagem_total: 0, horas_embalamento_total: 0 }; map.set(key, m); }
    m.kg_total += Number(r.kg_produzido || 0);
    m.valor_total += Number(r.custo_total || 0);
    if (r.kg_produzido > 0) m.dias += 1;
    m.ops_total += Number(r.ops || 0);
    m.horas_moagem_total += Number(r.horas_moagem || 0);
    m.horas_modelagem_total += Number(r.horas_modelagem || 0);
    m.horas_embalamento_total += Number(r.horas_embalamento || 0);
  }
  const arr = [...map.values()];
  for (const m of arr) m.custo_medio_kg = m.kg_total > 0 ? Math.round((m.valor_total / m.kg_total) * 100) / 100 : 0;
  return arr.sort((a, b) => a.ano_mes.localeCompare(b.ano_mes));
}

export function DashboardCustos() {
  const [aba, setAba] = useState<string>("geral");
  const [regs, setRegs] = useState<Registro[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [thresholds, setThresholds] = useState<Thresholds>(THRESHOLDS_DEFAULT);
  const [custoHora, setCustoHora] = useState<Record<string, number>>({ moagem: 0, modelagem: 0, embalamento: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { tipo: "dia" | "lote" | "insumo"; reg?: Registro | null; data?: string }>(null);
  const hoje = new Date();
  const [selAno, setSelAno] = useState(2026);
  const [selMes, setSelMes] = useState(hoje.getMonth() + 1 <= 5 ? hoje.getMonth() + 1 : 5);

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null);
    try {
      const [r, ins, ac, pc] = await Promise.all([api.carregarTodos(), api.insumos().catch(() => []), api.alertasConfig().catch(() => null), api.processoConfig().catch(() => null)]);
      setRegs(r); setInsumos(ins as Insumo[]);
      if (Array.isArray(ac)) {
        const f = (n: string) => ac.find((x: { nivel: string }) => x.nivel === n)?.valor_max;
        setThresholds({ IDEAL: f("ideal") ?? 18, ATENCAO: f("atencao") ?? 19, ALERTA: f("alerta") ?? 20 });
      }
      if (Array.isArray(pc)) { const o: Record<string, number> = {}; pc.forEach((x: { etapa: string; custo_hora: number }) => (o[x.etapa] = Number(x.custo_hora))); setCustoHora({ moagem: o.moagem ?? 0, modelagem: o.modelagem ?? 0, embalamento: o.embalamento ?? 0 }); }
    } catch (e) { setErro((e as Error).message); }
    setLoading(false);
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const regMap = useMemo(() => Object.fromEntries(regs.map((r) => [r.data, r])) as Record<string, Registro>, [regs]);
  const meses = useMemo(() => agregar(regs), [regs]);
  const totalKg = useMemo(() => regs.reduce((s, r) => s + Number(r.kg_produzido || 0), 0), [regs]);
  const totalCusto = useMemo(() => regs.reduce((s, r) => s + Number(r.custo_total || 0), 0), [regs]);
  const custoMedioGeral = totalKg > 0 ? totalCusto / totalKg : 0;
  const ultimoMes = meses[meses.length - 1];
  const custoHoraZero = custoHora.moagem === 0 && custoHora.modelagem === 0 && custoHora.embalamento === 0;
  const projecao = useMemo(() => calcularProjecao(meses.map((m) => ({ ano_mes: m.ano_mes, kg_total: m.kg_total, custo_medio_kg: m.custo_medio_kg }))), [meses]);

  const mesesAlerta = meses.filter((m) => m.kg_total > 0 && m.custo_medio_kg > thresholds.ATENCAO);
  const diasDoMes = regs.filter((r) => r.data.slice(0, 7) === `${selAno}-${String(selMes).padStart(2, "0")}`).sort((a, b) => a.data.localeCompare(b.data));
  const mesSel = meses.find((m) => m.ano === selAno && m.mes === selMes);

  async function acao(nome: string, fn: () => Promise<unknown>) {
    setBusy(nome); setErro(null);
    try { await fn(); await carregar(); } catch (e) { setErro((e as Error).message); } finally { setBusy(null); }
  }

  const tip = { contentStyle: { background: C.card2, border: `1px solid ${C.borda}`, borderRadius: 6, fontFamily: mono, fontSize: 11 }, labelStyle: { color: C.branco } };
  const axis = { tick: { fill: C.mut, fontSize: 10, fontFamily: mono }, stroke: C.borda };
  const th: React.CSSProperties = { ...sLabel, padding: "8px 10px", textAlign: "right", borderBottom: `1px solid ${C.borda}` };
  const td: React.CSSProperties = { padding: "6px 10px", color: C.texto, fontFamily: mono, fontSize: 12, textAlign: "right" };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.mut, fontFamily: mono }}><Loader2 className="animate-spin" style={{ margin: "0 auto 10px" }} /> Carregando custos...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: C.branco, fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" }}>Custo de Produção</h1>
          <p style={{ color: C.mut, fontSize: 11, fontFamily: mono }}>Dashboard ASB 2026 · registros diários, calendário, projeção e gestão</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => acao("ares", () => api.aresSync())} disabled={!!busy} style={btnGhost}><Database size={14} /> {busy === "ares" ? "Sync..." : "Sync ARES"}</button>
          <button onClick={() => acao("backup", () => api.criarBackup(`Backup ${new Date().toLocaleString("pt-BR")}`))} disabled={!!busy} style={btnGhost}><Save size={14} /> Backup</button>
          <button onClick={() => carregar()} style={btnGhost}><RefreshCw size={14} /></button>
        </div>
      </div>

      {erro && <div style={{ border: `1px solid ${C.vermelho}`, background: `${C.vermelho}11`, borderRadius: 6, padding: "8px 12px", color: C.vermelho, fontSize: 11, fontFamily: mono }}>{erro}</div>}

      {/* Banner alertas */}
      {mesesAlerta.length > 0 && (
        <div style={{ border: `1px solid ${C.laranja}`, background: `${C.laranja}11`, borderRadius: 6, padding: "10px 14px" }}>
          <p style={{ color: C.laranja, fontSize: 11, fontFamily: mono }}>
            {mesesAlerta.length} mês(es) acima do alvo: {mesesAlerta.map((m) => `${m.ano_mes} ${brl(m.custo_medio_kg)}/kg`).join(" · ")}
          </p>
        </div>
      )}
      {custoHoraZero && (
        <div style={{ border: `1px solid ${C.amarelo}`, background: `${C.amarelo}11`, borderRadius: 6, padding: "8px 12px" }}>
          <p style={{ color: C.amarelo, fontSize: 11, fontFamily: mono }}>CUSTO_HORA = R$ 0,00 — aguardando RH/financeiro (DEBT-075). Custos de processo dependem desse valor.</p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", borderBottom: `1px solid ${C.borda}`, paddingBottom: 2 }}>
        {ABAS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setAba(id)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", border: "none", borderBottom: aba === id ? `2px solid ${C.verde}` : "2px solid transparent", background: "transparent", color: aba === id ? C.branco : C.mut, fontSize: 10, fontFamily: mono, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer" }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* === VISÃO GERAL === */}
      {aba === "geral" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
            <Kpi label="kg Produzido (total)" value={kg(totalKg)} cor={C.branco} />
            <Kpi label="Custo Total" value={brl(totalCusto)} cor={C.texto} />
            <Kpi label="Custo Médio/kg" value={brl(custoMedioGeral)} cor={custoMedioGeral <= thresholds.IDEAL ? C.verde2 : custoMedioGeral <= thresholds.ALERTA ? C.amarelo : C.vermelho} />
            <Kpi label="Último mês" value={ultimoMes ? `${brl(ultimoMes.custo_medio_kg)}/kg` : "—"} cor={C.texto} sub={ultimoMes?.ano_mes} />
            <Kpi label="Dias registrados" value={num(regs.filter((r) => r.kg_produzido > 0).length)} cor={C.texto} />
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

      {/* === CALENDÁRIO === */}
      {aba === "calendario" && (
        <div style={{ ...sCard, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <MesSelector ano={selAno} mes={selMes} setAno={setSelAno} setMes={setSelMes} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setModal({ tipo: "dia", data: `${selAno}-${String(selMes).padStart(2, "0")}-01` })} style={btn()}><Plus size={14} /> Registrar dia</button>
              <button onClick={() => setModal({ tipo: "lote" })} style={btnGhost}><Layers size={14} /> Lote semanal</button>
            </div>
          </div>
          <Calendario ano={selAno} mes={selMes} registros={regMap} onPickDia={(data, r) => setModal({ tipo: "dia", data, reg: r })} />
          <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
            {(["ideal", "atencao", "alerta", "critico", "feriado"] as Status[]).map((s) => (
              <span key={s} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: C.mut, fontFamily: mono }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COR[s] }} /> {STATUS_LABEL[s]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* === DETALHE MÊS === */}
      {aba === "detalhe" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <MesSelector ano={selAno} mes={selMes} setAno={setSelAno} setMes={setSelMes} />
          {mesSel && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
              <Kpi label="kg do mês" value={kg(mesSel.kg_total)} cor={C.branco} />
              <Kpi label="Custo total" value={brl(mesSel.valor_total)} cor={C.texto} />
              <Kpi label="Custo médio/kg" value={brl(mesSel.custo_medio_kg)} cor={mesSel.custo_medio_kg <= thresholds.ALERTA ? C.verde2 : C.vermelho} />
              <Kpi label="Dias / OPs" value={`${mesSel.dias} / ${mesSel.ops_total}`} cor={C.texto} />
            </div>
          )}
          <div style={{ ...sCard, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>Data</th><th style={th}>kg</th><th style={th}>Custo R$</th><th style={th}>Custo/kg</th><th style={th}>Temp</th><th style={th}>OPs</th><th style={{ ...th, textAlign: "center" }}>Status</th><th style={{ ...th, textAlign: "center" }}>Ações</th></tr></thead>
              <tbody>
                {diasDoMes.length === 0 ? <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: C.mut2, padding: 20 }}>sem registros neste mês</td></tr> :
                  diasDoMes.map((r) => {
                    const st = (r.status as Status) ?? "sem_dados";
                    return (
                      <tr key={r.data} style={{ borderBottom: "1px solid #0b0f1d" }}>
                        <td style={{ ...td, textAlign: "left", color: C.branco }}>{r.data}</td>
                        <td style={td}>{num(r.kg_produzido, 1)}</td>
                        <td style={td}>{brl(r.custo_total)}</td>
                        <td style={{ ...td, color: STATUS_COR[st], fontWeight: 700 }}>{r.custo_kg != null ? brl(r.custo_kg) : "—"}</td>
                        <td style={td}>{num(r.temperatura, 1)}</td>
                        <td style={td}>{r.ops}</td>
                        <td style={{ ...td, textAlign: "center" }}><span style={{ color: STATUS_COR[st], fontSize: 9, fontWeight: 700, border: `1px solid ${STATUS_COR[st]}`, borderRadius: 3, padding: "2px 5px" }}>{STATUS_LABEL[st]}</span></td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <button onClick={() => setModal({ tipo: "dia", data: r.data, reg: r })} style={{ background: "none", border: "none", color: C.mut, cursor: "pointer", marginRight: 6 }} title="editar"><Settings size={13} /></button>
                          <button onClick={() => acao("del", () => api.removerRegistro(r.data))} style={{ background: "none", border: "none", color: C.vermelho, cursor: "pointer" }} title="remover"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === GERENCIAL === */}
      {aba === "gerencial" && <AbaGerencial meses={meses} registros={regs} thresholds={thresholds} />}

      {/* === INSUMOS === */}
      {aba === "insumos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><button onClick={() => setModal({ tipo: "insumo" })} style={btn()}><Plus size={14} /> Novo insumo</button></div>
          <div style={{ ...sCard, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr><th style={{ ...th, textAlign: "left" }}>Data</th><th style={{ ...th, textAlign: "left" }}>Matéria</th><th style={{ ...th, textAlign: "left" }}>Fornecedor</th><th style={th}>Qtd</th><th style={th}>Un</th><th style={th}>Custo Un</th><th style={{ ...th, textAlign: "left" }}>Lote/SIF</th><th style={{ ...th, textAlign: "center" }}></th></tr></thead>
              <tbody>
                {insumos.length === 0 ? <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: C.mut2, padding: 20 }}>nenhum insumo</td></tr> :
                  insumos.map((i) => (
                    <tr key={i.id} style={{ borderBottom: "1px solid #0b0f1d" }}>
                      <td style={{ ...td, textAlign: "left" }}>{i.data}</td>
                      <td style={{ ...td, textAlign: "left", color: C.branco }}>{i.materia}</td>
                      <td style={{ ...td, textAlign: "left", color: C.mut }}>{i.fornecedor ?? "—"}</td>
                      <td style={td}>{num(i.quantidade, 2)}</td><td style={td}>{i.unidade}</td><td style={td}>{brl(i.custo_unit)}</td>
                      <td style={{ ...td, textAlign: "left", color: C.mut }}>{[i.lote, i.sif].filter(Boolean).join(" / ") || "—"}</td>
                      <td style={{ ...td, textAlign: "center" }}><button onClick={() => acao("delins", () => api.removerInsumo(i.id))} style={{ background: "none", border: "none", color: C.vermelho, cursor: "pointer" }}><Trash2 size={13} /></button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === PROJEÇÃO === */}
      {aba === "projecao" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          {projecao ? (<>
            <Kpi label="kg/mês projetado" value={kg(projecao.kgMensalProjetado)} cor={C.branco} sub={`base ${projecao.baseMeses} meses`} />
            <Kpi label="kg/ano projetado" value={num(projecao.kgAnualProjetado)} cor={C.texto} />
            <Kpi label="Custo/kg projetado" value={brl(projecao.custoKgProjetado)} cor={projecao.custoKgProjetado <= thresholds.ALERTA ? C.verde2 : C.vermelho} />
            <Kpi label="Tendência" value={projecao.tendencia.toUpperCase()} cor={projecao.tendencia === "alta" ? C.vermelho : projecao.tendencia === "baixa" ? C.verde2 : C.amarelo} />
          </>) : <p style={{ color: C.mut, fontFamily: mono, fontSize: 12 }}>sem dados suficientes para projeção</p>}
        </div>
      )}

      {/* === CONFIG === */}
      {aba === "config" && (
        <ConfigTab thresholds={thresholds} custoHora={custoHora} onReload={carregar} />
      )}

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
      <p style={{ fontSize: 18, color: cor, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: C.mut2, fontFamily: mono, marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

function MesSelector({ ano, mes, setAno, setMes }: { ano: number; mes: number; setAno: (n: number) => void; setMes: (n: number) => void }) {
  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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
      await Promise.all([
        fetch("/api/compras/custos/processo/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ etapa: "moagem", custo_hora: ch.moagem }) }),
        fetch("/api/compras/custos/processo/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ etapa: "modelagem", custo_hora: ch.modelagem }) }),
        fetch("/api/compras/custos/processo/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ etapa: "embalamento", custo_hora: ch.embalamento }) }),
        fetch("/api/compras/custos/alertas/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nivel: "ideal", valor_max: th.IDEAL }) }),
        fetch("/api/compras/custos/alertas/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nivel: "atencao", valor_max: th.ATENCAO }) }),
        fetch("/api/compras/custos/alertas/config", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nivel: "alerta", valor_max: th.ALERTA }) }),
      ]);
      setMsg("Salvo."); onReload();
    } catch (e) { setMsg((e as Error).message); }
    setSaving(false);
  }
  const campo = (label: string, val: number, on: (n: number) => void) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={sLabel}>{label}</span><input type="number" step="0.01" value={val} onChange={(e) => on(Number(e.target.value))} style={sInput} /></div>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600 }}>
      <div style={{ ...sCard, padding: 16 }}>
        <p style={{ ...sLabel, marginBottom: 10 }}>Custo-hora por etapa (R$/h) — DEBT-075</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {campo("Moagem", ch.moagem, (n) => setCh({ ...ch, moagem: n }))}
          {campo("Modelagem", ch.modelagem, (n) => setCh({ ...ch, modelagem: n }))}
          {campo("Embalamento", ch.embalamento, (n) => setCh({ ...ch, embalamento: n }))}
        </div>
      </div>
      <div style={{ ...sCard, padding: 16 }}>
        <p style={{ ...sLabel, marginBottom: 10 }}>Thresholds custo/kg (limite superior de cada faixa)</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {campo("Ideal ≤", th.IDEAL, (n) => setTh({ ...th, IDEAL: n }))}
          {campo("Atenção ≤", th.ATENCAO, (n) => setTh({ ...th, ATENCAO: n }))}
          {campo("Alerta ≤", th.ALERTA, (n) => setTh({ ...th, ALERTA: n }))}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={salvar} disabled={saving} style={btn(!saving)}>{saving ? "Salvando..." : "Salvar configurações"}</button>
        {msg && <span style={{ color: msg === "Salvo." ? C.verde2 : C.vermelho, fontSize: 11, fontFamily: mono }}>{msg}</span>}
      </div>
    </div>
  );
}
