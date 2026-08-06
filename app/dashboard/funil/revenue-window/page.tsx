// app/dashboard/funil/revenue-window/page.tsx — CRI F9 (tela 5/8 desta rodada): Revenue Window.
// Comportamento pós-1o-pedido dentro de uma janela configurável (7/15/30/60/90/180/365 ou
// custom) — sem limite de quantidade de pedidos. 60 dias é só default desta página, nunca
// constante de backend (as 3 RPCs exigem p_janela_dias explícito, sem default no SQL).
// Reusa integralmente F4 (v_cri_conversion_sequencia_pedidos) e F6 (fn_cri_revenue_window,
// fn_cri_faixa_por_dias, v_cri_retention_status_com_recuperacao). Motor de Período via URL.
import { createClient } from "@/lib/supabase/server";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { fmtDateTimeCompactBRT } from "@/lib/datetime-brt";
import { vendorLabel } from "@/lib/vendor-labels";
import Link from "next/link";
import { Users, Repeat, Timer, DollarSign, Eye, CheckCircle2, RotateCcw, UserX, Percent, Layers, Search, Info } from "lucide-react";

export const dynamic = "force-dynamic";

interface WindowKpis {
  total_clientes: number;
  clientes_1_pedido: number;
  clientes_2_pedidos: number;
  clientes_3_pedidos: number;
  clientes_4_pedidos: number;
  clientes_5_mais_pedidos: number;
  clientes_recompraram: number;
  tempo_medio_ate_2o_pedido_dias: number | null;
  tempo_medio_entre_compras_dias: number | null;
  faturamento_acumulado_brl: number;
  ticket_medio_brl: number | null;
  clientes_em_observacao: number;
  clientes_janela_concluida: number;
  clientes_recuperados: number;
  clientes_inativos_na_janela: number;
  pct_recompra: number | null;
  pct_recorrencia: number | null;
  selo_maturidade_coorte: string;
  margem_selo: string;
}

interface ListaRow {
  ares_cliente_id: number;
  phone: string | null;
  restaurant_name: string | null;
  origem_canal: string | null;
  routing_team: string | null;
  first_order_at: string;
  data_fechamento: string;
  janela_concluida: boolean;
  pedidos_na_janela: number;
  bucket_pedidos: string;
  dias_1o_ao_2o_pedido: number | null;
  faturamento_na_janela_brl: number;
  ticket_medio_na_janela_brl: number | null;
  ultimo_pedido_na_janela: string;
  faixa_inatividade_na_janela: string;
  recuperado: boolean;
}

const JANELAS_PRESET = [7, 15, 30, 60, 90, 180, 365];

const SELO_MATURIDADE_COR: Record<string, string> = {
  madura: "#22c55e",
  parcial: "#D4A017",
  em_observacao: "#8bb4ff",
  sem_dados: "#83879a",
};

const SELO_MATURIDADE_LABEL: Record<string, string> = {
  madura: "coorte madura",
  parcial: "coorte parcial",
  em_observacao: "ainda em observação",
  sem_dados: "sem dados no período",
};

const SELO_COR: Record<string, string> = {
  confirmado: "#22c55e",
  parcial: "#D4A017",
  estimado: "#8bb4ff",
  nao_informado: "#C8102E",
};

const FAIXA_COR: Record<string, string> = {
  ativo: "#22c55e",
  atencao: "#8bb4ff",
  risco: "#D4A017",
  pre_churn: "#D4A017",
  churn_comercial: "#C8102E",
  inativo_definitivo: "#C8102E",
};

function fmtBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtDias(v: number | null): string {
  if (v == null) return "—";
  return `${v.toFixed(1)}d`;
}

function trendChip(atual: number, anterior: number): { chip: string; up: boolean | null } {
  if (anterior === 0) return { chip: atual > 0 ? "novo no período" : "sem dado", up: null };
  const delta = ((atual - anterior) / anterior) * 100;
  return { chip: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs período anterior`, up: delta >= 0 };
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

export default async function RevenueWindowPage({
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
  // 60 e default só desta PÁGINA (prop de UI) — nao existe DEFAULT no SQL das 3 RPCs novas.
  const janela = sp?.janela && /^\d+$/.test(sp.janela) && Number(sp.janela) > 0 ? Number(sp.janela) : 60;
  const { inicioAnt, fimAnt } = periodoAnterior(inicio, fim);

  const bucketFiltro = sp?.bucket || null;
  const origemFiltro = sp?.origem_canal || null;
  const routingFiltro = sp?.routing_team || null;
  const apenasRecuperados = sp?.recuperados === "1" ? true : null;
  const apenasInativos = sp?.inativos === "1" ? true : null;

  const supabase = await createClient();
  const [{ data: kpisRaw, error: kpisErr }, { data: kpisAntRaw }, { data: listaRaw, error: listaErr }] = await Promise.all([
    supabase.rpc("fn_cri_revenue_window_kpis", { p_janela_dias: janela, p_data_inicio: inicio, p_data_fim: fim }),
    supabase.rpc("fn_cri_revenue_window_kpis", { p_janela_dias: janela, p_data_inicio: inicioAnt, p_data_fim: fimAnt }),
    supabase.rpc("fn_cri_revenue_window_lista", {
      p_janela_dias: janela,
      p_data_inicio: inicio,
      p_data_fim: fim,
      p_bucket_pedidos: bucketFiltro,
      p_origem_canal: origemFiltro,
      p_routing_team: routingFiltro,
      p_apenas_recuperados: apenasRecuperados,
      p_apenas_inativos: apenasInativos,
    }),
  ]);

  const kpis = (kpisRaw as WindowKpis[] | null)?.[0];
  const kpisAnt = (kpisAntRaw as WindowKpis[] | null)?.[0];
  const lista = (listaRaw ?? []) as ListaRow[];
  const error = kpisErr ?? listaErr;

  const buckets = kpis
    ? [
        { label: "1 pedido", valor: kpis.clientes_1_pedido },
        { label: "2 pedidos", valor: kpis.clientes_2_pedidos },
        { label: "3 pedidos", valor: kpis.clientes_3_pedidos },
        { label: "4 pedidos", valor: kpis.clientes_4_pedidos },
        { label: "5+ pedidos", valor: kpis.clientes_5_mais_pedidos },
      ]
    : [];
  const maxBucket = Math.max(1, ...buckets.map((b) => b.valor));

  const hrefComJanela = (n: number) => `/dashboard/funil/revenue-window?inicio=${inicio}&fim=${fim}&janela=${n}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Revenue Window"
        desc={`Comportamento pós-1º pedido em janela de ${janela} dias · período de aquisição ${inicio} a ${fim}`}
      />

      <form method="get" style={{ ...S.card, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span style={{ ...S.label }}>Período de aquisição</span>
          <input type="date" name="inicio" defaultValue={inicio} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12 }} />
          <span style={{ color: "#83879a" }}>até</span>
          <input type="date" name="fim" defaultValue={fim} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12 }} />
          <span style={{ ...S.label, marginLeft: 8 }}>Janela</span>
          <input type="number" name="janela" defaultValue={janela} min={1} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12, width: 70 }} />
          <span style={{ ...S.muted, fontSize: 10 }}>dias</span>
          <button type="submit" style={{ background: "#185FA5", border: "none", borderRadius: 5, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer" }}>
            Aplicar
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ ...S.label }}>Atalhos</span>
          {JANELAS_PRESET.map((n) => (
            <Link
              key={n}
              href={hrefComJanela(n)}
              style={{
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 999,
                textDecoration: "none",
                background: n === janela ? "#185FA5" : "var(--asb-card-hi)",
                color: n === janela ? "#fff" : "#c0d0e0",
                border: `1px solid ${n === janela ? "#185FA5" : "rgba(255,255,255,.14)"}`,
                fontWeight: n === janela ? 700 : 500,
              }}
            >
              {n}d
            </Link>
          ))}
          <span style={{ ...S.muted, fontSize: 9, marginLeft: 4 }}>60d é só o default desta tela — digite qualquer valor no campo &quot;Janela&quot; para personalizar</span>
          {kpis && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${SELO_MATURIDADE_COR[kpis.selo_maturidade_coorte]}22`, color: SELO_MATURIDADE_COR[kpis.selo_maturidade_coorte] }}>
                {SELO_MATURIDADE_LABEL[kpis.selo_maturidade_coorte] ?? kpis.selo_maturidade_coorte}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${SELO_COR[kpis.margem_selo]}22`, color: SELO_COR[kpis.margem_selo] }}>
                margem: {kpis.margem_selo}
              </span>
            </span>
          )}
        </div>
      </form>

      {error || !kpis ? (
        <div style={{ ...S.card, padding: 20, borderTop: "2px solid #C8102E" }}>
          <p style={{ color: "#C8102E" }}>Erro ao carregar dados: {error?.message ?? "sem retorno da RPC"}</p>
        </div>
      ) : (
        <>
          {kpis.selo_maturidade_coorte === "parcial" && (
            <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(212,160,23,.06)", border: "1px solid rgba(212,160,23,.3)" }}>
              <Info size={16} color="#D4A017" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ ...S.muted, fontSize: 11.5, lineHeight: 1.5 }}>
                <b style={{ color: "#D4A017" }}>Coorte parcial:</b> {kpis.clientes_janela_concluida} de {kpis.total_clientes} clientes já tiveram a janela de{" "}
                {janela} dias concluída (data de fechamento no passado); {kpis.clientes_em_observacao} ainda estão dentro da janela — os números de recompra
                deles ainda podem mudar. <b>% de Recorrência</b> abaixo já usa só os {kpis.clientes_janela_concluida} maduros, para não misturar coorte
                imatura com concluída. <b>% de Recompra</b> usa todos os {kpis.total_clientes} (número &quot;bruto&quot;, incluindo quem ainda pode recomprar).
              </p>
            </div>
          )}

          <div className="asb-grid-kpi">
            <KpiCard
              label="Clientes na Coorte"
              value={String(kpis.total_clientes)}
              Icon={Users}
              accent="#185FA5"
              num="#FFFFFF"
              note="1º pedido all-time no período de aquisição"
            />
            <KpiCard
              label="Recompraram na Janela"
              value={String(kpis.clientes_recompraram)}
              Icon={Repeat}
              accent="#22c55e"
              num="#22c55e"
              {...(kpisAnt ? { chip: trendChip(kpis.clientes_recompraram, kpisAnt.clientes_recompraram).chip, chipUp: trendChip(kpis.clientes_recompraram, kpisAnt.clientes_recompraram).up } : {})}
            />
            <KpiCard
              label="% de Recompra"
              value={fmtPct(kpis.pct_recompra)}
              Icon={Percent}
              accent="#22c55e"
              num="#22c55e"
              note={`${kpis.clientes_recompraram} de ${kpis.total_clientes} clientes (toda a coorte)`}
            />
            <KpiCard
              label="% de Recorrência"
              value={fmtPct(kpis.pct_recorrencia)}
              Icon={Percent}
              accent="#8bb4ff"
              num="#8bb4ff"
              note={`só coorte madura: ${kpis.clientes_janela_concluida} clientes com janela concluída`}
            />
          </div>

          <div className="asb-grid-kpi">
            <KpiCard label="Tempo até a 2ª Compra" value={fmtDias(kpis.tempo_medio_ate_2o_pedido_dias)} Icon={Timer} accent="#8bb4ff" num="#8bb4ff" note="média entre quem recomprou dentro da janela" />
            <KpiCard label="Tempo Médio entre Compras" value={fmtDias(kpis.tempo_medio_entre_compras_dias)} Icon={Timer} accent="#8bb4ff" num="#8bb4ff" note="média por cliente, todos os intervalos dentro da janela" />
            <KpiCard
              label="Faturamento Acumulado"
              value={fmtBRL(kpis.faturamento_acumulado_brl)}
              Icon={DollarSign}
              accent="#22c55e"
              num="#22c55e"
              {...(kpisAnt ? { chip: trendChip(kpis.faturamento_acumulado_brl, kpisAnt.faturamento_acumulado_brl).chip, chipUp: trendChip(kpis.faturamento_acumulado_brl, kpisAnt.faturamento_acumulado_brl).up } : {})}
            />
            <KpiCard label="Ticket Médio na Janela" value={fmtBRL(kpis.ticket_medio_brl)} Icon={DollarSign} accent="#22c55e" num="#22c55e" note="soma faturada ÷ pedidos, dentro da janela" />
          </div>

          <div className="asb-grid-kpi">
            <KpiCard label="Ainda em Observação" value={String(kpis.clientes_em_observacao)} Icon={Eye} accent="#8bb4ff" num="#8bb4ff" note="janela ainda não fechou — números podem subir" />
            <KpiCard label="Janela Concluída" value={String(kpis.clientes_janela_concluida)} Icon={CheckCircle2} accent="#22c55e" num="#22c55e" note="data de fechamento no passado — número final" />
            <KpiCard label="Recuperados" value={String(kpis.clientes_recuperados)} Icon={RotateCcw} accent="#8bb4ff" num="#8bb4ff" note="voltaram após gap de risco (histórico completo, F6)" />
            <KpiCard label="Inativos na Janela" value={String(kpis.clientes_inativos_na_janela)} Icon={UserX} accent="#C8102E" num="#C8102E" note="60+ dias sem comprar, medido dentro da janela" />
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={Layers} color="#185FA5" title="Distribuição por Quantidade de Pedidos" desc={`${kpis.total_clientes} clientes da coorte, por nº de pedidos dentro da janela de ${janela} dias — o 4º pedido é marco analítico, não teto técnico`} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {buckets.map((b) => {
                const pct = Math.round((b.valor / maxBucket) * 100);
                const pctDoTotal = kpis.total_clientes > 0 ? fmtPct(b.valor / kpis.total_clientes) : "—";
                return (
                  <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 80, color: "#c8d8e8", fontSize: 11, flexShrink: 0 }}>{b.label}</span>
                    <div style={{ flex: 1, background: "var(--asb-card)", borderRadius: 3, height: 22, position: "relative", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #1B2A6B, #2ea043)", borderRadius: 3, minWidth: b.valor > 0 ? 3 : 0 }} />
                      <span style={{ position: "absolute", left: 8, top: 3, color: "#fff", fontSize: 11 }}>{b.valor} clientes</span>
                    </div>
                    <span style={{ width: 60, textAlign: "right", color: "#c0d0e0", fontSize: 11, flexShrink: 0 }}>{pctDoTotal}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={Search} color="#8bb4ff" title="Lista Investigativa" desc={`${lista.length} cliente${lista.length === 1 ? "" : "s"} · filtros abaixo`} />
            <form method="get" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <input type="hidden" name="inicio" value={inicio} />
              <input type="hidden" name="fim" value={fim} />
              <input type="hidden" name="janela" value={janela} />
              <select name="bucket" defaultValue={bucketFiltro ?? ""} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 11 }}>
                <option value="">Todos os buckets</option>
                {["1", "2", "3", "4", "5+"].map((b) => (
                  <option key={b} value={b}>{b} pedido{b === "1" ? "" : "s"}</option>
                ))}
              </select>
              <input type="text" name="origem_canal" defaultValue={origemFiltro ?? ""} placeholder="origem_canal" style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 11, width: 130 }} />
              <input type="text" name="routing_team" defaultValue={routingFiltro ?? ""} placeholder="routing_team" style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 11, width: 150 }} />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#c0d0e0" }}>
                <input type="checkbox" name="recuperados" value="1" defaultChecked={apenasRecuperados === true} /> só recuperados
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "#c0d0e0" }}>
                <input type="checkbox" name="inativos" value="1" defaultChecked={apenasInativos === true} /> só inativos na janela
              </label>
              <button type="submit" style={{ background: "#185FA5", border: "none", borderRadius: 5, padding: "6px 14px", color: "#fff", fontSize: 11, fontWeight: 650, cursor: "pointer" }}>
                Filtrar
              </button>
            </form>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    {["Cliente", "Origem", "Responsável", "1º Pedido", "Fechamento", "Maturidade", "Pedidos", "Faturamento", "Ticket", "Último Pedido", "Faixa", "Recuperado"].map((h) => (
                      <th key={h} style={{ ...S.label, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 50).map((c) => (
                    <tr key={c.ares_cliente_id} style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                      <td style={{ padding: "10px 10px" }}>
                        {c.phone ? (
                          <Link href={`/dashboard/leads/${encodeURIComponent(c.phone)}`} style={{ color: "#c8d8e8", fontSize: 12, textDecoration: "none", fontWeight: 600 }}>
                            {c.restaurant_name || `...${c.phone.slice(-4)}`}
                          </Link>
                        ) : (
                          <span style={{ color: "#83879a", fontSize: 11.5 }}>sem lead SDR</span>
                        )}
                      </td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{c.origem_canal ?? "—"}</td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{c.routing_team ? vendorLabel(c.routing_team) : "—"}</td>
                      <td style={{ ...S.value, fontSize: 11, padding: "10px 10px" }}>{c.first_order_at}</td>
                      <td style={{ ...S.value, fontSize: 11, padding: "10px 10px" }}>{c.data_fechamento}</td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: c.janela_concluida ? "rgba(34,197,94,.15)" : "rgba(139,180,255,.15)", color: c.janela_concluida ? "#22c55e" : "#8bb4ff" }}>
                          {c.janela_concluida ? "concluída" : "em observação"}
                        </span>
                      </td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>{c.pedidos_na_janela}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px", color: "#22c55e" }}>{fmtBRL(c.faturamento_na_janela_brl)}</td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{fmtBRL(c.ticket_medio_na_janela_brl)}</td>
                      <td style={{ ...S.value, fontSize: 11, padding: "10px 10px" }}>{c.ultimo_pedido_na_janela}</td>
                      <td style={{ padding: "10px 10px" }}>
                        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: `${FAIXA_COR[c.faixa_inatividade_na_janela] ?? "#83879a"}22`, color: FAIXA_COR[c.faixa_inatividade_na_janela] ?? "#83879a" }}>
                          {c.faixa_inatividade_na_janela}
                        </span>
                      </td>
                      <td style={{ padding: "10px 10px", fontSize: 12 }}>{c.recuperado ? "↩" : "—"}</td>
                    </tr>
                  ))}
                  {lista.length === 0 && (
                    <tr><td colSpan={12} style={{ ...S.muted, padding: 20, textAlign: "center" }}>Nenhum cliente encontrado com esses filtros.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {lista.length > 50 && (
              <p style={{ ...S.muted, fontSize: 10, marginTop: 8 }}>Mostrando os 50 mais recentes de {lista.length} clientes (limite de leitura de 1000 na RPC) — refine os filtros.</p>
            )}
          </div>

          <p style={{ ...S.muted, fontSize: 10, textAlign: "center" }}>
            {fmtDateTimeCompactBRT(new Date().toISOString())} · dados atualizados no carregamento da página
          </p>
        </>
      )}
    </div>
  );
}
