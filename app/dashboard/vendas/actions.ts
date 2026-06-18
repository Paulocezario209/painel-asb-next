"use server";

import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";
import type { PedidoAtrasadoRow, ClienteDormenteRow } from "./alert-drawer";

export type DayPedido = {
  ares_pedido_id: number | null;
  n_pedido: string | null;
  cliente_nome: string | null;
  ares_cliente_id: number | null;
  status_pedido: string | null;
  valor_total_brl: number | null;
  valor_faturado_brl: number | null;
  previsao_entrega: string | null;
  data_emissao: string | null;
  data_meta: string | null;
  data_faturamento: string | null;
};

export async function getDayPedidos(
  dia: string,
  team: string | null,
): Promise<DayPedido[]> {
  noStore();
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  let q = supabase
    .from("pedidos_espelho")
    .select(
      "ares_pedido_id, n_pedido, cliente_nome, ares_cliente_id, status_pedido, valor_total_brl, valor_faturado_brl, previsao_entrega, data_emissao, data_meta, data_faturamento",
    )
    .or("is_excluded.is.null,is_excluded.eq.false")
    .order("n_pedido", { ascending: false });

  // DEBT-133: a célula do calendário soma por DATA_FATURAMENTO (eixo §5, FASE C) —
  // o drill-down precisa do MESMO eixo, senão o modal mostra conjunto ≠ número exibido.
  if (dia > hoje) {
    // dia futuro: agendados por previsão de entrega (badge AGENDADO no modal)
    q = q.eq("previsao_entrega", dia).neq("status_pedido", "cancelado");
  } else {
    // eixo faturamento + fallback p/ ~3-4% com data_faturamento NULL (DEBT-105;
    // conjuntos disjuntos — sem dupla contagem)
    q = q.or(`data_faturamento.eq.${dia},and(data_faturamento.is.null,data_meta.eq.${dia})`);
  }

  if (team && team !== "all") {
    q = q.eq("vendedor_routing_team", team);
  }

  const { data, error } = await q;
  if (error) {
    console.error("[getDayPedidos] error:", error);
    return [];
  }
  return (data ?? []) as DayPedido[];
}

// ════════════════════════════════════════════════════════════════════
// ALERTAS COMERCIAIS — 5 alertas em runtime sobre views existentes
// ════════════════════════════════════════════════════════════════════

export type Alerta = {
  tipo: "saldo_negativo" | "atrasados" | "dormente" | "tendencia_queda" | "meta_dia";
  severidade: "vermelho" | "laranja" | "amarelo" | "verde";
  titulo: string;
  descricao: string;
  vendedor?: string | null;
  valor?: number | null;
  href?: string | null; // Fase 1: drill-down. A1/A4/A5 → tela de vendedores.
  metadados?: Record<string, unknown>;
};

export type AlertasResponse = {
  total: number;
  alertas: Alerta[];
  contadores: { vermelho: number; laranja: number; amarelo: number };
};

const VENDOR_NAMES: Record<string, string> = {
  SETOR_CUIT: "Paulo Cezario",
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula",
  SETOR_CAMPINAS_JUNDIAI: "Alan",
};

function vName(team: string | null | undefined): string {
  if (!team) return "—";
  return VENDOR_NAMES[team] ?? team;
}

export async function getAlertasComerciais(): Promise<AlertasResponse> {
  noStore();
  const supabase = await createClient();
  const alertas: Alerta[] = [];
  const hoje = new Date().toISOString().slice(0, 10);

  // A1 — Saldo negativo + dias restantes
  const { data: resumos } = await supabase
    .from("v_resumo_mes_vendedor")
    .select("vendedor_routing_team, saldo_brl, dias_uteis_decorridos, dias_uteis_mes, pct_atingido_mes, proxima_data_meta, meta_proxima_data_brl, meta_diaria_brl");
  for (const r of resumos ?? []) {
    const saldo = Number(r.saldo_brl ?? 0);
    const restantes = Number(r.dias_uteis_mes ?? 0) - Number(r.dias_uteis_decorridos ?? 0);
    if (saldo < 0) {
      const precisaPorDia = restantes > 0 ? Math.abs(saldo) / restantes : 0;
      const sev = saldo < -10000 ? "vermelho" : "laranja";
      alertas.push({
        tipo: "saldo_negativo",
        severidade: sev,
        titulo: `${vName(r.vendedor_routing_team)} abaixo da meta`,
        descricao: `Saldo R$ ${Math.abs(saldo).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · ${restantes} dia(s) útil(eis) restantes · precisa R$ ${precisaPorDia.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/dia`,
        vendedor: r.vendedor_routing_team,
        valor: saldo,
        href: "/dashboard/vendedores",
        metadados: { restantes, pct: r.pct_atingido_mes },
      });
    }
  }

  // A2 — Pedidos atrasados (status pendente/aprovado, data_meta < hoje).
  // Filtro alinhado ao drawer (DEBT-083): exclui AMERICAN STEAK interna (1,4,808) e
  // rascunhos R$0 → cards "DESCONHECIDO" e R$0 deixam de renderizar (qty=0).
  const { data: atrasados } = await supabase
    .from("pedidos_espelho")
    .select("vendedor_routing_team, valor_total_brl")
    .in("status_pedido", ["pendente", "aprovado"])
    .lt("data_meta", hoje)
    .eq("is_deleted", false)
    .not("ares_cliente_id", "in", "(1,4,808)")
    .gt("valor_total_brl", 0);
  const atrasadosPorVendedor: Record<string, { qty: number; valor: number }> = {};
  for (const p of atrasados ?? []) {
    const t = p.vendedor_routing_team ?? "DESCONHECIDO";
    atrasadosPorVendedor[t] = atrasadosPorVendedor[t] ?? { qty: 0, valor: 0 };
    atrasadosPorVendedor[t].qty += 1;
    atrasadosPorVendedor[t].valor += Number(p.valor_total_brl ?? 0);
  }
  for (const [team, { qty, valor }] of Object.entries(atrasadosPorVendedor)) {
    if (qty === 0) continue;
    alertas.push({
      tipo: "atrasados",
      severidade: qty >= 5 ? "vermelho" : "laranja",
      titulo: `${qty} pedido(s) atrasado(s) — ${vName(team)}`,
      descricao: `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} preso(s). Pendente/aprovado com previsão de entrega já vencida.`,
      vendedor: team,
      valor,
      metadados: { qty },
    });
  }

  // A3 — Top clientes dormentes via v_clientes_dormentes (churn por frequência, asb-crm §8).
  // Fonte: VIEW Postgres (agrega no banco) — elimina o truncamento PostgREST 1000 linhas (DEBT-P2).
  const { data: dormentes } = await supabase
    .from("v_clientes_dormentes")
    .select("ares_cliente_id, cliente_nome, vendedor_routing_team, days_since_last, receita_total, churn_state")
    .in("churn_state", ["churn_warning", "churn_at_risk", "churn"])
    .order("receita_total", { ascending: false })
    .limit(5);
  if (dormentes && dormentes.length > 0) {
    const top = dormentes[0];
    const valorTop = Number(top.receita_total ?? 0);
    alertas.push({
      tipo: "dormente",
      severidade: valorTop > 20000 ? "vermelho" : valorTop > 5000 ? "laranja" : "amarelo",
      titulo: `${dormentes.length} cliente(s) dormente(s) — top: ${String(top.cliente_nome ?? "").slice(0, 40)}`,
      descricao: `Há ${top.days_since_last}d sem comprar · receita histórica R$ ${valorTop.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · vendedor: ${vName(top.vendedor_routing_team)}`,
      vendedor: top.vendedor_routing_team,
      valor: valorTop,
      metadados: { dormentes },
    });
  }

  // A4 — Tendência queda APENAS em DIA DE META do vendedor (vs média dos últimos
  // dias de meta dele — não calendário corrido). Evita falso alarme em dia atípico.
  const { data: calHoje30d } = await supabase
    .from("v_calendario_metas")
    .select("vendedor_routing_team, dia, is_dia_meta, realizado_brl")
    .gte("dia", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
    .lte("dia", hoje)
    .eq("is_dia_meta", true);

  const diasMetaPorVendedor: Record<string, { historico: number[]; hoje: number }> = {};
  for (const d of calHoje30d ?? []) {
    const t = d.vendedor_routing_team ?? "—";
    diasMetaPorVendedor[t] = diasMetaPorVendedor[t] ?? { historico: [], hoje: 0 };
    const val = Number(d.realizado_brl ?? 0);
    if (d.dia === hoje) {
      diasMetaPorVendedor[t].hoje = val;
    } else if (val > 0) {
      diasMetaPorVendedor[t].historico.push(val);
    }
  }
  for (const [team, agg] of Object.entries(diasMetaPorVendedor)) {
    // Só alerta se HOJE é dia padrão de meta do vendedor (hoje > 0 OR é dia útil que ainda vai render)
    // E historico tem ao menos 2 dias pra comparar
    if (agg.historico.length < 2) continue;
    const media = agg.historico.reduce((s, v) => s + v, 0) / agg.historico.length;
    // Alerta se hoje DELE > 0 (já começou) E ainda muito abaixo da média
    if (media > 1000 && agg.hoje > 0 && agg.hoje < media * 0.5) {
      const pctQueda = Math.round((1 - agg.hoje / media) * 100);
      alertas.push({
        tipo: "tendencia_queda",
        severidade: pctQueda >= 70 ? "vermelho" : "laranja",
        titulo: `${vName(team)} hoje ${pctQueda}% abaixo da média de dia-meta`,
        descricao: `Hoje R$ ${agg.hoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · média últimos ${agg.historico.length} dias de meta R$ ${media.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        vendedor: team,
        valor: agg.hoje - media,
        href: "/dashboard/vendedores",
      });
    }
  }

  // A5 — Meta do dia em risco — MESMA fonte/eixo do card consolidado (EMISSÃO DE CICLO).
  // pct E "faltam" derivam de realizadoCiclo (v_emissao_ciclo_vendedor.emissao_ciclo_brl) ÷
  // metaProxima (v_resumo.meta_proxima_data_brl). NÃO usa realizado_brl cru nem o FOLD de
  // faturamento (realizado_meta_brl) de v_calendario_metas — o alerta tem que bater com o card.
  // v_emissao_ciclo_vendedor é security_invoker → ler via SERVICE ROLE (igual page.tsx/getDayCnb),
  // senão o ciclo do setor do próprio gestor (CUIT) zera (DEBT-069c).
  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  const cicloClient = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : supabase;
  const { data: ciclo } = await cicloClient
    .from("v_emissao_ciclo_vendedor")
    .select("vendedor_routing_team, emissao_ciclo_brl");
  const cicloMap: Record<string, number> = {};
  for (const c of ciclo ?? []) cicloMap[c.vendedor_routing_team] = Number(c.emissao_ciclo_brl ?? 0);

  for (const r of resumos ?? []) {
    // só dispara se HOJE é o dia-meta do vendedor (mesma semântica do antigo is_dia_meta)
    if (r.proxima_data_meta !== hoje) continue;
    const meta = Number(r.meta_proxima_data_brl ?? r.meta_diaria_brl ?? 0);
    if (meta <= 0) continue;
    const real = cicloMap[r.vendedor_routing_team] ?? 0;
    const pct = (real / meta) * 100;
    if (pct >= 80) continue;                           // ≥80% (card verde/amarelo) → sem alerta
    const sev = pct < 50 ? "vermelho" : "laranja";     // <50 CRÍTICO · 50–80 AVISO
    alertas.push({
      tipo: "meta_dia",
      severidade: sev,
      titulo: `Meta hoje em risco — ${vName(r.vendedor_routing_team)}`,
      descricao: `${pct.toFixed(1)}% da meta diária · faltam R$ ${Math.max(0, meta - real).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      vendedor: r.vendedor_routing_team,
      valor: real - meta,
      href: "/dashboard/vendedores",
    });
  }

  const ordem = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3 };
  alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);

  return {
    total: alertas.length,
    alertas,
    contadores: {
      vermelho: alertas.filter((a) => a.severidade === "vermelho").length,
      laranja: alertas.filter((a) => a.severidade === "laranja").length,
      amarelo: alertas.filter((a) => a.severidade === "amarelo").length,
    },
  };
}

// ════════════════════════════════════════════════════════════════════
// RANKING DE VENDEDORES
// ════════════════════════════════════════════════════════════════════

export type RankingItem = {
  posicao: number;
  vendedor_routing_team: string;
  nome: string;
  pct_atingido_mes: number | null;
  realizado_mes: number;
  saldo: number;
  media_7d: number;
  realizado_hoje: number;
  delta_pct_vs_media: number | null; // hoje vs media 7d
  cor_card_mes: string;
};

// ════════════════════════════════════════════════════════════════════
// ESTRATÉGIAS E AÇÕES — 3 grupos de recomendações práticas
// ════════════════════════════════════════════════════════════════════

export type AcaoBaterMeta = {
  vendedor: string;
  nome: string;
  proxima_meta: string;
  realizado: number;
  meta: number; // meta REAL da data (vendedor_meta_diaria)
  gap: number;
  pct: number;
  status: "bater" | "abaixo" | "no_alvo";
  sugestao: string;
};

export type AcaoPendente = {
  vendedor: string;
  nome: string;
  qty: number;
  valor: number;
  mais_antigo_dias: number;
};

export type AcaoDormente = {
  cliente: string;
  vendedor: string;
  nome_vendedor: string;
  ultimo_pedido: string;
  dias_sem_comprar: number;
  valor_historico: number;
  prioridade: "alta" | "media" | "baixa";
};

export type EstrategiasResponse = {
  baterMeta: AcaoBaterMeta[];
  fecharPendentes: AcaoPendente[];
  reativarDormentes: AcaoDormente[];
};

export async function getEstrategiasComerciais(): Promise<EstrategiasResponse> {
  noStore();
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  // ── Bater meta do ciclo ────────────────────────────────────────────
  const { data: resumos } = await supabase
    .from("v_resumo_mes_vendedor")
    .select("vendedor_routing_team, proxima_data_meta, realizado_hoje_brl, meta_diaria_brl, saldo_brl");

  // Pegar meta diária da próxima data (peso aplicado) via v_calendario_metas
  const proximaDatas = [...new Set((resumos ?? []).map(r => r.proxima_data_meta).filter(Boolean))];
  const { data: calProx } = proximaDatas.length > 0
    ? await supabase
        .from("v_calendario_metas")
        .select("vendedor_routing_team, dia, meta_diaria_brl, realizado_brl")
        .in("dia", proximaDatas as string[])
    : { data: [] };

  const baterMeta: AcaoBaterMeta[] = (resumos ?? []).map(r => {
    const cal = (calProx ?? []).find(c =>
      c.vendedor_routing_team === r.vendedor_routing_team &&
      c.dia === r.proxima_data_meta
    );
    const metaDia = Number(cal?.meta_diaria_brl ?? 0);
    const realizadoDia = Number(cal?.realizado_brl ?? 0);
    const gap = metaDia - realizadoDia;
    const pct = metaDia > 0 ? Math.round((realizadoDia / metaDia) * 100) : 0;
    const status: AcaoBaterMeta["status"] =
      pct >= 100 ? "bater" : pct >= 80 ? "no_alvo" : "abaixo";
    const sugestao =
      pct >= 100
        ? "✓ Meta batida. Continue captando pra superar."
        : gap > 20000
        ? `Foco em clientes de alto ticket. Faltam R$ ${gap.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}.`
        : gap > 5000
        ? `Reative dormentes + reforce ticket. Faltam R$ ${gap.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}.`
        : `Praticamente lá. Faltam R$ ${gap.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}.`;
    return {
      vendedor: r.vendedor_routing_team as string,
      nome: vName(r.vendedor_routing_team as string),
      proxima_meta: r.proxima_data_meta as string,
      realizado: realizadoDia,
      meta: metaDia,
      gap,
      pct,
      status,
      sugestao,
    };
  });

  // ── Pedidos pendentes (escritório precisa fechar) ──────────────────
  const { data: pendentesRaw } = await supabase
    .from("pedidos_espelho")
    .select("vendedor_routing_team, valor_total_brl, data_emissao")
    .in("status_pedido", ["pendente", "aprovado"]);

  const pendMap: Record<string, { qty: number; valor: number; maisAntigo: string }> = {};
  for (const p of pendentesRaw ?? []) {
    const t = p.vendedor_routing_team ?? "DESCONHECIDO";
    pendMap[t] = pendMap[t] ?? { qty: 0, valor: 0, maisAntigo: "" };
    pendMap[t].qty += 1;
    pendMap[t].valor += Number(p.valor_total_brl ?? 0);
    if (!pendMap[t].maisAntigo || (p.data_emissao ?? "") < pendMap[t].maisAntigo) {
      pendMap[t].maisAntigo = p.data_emissao ?? pendMap[t].maisAntigo;
    }
  }
  const fecharPendentes: AcaoPendente[] = Object.entries(pendMap)
    .filter(([_, v]) => v.qty > 0)
    .map(([team, v]) => ({
      vendedor: team,
      nome: vName(team),
      qty: v.qty,
      valor: v.valor,
      mais_antigo_dias: v.maisAntigo
        ? Math.floor((Date.now() - new Date(v.maisAntigo + "T00:00:00").getTime()) / 86400000)
        : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  // ── Top dormentes via v_clientes_dormentes (churn por frequência, asb-crm §8) ──
  // VIEW Postgres (agrega no banco) — sem truncamento PostgREST 1000 linhas (DEBT-P2).
  const { data: dormentesView } = await supabase
    .from("v_clientes_dormentes")
    .select("cliente_nome, vendedor_routing_team, last_order_date, days_since_last, receita_total, churn_state")
    .in("churn_state", ["churn_warning", "churn_at_risk", "churn"])
    .order("receita_total", { ascending: false })
    .limit(8);
  const reativarDormentes: AcaoDormente[] = (dormentesView ?? []).map((d) => {
    const valor = Number(d.receita_total ?? 0);
    return {
      cliente: d.cliente_nome ?? "—",
      vendedor: d.vendedor_routing_team ?? "—",
      nome_vendedor: vName(d.vendedor_routing_team),
      ultimo_pedido: d.last_order_date ?? "",
      dias_sem_comprar: Number(d.days_since_last ?? 0),
      valor_historico: valor,
      prioridade: (valor > 10000 ? "alta" : valor > 2000 ? "media" : "baixa") as AcaoDormente["prioridade"],
    };
  });

  return { baterMeta, fecharPendentes, reativarDormentes };
}

export async function getRankingVendedores(): Promise<RankingItem[]> {
  noStore();
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const { data: resumos } = await supabase
    .from("v_resumo_mes_vendedor")
    .select("*")
    .order("pct_atingido_mes", { ascending: false, nullsFirst: false });

  const { data: dias7d } = await supabase
    .from("painel_dia_vendedor")
    .select("vendedor_routing_team, dia, realizado_parcial_brl")
    .gte("dia", seteDiasAtras)
    .lte("dia", hoje);

  const mediaMap: Record<string, { soma: number; dias: number; hoje: number }> = {};
  for (const d of dias7d ?? []) {
    const t = d.vendedor_routing_team ?? "—";
    mediaMap[t] = mediaMap[t] ?? { soma: 0, dias: 0, hoje: 0 };
    const val = Number(d.realizado_parcial_brl ?? 0);
    if (val > 0) {
      mediaMap[t].soma += val;
      mediaMap[t].dias += 1;
    }
    if (d.dia === hoje) mediaMap[t].hoje = val;
  }

  const ranking: RankingItem[] = (resumos ?? []).map((r, idx) => {
    const team = r.vendedor_routing_team as string;
    const media = mediaMap[team]?.dias ? mediaMap[team].soma / mediaMap[team].dias : 0;
    const hojeVal = mediaMap[team]?.hoje ?? 0;
    const delta = media > 0 && hojeVal > 0 ? ((hojeVal - media) / media) * 100 : null;
    return {
      posicao: idx + 1,
      vendedor_routing_team: team,
      nome: vName(team),
      pct_atingido_mes: r.pct_atingido_mes !== null ? Number(r.pct_atingido_mes) : null,
      realizado_mes: Number(r.realizado_mes_brl ?? 0),
      saldo: Number(r.saldo_brl ?? 0),
      media_7d: media,
      realizado_hoje: hojeVal,
      delta_pct_vs_media: delta,
      cor_card_mes: r.cor_card_mes ?? "cinza",
    };
  });

  return ranking;
}

// ════════════════════════════════════════════════════════════════════
// DRILL-DOWN DOS CARDS DE ALERTA (DEBT-083) — alimentam o AlertDrawer
// ════════════════════════════════════════════════════════════════════

// Pedidos atrasados de um vendedor (mesmo filtro do A2: exclui AMERICAN STEAK + rascunhos R$0).
export async function getPedidosAtrasadosPorVendedor(team: string): Promise<PedidoAtrasadoRow[]> {
  noStore();
  if (!team) return [];
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("pedidos_espelho")
    .select("n_pedido, cliente_nome, valor_total_brl, data_meta")
    .in("status_pedido", ["pendente", "aprovado"])
    .lt("data_meta", hoje)
    .eq("is_deleted", false)
    .eq("vendedor_routing_team", team)
    .not("ares_cliente_id", "in", "(1,4,808)")
    .gt("valor_total_brl", 0)
    .order("data_meta", { ascending: true });
  if (error) {
    console.error("[getPedidosAtrasadosPorVendedor]", error);
    return [];
  }
  const today = Date.now();
  return (data ?? []).map((p) => ({
    n_pedido: p.n_pedido,
    cliente_nome: p.cliente_nome,
    valor_total_brl: p.valor_total_brl,
    data_meta: p.data_meta,
    dias_atraso: p.data_meta
      ? Math.floor((today - new Date(p.data_meta + "T00:00:00").getTime()) / 86400000)
      : 0,
  }));
}

// Top dormentes (mesma query do card A3) — fonte v_clientes_dormentes (asb-crm §8).
export async function getClientesDormentes(limit = 5): Promise<ClienteDormenteRow[]> {
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_clientes_dormentes")
    .select("cliente_nome, last_order_date, days_since_last, avg_interval_days, vendedor_routing_team, churn_state")
    .in("churn_state", ["churn_warning", "churn_at_risk", "churn"])
    .order("receita_total", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[getClientesDormentes]", error);
    return [];
  }
  return (data ?? []) as ClienteDormenteRow[];
}

export async function getDayCnb(
  dia: string,
  team: string
): Promise<{ cliente_nome: string; valor_total_brl: number; numero: string; forma_pagamento: string | null }[]> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  let q = supabase
    .from("vendas_cnb")
    .select("cliente_nome, valor_total_brl, numero, forma_pagamento")
    .eq("data_venda", dia)
    .order("valor_total_brl", { ascending: false });
  if (team && team !== "all") q = q.eq("vendedor_routing_team", team);
  const { data, error } = await q;
  if (error) { console.error("getDayCnb", error); return []; }
  return data ?? [];
}

export async function getDayAusentes(
  dia: string,
  team: string
): Promise<{ cliente_nome: string; ultima_compra: string; dias_ausente: number }[]> {
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const dataRef = new Date(dia);
  const data45 = new Date(dataRef);
  data45.setDate(data45.getDate() - 45);
  const data45str = data45.toISOString().split("T")[0];

  let q = supabase
    .from("pedidos_espelho")
    .select("cliente_nome, data_faturamento")
    .gte("data_faturamento", data45str)
    .lt("data_faturamento", dia)
    .not("status_pedido", "eq", "cancelado")
    .eq("is_excluded", false)
    .order("data_faturamento", { ascending: false });
  if (team && team !== "all") q = q.eq("vendedor_routing_team", team);
  const { data, error } = await q;
  if (error) { console.error("getDayAusentes", error); return []; }

  // Clientes que compraram no dia clicado
  let qDia = supabase
    .from("pedidos_espelho")
    .select("cliente_nome")
    .or(`data_faturamento.eq.${dia},and(data_faturamento.is.null,data_meta.eq.${dia})`)
    .eq("is_excluded", false);
  if (team && team !== "all") qDia = qDia.eq("vendedor_routing_team", team);
  const { data: dataDia } = await qDia;
  const compraraDia = new Set((dataDia ?? []).map((r: { cliente_nome: string }) => r.cliente_nome));

  // Dedupe: último registro por cliente, excluindo quem comprou no dia
  const seen = new Map<string, string>();
  for (const r of data ?? []) {
    if (!compraraDia.has(r.cliente_nome) && !seen.has(r.cliente_nome)) {
      seen.set(r.cliente_nome, r.data_faturamento);
    }
  }
  return Array.from(seen.entries())
    .map(([cliente_nome, ultima_compra]) => ({
      cliente_nome,
      ultima_compra,
      dias_ausente: Math.floor((dataRef.getTime() - new Date(ultima_compra).getTime()) / 86400000),
    }))
    .sort((a, b) => a.dias_ausente - b.dias_ausente)
    .slice(0, 15);
}
