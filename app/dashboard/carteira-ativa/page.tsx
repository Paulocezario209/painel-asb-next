import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";
import { RecompraLista, type RecompraRow } from "./recompra-lista";
import { SaudeCarteira, type SaudeVendedor } from "./saude-carteira";
import { CarteiraKpisRow } from "./carteira-kpis";
import { RecompraMetaSection, TopProdutosSection, GruposSection, type MetaRow, type TopRow, type GrupoRow } from "./carteira-analytics";

export const dynamic = "force-dynamic";

export default async function CarteiraAtivaPage() {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx) redirect("/dashboard");

  // ACESSO (padrão idêntico a /dashboard/vendas): gestor/manager veem os 3 vendedores;
  // vendedor restrito (≠ CUIT) só a própria carteira, filtrando por routing_team em TODAS as queries.
  const isVendedorRestrito = ctx.isVendedor && !!ctx.routing_team && ctx.routing_team !== "SETOR_CUIT";

  let recompraQ = supabase.from("v_recompra_com_sugestao").select("*");
  let carteiraQ = supabase.from("v_carteira_360").select("customer_status, vendedor_nome, routing_team");
  let metaQ = supabase.from("v_recompra_meta_dia").select("*");
  let topQ = supabase.from("v_produtos_top").select("*");
  let gruposQ = supabase.from("v_recompra_grupos").select("*");
  if (isVendedorRestrito) {
    const rt = ctx.routing_team!;
    recompraQ = recompraQ.eq("routing_team", rt);
    carteiraQ = carteiraQ.eq("routing_team", rt);
    metaQ = metaQ.eq("routing_team", rt);
    topQ = topQ.eq("routing_team", rt);
    gruposQ = gruposQ.eq("routing_team", rt);
  }
  const [{ data: rows }, { data: cart }, { data: metaD }, { data: topD }, { data: gruposD }] = await Promise.all([
    recompraQ,
    carteiraQ,
    metaQ,
    topQ,
    gruposQ,
  ]);
  const list = (rows ?? []) as RecompraRow[];

  // KPIs (server-side, sobre a lista já escopada por acesso).
  const kpis = {
    total: list.length,
    atencao: list.filter((r) => r.customer_status === "atencao").length,
    ativos: list.filter((r) => r.customer_status === "ativo").length,
    cesta: list.reduce((s, r) => s + (Number(r.cesta_valor_90d) || 0), 0),
  };

  // Saúde da carteira agregada server-side por vendedor (sem view nova).
  const map = new Map<string, Record<string, number>>();
  for (const c of (cart ?? []) as { customer_status: string; vendedor_nome: string | null }[]) {
    const v = c.vendedor_nome ?? "Sem vendedor";
    if (!map.has(v)) map.set(v, {});
    const d = map.get(v)!;
    d[c.customer_status] = (d[c.customer_status] ?? 0) + 1;
  }
  const saude: SaudeVendedor[] = [...map.entries()].map(([vendedor, dist]) => ({ vendedor, dist }));

  const metaRows = (metaD ?? []) as MetaRow[];
  const topRows = (topD ?? []) as TopRow[];
  const gruposRows = (gruposD ?? []) as GrupoRow[];

  // Nova ordem (Paulo): (a) KPIs → (b) Recompra×Meta → (c) Colunas clientes → (d) Top10 → (e) Grupos → (f) Saúde.
  return (
    <div className="space-y-6">
      <CarteiraKpisRow kpis={kpis} />
      <RecompraMetaSection meta={metaRows} top={topRows} grupos={gruposRows} />
      <RecompraLista rows={list} />
      <TopProdutosSection meta={metaRows} top={topRows} />
      <GruposSection meta={metaRows} grupos={gruposRows} />
      <SaudeCarteira saude={saude} />
    </div>
  );
}
