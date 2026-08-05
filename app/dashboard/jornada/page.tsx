// app/dashboard/jornada/page.tsx — DRILL de um estágio da Jornada (lista detalhada por cliente).
// Resumo por cliente (sortável); o pedido-a-pedido fica no Dossiê. Gestor-only (porta /funil).
// Fonte: getJornadaData (v_carteira_360 + pedidos_espelho, deduplicado, score V1).

import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead } from "@/app/dashboard/lib/ui";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { getJornadaData } from "@/lib/funnel/jornada-data";
import {
  bucketByOrders, isViva, filterByView, JORNADA_STAGES,
  cohortDoMes, dedupePedidos, isCompetenciaValida,
  type JornadaView, type JornadaStageKey,
} from "@/lib/funnel/jornada";
import { gaps, mean } from "@/lib/funnel/jornada-metrics";
import { JornadaDrillList, type DrillRow } from "@/components/dashboard/jornada-drill-list";
import { ArrowLeft, Users } from "lucide-react";

export const dynamic = "force-dynamic";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const isView = (v: string | undefined): v is JornadaView => v === "mes" || v === "geral" || v === "viva";
const isStage = (s: string | undefined): s is JornadaStageKey => ["p1", "p2", "p3", "p4", "recorrente"].includes(s ?? "");

export default async function JornadaDrillPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/funil")) redirect("/dashboard");

  const sp = await searchParams;
  const view: JornadaView = isView(sp.view) ? sp.view : "mes";
  const stage: JornadaStageKey = isStage(sp.stage) ? sp.stage : "p1";
  const stageMeta = JORNADA_STAGES.find((s) => s.key === stage)!;
  const mesSel = isCompetenciaValida(sp.mes) ? sp.mes : null;

  const { clientes } = await getJornadaData();

  // O drill precisa usar EXATAMENTE o mesmo recorte dos cards, senão a lista não bate com o número.
  // view="mes": coorte da competência (1º pedido no mês) + pedidos limitados ao mês.
  const deduped = clientes.map(dedupePedidos);
  const escopo =
    view === "mes" && mesSel
      ? cohortDoMes(deduped, mesSel).map((c) => ({
          ...c,
          total_orders: c.pedidos.length,
          total_revenue_brl: c.pedidos.reduce((a, p) => a + p.valor, 0),
          avg_ticket_brl: c.pedidos.length ? c.pedidos.reduce((a, p) => a + p.valor, 0) / c.pedidos.length : 0,
          last_order_at: c.pedidos.length ? c.pedidos[c.pedidos.length - 1].data : c.last_order_at,
        }))
      : filterByView(deduped, view);
  const scoped = escopo.filter((c) => bucketByOrders(c.total_orders) === stage);

  const rows: DrillRow[] = scoped.map((c) => ({
    ares_pessoa_id: c.ares_pessoa_id,
    name: c.name, city: c.city, uf: c.uf, vendedor_nome: c.vendedor_nome,
    customer_status: c.customer_status,
    total_orders: c.total_orders,
    total_revenue_brl: c.total_revenue_brl,
    avg_ticket_brl: c.avg_ticket_brl,
    last_order_at: c.last_order_at,
    dias_sem_compra: c.dias_sem_compra,
    avg_interval_dias: (() => { const g = gaps({ ares_pessoa_id: c.ares_pessoa_id, customer_status: c.customer_status, pedidos: c.pedidos }); return g.length ? mean(g) : null; })(),
    score: c.score.score,
    faixa: c.score.faixa,
    motivo: c.motivo,
    viva: isViva(c.customer_status),
  }));
  const totalReceita = rows.reduce((a, c) => a + c.total_revenue_brl, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Link href="/dashboard/funil" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#c8d8e8", fontSize: 12, fontFamily: theme.font.label, textDecoration: "none" }}>
        <ArrowLeft size={14} /> Funil de Vendas
      </Link>

      <PageHead
        title={`Jornada · ${stageMeta.label}`}
        desc={
          view === "mes"
            ? `Conversão do mês · competência ${mesSel ?? "—"} · ${rows.length} clientes · ${brl(totalReceita)} faturado no mês · só pedidos da competência`
            : `Histórico geral (toda a carteira faturada) · ${rows.length} clientes · ${brl(totalReceita)} faturado · classificação por histórico completo`
        }
      />

      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead
          Icon={Users}
          color={stageMeta.fill}
          title={`${rows.length} clientes em "${stageMeta.label}"`}
          desc="Clique num cliente para abrir o Dossiê (linha do tempo dos pedidos). Identificador = ID ARES (CNPJ/CPF não disponível no espelho)."
        />
        {rows.length === 0 ? (
          <p style={S.muted}>Nenhum cliente neste estágio para a visão selecionada.</p>
        ) : (
          <JornadaDrillList rows={rows} view={view} />
        )}
      </div>
    </div>
  );
}
