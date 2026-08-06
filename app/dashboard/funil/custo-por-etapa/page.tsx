// app/dashboard/funil/custo-por-etapa/page.tsx — CRI F5+F9: Custo Acumulado por Etapa.
// KPI central do Customer Revenue Intelligence (CRI) — cruza Identity (F1) + Motor de
// Custo/Período (F2) + Journey (F3) + Conversion (F4) num único cálculo por etapa da
// trilha, no período selecionado. Motor de Período: [inicio,fim] via URL, sem janela fixa.
import { createClient } from "@/lib/supabase/server";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { TrendingUp, Users, ArrowRightCircle, XCircle, Clock, DollarSign, Info } from "lucide-react";

export const dynamic = "force-dynamic";

interface EtapaRow {
  etapa_numero: number;
  etapa_nome: string;
  chegou: number;
  avancou: number;
  abandonou: number;
  parou: number;
  pct_avanco: number | null;
  pct_abandono: number | null;
  tempo_medio_horas: number | null;
  faturamento_atribuido_brl: number | null;
  custo_incremental_etapa_brl: number | null;
  custo_acumulado_etapa_brl: number | null;
  margem_atribuida_brl: number | null;
  retorno_acumulado_brl: number | null;
  selo_confiabilidade: string;
  componentes_pendentes: string[] | null;
}

function fmtBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtHoras(v: number | null): string {
  if (v == null) return "—";
  if (v < 24) return `${v.toFixed(0)}h`;
  return `${(v / 24).toFixed(1)}d`;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const primeiroDiaDoMes = () => `${new Date().toISOString().slice(0, 7)}-01`;

export default async function CustoPorEtapaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/marketing")) redirect("/dashboard/funil");

  const sp = await searchParams;
  const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
  const inicio = sp?.inicio && dataRegex.test(sp.inicio) ? sp.inicio : primeiroDiaDoMes();
  const fim = sp?.fim && dataRegex.test(sp.fim) ? sp.fim : hoje();

  const supabase = await createClient();
  const { data: rawEtapas, error } = await supabase.rpc("fn_cri_custo_acumulado_por_etapa", {
    p_data_inicio: inicio,
    p_data_fim: fim,
  });
  const etapas = ((rawEtapas ?? []) as EtapaRow[]).sort((a, b) => a.etapa_numero - b.etapa_numero);

  const totalChegou = etapas.reduce((s, e) => s + (e.etapa_numero !== 99 ? e.chegou : 0), 0);
  const totalFaturamento = etapas.reduce((s, e) => s + (e.faturamento_atribuido_brl ?? 0), 0);
  const totalAbandonou = etapas.reduce((s, e) => s + e.abandonou, 0);
  const etapaFinal = etapas.find((e) => e.etapa_numero === 8);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Custo Acumulado por Etapa"
        desc={`KPI central do Customer Revenue Intelligence · período ${inicio} a ${fim} · Motor de Período (qualquer intervalo)`}
      />

      {/* Motor de Período — filtro por data, sem JS, sem janela fixa embutida no código */}
      <form method="get" style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ ...S.label }}>Período</span>
        <input type="date" name="inicio" defaultValue={inicio} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12 }} />
        <span style={{ color: "#83879a" }}>até</span>
        <input type="date" name="fim" defaultValue={fim} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12 }} />
        <button type="submit" style={{ background: "#185FA5", border: "none", borderRadius: 5, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer" }}>
          Aplicar
        </button>
        <span style={{ ...S.muted, fontSize: 10 }}>60 dias é só um atalho comum — qualquer intervalo é válido.</span>
      </form>

      {error ? (
        <div style={{ ...S.card, padding: 20, borderTop: "2px solid #C8102E" }}>
          <p style={{ color: "#C8102E" }}>Erro ao carregar dados: {error.message}</p>
        </div>
      ) : (
        <>
          <div className="asb-grid-kpi">
            <KpiCard label="Leads Chegaram (Etapas 1-8)" value={String(totalChegou)} Icon={Users} accent="#185FA5" num="#FFFFFF" note="soma das 9 etapas, sem Abandono/Saída" />
            <KpiCard label="Faturamento Atribuído" value={fmtBRL(totalFaturamento)} Icon={DollarSign} accent="#22c55e" num="#22c55e" note="via customer_state, fonte única (F4)" />
            <KpiCard label="Abandonos no Período" value={String(totalAbandonou)} Icon={XCircle} accent="#C8102E" num="#C8102E" note="foram para lead_perdido/fora_de_rota/fornecedor" />
            <KpiCard
              label="Recorrência (Etapa 8)"
              value={String(etapaFinal?.chegou ?? 0)}
              Icon={TrendingUp}
              accent="#D4A017"
              num="#D4A017"
              note="2º pedido → recorrência"
            />
          </div>

          <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(212,160,23,.06)", border: "1px solid rgba(212,160,23,.3)" }}>
            <Info size={16} color="#D4A017" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ ...S.muted, fontSize: 11.5, lineHeight: 1.5 }}>
              <b style={{ color: "#D4A017" }}>Selo Parcial em todas as etapas:</b> Custo incremental/acumulado por etapa e Margem/Retorno ainda não têm fonte —
              não existe alocação de custo operacional POR ETAPA hoje (Motor de Custo aloca só por canal/mês), e margem confirmada/estimada está pendente
              (decisão: não inventar custo, não usar percentual fixo). Os campos abaixo com fonte real (chegou/avançou/abandonou/tempo/faturamento) são
              sempre calculados de verdade — nunca bloqueados pela ausência dos demais.
            </p>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={ArrowRightCircle} color="#185FA5" title="Trilha completa" desc="00 Campanha/origem (custo de mídia) → 08+ Recorrência" />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    {["Etapa", "Chegou", "Avançou", "Abandonou", "Parou", "% Avanço", "% Abandono", "Tempo Médio", "Faturamento", "Custo/Margem"].map((h) => (
                      <th key={h} style={{ ...S.label, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {etapas.map((e) => (
                    <tr key={e.etapa_numero} style={{ borderBottom: "1px solid rgba(255,255,255,.06)", background: e.etapa_numero === 99 ? "rgba(200,16,46,.04)" : undefined }}>
                      <td style={{ padding: "10px 10px", color: "#fff", fontFamily: "var(--font-geist-sans)", fontSize: 12.5, fontWeight: 650 }}>
                        {e.etapa_numero === 99 ? "⚠ " : `${e.etapa_numero} · `}{e.etapa_nome}
                      </td>
                      <td style={{ ...S.value, fontSize: 14, padding: "10px 10px" }}>{e.chegou}</td>
                      <td style={{ ...S.value, fontSize: 14, padding: "10px 10px", color: "#22c55e" }}>{e.avancou}</td>
                      <td style={{ ...S.value, fontSize: 14, padding: "10px 10px", color: "#C8102E" }}>{e.abandonou}</td>
                      <td style={{ ...S.value, fontSize: 14, padding: "10px 10px", color: "#83879a" }}>{e.parou}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>{fmtPct(e.pct_avanco)}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>{fmtPct(e.pct_abandono)}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>
                        <Clock size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
                        {fmtHoras(e.tempo_medio_horas)}
                      </td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px", color: "#22c55e" }}>{fmtBRL(e.faturamento_atribuido_brl)}</td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-geist-sans)", padding: "2px 8px", borderRadius: 999, background: "rgba(212,160,23,.16)", color: "#D4A017" }}>
                          {e.selo_confiabilidade}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {etapas.length === 0 && (
                    <tr><td colSpan={10} style={{ ...S.muted, padding: 20, textAlign: "center" }}>Nenhum lead entrou em etapa mapeada neste período.</td></tr>
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
