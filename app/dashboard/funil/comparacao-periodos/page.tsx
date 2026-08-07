// app/dashboard/funil/comparacao-periodos/page.tsx — CRI F9 (tela 8/9): Comparação de Períodos.
// ZERO SQL novo — reusa 100% fn_cri_visao_geral + fn_cri_distribuicao_origem (F9/Visão Geral),
// chamadas 2x (Período A + Período B). O próprio COMMENT de fn_cri_visao_geral já prescrevia
// esse uso ("Evolução vs período anterior = chamar esta function 2x no frontend, não recálculo").
// LEI ÚNICA: nenhuma métrica é recalculada aqui, só comparada lado a lado com delta absoluto/%.
import { createClient } from "@/lib/supabase/server";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead } from "@/app/dashboard/lib/ui";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { GitCompare, Layers, Info, ArrowUp, ArrowDown, Minus } from "lucide-react";

export const dynamic = "force-dynamic";

interface VisaoGeralKpis {
  leads_recebidos: number;
  leads_qualificados: number;
  abandonos: number;
  primeiros_pedidos: number;
  clientes_com_recompra: number;
  clientes_com_pedido: number;
  faturamento_atribuido_brl: number;
  custo_midia_brl: number;
  custo_operacional_brl: number;
  custo_total_brl: number;
  cac_brl: number | null;
  taxa_conversao: number | null;
  taxa_recorrencia: number | null;
  selo_geral: string;
}

interface OrigemRow {
  origem_canal: string;
  leads: number;
  primeiros_pedidos: number;
  faturamento_brl: number | null;
}

const SELO_COR: Record<string, string> = {
  confirmado: "#22c55e",
  parcial: "#D4A017",
  estimado: "#8bb4ff",
  nao_informado: "#C8102E",
};

const SELO_LABEL: Record<string, string> = {
  confirmado: "Confirmado",
  parcial: "Parcial",
  estimado: "Estimado",
  nao_informado: "Não informado",
};

// menor=melhor nestas 3 (abandonos/custo/CAC) — sinal de cor invertido vs as demais
const MENOR_MELHOR = new Set(["abandonos", "custo_midia_brl", "custo_operacional_brl", "custo_total_brl", "cac_brl"]);

type MetricaDef = { key: keyof VisaoGeralKpis; label: string; fmt: (v: number | null) => string };

const METRICAS: MetricaDef[] = [
  { key: "leads_recebidos", label: "Leads Recebidos", fmt: fmtInt },
  { key: "leads_qualificados", label: "Leads Qualificados", fmt: fmtInt },
  { key: "abandonos", label: "Abandonos", fmt: fmtInt },
  { key: "primeiros_pedidos", label: "1os Pedidos", fmt: fmtInt },
  { key: "clientes_com_recompra", label: "Clientes com Recompra", fmt: fmtInt },
  { key: "clientes_com_pedido", label: "Clientes com Pedido", fmt: fmtInt },
  { key: "faturamento_atribuido_brl", label: "Faturamento Atribuído", fmt: fmtBRL },
  { key: "custo_midia_brl", label: "Custo de Mídia", fmt: fmtBRL },
  { key: "custo_operacional_brl", label: "Custo Operacional", fmt: fmtBRL },
  { key: "custo_total_brl", label: "Custo Total", fmt: fmtBRL },
  { key: "cac_brl", label: "CAC", fmt: fmtBRL },
  { key: "taxa_conversao", label: "Taxa de Conversão", fmt: fmtPct },
  { key: "taxa_recorrencia", label: "Taxa de Recorrência", fmt: fmtPct },
];

function fmtInt(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR");
}

function fmtBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtData(v: string): string {
  return new Date(v + "T00:00:00").toLocaleDateString("pt-BR");
}

const hoje = () => new Date().toISOString().slice(0, 10);
const primeiroDiaDoMes = () => `${new Date().toISOString().slice(0, 7)}-01`;
const somaDias = (iso: string, dias: number) => {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const diffDias = (inicioIso: string, fimIso: string) =>
  Math.round((new Date(fimIso + "T00:00:00").getTime() - new Date(inicioIso + "T00:00:00").getTime()) / 86400000) + 1;

const selectStyle = {
  background: "var(--asb-card-hi)",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 5,
  padding: "6px 10px",
  color: "#c8d8e8",
  fontSize: 12,
};

export default async function ComparacaoPeriodosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/marketing")) redirect("/dashboard/funil");

  const sp = await searchParams;
  const dataRegex = /^\d{4}-\d{2}-\d{2}$/;

  const inicioA = sp?.inicio_a && dataRegex.test(sp.inicio_a) ? sp.inicio_a : primeiroDiaDoMes();
  const fimA = sp?.fim_a && dataRegex.test(sp.fim_a) ? sp.fim_a : hoje();
  // Default B: período imediatamente anterior a A, com a MESMA duração ("período anterior
  // de mesma duração" — mesmo critério já documentado no COMMENT de fn_cri_visao_geral).
  const duracaoA = diffDias(inicioA, fimA);
  const fimBDefault = somaDias(inicioA, -1);
  const inicioBDefault = somaDias(fimBDefault, -(duracaoA - 1));
  const inicioB = sp?.inicio_b && dataRegex.test(sp.inicio_b) ? sp.inicio_b : inicioBDefault;
  const fimB = sp?.fim_b && dataRegex.test(sp.fim_b) ? sp.fim_b : fimBDefault;
  const duracaoB = diffDias(inicioB, fimB);

  const supabase = await createClient();
  const [{ data: kpisARaw, error: errA }, { data: kpisBRaw, error: errB }, { data: origemARaw }, { data: origemBRaw }] =
    await Promise.all([
      supabase.rpc("fn_cri_visao_geral", { p_data_inicio: inicioA, p_data_fim: fimA }),
      supabase.rpc("fn_cri_visao_geral", { p_data_inicio: inicioB, p_data_fim: fimB }),
      supabase.rpc("fn_cri_distribuicao_origem", { p_data_inicio: inicioA, p_data_fim: fimA }),
      supabase.rpc("fn_cri_distribuicao_origem", { p_data_inicio: inicioB, p_data_fim: fimB }),
    ]);

  const kpisA = (kpisARaw as VisaoGeralKpis[] | null)?.[0] ?? null;
  const kpisB = (kpisBRaw as VisaoGeralKpis[] | null)?.[0] ?? null;
  const origemA = (origemARaw ?? []) as OrigemRow[];
  const origemB = (origemBRaw ?? []) as OrigemRow[];
  const origensUnificadas = Array.from(new Set([...origemA.map((o) => o.origem_canal), ...origemB.map((o) => o.origem_canal)])).sort();

  const duracaoDivergente = duracaoA !== duracaoB;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Comparação de Períodos"
        desc="Os mesmos 13 KPIs da Visão Geral do CRI, lado a lado entre 2 períodos — mesma fonte, zero recálculo"
      />

      <form method="get" style={{ ...S.card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ ...S.label, color: "#8bb4ff", minWidth: 72 }}>Período A</span>
          <input type="date" name="inicio_a" defaultValue={inicioA} style={selectStyle} />
          <span style={{ ...S.muted }}>até</span>
          <input type="date" name="fim_a" defaultValue={fimA} style={selectStyle} />
          <span style={{ ...S.muted, fontSize: 10.5 }}>{duracaoA} dia{duracaoA === 1 ? "" : "s"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ ...S.label, color: "#D4A017", minWidth: 72 }}>Período B</span>
          <input type="date" name="inicio_b" defaultValue={inicioB} style={selectStyle} />
          <span style={{ ...S.muted }}>até</span>
          <input type="date" name="fim_b" defaultValue={fimB} style={selectStyle} />
          <span style={{ ...S.muted, fontSize: 10.5 }}>{duracaoB} dia{duracaoB === 1 ? "" : "s"}</span>
          <button type="submit" style={{ background: "#185FA5", border: "none", borderRadius: 5, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer", marginLeft: 8 }}>
            Comparar
          </button>
        </div>
      </form>

      {duracaoDivergente && (
        <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(212,160,23,.06)", border: "1px solid rgba(212,160,23,.3)" }}>
          <Info size={16} color="#D4A017" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ ...S.muted, fontSize: 11.5, lineHeight: 1.5 }}>
            <b style={{ color: "#D4A017" }}>Durações diferentes:</b> Período A tem {duracaoA} dia{duracaoA === 1 ? "" : "s"},
            Período B tem {duracaoB} dia{duracaoB === 1 ? "" : "s"}. Comparar totais absolutos (leads, faturamento) entre
            períodos de tamanhos diferentes é enganoso — prefira as taxas (Conversão, Recorrência) ou ajuste as datas
            para a mesma duração.
          </p>
        </div>
      )}

      {errA || errB ? (
        <div style={{ ...S.card, padding: 20, borderTop: "2px solid #C8102E" }}>
          <p style={{ color: "#C8102E" }}>Erro ao carregar dados: {errA?.message ?? errB?.message}</p>
        </div>
      ) : (
        <>
          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead
              Icon={GitCompare}
              color="#185FA5"
              title="KPIs Centrais"
              desc={`${fmtData(inicioA)}–${fmtData(fimA)} vs ${fmtData(inicioB)}–${fmtData(fimB)}`}
            />
            <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: SELO_COR[kpisA?.selo_geral ?? ""] ?? "#83879a", display: "inline-block" }} />
                <span style={{ ...S.muted }}>Período A — selo {SELO_LABEL[kpisA?.selo_geral ?? ""] ?? "—"}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: SELO_COR[kpisB?.selo_geral ?? ""] ?? "#83879a", display: "inline-block" }} />
                <span style={{ ...S.muted }}>Período B — selo {SELO_LABEL[kpisB?.selo_geral ?? ""] ?? "—"}</span>
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    {["Métrica", "Período A", "Período B", "Δ", "Δ %"].map((h) => (
                      <th key={h} style={{ ...S.label, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {METRICAS.map((m) => {
                    const a = kpisA?.[m.key];
                    const b = kpisB?.[m.key];
                    const va = typeof a === "number" ? a : null;
                    const vb = typeof b === "number" ? b : null;
                    const delta = va != null && vb != null ? va - vb : null;
                    const deltaPct = va != null && vb != null && vb !== 0 ? delta! / Math.abs(vb) : null;
                    const menorMelhor = MENOR_MELHOR.has(m.key as string);
                    const subiu = delta != null && delta > 0;
                    const desceu = delta != null && delta < 0;
                    const corDelta = delta == null || delta === 0 ? "#83879a" : (subiu ? !menorMelhor : menorMelhor) ? "#22c55e" : "#C8102E";
                    return (
                      <tr key={String(m.key)} style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                        <td style={{ ...S.value, fontSize: 12, padding: "9px 10px" }}>{m.label}</td>
                        <td style={{ ...S.value, fontSize: 12.5, padding: "9px 10px", color: "#8bb4ff" }}>{m.fmt(va)}</td>
                        <td style={{ ...S.value, fontSize: 12.5, padding: "9px 10px", color: "#D4A017" }}>{m.fmt(vb)}</td>
                        <td style={{ padding: "9px 10px", fontSize: 12, color: corDelta, display: "flex", alignItems: "center", gap: 4 }}>
                          {subiu ? <ArrowUp size={12} /> : desceu ? <ArrowDown size={12} /> : <Minus size={12} />}
                          {delta != null ? m.fmt(Math.abs(delta)) : "—"}
                        </td>
                        <td style={{ ...S.value, fontSize: 12, padding: "9px 10px", color: corDelta }}>
                          {deltaPct != null ? `${deltaPct >= 0 ? "+" : ""}${(deltaPct * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={Layers} color="#8bb4ff" title="Por Origem" desc="leads / 1os pedidos / faturamento — mesmas fontes de fn_cri_distribuicao_origem (Visão Geral)" />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    <th style={{ ...S.label, textAlign: "left", padding: "8px 10px" }}>Origem</th>
                    <th style={{ ...S.label, textAlign: "left", padding: "8px 10px", color: "#8bb4ff" }}>Leads A</th>
                    <th style={{ ...S.label, textAlign: "left", padding: "8px 10px", color: "#D4A017" }}>Leads B</th>
                    <th style={{ ...S.label, textAlign: "left", padding: "8px 10px", color: "#8bb4ff" }}>1os Pedidos A</th>
                    <th style={{ ...S.label, textAlign: "left", padding: "8px 10px", color: "#D4A017" }}>1os Pedidos B</th>
                    <th style={{ ...S.label, textAlign: "left", padding: "8px 10px", color: "#8bb4ff" }}>Faturamento A</th>
                    <th style={{ ...S.label, textAlign: "left", padding: "8px 10px", color: "#D4A017" }}>Faturamento B</th>
                  </tr>
                </thead>
                <tbody>
                  {origensUnificadas.map((canal) => {
                    const a = origemA.find((o) => o.origem_canal === canal);
                    const b = origemB.find((o) => o.origem_canal === canal);
                    return (
                      <tr key={canal} style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                        <td style={{ ...S.value, fontSize: 12, padding: "9px 10px" }}>{canal}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "9px 10px" }}>{fmtInt(a?.leads ?? 0)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "9px 10px" }}>{fmtInt(b?.leads ?? 0)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "9px 10px" }}>{fmtInt(a?.primeiros_pedidos ?? 0)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "9px 10px" }}>{fmtInt(b?.primeiros_pedidos ?? 0)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "9px 10px" }}>{fmtBRL(a?.faturamento_brl ?? 0)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "9px 10px" }}>{fmtBRL(b?.faturamento_brl ?? 0)}</td>
                      </tr>
                    );
                  })}
                  {origensUnificadas.length === 0 && (
                    <tr><td colSpan={7} style={{ ...S.muted, padding: 20, textAlign: "center" }}>Nenhuma origem com dado em nenhum dos 2 períodos.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
