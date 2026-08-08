import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";
import { RecompraLista, type RecompraRow } from "./recompra-lista";
import { SaudeCarteira, type SaudeVendedor } from "./saude-carteira";
import { CarteiraKpisRow } from "./carteira-kpis";
import { RecompraMetaSection, TopProdutosSection, GruposSection, type MetaRow, type TopRow, type GrupoRow } from "./carteira-analytics";
import { PageHead } from "../lib/ui";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";

export const dynamic = "force-dynamic";

export default async function CarteiraAtivaPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx) redirect("/dashboard");

  // ACESSO (padrão idêntico a /dashboard/vendas): gestor/manager veem os 3 vendedores;
  // vendedor restrito (≠ CUIT) só a própria carteira, filtrando por routing_team em TODAS as queries.
  const isVendedorRestrito = ctx.isVendedor && !!ctx.routing_team && ctx.routing_team !== "SETOR_CUIT";

  // Filtro de setor (consultoria item 10): quem NÃO é vendedor restrito escolhe via
  // ?vendedor=SETOR_* (mesmo padrão da home). Vendedor restrito fica TRAVADO no próprio
  // setor — o param da URL é ignorado (nunca confiar no ?vendedor= para escopo).
  const sp = await searchParams;
  const canPick = !isVendedorRestrito;
  const rawVend = sp?.vendedor ?? "";
  const vendSel = canPick && /^SETOR_[A-Z_]+$/.test(rawVend) ? rawVend : null;
  const rtFiltro = isVendedorRestrito ? ctx.routing_team! : vendSel;

  let recompraQ = supabase.from("v_recompra_com_sugestao").select("*");
  let carteiraQ = supabase.from("v_carteira_360").select("customer_status, vendedor_nome, routing_team");
  let metaQ = supabase.from("v_recompra_meta_dia").select("*");
  let topQ = supabase.from("v_produtos_top").select("*");
  let gruposQ = supabase.from("v_recompra_grupos").select("*");
  if (rtFiltro) {
    recompraQ = recompraQ.eq("routing_team", rtFiltro);
    carteiraQ = carteiraQ.eq("routing_team", rtFiltro);
    metaQ = metaQ.eq("routing_team", rtFiltro);
    topQ = topQ.eq("routing_team", rtFiltro);
    gruposQ = gruposQ.eq("routing_team", rtFiltro);
  }
  const [{ data: rows }, { data: cart }, { data: metaD }, { data: topD }, { data: gruposD }] = await Promise.all([
    recompraQ,
    carteiraQ,
    metaQ,
    topQ,
    gruposQ,
  ]);
  const list = (rows ?? []) as RecompraRow[];

  // KPIs (server-side, sobre a lista já escopada por acesso+filtro) — cards e lista
  // derivam da MESMA query, então os totais batem com a listagem por construção.
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
      <PageHead title="Carteira Ativa" desc="Recompra, saúde e cesta projetada da carteira real ARES" />
      {canPick && <DashboardFilters showMonth={false} showVendedor />}
      <CarteiraKpisRow kpis={kpis} />
      <RecompraMetaSection meta={metaRows} top={topRows} grupos={gruposRows} />
      <RecompraLista rows={list} />
      <TopProdutosSection meta={metaRows} top={topRows} />
      <GruposSection meta={metaRows} grupos={gruposRows} />
      <SaudeCarteira saude={saude} />
    </div>
  );
}
