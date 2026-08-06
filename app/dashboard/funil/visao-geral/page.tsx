// app/dashboard/funil/visao-geral/page.tsx — CRI F9 (tela 1/8 desta rodada): Visão Geral.
// Resumo executivo do período: leads, qualificação, abandono, conversão, recompra,
// faturamento, custo (mídia/operacional/total), CAC, taxas e distribuição por origem.
// Motor de Período via URL. "Evolução vs período anterior" = mesma RPC chamada 2x.
import { createClient } from "@/lib/supabase/server";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard, StatTile } from "@/app/dashboard/lib/ui";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { Users, CheckCircle2, XCircle, ShoppingCart, Repeat, DollarSign, Percent, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

interface VisaoGeral {
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

function fmtBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function trendChip(atual: number, anterior: number): { chip: string; up: boolean | null } {
  if (anterior === 0) return { chip: atual > 0 ? "novo no período" : "sem dado", up: null };
  const delta = ((atual - anterior) / anterior) * 100;
  return { chip: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs período anterior`, up: delta >= 0 };
}

const SELO_COR: Record<string, string> = {
  confirmado: "#22c55e",
  parcial: "#D4A017",
  estimado: "#8bb4ff",
  nao_informado: "#C8102E",
};

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

export default async function VisaoGeralPage({
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
  const [{ data: vgRaw, error: vgErr }, { data: vgAntRaw }, { data: origemRaw, error: origemErr }] = await Promise.all([
    supabase.rpc("fn_cri_visao_geral", { p_data_inicio: inicio, p_data_fim: fim }),
    supabase.rpc("fn_cri_visao_geral", { p_data_inicio: inicioAnt, p_data_fim: fimAnt }),
    supabase.rpc("fn_cri_distribuicao_origem", { p_data_inicio: inicio, p_data_fim: fim }),
  ]);

  const vg = (vgRaw as VisaoGeral[] | null)?.[0];
  const vgAnt = (vgAntRaw as VisaoGeral[] | null)?.[0];
  const origens = ((origemRaw ?? []) as OrigemRow[]).sort((a, b) => b.leads - a.leads);
  const error = vgErr ?? origemErr;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Visão Geral do CRI"
        desc={`Resumo executivo · período ${inicio} a ${fim} · comparado a ${inicioAnt} a ${fimAnt} (mesma duração)`}
      />

      <form method="get" style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ ...S.label }}>Período</span>
        <input type="date" name="inicio" defaultValue={inicio} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12 }} />
        <span style={{ color: "#83879a" }}>até</span>
        <input type="date" name="fim" defaultValue={fim} style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "6px 10px", color: "#c8d8e8", fontSize: 12 }} />
        <button type="submit" style={{ background: "#185FA5", border: "none", borderRadius: 5, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer" }}>
          Aplicar
        </button>
        {vg && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <span style={{ ...S.label }}>Selo geral</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${SELO_COR[vg.selo_geral]}22`, color: SELO_COR[vg.selo_geral] }}>
              {vg.selo_geral}
            </span>
          </span>
        )}
      </form>

      {error || !vg ? (
        <div style={{ ...S.card, padding: 20, borderTop: "2px solid #C8102E" }}>
          <p style={{ color: "#C8102E" }}>Erro ao carregar dados: {error?.message ?? "sem retorno da RPC"}</p>
        </div>
      ) : (
        <>
          <div className="asb-grid-kpi">
            <KpiCard
              label="Leads Recebidos"
              value={String(vg.leads_recebidos)}
              Icon={Users}
              accent="#185FA5"
              num="#FFFFFF"
              {...(vgAnt ? { chip: trendChip(vg.leads_recebidos, vgAnt.leads_recebidos).chip, chipUp: trendChip(vg.leads_recebidos, vgAnt.leads_recebidos).up } : {})}
            />
            <KpiCard
              label="Leads Qualificados"
              value={String(vg.leads_qualificados)}
              Icon={CheckCircle2}
              accent="#22c55e"
              num="#22c55e"
              note={`qual_stage ≥ 7 · ${vg.leads_recebidos > 0 ? fmtPct(vg.leads_qualificados / vg.leads_recebidos) : "—"} dos recebidos`}
            />
            <KpiCard label="Abandonos no Período" value={String(vg.abandonos)} Icon={XCircle} accent="#C8102E" num="#C8102E" note="entraram em Abandono/Saída" />
            <KpiCard
              label="1os Pedidos"
              value={String(vg.primeiros_pedidos)}
              Icon={ShoppingCart}
              accent="#D4A017"
              num="#D4A017"
              note={`${vg.leads_recebidos} recebidos → ${vg.primeiros_pedidos} converteram (${fmtPct(vg.taxa_conversao)})`}
            />
          </div>

          <div className="asb-grid-kpi">
            <KpiCard
              label="Clientes com Recompra"
              value={String(vg.clientes_com_recompra)}
              Icon={Repeat}
              accent="#8bb4ff"
              num="#8bb4ff"
              note={`${vg.clientes_com_recompra} de ${vg.clientes_com_pedido} clientes com pedido (${fmtPct(vg.taxa_recorrencia)})`}
            />
            <KpiCard
              label="Faturamento Atribuído"
              value={fmtBRL(vg.faturamento_atribuido_brl)}
              Icon={DollarSign}
              accent="#22c55e"
              num="#22c55e"
              {...(vgAnt ? { chip: trendChip(vg.faturamento_atribuido_brl, vgAnt.faturamento_atribuido_brl).chip, chipUp: trendChip(vg.faturamento_atribuido_brl, vgAnt.faturamento_atribuido_brl).up } : {})}
            />
            <KpiCard
              label="Custo Total Conhecido"
              value={fmtBRL(vg.custo_total_brl)}
              Icon={DollarSign}
              accent="#D4A017"
              num="#D4A017"
              note={`mídia ${fmtBRL(vg.custo_midia_brl)} + operacional ${fmtBRL(vg.custo_operacional_brl)}`}
            />
            <KpiCard
              label="CAC (parcial)"
              value={vg.cac_brl != null ? fmtBRL(vg.cac_brl) : "—"}
              Icon={Percent}
              accent="#8bb4ff"
              num="#8bb4ff"
              note={`${fmtBRL(vg.custo_total_brl)} ÷ ${vg.primeiros_pedidos} 1os pedidos`}
            />
          </div>

          <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(212,160,23,.06)", border: "1px solid rgba(212,160,23,.3)" }}>
            <span style={{ fontSize: 11.5, color: "#D4A017", fontWeight: 700 }}>ℹ</span>
            <p style={{ ...S.muted, fontSize: 11.5, lineHeight: 1.5 }}>
              Custo operacional ainda não tem fonte alimentada (cri_custo_operacional vazia) — CAC e Custo Total refletem só mídia até isso ser
              preenchido. Taxa de Conversão mede leads recebidos vs. 1º pedido <b>dentro do mesmo período</b> — um lead recebido no fim da janela
              pode não ter tido tempo de converter ainda; é limite de qualquer taxa por período civil, não erro de cálculo.
            </p>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={Megaphone} color="#185FA5" title="Distribuição por Origem" desc="leads recebidos no período, por origem_canal (SDR — único escritor)" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {origens.map((o) => (
                <StatTile
                  key={o.origem_canal}
                  label={o.origem_canal}
                  value={String(o.leads)}
                  accent="#185FA5"
                  sub={`${o.primeiros_pedidos} 1º pedido · ${fmtBRL(o.faturamento_brl)}`}
                />
              ))}
              {origens.length === 0 && <p style={{ ...S.muted }}>Nenhum lead recebido neste período.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
