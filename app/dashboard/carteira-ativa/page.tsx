import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";
import { RecompraLista, type RecompraRow } from "./recompra-lista";
import { SaudeCarteira, type SaudeVendedor } from "./saude-carteira";

export const dynamic = "force-dynamic";

export default async function CarteiraAtivaPage() {
  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx) redirect("/dashboard");

  // ACESSO (padrão idêntico a /dashboard/vendas): gestor/manager veem os 3 vendedores;
  // vendedor restrito (≠ CUIT) só a própria carteira, filtrando por routing_team.
  const isVendedorRestrito = ctx.isVendedor && !!ctx.routing_team && ctx.routing_team !== "SETOR_CUIT";

  let recompraQ = supabase.from("v_recompra_com_sugestao").select("*");
  let carteiraQ = supabase.from("v_carteira_360").select("customer_status, vendedor_nome, routing_team");
  if (isVendedorRestrito) {
    recompraQ = recompraQ.eq("routing_team", ctx.routing_team!);
    carteiraQ = carteiraQ.eq("routing_team", ctx.routing_team!);
  }
  const [{ data: rows }, { data: cart }] = await Promise.all([recompraQ, carteiraQ]);

  // Saúde da carteira agregada server-side por vendedor (sem view nova).
  const map = new Map<string, Record<string, number>>();
  for (const c of (cart ?? []) as { customer_status: string; vendedor_nome: string | null }[]) {
    const v = c.vendedor_nome ?? "Sem vendedor";
    if (!map.has(v)) map.set(v, {});
    const d = map.get(v)!;
    d[c.customer_status] = (d[c.customer_status] ?? 0) + 1;
  }
  const saude: SaudeVendedor[] = [...map.entries()].map(([vendedor, dist]) => ({ vendedor, dist }));

  return (
    <div className="space-y-6">
      <RecompraLista rows={(rows ?? []) as RecompraRow[]} />
      <SaudeCarteira saude={saude} />
    </div>
  );
}
