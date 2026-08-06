// app/dashboard/funil/origens/page.tsx — CRI F9 (tela 6/8 desta rodada): Origens.
// Jornada financeira e operacional do lead POR ORIGEM: recebido → qualificado → abandonado
// → convertido → recompra → recorrência → faturamento → custo → selo. NÃO repete CAC/ROAS/
// atribuição de /marketing/origem|atribuicao|funil-cac|overview (canal/campanha/anúncio até
// "convertido") — cobre o gap exclusivo do CRI: trilha fina de 8 etapas + pós-venda, por
// origem, no Motor de Período. Motor de Período via URL.
import { createClient } from "@/lib/supabase/server";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead } from "@/app/dashboard/lib/ui";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { Info, Table2 } from "lucide-react";

export const dynamic = "force-dynamic";

interface OrigemRow {
  origem_bucket: string;
  leads_recebidos: number;
  pct_participacao_leads: number | null;
  leads_qualificados: number;
  taxa_qualificacao: number | null;
  abandonos: number;
  taxa_abandono: number | null;
  primeiros_pedidos: number;
  taxa_conversao: number | null;
  clientes_com_recompra: number;
  taxa_recompra: number | null;
  clientes_recorrentes: number;
  taxa_recorrencia: number | null;
  faturamento_atribuido_brl: number;
  pct_faturamento: number | null;
  custo_midia_brl: number;
  custo_operacional_brl: number;
  custo_total_brl: number;
  custo_por_lead_brl: number | null;
  custo_por_qualificado_brl: number | null;
  custo_por_primeiro_pedido_brl: number | null;
  custo_por_recorrente_brl: number | null;
  retorno_sobre_faturamento: number | null;
  selo_confiabilidade: string;
}

const BUCKET_LABEL: Record<string, string> = {
  midia_paga: "Mídia Paga",
  organico: "Orgânico",
  indicacao: "Indicação",
  bio_instagram: "Bio do Instagram",
  whatsapp_direto: "WhatsApp Direto",
  site: "Site",
  landing_page: "Landing Page",
  prospeccao_ativa: "Prospecção Ativa",
  origem_desconhecida: "Origem Desconhecida",
};

const SELO_COR: Record<string, string> = {
  confirmado: "#22c55e",
  parcial: "#D4A017",
  estimado: "#8bb4ff",
  nao_informado: "#C8102E",
};

function fmtBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtBRLCent(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtCountPct(count: number, pct: number | null): string {
  return `${count} (${fmtPct(pct)})`;
}

function trendArrow(atual: number, anterior: number): string {
  if (anterior === 0) return atual > 0 ? " · novo" : "";
  const delta = ((atual - anterior) / anterior) * 100;
  if (Math.abs(delta) < 1) return "";
  return delta > 0 ? ` · ▲${delta.toFixed(0)}%` : ` · ▼${Math.abs(delta).toFixed(0)}%`;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const primeiroDiaDoMes = () => `${new Date().toISOString().slice(0, 7)}-01`;

function diasEntre(inicio: string, fim: string): number {
  return Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86400000) + 1;
}

function periodoAnterior(inicio: string, fim: string): { inicioAnt: string; fimAnt: string } {
  const dias = diasEntre(inicio, fim);
  const fimAnt = new Date(inicio);
  fimAnt.setUTCDate(fimAnt.getUTCDate() - 1);
  const inicioAnt = new Date(fimAnt);
  inicioAnt.setUTCDate(inicioAnt.getUTCDate() - dias + 1);
  return { inicioAnt: inicioAnt.toISOString().slice(0, 10), fimAnt: fimAnt.toISOString().slice(0, 10) };
}

export default async function OrigensPage({
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
  const { inicioAnt, fimAnt } = periodoAnterior(inicio, fim);

  const supabase = await createClient();
  const [{ data: rowsRaw, error }, { data: rowsAntRaw }] = await Promise.all([
    supabase.rpc("fn_cri_origens_kpis", { p_data_inicio: inicio, p_data_fim: fim }),
    supabase.rpc("fn_cri_origens_kpis", { p_data_inicio: inicioAnt, p_data_fim: fimAnt }),
  ]);

  const rows = (rowsRaw ?? []) as OrigemRow[];
  const rowsAnt = new Map(((rowsAntRaw ?? []) as OrigemRow[]).map((r) => [r.origem_bucket, r]));

  const totalLeads = rows.reduce((s, r) => s + r.leads_recebidos, 0);
  const totalFaturamento = rows.reduce((s, r) => s + r.faturamento_atribuido_brl, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Origens"
        desc={`Jornada financeira e operacional do lead por origem · período ${inicio} a ${fim}`}
      />

      <form method="get" style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ ...S.label }}>Período</span>
        <input type="date" name="inicio" defaultValue={inicio} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12 }} />
        <span style={{ color: "#83879a" }}>até</span>
        <input type="date" name="fim" defaultValue={fim} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12 }} />
        <button type="submit" style={{ background: "#185FA5", border: "none", borderRadius: 5, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer" }}>
          Aplicar
        </button>
        <span style={{ ...S.muted, fontSize: 10, marginLeft: "auto" }}>comparado a {inicioAnt} a {fimAnt} (mesma duração)</span>
      </form>

      {error ? (
        <div style={{ ...S.card, padding: 20, borderTop: "2px solid #C8102E" }}>
          <p style={{ color: "#C8102E" }}>Erro ao carregar dados: {error.message}</p>
        </div>
      ) : (
        <>
          <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(212,160,23,.06)", border: "1px solid rgba(212,160,23,.3)" }}>
            <Info size={16} color="#D4A017" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ ...S.muted, fontSize: 11.5, lineHeight: 1.5 }}>
              <b style={{ color: "#D4A017" }}>Esta tela não repete CAC/ROAS/atribuição de Marketing</b> (ver /marketing/origem, /marketing/atribuicao,
              /marketing/funil-cac — cobrem canal/campanha/anúncio até 1º pedido). Aqui é o ângulo exclusivo do CRI: trilha de 8 etapas e pós-venda por
              origem. <b>Origem Desconhecida</b> nunca é tratada como Orgânico — junta leads sem origem_canal reconhecido e <b>pedidos de clientes sem lead
              SDR correspondente</b> (carteira ARES antiga, pré-SDR — normalmente a maior parte do faturamento histórico). <b>Custo de Mídia</b> zero em
              Bio do Instagram/Landing Page/Orgânico/Indicação não significa custo total zero — é limitação de granularidade do Motor de Custo do CRI (só
              desce a canal google/meta, não a objetivo de campanha) — por isso o selo dessas linhas é &quot;não informado&quot;, nunca &quot;confirmado&quot;.
              WhatsApp Direto/Site/Prospecção Ativa aparecem com 0 porque a origem ainda não os distingue distintamente na captura — os baldes existem e
              serão preenchidos automaticamente quando essa marcação existir, sem migration nova.
            </p>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead
              Icon={Table2}
              color="#185FA5"
              title="9 Origens × 22 Métricas"
              desc={`${totalLeads} leads e ${fmtBRL(totalFaturamento)} faturados no período, por origem — sempre as 9, mesmo com 0 no período`}
            />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1600 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    {[
                      "Origem", "Leads Recebidos", "Qualificados", "Abandonos", "1º Pedido", "Recompra", "Recorrentes",
                      "Faturamento", "Custo Mídia", "Custo Operacional", "Custo Total", "Custo/Lead", "Custo/Qualificado",
                      "Custo/1º Pedido", "Custo/Recorrente", "Retorno s/ Faturamento", "Selo",
                    ].map((h) => (
                      <th key={h} style={{ ...S.label, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const ant = rowsAnt.get(r.origem_bucket);
                    const semDadoHoje = r.leads_recebidos === 0 && r.primeiros_pedidos === 0 && r.faturamento_atribuido_brl === 0;
                    return (
                      <tr key={r.origem_bucket} style={{ borderBottom: "1px solid rgba(255,255,255,.06)", opacity: semDadoHoje ? 0.55 : 1 }}>
                        <td style={{ padding: "10px 10px", color: "#fff", fontSize: 12.5, fontWeight: 650, whiteSpace: "nowrap" }}>
                          {BUCKET_LABEL[r.origem_bucket] ?? r.origem_bucket}
                        </td>
                        <td style={{ ...S.value, fontSize: 12, padding: "10px 10px", whiteSpace: "nowrap" }}>
                          {fmtCountPct(r.leads_recebidos, r.pct_participacao_leads)}
                          {ant && <span style={{ color: "#83879a", fontSize: 10 }}>{trendArrow(r.leads_recebidos, ant.leads_recebidos)}</span>}
                        </td>
                        <td style={{ ...S.value, fontSize: 12, padding: "10px 10px", whiteSpace: "nowrap" }}>{fmtCountPct(r.leads_qualificados, r.taxa_qualificacao)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "10px 10px", whiteSpace: "nowrap", color: r.abandonos > 0 ? "#C8102E" : undefined }}>{fmtCountPct(r.abandonos, r.taxa_abandono)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "10px 10px", whiteSpace: "nowrap" }}>{fmtCountPct(r.primeiros_pedidos, r.taxa_conversao)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "10px 10px", whiteSpace: "nowrap" }}>{fmtCountPct(r.clientes_com_recompra, r.taxa_recompra)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "10px 10px", whiteSpace: "nowrap" }}>{fmtCountPct(r.clientes_recorrentes, r.taxa_recorrencia)}</td>
                        <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px", whiteSpace: "nowrap", color: "#22c55e" }}>
                          {fmtBRL(r.faturamento_atribuido_brl)} ({fmtPct(r.pct_faturamento)})
                          {ant && <span style={{ color: "#83879a", fontSize: 10 }}>{trendArrow(r.faturamento_atribuido_brl, ant.faturamento_atribuido_brl)}</span>}
                        </td>
                        <td style={{ ...S.value, fontSize: 12, padding: "10px 10px", whiteSpace: "nowrap" }}>{fmtBRL(r.custo_midia_brl)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "10px 10px", whiteSpace: "nowrap" }}>{fmtBRL(r.custo_operacional_brl)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "10px 10px", whiteSpace: "nowrap", fontWeight: 650 }}>{fmtBRL(r.custo_total_brl)}</td>
                        <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px", whiteSpace: "nowrap" }}>{fmtBRLCent(r.custo_por_lead_brl)}</td>
                        <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px", whiteSpace: "nowrap" }}>{fmtBRLCent(r.custo_por_qualificado_brl)}</td>
                        <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px", whiteSpace: "nowrap" }}>{fmtBRLCent(r.custo_por_primeiro_pedido_brl)}</td>
                        <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px", whiteSpace: "nowrap" }}>{fmtBRLCent(r.custo_por_recorrente_brl)}</td>
                        <td style={{ ...S.value, fontSize: 12, padding: "10px 10px", whiteSpace: "nowrap" }}>{r.retorno_sobre_faturamento != null ? `${r.retorno_sobre_faturamento.toFixed(2)}x` : "—"}</td>
                        <td style={{ padding: "10px 10px" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${SELO_COR[r.selo_confiabilidade]}22`, color: SELO_COR[r.selo_confiabilidade] ?? "#c0d0e0" }}>
                            {r.selo_confiabilidade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && (
                    <tr><td colSpan={17} style={{ ...S.muted, padding: 20, textAlign: "center" }}>Sem retorno da RPC.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <p style={{ ...S.muted, fontSize: 9.5, marginTop: 10 }}>
              Linhas esmaecidas: origem sem nenhum lead, pedido ou faturamento neste período (balde existe, número é 0 real). % entre parênteses é sempre
              numerador/denominador do próprio período — ▲/▼ ao lado de Leads Recebidos e Faturamento compara com {inicioAnt} a {fimAnt}.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
