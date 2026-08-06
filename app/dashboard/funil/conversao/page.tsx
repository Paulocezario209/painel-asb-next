// app/dashboard/funil/conversao/page.tsx — CRI F9 (tela 4/8 desta rodada): Conversão.
// Drill dedicado no EVENTO de conversão: taxa, velocidade, ticket, funil de recompra por
// posição do pedido e margem (contrato F4, ainda "não informada"). Reusa exclusivamente
// v_cri_conversion_sequencia_pedidos/v_cri_conversion_cliente/v_cri_margem_pedido (F4).
// Motor de Período via URL.
import { createClient } from "@/lib/supabase/server";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { vendorLabel } from "@/lib/vendor-labels";
import { Percent, Timer, ShoppingCart, DollarSign, Repeat, Layers, BarChart3, Search, Info } from "lucide-react";

export const dynamic = "force-dynamic";

interface ConversaoKpis {
  leads_recebidos: number;
  leads_convertidos: number;
  taxa_conversao: number | null;
  tempo_medio_conversao_horas: number | null;
  primeiros_pedidos: number;
  ticket_medio_1o_pedido_brl: number | null;
  total_pedidos_periodo: number;
  ticket_medio_geral_brl: number | null;
  faturamento_total_brl: number;
  clientes_com_recompra: number;
  clientes_com_pedido: number;
  taxa_recorrencia: number | null;
  margem_selo: string;
}

interface SequenciaRow {
  posicao: string;
  ordem: number;
  pedidos: number;
  clientes: number;
  faturamento_brl: number;
  ticket_medio_brl: number | null;
}

interface TempoRow {
  faixa: string;
  ordem: number;
  leads: number;
}

interface ListaRow {
  ares_pedido_id: number;
  n_pedido: string;
  data_faturamento: string;
  valor_faturado_brl: number;
  numero_sequencia: number;
  phone: string | null;
  restaurant_name: string | null;
  origem_canal: string | null;
  routing_team: string | null;
}

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

export default async function ConversaoPage({
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
  const [{ data: kpisRaw, error: kpisErr }, { data: seqRaw, error: seqErr }, { data: tempoRaw }, { data: listaRaw }] =
    await Promise.all([
      supabase.rpc("fn_cri_conversao_kpis", { p_data_inicio: inicio, p_data_fim: fim }),
      supabase.rpc("fn_cri_conversao_por_sequencia", { p_data_inicio: inicio, p_data_fim: fim }),
      supabase.rpc("fn_cri_conversao_distribuicao_tempo", { p_data_inicio: inicio, p_data_fim: fim }),
      supabase.rpc("fn_cri_conversao_lista", { p_data_inicio: inicio, p_data_fim: fim, p_origem_canal: null, p_routing_team: null, p_numero_sequencia_min: null }),
    ]);

  const kpis = (kpisRaw as ConversaoKpis[] | null)?.[0];
  const sequencia = ((seqRaw ?? []) as SequenciaRow[]).sort((a, b) => a.ordem - b.ordem);
  const tempoDist = ((tempoRaw ?? []) as TempoRow[]).sort((a, b) => a.ordem - b.ordem);
  const lista = (listaRaw ?? []) as ListaRow[];
  const error = kpisErr ?? seqErr;

  const totalTempoDist = tempoDist.reduce((s, t) => s + t.leads, 0);
  const maxSequencia = Math.max(1, ...sequencia.map((s) => s.pedidos));
  const semLeadBridge = lista.filter((l) => !l.phone).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Conversão"
        desc={`Taxa, velocidade, ticket e recompra por posição do pedido · período ${inicio} a ${fim}`}
      />

      <form method="get" style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ ...S.label }}>Período</span>
        <input type="date" name="inicio" defaultValue={inicio} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12 }} />
        <span style={{ color: "#83879a" }}>até</span>
        <input type="date" name="fim" defaultValue={fim} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12 }} />
        <button type="submit" style={{ background: "#185FA5", border: "none", borderRadius: 5, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer" }}>
          Aplicar
        </button>
        {kpis && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <span style={{ ...S.label }}>Selo margem</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${SELO_COR[kpis.margem_selo]}22`, color: SELO_COR[kpis.margem_selo] }}>
              {kpis.margem_selo}
            </span>
          </span>
        )}
      </form>

      {error || !kpis ? (
        <div style={{ ...S.card, padding: 20, borderTop: "2px solid #C8102E" }}>
          <p style={{ color: "#C8102E" }}>Erro ao carregar dados: {error?.message ?? "sem retorno da RPC"}</p>
        </div>
      ) : (
        <>
          <div className="asb-grid-kpi">
            <KpiCard
              label="Taxa de Conversão"
              value={fmtPct(kpis.taxa_conversao)}
              Icon={Percent}
              accent="#22c55e"
              num="#22c55e"
              note={`${kpis.leads_convertidos} de ${kpis.leads_recebidos} leads recebidos no período (mesma régua da Visão Geral)`}
            />
            <KpiCard label="Tempo Médio de Conversão" value={fmtHoras(kpis.tempo_medio_conversao_horas)} Icon={Timer} accent="#8bb4ff" num="#8bb4ff" note="criação do lead → 1º pedido faturado" />
            <KpiCard
              label="1os Pedidos"
              value={String(kpis.primeiros_pedidos)}
              Icon={ShoppingCart}
              accent="#D4A017"
              num="#D4A017"
              note={`ticket médio ${fmtBRL(kpis.ticket_medio_1o_pedido_brl)} · por data_faturamento no período`}
            />
            <KpiCard
              label="Taxa de Recompra"
              value={fmtPct(kpis.taxa_recorrencia)}
              Icon={Repeat}
              accent="#8bb4ff"
              num="#8bb4ff"
              note={`${kpis.clientes_com_recompra} de ${kpis.clientes_com_pedido} clientes com pedido no período`}
            />
          </div>

          <div className="asb-grid-kpi">
            <KpiCard label="Pedidos no Período" value={String(kpis.total_pedidos_periodo)} Icon={Layers} accent="#185FA5" num="#FFFFFF" note="qualquer posição na sequência do cliente" />
            <KpiCard label="Ticket Médio Geral" value={fmtBRL(kpis.ticket_medio_geral_brl)} Icon={DollarSign} accent="#22c55e" num="#22c55e" note="média de todos os pedidos do período" />
            <KpiCard label="Faturamento do Período" value={fmtBRL(kpis.faturamento_total_brl)} Icon={DollarSign} accent="#22c55e" num="#22c55e" note="soma via v_cri_conversion_sequencia_pedidos (F4)" />
            <KpiCard label="Margem" value="—" Icon={Percent} accent="#C8102E" num="#C8102E" note="não informada — sem fonte confiável hoje (decisão Paulo: não inventar, não usar % fixo)" />
          </div>

          <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(212,160,23,.06)", border: "1px solid rgba(212,160,23,.3)" }}>
            <Info size={16} color="#D4A017" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ ...S.muted, fontSize: 11.5, lineHeight: 1.5 }}>
              <b style={{ color: "#D4A017" }}>3 números de &quot;conversão&quot;, 3 fontes — de propósito, não é bug:</b> <b>Taxa de Conversão</b> ({kpis.leads_convertidos}) conta
              leads (ai_sdr_leads.first_order_at) — mesma régua da Visão Geral/Jornada dos Leads. <b>1os Pedidos</b> ({kpis.primeiros_pedidos}) conta pedidos com
              numero_sequencia=1 faturados no período (v_cri_conversion_sequencia_pedidos) — pode diferir porque olha a DATA DO FATURAMENTO, não a criação do lead.
              <b> Tempo Médio/Distribuição abaixo</b> usam v_cri_conversion_cliente (customer_state, fonte única de receita do F4) e só entram leads com tempo de
              conversão válido (≥0 dias) — excluem clientes ARES pré-existentes reconciliados depois com um lead, que não são conversão real (mesma exclusão
              documentada em F4). As 3 medem &quot;conversão&quot; de ângulos diferentes; nenhuma delas está errada.
            </p>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={Layers} color="#185FA5" title="Funil de Recompra — Posição do Pedido" desc="pedidos, clientes e ticket por posição na sequência do cliente, no período" />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sequencia.map((s) => {
                const pct = Math.round((s.pedidos / maxSequencia) * 100);
                return (
                  <div key={s.posicao} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 90, color: "#c8d8e8", fontSize: 11, flexShrink: 0 }}>{s.posicao}</span>
                    <div style={{ flex: 1, background: "var(--asb-card)", borderRadius: 3, height: 22, position: "relative", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #1B2A6B, #2ea043)", borderRadius: 3, minWidth: s.pedidos > 0 ? 3 : 0 }} />
                      <span style={{ position: "absolute", left: 8, top: 3, color: "#fff", fontSize: 11 }}>{s.pedidos} pedidos · {s.clientes} clientes</span>
                    </div>
                    <span style={{ width: 90, textAlign: "right", color: "#22c55e", fontSize: 11, flexShrink: 0 }}>{fmtBRL(s.faturamento_brl)}</span>
                    <span style={{ width: 80, textAlign: "right", color: "#c0d0e0", fontSize: 10, flexShrink: 0 }}>tkt {fmtBRL(s.ticket_medio_brl)}</span>
                  </div>
                );
              })}
              {sequencia.length === 0 && <p style={{ ...S.muted, padding: 10 }}>Nenhum pedido faturado neste período.</p>}
            </div>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={BarChart3} color="#8bb4ff" title="Distribuição do Tempo até Conversão" desc={`${totalTempoDist} lead${totalTempoDist === 1 ? "" : "s"} com tempo de conversão válido no período (ver nota acima)`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tempoDist.map((t) => {
                const pct = totalTempoDist > 0 ? Math.round((t.leads / totalTempoDist) * 100) : 0;
                return (
                  <div key={t.faixa} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 80, color: "#c8d8e8", fontSize: 11, flexShrink: 0 }}>{t.faixa}</span>
                    <div style={{ flex: 1, background: "var(--asb-card)", borderRadius: 3, height: 20, position: "relative", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #185FA5, #8bb4ff)", borderRadius: 3, minWidth: t.leads > 0 ? 3 : 0 }} />
                      <span style={{ position: "absolute", left: 8, top: 2, color: "#fff", fontSize: 10.5 }}>{t.leads}</span>
                    </div>
                    <span style={{ width: 40, textAlign: "right", color: "#c0d0e0", fontSize: 10, flexShrink: 0 }}>{pct}%</span>
                  </div>
                );
              })}
              {tempoDist.length === 0 && <p style={{ ...S.muted, padding: 10 }}>Nenhum lead com tempo de conversão válido neste período.</p>}
            </div>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={Search} color="#8bb4ff" title="Pedidos do Período" desc={`${lista.length} pedido${lista.length === 1 ? "" : "s"} · ${semLeadBridge} de ${lista.length} sem lead SDR correspondente (cliente ARES pré-existente)`} />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    {["Pedido", "Data", "Valor", "Sequência", "Cliente (via lead)", "Origem", "Responsável"].map((h) => (
                      <th key={h} style={{ ...S.label, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 50).map((p) => (
                    <tr key={p.ares_pedido_id} style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                      <td style={{ ...S.value, fontSize: 12, padding: "10px 10px" }}>{p.n_pedido}</td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{p.data_faturamento}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px", color: "#22c55e" }}>{fmtBRL(p.valor_faturado_brl)}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>{p.numero_sequencia}º</td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{p.restaurant_name ?? (p.phone ? `...${p.phone.slice(-4)}` : "sem lead SDR")}</td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{p.origem_canal ?? "—"}</td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{p.routing_team ? vendorLabel(p.routing_team) : "—"}</td>
                    </tr>
                  ))}
                  {lista.length === 0 && (
                    <tr><td colSpan={7} style={{ ...S.muted, padding: 20, textAlign: "center" }}>Nenhum pedido faturado neste período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {lista.length > 50 && (
              <p style={{ ...S.muted, fontSize: 10, marginTop: 8 }}>Mostrando os 50 mais recentes de {lista.length} pedidos (limite de leitura de 1000 na RPC) — refine o período para uma lista mais específica.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
