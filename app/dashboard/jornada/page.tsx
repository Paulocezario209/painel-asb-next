// app/dashboard/jornada/page.tsx — DRILL da "Jornada do Cliente até a Recorrência".
// Abre a lista detalhada de um estágio (1º/2º/3º/4º/recorrente) numa visão (viva|geral),
// com o histórico pedido-a-pedido de cada cliente. Gestor-only (mesma porta do /funil).
//
// Fontes (read-only, ZERO migration):
//   • v_carteira_360      → agregados por cliente (classificação + métricas)
//   • pedidos_espelho     → linhas de pedido faturado (status 4/13), paginado (>1000)
// Classificação por total_orders (histórico completo). CNPJ não existe no espelho →
// identificador = ares_cliente_id. Churn/perdido NÃO são alterados (só lidos).

import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead } from "@/app/dashboard/lib/ui";
import { statusLabel, statusColor } from "@/lib/customer-status";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import {
  JORNADA_STAGES,
  bucketByOrders,
  isViva,
  filterByView,
  dedupeById,
  type JornadaView,
  type JornadaStageKey,
} from "@/lib/funnel/jornada";
import { ArrowLeft, Users } from "lucide-react";

export const dynamic = "force-dynamic";

const brl = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const brl2 = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDia = (d: string | null | undefined) => {
  if (!d) return "—";
  const p = String(d).slice(0, 10).split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(d);
};
const isView = (v: string | undefined): v is JornadaView => v === "viva" || v === "geral";
const isStage = (s: string | undefined): s is JornadaStageKey =>
  s === "p1" || s === "p2" || s === "p3" || s === "p4" || s === "recorrente";

interface CarteiraDrillRow {
  ares_pessoa_id: number;
  name: string | null;
  city: string | null;
  uf: string | null;
  vendedor_nome: string | null;
  total_orders: number | null;
  total_revenue_brl: number | null;
  avg_ticket_brl: number | null;
  first_order_at: string | null;
  last_order_at: string | null;
  dias_sem_compra: number | null;
  avg_order_interval_days: number | null;
  customer_status: string | null;
}
interface PedidoRow {
  ares_cliente_id: number;
  ares_pedido_id: number | null;
  data_faturamento: string | null;
  valor_faturado_brl: number | null;
}

export default async function JornadaDrillPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/funil")) redirect("/dashboard");

  const sp = await searchParams;
  const view: JornadaView = isView(sp.view) ? sp.view : "viva";
  const stage: JornadaStageKey = isStage(sp.stage) ? sp.stage : "p1";
  const stageMeta = JORNADA_STAGES.find((s) => s.key === stage)!;

  // Serviço (dado global gestor) — mesma justificativa do getFunilContagem do /funil.
  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: rawCarteira } = await sb
    .from("v_carteira_360")
    .select(
      "ares_pessoa_id, name, city, uf, vendedor_nome, total_orders, total_revenue_brl, avg_ticket_brl, first_order_at, last_order_at, dias_sem_compra, avg_order_interval_days, customer_status",
    );
  // Dedup por cliente (v_carteira_360 pode duplicar por fan-out do LEFT JOIN vendors).
  const carteira = dedupeById((rawCarteira ?? []) as CarteiraDrillRow[]);

  // Recorte da visão + estágio (classificação por total_orders, histórico completo).
  const scoped = filterByView(carteira, view).filter((c) => bucketByOrders(c.total_orders) === stage);
  scoped.sort((a, b) => (b.total_revenue_brl ?? 0) - (a.total_revenue_brl ?? 0));

  // Histórico pedido-a-pedido só dos clientes do recorte — paginado (beat 1000-row cap).
  const clienteIds = scoped.map((c) => c.ares_pessoa_id);
  const pedidos: PedidoRow[] = [];
  if (clienteIds.length > 0) {
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from("pedidos_espelho")
        .select("ares_cliente_id, ares_pedido_id, data_faturamento, valor_faturado_brl")
        .in("ares_id_status_pedido", [4, 13])
        .eq("is_deleted", false)
        .eq("is_excluded", false)
        .not("data_faturamento", "is", null)
        .in("ares_cliente_id", clienteIds)
        .order("ares_cliente_id", { ascending: true })
        .order("data_faturamento", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) break;
      const rows = (data ?? []) as PedidoRow[];
      pedidos.push(...rows);
      if (rows.length < PAGE) break;
    }
  }
  const pedidosPorCliente = new Map<number, PedidoRow[]>();
  for (const p of pedidos) {
    if (!pedidosPorCliente.has(p.ares_cliente_id)) pedidosPorCliente.set(p.ares_cliente_id, []);
    pedidosPorCliente.get(p.ares_cliente_id)!.push(p);
  }

  const totalReceita = scoped.reduce((a, c) => a + (c.total_revenue_brl ?? 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Link
        href="/dashboard/funil"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#c8d8e8", fontSize: 12, fontFamily: theme.font.label, textDecoration: "none" }}
      >
        <ArrowLeft size={14} /> Funil de Vendas
      </Link>

      <PageHead
        title={`Jornada · ${stageMeta.label}`}
        desc={`Base: ${view === "viva" ? "Carteira Viva (ativo/atenção)" : "Histórico Geral (toda a carteira faturada)"} · ${scoped.length} clientes · ${brl(totalReceita)} faturado · classificação por histórico completo de pedidos faturados`}
      />

      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead
          Icon={Users}
          color={stageMeta.fill}
          title={`${scoped.length} clientes em "${stageMeta.label}"`}
          desc="Identificador = ID ARES do cliente (CNPJ/CPF não disponível no espelho de pedidos)"
        />

        {scoped.length === 0 ? (
          <p style={S.muted}>Nenhum cliente neste estágio para a visão selecionada.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {scoped.map((c) => {
              const peds = pedidosPorCliente.get(c.ares_pessoa_id) ?? [];
              const acumulado = peds.reduce((a, p) => a + (p.valor_faturado_brl ?? 0), 0);
              const vivo = isViva(c.customer_status);
              return (
                <div key={c.ares_pessoa_id} style={{ background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)", borderRadius: 8, padding: "14px 16px" }}>
                  {/* Cabeçalho do cliente */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: theme.font.label }}>
                        {c.name || `cliente ${c.ares_pessoa_id}`}
                      </div>
                      <div style={{ color: "#aeb7cc", fontSize: 11, fontFamily: theme.font.label, marginTop: 2 }}>
                        {[`ID ARES ${c.ares_pessoa_id}`, [c.city, c.uf].filter(Boolean).join("/"), c.vendedor_nome ?? "sem vendedor"].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {/* pertence à carteira viva */}
                      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", padding: "2px 7px", borderRadius: 999, background: vivo ? "rgba(34,197,94,.14)" : "rgba(255,255,255,.06)", color: vivo ? "#22c55e" : "#83879a", fontFamily: theme.font.label }}>
                        {vivo ? "Carteira viva" : "Fora da viva"}
                      </span>
                      {/* situação atual (status oficial) */}
                      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", padding: "2px 7px", borderRadius: 999, background: statusColor(c.customer_status), color: "#fff", fontFamily: theme.font.label }}>
                        {statusLabel(c.customer_status)}
                      </span>
                      {/* indicador de churn/perdido — só no Histórico Geral */}
                      {view === "geral" && !vivo && c.customer_status && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", padding: "2px 7px", borderRadius: 999, background: c.customer_status === "inativo_definitivo" ? "rgba(107,114,128,.2)" : "rgba(200,16,46,.16)", color: c.customer_status === "inativo_definitivo" ? "#9ca3af" : "#ff5a72", fontFamily: theme.font.label }}>
                          {c.customer_status === "inativo_definitivo" ? "Perdido" : "Churn"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Resumo do cliente */}
                  <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 10, fontSize: 11, fontFamily: theme.font.label, color: "#c8d2e6" }}>
                    <span><b style={{ fontFamily: theme.font.num }}>{c.total_orders ?? 0}</b> pedidos</span>
                    <span>Acumulado <b style={{ fontFamily: theme.font.num }}>{brl(c.total_revenue_brl)}</b></span>
                    <span>Ticket médio <b style={{ fontFamily: theme.font.num }}>{brl(c.avg_ticket_brl)}</b></span>
                    <span>Intervalo médio <b style={{ fontFamily: theme.font.num }}>{c.avg_order_interval_days != null ? `${Number(c.avg_order_interval_days).toFixed(0)}d` : "—"}</b></span>
                    <span>Último pedido <b style={{ fontFamily: theme.font.num }}>{fmtDia(c.last_order_at)}</b> ({c.dias_sem_compra ?? "—"}d atrás)</span>
                  </div>

                  {/* Sequência pedido-a-pedido */}
                  {peds.length > 0 && (
                    <div style={{ marginTop: 12, overflowX: "auto" }}>
                      <div style={{ display: "flex", gap: 8, minWidth: "min-content" }}>
                        {peds.map((p, i) => {
                          const prev = i > 0 ? peds[i - 1] : null;
                          const gap = prev && p.data_faturamento && prev.data_faturamento
                            ? Math.round((new Date(p.data_faturamento).getTime() - new Date(prev.data_faturamento).getTime()) / 86400000)
                            : null;
                          return (
                            <div key={p.ares_pedido_id ?? i} style={{ background: "var(--asb-card)", border: "1px solid var(--asb-border)", borderRadius: 6, padding: "8px 10px", minWidth: 128 }}>
                              <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", color: stageMeta.fill, fontFamily: theme.font.label }}>Pedido {i + 1}</div>
                              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", marginTop: 3 }}>{brl2(p.valor_faturado_brl)}</div>
                              <div style={{ fontSize: 10, color: "#aeb7cc", fontFamily: theme.font.num, marginTop: 2 }}>{fmtDia(p.data_faturamento)}</div>
                              {gap != null && <div style={{ fontSize: 9.5, color: "#83879a", fontFamily: theme.font.label, marginTop: 2 }}>+{gap}d</div>}
                            </div>
                          );
                        })}
                      </div>
                      {Math.abs(acumulado - (c.total_revenue_brl ?? 0)) > 1 && (
                        <p style={{ fontSize: 9.5, color: "#D4A017", fontFamily: theme.font.label, marginTop: 6 }}>
                          ⚠ soma dos pedidos listados ({brl(acumulado)}) diverge do acumulado da carteira ({brl(c.total_revenue_brl)}).
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
