// app/dashboard/funil/jornada-dos-leads/page.tsx — CRI F9 (tela 3/8 desta rodada): Jornada dos Leads.
// Funil de LEADS pré-venda: onde cada lead está, por quais etapas passou, quanto tempo
// permaneceu e onde travou ou avançou. NÃO duplica "Jornada do Cliente até a Recorrência"
// (Bloco 2 de app/dashboard/funil/page.tsx — 100% pós-1ª-compra, eixo=total_orders); esta
// tela é pré-venda, eixo=trilha CRI (funnel_stage_events via v_cri_etapa_transicoes).
// Motor de Período via URL. 8 filtros. Status da lista é 100% escopado ao período — ver nota.
import { createClient } from "@/lib/supabase/server";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { fmtDateTimeCompactBRT } from "@/lib/datetime-brt";
import { VENDOR_LABELS, VENDOR_ORDER, vendorLabel } from "@/lib/vendor-labels";
import Link from "next/link";
import { Users, Filter, Clock, XCircle, ShoppingCart, Timer, Handshake, LayoutGrid, Search, Info } from "lucide-react";

export const dynamic = "force-dynamic";

interface JornadaKpis {
  leads_recebidos: number;
  leads_em_qualificacao: number;
  leads_parados: number;
  leads_abandonados: number;
  leads_convertidos: number;
  tempo_medio_qualificacao_horas: number | null;
  tempo_medio_handoff_horas: number | null;
  tempo_medio_1o_pedido_horas: number | null;
}

interface DistribuicaoRow {
  etapa_numero: number;
  etapa_nome: string;
  chegou: number;
  pct_do_total: number | null;
  tempo_medio_horas: number | null;
  avancou: number;
  parou: number;
  abandonou: number;
}

interface ListaRow {
  lead_id: string;
  phone: string;
  restaurant_name: string | null;
  origem_canal: string | null;
  campanha: string | null;
  etapa_numero: number | null;
  etapa_nome: string | null;
  entrou_etapa_em: string | null;
  dias_na_etapa: number | null;
  routing_team: string | null;
  last_contact_at: string | null;
  status: string;
}

interface OrigemRow {
  origem_canal: string;
  leads: number;
}

// Mesma trilha de fn_cri_mapear_etapa_trilha (migration F5,
// 2026_08_06_cri_f5_custo_acumulado_por_etapa.sql) — duplicado aqui só como rótulo de
// exibição do filtro (frontend não importa SQL); fonte de verdade é a function.
const TRILHA_ETAPAS = [
  { v: "1", label: "1 · Lead criado" },
  { v: "2", label: "2 · 1º atendimento" },
  { v: "3", label: "3 · Qualificação iniciada" },
  { v: "4", label: "4 · Qualificação concluída" },
  { v: "5", label: "5 · Handoff" },
  { v: "6", label: "6 · Negociação" },
  { v: "7", label: "7 · 1º pedido" },
  { v: "8", label: "8 · Recorrência" },
  { v: "99", label: "⚠ Abandono/Saída" },
];

const STATUS_OPCOES = [
  { v: "convertido", label: "Convertido" },
  { v: "abandonado", label: "Abandonado" },
  { v: "parado", label: "Parado" },
  { v: "ativo", label: "Ativo" },
];

const STATUS_COR: Record<string, string> = {
  convertido: "#22c55e",
  abandonado: "#C8102E",
  parado: "#D4A017",
  ativo: "#8bb4ff",
};

function fmtHoras(v: number | null): string {
  if (v == null) return "—";
  if (v < 24) return `${v.toFixed(0)}h`;
  return `${(v / 24).toFixed(1)}d`;
}

function fmtDias(v: number | null): string {
  if (v == null) return "—";
  if (v < 1) return `${Math.round(v * 24)}h`;
  return `${v.toFixed(1)}d`;
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

const selectStyle = {
  background: "var(--asb-card-hi)",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 5,
  padding: "6px 10px",
  color: "#c8d8e8",
  fontSize: 12,
};

const hoje = () => new Date().toISOString().slice(0, 10);
const primeiroDiaDoMes = () => `${new Date().toISOString().slice(0, 7)}-01`;

export default async function JornadaDosLeadsPage({
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

  const origemCanal = sp?.origem_canal || null;
  const campanha = sp?.campanha || null;
  const etapaNumero = sp?.etapa && /^\d+$/.test(sp.etapa) ? Number(sp.etapa) : null;
  const routingTeam = sp?.routing_team || null;
  const paradoDiasMin = sp?.parado_dias_min && /^\d+$/.test(sp.parado_dias_min) ? Number(sp.parado_dias_min) : null;
  const status = sp?.status || null;

  const supabase = await createClient();
  const [{ data: kpisRaw, error: kpisErr }, { data: distRaw, error: distErr }, { data: listaRaw, error: listaErr }, { data: origemRaw }] =
    await Promise.all([
      supabase.rpc("fn_cri_jornada_kpis", { p_data_inicio: inicio, p_data_fim: fim }),
      supabase.rpc("fn_cri_jornada_distribuicao_etapa", { p_data_inicio: inicio, p_data_fim: fim }),
      supabase.rpc("fn_cri_jornada_lista", {
        p_data_inicio: inicio,
        p_data_fim: fim,
        p_origem_canal: origemCanal,
        p_campanha: campanha,
        p_etapa_numero: etapaNumero,
        p_routing_team: routingTeam,
        p_parado_dias_min: paradoDiasMin,
        p_status: status,
      }),
      supabase.rpc("fn_cri_distribuicao_origem", { p_data_inicio: inicio, p_data_fim: fim }),
    ]);

  const kpis = (kpisRaw as JornadaKpis[] | null)?.[0];
  const distribuicao = ((distRaw ?? []) as DistribuicaoRow[]).sort((a, b) => a.etapa_numero - b.etapa_numero);
  const lista = (listaRaw ?? []) as ListaRow[];
  const origens = ((origemRaw ?? []) as OrigemRow[]).sort((a, b) => b.leads - a.leads);
  const error = kpisErr ?? distErr ?? listaErr;

  const filtrosAtivos = [origemCanal, campanha, etapaNumero, routingTeam, paradoDiasMin, status].some((v) => v != null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Jornada dos Leads"
        desc={`Onde cada lead está, por quais etapas passou e onde travou ou avançou · período ${inicio} a ${fim}`}
      />

      {/* Motor de Período + 8 filtros — GET puro, sem JS, URL-driven (mesmo padrão das telas CRI irmãs) */}
      <form method="get" style={{ ...S.card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ ...S.label }}>Período</span>
          <input type="date" name="inicio" defaultValue={inicio} style={selectStyle} />
          <span style={{ color: "#83879a" }}>até</span>
          <input type="date" name="fim" defaultValue={fim} style={selectStyle} />
          <span style={{ ...S.label, marginLeft: 8 }}>Etapa</span>
          <select name="etapa" defaultValue={etapaNumero != null ? String(etapaNumero) : ""} style={selectStyle}>
            <option value="">Todas</option>
            {TRILHA_ETAPAS.map((e) => (
              <option key={e.v} value={e.v}>{e.label}</option>
            ))}
          </select>
          <span style={{ ...S.label }}>Responsável</span>
          <select name="routing_team" defaultValue={routingTeam ?? ""} style={selectStyle}>
            <option value="">Todos</option>
            {VENDOR_ORDER.map((v) => (
              <option key={v} value={v}>{VENDOR_LABELS[v]}</option>
            ))}
            <option value="fora_de_rota">Fora de Rota</option>
          </select>
          <span style={{ ...S.label }}>Status</span>
          <select name="status" defaultValue={status ?? ""} style={selectStyle}>
            <option value="">Todos</option>
            {STATUS_OPCOES.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ ...S.label }}>Origem</span>
          <select name="origem_canal" defaultValue={origemCanal ?? ""} style={selectStyle}>
            <option value="">Todas</option>
            {origens.map((o) => (
              <option key={o.origem_canal} value={o.origem_canal}>{o.origem_canal} ({o.leads})</option>
            ))}
          </select>
          <span style={{ ...S.label }}>Campanha</span>
          <input type="text" name="campanha" defaultValue={campanha ?? ""} placeholder="utm_campaign" style={{ ...selectStyle, width: 160 }} />
          <span style={{ ...S.label }}>Parado há ≥</span>
          <input type="number" name="parado_dias_min" defaultValue={paradoDiasMin ?? ""} min={0} placeholder="dias" style={{ ...selectStyle, width: 80 }} />
          <button type="submit" style={{ background: "#185FA5", border: "none", borderRadius: 5, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer" }}>
            Aplicar
          </button>
          {filtrosAtivos && (
            <Link href={`/dashboard/funil/jornada-dos-leads?inicio=${inicio}&fim=${fim}`} style={{ color: "#c0d0e0", fontSize: 11 }}>
              limpar filtros
            </Link>
          )}
        </div>
      </form>

      {error || !kpis ? (
        <div style={{ ...S.card, padding: 20, borderTop: "2px solid #C8102E" }}>
          <p style={{ color: "#C8102E" }}>Erro ao carregar dados: {error?.message ?? "sem retorno da RPC"}</p>
        </div>
      ) : (
        <>
          <div className="asb-grid-kpi">
            <KpiCard label="Leads Recebidos" value={String(kpis.leads_recebidos)} Icon={Users} accent="#185FA5" num="#FFFFFF" note="criados no período" />
            <KpiCard label="Em Qualificação" value={String(kpis.leads_em_qualificacao)} Icon={Filter} accent="#8bb4ff" num="#8bb4ff" note="agora, independente do período · etapas 1-6, ainda ativo" />
            <KpiCard label="Parados" value={String(kpis.leads_parados)} Icon={Clock} accent="#D4A017" num="#D4A017" note="entraram na etapa atual no período e ainda não saíram" />
            <KpiCard label="Abandonados" value={String(kpis.leads_abandonados)} Icon={XCircle} accent="#C8102E" num="#C8102E" note="entraram em Abandono/Saída no período" />
          </div>

          <div className="asb-grid-kpi">
            <KpiCard
              label="Convertidos"
              value={String(kpis.leads_convertidos)}
              Icon={ShoppingCart}
              accent="#22c55e"
              num="#22c55e"
              note={`${kpis.leads_recebidos} recebidos → ${kpis.leads_convertidos} converteram no período (1º pedido)`}
            />
            <KpiCard label="Tempo até Qualificação" value={fmtHoras(kpis.tempo_medio_qualificacao_horas)} Icon={Timer} accent="#8bb4ff" num="#8bb4ff" note="criação → etapa 4 (concluída)" />
            <KpiCard label="Tempo até Handoff" value={fmtHoras(kpis.tempo_medio_handoff_horas)} Icon={Handshake} accent="#8bb4ff" num="#8bb4ff" note="criação → etapa 5" />
            <KpiCard label="Tempo até 1º Pedido" value={fmtHoras(kpis.tempo_medio_1o_pedido_horas)} Icon={Timer} accent="#22c55e" num="#22c55e" note="criação → 1º pedido faturado" />
          </div>

          <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(212,160,23,.06)", border: "1px solid rgba(212,160,23,.3)" }}>
            <Info size={16} color="#D4A017" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ ...S.muted, fontSize: 11.5, lineHeight: 1.5 }}>
              <b style={{ color: "#D4A017" }}>Leitura do período:</b> <b>Em Qualificação</b> é foto do agora (não muda com o período — é &quot;quantos estão
              no funil hoje&quot;, não um evento datado). Todos os demais números (Recebidos/Parados/Abandonados/Convertidos/Tempos) e o <b>status</b> de cada
              lead na lista abaixo são escopados ao período selecionado — um lead abandonado ou convertido fora da janela aparece como <b>ativo</b> nesta
              consulta (a etapa atual dele continua visível, só o rótulo de status é que respeita o Motor de Período). Na tabela de <b>Distribuição por
              Etapa</b>, avançou/parou/abandonou contam apenas quem <i>entrou</i> naquela etapa dentro do período — um lead que entrou numa etapa antes da
              janela e só avançou dentro dela não entra nesse breakdown por etapa (mesma régua já usada em Custo Acumulado por Etapa), mas aparece
              corretamente na lista investigativa, na sua etapa atual.
            </p>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={LayoutGrid} color="#185FA5" title="Distribuição por Etapa" desc="quem chegou, quanto tempo ficou e o desfecho de quem entrou em cada etapa no período" />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    {["Etapa", "Chegou", "% do Total", "Tempo Médio", "Avançou", "Parou", "Abandonou"].map((h) => (
                      <th key={h} style={{ ...S.label, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {distribuicao.map((e) => (
                    <tr key={e.etapa_numero} style={{ borderBottom: "1px solid rgba(255,255,255,.06)", background: e.etapa_numero === 99 ? "rgba(200,16,46,.04)" : undefined }}>
                      <td style={{ padding: "10px 10px", color: "#fff", fontFamily: "var(--font-geist-sans)", fontSize: 12.5, fontWeight: 650 }}>
                        {e.etapa_numero === 99 ? "⚠ " : `${e.etapa_numero} · `}{e.etapa_nome}
                      </td>
                      <td style={{ ...S.value, fontSize: 14, padding: "10px 10px" }}>{e.chegou}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>{fmtPct(e.pct_do_total)}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>
                        <Clock size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
                        {fmtHoras(e.tempo_medio_horas)}
                      </td>
                      <td style={{ ...S.value, fontSize: 14, padding: "10px 10px", color: "#22c55e" }}>{e.avancou}</td>
                      <td style={{ ...S.value, fontSize: 14, padding: "10px 10px", color: "#83879a" }}>{e.parou}</td>
                      <td style={{ ...S.value, fontSize: 14, padding: "10px 10px", color: "#C8102E" }}>{e.abandonou}</td>
                    </tr>
                  ))}
                  {distribuicao.length === 0 && (
                    <tr><td colSpan={7} style={{ ...S.muted, padding: 20, textAlign: "center" }}>Nenhum lead entrou em etapa mapeada neste período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={Search} color="#8bb4ff" title="Lista Investigativa" desc={`${lista.length} lead${lista.length === 1 ? "" : "s"} · clique no telefone para abrir a ficha · ordenado por dias na etapa atual`} />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    {["Lead", "Origem", "Campanha", "Etapa", "Entrou em", "Dias na Etapa", "Responsável", "Último Contato", "Status"].map((h) => (
                      <th key={h} style={{ ...S.label, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((l) => (
                    <tr key={l.lead_id} style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                      <td style={{ padding: "10px 10px" }}>
                        <Link href={`/dashboard/leads/${encodeURIComponent(l.phone)}`} style={{ color: "#c8d8e8", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
                          {l.restaurant_name || `...${l.phone.slice(-4)}`}
                        </Link>
                      </td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{l.origem_canal ?? "—"}</td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{l.campanha ?? "—"}</td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>
                        {l.etapa_numero != null ? `${l.etapa_numero === 99 ? "⚠" : l.etapa_numero} · ${l.etapa_nome}` : "—"}
                      </td>
                      <td style={{ ...S.value, fontSize: 11, padding: "10px 10px" }}>{fmtDateTimeCompactBRT(l.entrou_etapa_em)}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>{fmtDias(l.dias_na_etapa)}</td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{vendorLabel(l.routing_team)}</td>
                      <td style={{ ...S.value, fontSize: 11, padding: "10px 10px" }}>{fmtDateTimeCompactBRT(l.last_contact_at)}</td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 10, fontFamily: "var(--font-geist-sans)", padding: "2px 8px", borderRadius: 999, background: `${STATUS_COR[l.status]}22`, color: STATUS_COR[l.status] ?? "#c0d0e0" }}>
                          {l.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {lista.length === 0 && (
                    <tr><td colSpan={9} style={{ ...S.muted, padding: 20, textAlign: "center" }}>Nenhum lead encontrado com esses filtros.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {lista.length >= 1000 && (
              <p style={{ ...S.muted, fontSize: 10, marginTop: 8 }}>Limite de 1000 linhas atingido — refine os filtros para uma lista mais específica.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
