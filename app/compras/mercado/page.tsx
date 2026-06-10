// app/compras/mercado/page.tsx — ASB Intelligence Hub (Camada 4: Mercado de proteínas).
// Server Component: lê as 4 views v_mercado_* e entrega ao client.
// Fonte: workflow n8n ASB_MERCADO_INTELIGENCIA (cron diário 06h BRT) → tabelas mercado_*.
import { createClient } from "@/lib/supabase/server";
import MercadoClient, {
  type Cotacao,
  type Historico,
  type Sinal,
  type Noticia,
} from "./mercado-client";

export const dynamic = "force-dynamic";

export default async function MercadoPage() {
  const supabase = await createClient();
  const [cotRes, histRes, sinalRes, newsRes] = await Promise.all([
    supabase.from("v_mercado_cotacoes_recentes").select("*"),
    supabase.from("v_mercado_historico_90d").select("*"),
    supabase.from("v_mercado_sinal_atual").select("*"),
    supabase.from("v_mercado_noticias_recentes").select("*"),
  ]);

  return (
    <MercadoClient
      cotacoes={(cotRes.data ?? []) as Cotacao[]}
      historico={(histRes.data ?? []) as Historico[]}
      sinais={(sinalRes.data ?? []) as Sinal[]}
      noticias={(newsRes.data ?? []) as Noticia[]}
    />
  );
}
