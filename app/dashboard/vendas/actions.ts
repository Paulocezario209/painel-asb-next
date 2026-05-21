"use server";

import { createClient } from "@/lib/supabase/server";

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
};

export async function getDayPedidos(
  dia: string,
  team: string | null,
): Promise<DayPedido[]> {
  const supabase = await createClient();

  let q = supabase
    .from("pedidos_espelho")
    .select(
      "ares_pedido_id, n_pedido, cliente_nome, ares_cliente_id, status_pedido, valor_total_brl, valor_faturado_brl, previsao_entrega, data_emissao, data_meta",
    )
    .eq("data_meta", dia)
    .or("is_excluded.is.null,is_excluded.eq.false")
    .order("n_pedido", { ascending: false });

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
  const supabase = await createClient();
  const alertas: Alerta[] = [];
  const hoje = new Date().toISOString().slice(0, 10);

  // A1 — Saldo negativo + dias restantes
  const { data: resumos } = await supabase
    .from("v_resumo_mes_vendedor")
    .select("vendedor_routing_team, saldo_brl, dias_uteis_decorridos, dias_uteis_mes, pct_atingido_mes");
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
        metadados: { restantes, pct: r.pct_atingido_mes },
      });
    }
  }

  // A2 — Pedidos atrasados (status pendente/aprovado, data_meta < hoje)
  const { data: atrasados } = await supabase
    .from("pedidos_espelho")
    .select("vendedor_routing_team, valor_total_brl")
    .in("status_pedido", ["pendente", "aprovado"])
    .lt("data_meta", hoje);
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

  // A3 — Top clientes dormentes (>14d sem comprar, top 5 por valor histórico)
  type DormenteRow = { cliente: string; vendedor: string; ultimo: string; dias: number; valor: number };
  const { data: dormentesRaw } = await supabase.rpc("get_top_dormentes_30d", {});
  if (!dormentesRaw) {
    // Fallback runtime via query: agregar pedidos_espelho
    const { data: pedidos60d } = await supabase
      .from("pedidos_espelho")
      .select("cliente_nome, vendedor_routing_team, data_meta, valor_total_brl, status_pedido")
      .gte("data_meta", new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10))
      .neq("status_pedido", "cancelado");
    const map: Record<string, DormenteRow> = {};
    for (const p of pedidos60d ?? []) {
      if (!p.cliente_nome) continue;
      const cur = map[p.cliente_nome] ?? {
        cliente: p.cliente_nome,
        vendedor: p.vendedor_routing_team ?? "—",
        ultimo: p.data_meta ?? "",
        dias: 0,
        valor: 0,
      };
      if ((p.data_meta ?? "") > cur.ultimo) cur.ultimo = p.data_meta ?? cur.ultimo;
      cur.valor += Number(p.valor_total_brl ?? 0);
      map[p.cliente_nome] = cur;
    }
    const limite = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const dormentes = Object.values(map)
      .filter((d) => d.ultimo < limite)
      .map((d) => ({ ...d, dias: Math.floor((Date.now() - new Date(d.ultimo + "T00:00:00").getTime()) / 86400000) }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
    if (dormentes.length > 0) {
      const top = dormentes[0];
      alertas.push({
        tipo: "dormente",
        severidade: top.valor > 20000 ? "vermelho" : top.valor > 5000 ? "laranja" : "amarelo",
        titulo: `${dormentes.length} cliente(s) dormente(s) — top: ${top.cliente.slice(0, 40)}`,
        descricao: `Há ${top.dias}d sem comprar · valor histórico R$ ${top.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · vendedor: ${vName(top.vendedor)}`,
        vendedor: top.vendedor,
        valor: top.valor,
        metadados: { dormentes },
      });
    }
  }

  // A4 — Tendência queda (hoje < 50% da média 7d e é dia de venda)
  const seteDiasAtras = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const { data: dias7d } = await supabase
    .from("painel_dia_vendedor")
    .select("vendedor_routing_team, dia, realizado_parcial_brl")
    .gte("dia", seteDiasAtras)
    .lte("dia", hoje);
  const mediaPorVendedor: Record<string, { soma: number; dias: number; hoje: number }> = {};
  for (const d of dias7d ?? []) {
    const t = d.vendedor_routing_team ?? "—";
    mediaPorVendedor[t] = mediaPorVendedor[t] ?? { soma: 0, dias: 0, hoje: 0 };
    const val = Number(d.realizado_parcial_brl ?? 0);
    if (val > 0) {
      mediaPorVendedor[t].soma += val;
      mediaPorVendedor[t].dias += 1;
    }
    if (d.dia === hoje) mediaPorVendedor[t].hoje = val;
  }
  for (const [team, agg] of Object.entries(mediaPorVendedor)) {
    if (agg.dias < 2) continue;
    const media = agg.soma / agg.dias;
    if (media > 1000 && agg.hoje > 0 && agg.hoje < media * 0.5) {
      const pctQueda = Math.round((1 - agg.hoje / media) * 100);
      alertas.push({
        tipo: "tendencia_queda",
        severidade: pctQueda >= 70 ? "vermelho" : "laranja",
        titulo: `${vName(team)} hoje ${pctQueda}% abaixo da média`,
        descricao: `Hoje R$ ${agg.hoje.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · média 7d R$ ${media.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        vendedor: team,
        valor: agg.hoje - media,
      });
    }
  }

  // A5 — Meta do dia (se HOJE é dia de meta e pct < 50%)
  const { data: calHoje } = await supabase
    .from("v_calendario_metas")
    .select("vendedor_routing_team, meta_diaria_brl, realizado_brl, pct_atingido_dia, is_dia_meta")
    .eq("dia", hoje)
    .eq("is_dia_meta", true);
  for (const c of calHoje ?? []) {
    const pct = Number(c.pct_atingido_dia ?? 0);
    const meta = Number(c.meta_diaria_brl ?? 0);
    const real = Number(c.realizado_brl ?? 0);
    if (meta > 0 && pct < 50 && pct > 0) {
      alertas.push({
        tipo: "meta_dia",
        severidade: pct < 30 ? "vermelho" : "laranja",
        titulo: `Meta hoje em risco — ${vName(c.vendedor_routing_team)}`,
        descricao: `${pct.toFixed(1)}% da meta diária · faltam R$ ${(meta - real).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        vendedor: c.vendedor_routing_team,
        valor: real - meta,
      });
    }
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

export async function getRankingVendedores(): Promise<RankingItem[]> {
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
