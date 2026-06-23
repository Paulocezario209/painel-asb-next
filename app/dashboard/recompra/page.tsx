import { createClient } from "@/lib/supabase/server";
import { RecompraLista, type RecompraRow } from "./recompra-lista";

export const dynamic = "force-dynamic";

export default async function RecompraPage() {
  const supabase = await createClient();
  // Fonte: v_recompra_com_sugestao (DEFINER) — lista de recompra por vendedor + cesta jsonb 90d.
  // Já vem ORDER BY vendedor_nome, bucket, next_expected_order_at.
  const { data: rows } = await supabase.from("v_recompra_com_sugestao").select("*");
  return <RecompraLista rows={(rows ?? []) as RecompraRow[]} />;
}
