"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

export type DiaCalendario = {
  dia: string;
  faturado_brl: number;
  meta_dia_brl: number;
  compras_brl: number;
  compras_recebido: number;
  compras_a_chegar: number;
  qtd_fornecedores: number;
  pct_compras_faturado: number | null;
  semaforo: "verde" | "amarelo" | "vermelho" | "sem_dado" | "credito";
  atingimento_meta_pct: number | null;
  flags: Record<string, boolean> | null;
  compras_brl_bruto?: number; // F3: bruto antes da devolução
  devolucao_brl?: number;     // F3: devolução de compra abatida no dia
};
export type DevolucaoRow = {
  data_devolucao: string;
  n_nf: string | null;
  fornecedor_nome: string | null;
  valor_vnf: number;
  ref_nfe_chave: string | null;
};
export type CompraRow = {
  data_emissao: string;
  valor_total_brl: number;
  status_compra: string;
  fornecedor_nome: string | null;
};
export type DrilldownItemRow = {
  dia: string;
  data_emissao: string;
  fornecedor_nome: string | null;
  produto_nome: string | null;
  quantidade: number;
  preco_un: number;
  valor_brl: number;
};
export type FatTipoRow = {
  dia: string;
  tipo_doc: string; // 'NF' | 'Recibo'
  valor_brl: number;
  qtd_docs: number;
};

import { theme } from "@/lib/theme";
import { COR_SEMAFORO as SEM, brl } from "@/lib/compras/regras";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { TrendingUp, Percent, PieChart as PieChartIcon, CalendarDays } from "lucide-react";
const FLAG_EMOJI: Record<string, string> = {
  pico_compras: "🔥", top_faturado: "💰", margem_critica: "⚠️", abaixo_meta: "📉", acima_meta: "🎯",
};
const DONUT: Record<string, string> = { NF: "#2ea043", Recibo: "#d29922" };
const ddmm = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

export function CalendarDashboard({
  days, itens, fatTipo, devolucoes = [], isMesCorrente = false,
}: {
  days: DiaCalendario[];
  itens: DrilldownItemRow[];
  fatTipo: FatTipoRow[];
  devolucoes?: DevolucaoRow[];
  isMesCorrente?: boolean;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const selDevol = useMemo(() => (sel ? devolucoes.filter((d) => d.data_devolucao === sel) : []), [sel, devolucoes]);

  // Donut NF/Recibo (MTD) — soma client-side (PostgREST bloqueia agregação no select)
  const donut = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of fatTipo) m[f.tipo_doc] = (m[f.tipo_doc] || 0) + Number(f.valor_brl || 0);
    return Object.entries(m).map(([tipo, valor]) => ({ tipo, valor }));
  }, [fatTipo]);
  const donutTotal = useMemo(() => donut.reduce((s, d) => s + d.valor, 0), [donut]);

  const chartData = useMemo(
    () => days.map((d) => ({
      dia: ddmm(d.dia),
      faturado: Math.round(d.faturado_brl),
      meta: Math.round(d.meta_dia_brl),
      pct: d.pct_compras_faturado ?? null,
    })),
    [days],
  );

  // grid: alinha pela 1ª semana (getDay 0=DOM..6=SAB)
  const cells = useMemo(() => {
    if (!days.length) return [] as (DiaCalendario | null)[];
    const first = new Date(days[0].dia + "T12:00:00");
    const pad = first.getDay();
    return [...Array(pad).fill(null), ...days];
  }, [days]);

  const selDia = days.find((d) => d.dia === sel) || null;
  // DEBT-042 B1: fornecedores do dia derivados dos próprios itens (consistência total com o drilldown)
  const selFornec = useMemo(() => {
    if (!sel) return [];
    const m: Record<string, number> = {};
    for (const it of itens) {
      if (it.dia !== sel) continue;
      const k = it.fornecedor_nome || "(sem fornecedor)";
      m[k] = (m[k] || 0) + Number(it.valor_brl || 0);
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [sel, itens]);

  // produtos do dia selecionado, agrupados por fornecedor (drilldown Fase 1.6)
  const selItensByFornec = useMemo(() => {
    const m: Record<string, DrilldownItemRow[]> = {};
    if (!sel) return m;
    for (const it of itens) {
      if (it.dia !== sel) continue;
      const k = it.fornecedor_nome || "(sem fornecedor)";
      (m[k] ||= []).push(it);
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => Number(b.valor_brl) - Number(a.valor_brl));
    return m;
  }, [sel, itens]);

  // superfície grafite canônica (mesma linguagem do Dashboard) + eyebrow serigrafia
  const card: React.CSSProperties = { ...S.card, padding: 14 };
  const lbl: React.CSSProperties = { ...S.label };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 8 }}>
      {/* Gráficos */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ ...card, flex: 1, minWidth: 320 }}>
          <SectionHead Icon={TrendingUp} color="#2ea043" title="Faturado real × meta diária" desc="Realizado vs. meta por dia" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#1B2A6B" strokeDasharray="3 3" />
              <XAxis dataKey="dia" tick={{ fontSize: 9, fill: "#8899aa" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#8899aa" }} width={44} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => brl(Number(v))} contentStyle={{ background: "var(--asb-card)", border: "1px solid var(--asb-border)", fontSize: 11 }} />
              <Line type="monotone" dataKey="faturado" stroke="#2ea043" dot={false} strokeWidth={2} name="Faturado" />
              <Line type="monotone" dataKey="meta" stroke="#f0a04b" dot={false} strokeWidth={1} strokeDasharray="4 3" name="Meta" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ ...card, flex: 1, minWidth: 320 }}>
          <SectionHead Icon={Percent} color="#d4a017" title="Margem dia a dia" desc="% compras/faturado · linha de 54%" />
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#1B2A6B" strokeDasharray="3 3" />
              <XAxis dataKey="dia" tick={{ fontSize: 9, fill: "#8899aa" }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: "#8899aa" }} width={36} domain={[0, 120]} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: "var(--asb-card)", border: "1px solid var(--asb-border)", fontSize: 11 }} />
              <ReferenceLine y={54} stroke="#f85149" strokeDasharray="4 3" />
              <Line type="monotone" dataKey="pct" stroke="#c8d8e8" dot={{ r: 2 }} strokeWidth={1} name="% compras/fat" connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ ...card, flex: 1, minWidth: 240 }}>
          <SectionHead Icon={PieChartIcon} color="#8bb4ff" title="Faturado por tipo" desc="NF × Recibo (MTD)" />
          {donutTotal === 0 ? (
            // mês corrente em andamento: zerado é estado válido (R$ 0), nunca "sem dados"
            isMesCorrente ? (
              <div style={{ color: "#c8d8e8", fontSize: 22, fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", padding: 12 }}>{brl(0)}</div>
            ) : (
              <div style={{ color: "#e4e9f0", fontSize: 11, fontFamily: theme.font.label, padding: 12 }}>sem faturamento no mês</div>
            )
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={donut} dataKey="valor" nameKey="tipo" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {donut.map((d) => <Cell key={d.tipo} fill={DONUT[d.tipo] || "#556677"} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [brl(Number(v)), String(n)]} contentStyle={{ background: "var(--asb-card)", border: "1px solid var(--asb-border)", fontSize: 11 }} />
                <Legend
                  formatter={(value) => {
                    const d = donut.find((x) => x.tipo === value);
                    const p = donutTotal > 0 && d ? Math.round((d.valor / donutTotal) * 100) : 0;
                    return `${value} ${p}%`;
                  }}
                  wrapperStyle={{ fontSize: 11, fontFamily: theme.font.label }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Calendário */}
      <div style={card}>
        <SectionHead Icon={CalendarDays} color="#2ea043" title="Calendário do mês" desc="Semáforo de margem + sinalizadores · clique no dia" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"].map((w) => (
            <div key={w} style={{ ...lbl, textAlign: "center", padding: "2px 0" }}>{w}</div>
          ))}
          {cells.map((d, i) =>
            d === null ? (
              <div key={`b${i}`} />
            ) : (
              <button
                key={d.dia}
                onClick={() => setSel(d.dia)}
                style={{
                  background: sel === d.dia ? "var(--asb-border2)" : "var(--asb-card-hi)",
                  border: `1px solid ${SEM[d.semaforo]}`,
                  borderRadius: 4, padding: 6, minHeight: 64, cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 2, textAlign: "left",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#c8d8e8", fontSize: 11, fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{d.dia.slice(8, 10)}</span>
                  <span style={{ fontSize: 10 }}>{Object.keys(d.flags || {}).map((f) => FLAG_EMOJI[f] || "").join("")}</span>
                </div>
                <span style={{ color: SEM[d.semaforo], fontSize: 10, fontFamily: theme.font.num }}>
                  {d.pct_compras_faturado != null ? `${d.pct_compras_faturado}%` : "—"}
                </span>
                <span style={{ color: "#e4e9f0", fontSize: 9, fontFamily: theme.font.label }}>
                  {d.faturado_brl > 0 ? `f ${Math.round(d.faturado_brl / 1000)}k` : ""}
                  {d.compras_brl > 0 ? ` c ${Math.round(d.compras_brl / 1000)}k` : ""}
                </span>
              </button>
            ),
          )}
        </div>
      </div>

      {/* Drawer do dia */}
      {selDia && (
        <>
          <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 40 }} />
          <div
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0, width: 360, maxWidth: "90vw", zIndex: 50,
              background: "var(--asb-card)", borderLeft: `2px solid ${SEM[selDia.semaforo]}`, padding: 18, overflowY: "auto",
              display: "flex", flexDirection: "column", gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "#FFFFFF", fontSize: 15, fontWeight: 750, fontFamily: theme.font.label, letterSpacing: "-.01em" }}>
                <span style={{ fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{ddmm(selDia.dia)}</span>{" "}
                {Object.keys(selDia.flags || {}).map((f) => FLAG_EMOJI[f] || "").join("")}
              </span>
              <button onClick={() => setSel(null)} style={{ background: "transparent", border: "none", color: "#c0d0e0", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {([
                { label: "Faturado", value: brl(selDia.faturado_brl) },
                { label: "Meta", value: selDia.meta_dia_brl > 0 ? brl(selDia.meta_dia_brl) : "—" },
                { label: "Compras", value: brl(selDia.compras_brl) },
                selDia.compras_brl < 0
                  ? { label: "Crédito", value: brl(Math.abs(selDia.compras_brl)), num: SEM[selDia.semaforo] }
                  : { label: "% Margem", value: selDia.pct_compras_faturado != null ? `${selDia.pct_compras_faturado}%` : "—", num: SEM[selDia.semaforo] },
              ] as { label: string; value: string; num?: string }[]).map((t) => (
                <StatTile key={t.label} label={t.label} value={t.value} num={t.num} />
              ))}
            </div>

            <div style={{ ...S.text, fontSize: 12 }}>
              Entrada (NF+Recibo): <b style={{ color: "#2ea043", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{brl(selDia.compras_recebido)}</b>
              {selDia.atingimento_meta_pct != null ? ` · meta ${selDia.atingimento_meta_pct}%` : ""}
            </div>

            {(selDia.devolucao_brl ?? 0) > 0 && (
              <div style={{ ...S.muted, color: "#d29922" }}>
                Compra bruta <b style={{ color: "#c8d8e8", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{brl(selDia.compras_brl_bruto ?? 0)}</b> · (−) Devolução <b style={{ fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{brl(selDia.devolucao_brl ?? 0)}</b> · = líquido <b style={{ color: "#c8d8e8", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{brl(selDia.compras_brl)}</b>
              </div>
            )}

            {selDevol.length > 0 && (
              <div>
                <div style={{ ...lbl, marginBottom: 6 }}>Devoluções do dia ({selDevol.length})</div>
                {selDevol.map((d, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0", fontSize: 10, fontFamily: theme.font.label, color: "#c0d0e0", borderBottom: "1px solid var(--asb-border)" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>
                      NF {d.n_nf || "—"} · {d.fornecedor_nome || "—"}{d.ref_nfe_chave ? ` · ref ${d.ref_nfe_chave.slice(0, 12)}…` : ""}
                    </span>
                    <b style={{ color: "#d29922", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{brl(d.valor_vnf)}</b>
                  </div>
                ))}
              </div>
            )}

            <div>
              <div style={{ ...lbl, marginBottom: 6 }}>Fornecedores do dia ({selFornec.length}) · detalhe por PEDIDO de compra (não por entrada) · produtos abaixo de cada um</div>
              {selFornec.length === 0 ? (
                <div style={{ color: "#e4e9f0", fontSize: 11, fontFamily: theme.font.label }}>sem compras neste dia</div>
              ) : (
                selFornec.map(([nome, val]) => (
                  <div key={nome} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--asb-border)", fontSize: 11, fontFamily: theme.font.label, color: "#c8d8e8" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220, fontWeight: 700 }}>{nome}</span>
                      <b style={{ fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{brl(val)}</b>
                    </div>
                    {(selItensByFornec[nome] || []).map((it, idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "3px 0 3px 10px", fontSize: 10, fontFamily: theme.font.label, color: "#c0d0e0" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                          {(it.produto_nome || "(produto)") + " · " + Number(it.quantidade) + "× " + brl(Number(it.preco_un))}
                        </span>
                        <span style={{ fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{brl(Number(it.valor_brl))}</span>
                      </div>
                    ))}
                  </div>
                ))
              )}
              <div style={{ color: "#e4e9f0", fontSize: 9, fontFamily: theme.font.label, marginTop: 4 }}>
                Drilldown por produto (v_compras_itens_dia). Total do fornecedor = valor do pedido (header,
                c/ frete/desc.); itens = linhas. Lote/validade de fornecedor: DEBT-067 (não digitado no ARES).
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
