// lib/funnel/jornada-data.ts — carregador ÚNICO de dados da Jornada (server-side).
//
// Fonte oficial: v_carteira_360 (agregados/status) + pedidos_espelho (histórico pedido-a-pedido,
// paginado p/ furar o teto de 1000 linhas). Deduplica por ares_pessoa_id (fan-out do JOIN
// vendors na view). Calcula o score V1 e anexa o motivo SÓ quando confirmado (ai_sdr_leads
// .customer_exit_reason) — senão null → UI mostra "Motivo não identificado" (não inventa).
//
// Cálculo 100% em página (sem migration/DDL). Cacheado 5 min (dado global de gestor).

import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { dedupeById } from "./jornada";
import {
  computeScore, computeRankMedians, type ClienteHistorico, type ScoreResult,
} from "./jornada-metrics";

export interface JornadaPedido { data: string; valor: number; ares_pedido_id: number | null }
export interface JornadaClienteFull {
  ares_pessoa_id: number;
  name: string | null;
  city: string | null;
  uf: string | null;
  vendedor_nome: string | null;
  customer_status: string | null;
  lead_id: string | null;
  total_orders: number;
  total_revenue_brl: number;
  avg_ticket_brl: number;
  first_order_at: string | null;
  last_order_at: string | null;
  dias_sem_compra: number | null;
  pedidos: JornadaPedido[];
  score: ScoreResult;
  motivo: string | null; // confirmado (exit_reason) OU null (→ "Motivo não identificado")
}

interface CartRow {
  ares_pessoa_id: number; name: string | null; city: string | null; uf: string | null;
  vendedor_nome: string | null; customer_status: string | null; lead_id: string | null;
  total_orders: number | null; total_revenue_brl: number | null; avg_ticket_brl: number | null;
  first_order_at: string | null; last_order_at: string | null; dias_sem_compra: number | null;
}
interface PedRow { ares_cliente_id: number; ares_pedido_id: number | null; data_faturamento: string | null; valor_faturado_brl: number | null }

async function loadRaw(): Promise<{ clientes: JornadaClienteFull[]; hoje: string }> {
  const sb = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const hoje = new Date().toISOString().slice(0, 10);

  const { data: rawCart } = await sb.from("v_carteira_360").select(
    "ares_pessoa_id, name, city, uf, vendedor_nome, customer_status, lead_id, total_orders, total_revenue_brl, avg_ticket_brl, first_order_at, last_order_at, dias_sem_compra",
  );
  const carteira = dedupeById((rawCart ?? []) as CartRow[]);
  const ids = carteira.map((c) => c.ares_pessoa_id);
  if (ids.length === 0) return { clientes: [], hoje };

  // Pedidos faturados de toda a carteira, paginado (beat 1000-row cap), asc por cliente+data.
  const porCliente = new Map<number, JornadaPedido[]>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from("pedidos_espelho")
      .select("ares_cliente_id, ares_pedido_id, data_faturamento, valor_faturado_brl")
      .in("ares_id_status_pedido", [4, 13])
      .eq("is_deleted", false)
      .eq("is_excluded", false)
      .not("data_faturamento", "is", null)
      .in("ares_cliente_id", ids)
      .order("ares_cliente_id", { ascending: true })
      .order("data_faturamento", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) break;
    const rows = (data ?? []) as PedRow[];
    for (const p of rows) {
      if (!porCliente.has(p.ares_cliente_id)) porCliente.set(p.ares_cliente_id, []);
      porCliente.get(p.ares_cliente_id)!.push({
        data: String(p.data_faturamento).slice(0, 10),
        valor: Number(p.valor_faturado_brl ?? 0),
        ares_pedido_id: p.ares_pedido_id,
      });
    }
    if (rows.length < PAGE) break;
  }

  // Motivo CONFIRMADO: exit_reason dos leads vinculados (dado humano). Ausente → null.
  const leadIds = carteira.map((c) => c.lead_id).filter(Boolean) as string[];
  const exitByLead = new Map<string, string>();
  if (leadIds.length > 0) {
    const { data: leads } = await sb.from("ai_sdr_leads").select("id, customer_exit_reason").in("id", leadIds);
    for (const l of (leads ?? []) as { id: string; customer_exit_reason: string | null }[]) {
      if (l.customer_exit_reason) exitByLead.set(l.id, l.customer_exit_reason);
    }
  }

  // Referência do score (mediana de gap por rank, população acumulada).
  const historicos: ClienteHistorico[] = carteira.map((c) => ({
    ares_pessoa_id: c.ares_pessoa_id,
    customer_status: c.customer_status,
    pedidos: porCliente.get(c.ares_pessoa_id) ?? [],
  }));
  const rankMedians = computeRankMedians(historicos);

  const clientes: JornadaClienteFull[] = carteira.map((c) => {
    const pedidos = porCliente.get(c.ares_pessoa_id) ?? [];
    const hist: ClienteHistorico = { ares_pessoa_id: c.ares_pessoa_id, customer_status: c.customer_status, pedidos };
    return {
      ares_pessoa_id: c.ares_pessoa_id,
      name: c.name, city: c.city, uf: c.uf, vendedor_nome: c.vendedor_nome,
      customer_status: c.customer_status, lead_id: c.lead_id,
      total_orders: c.total_orders ?? pedidos.length,
      total_revenue_brl: Number(c.total_revenue_brl ?? 0),
      avg_ticket_brl: Number(c.avg_ticket_brl ?? 0),
      first_order_at: c.first_order_at, last_order_at: c.last_order_at, dias_sem_compra: c.dias_sem_compra,
      pedidos,
      score: computeScore(hist, hoje, rankMedians),
      motivo: c.lead_id ? exitByLead.get(c.lead_id) ?? null : null,
    };
  });
  return { clientes, hoje };
}

// Cache global (dado de gestor, não depende do usuário) — 5 min, como o getFunilContagem.
export const getJornadaData = unstable_cache(loadRaw, ["jornada-data-v2"], {
  revalidate: 300,
  tags: ["jornada-data-v2"],
});
