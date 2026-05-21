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
