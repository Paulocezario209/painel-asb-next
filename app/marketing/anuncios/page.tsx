import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { AnunciosClient, type RankRow, type SparkRow } from "./anuncios-client";
// ETAPA6 (DEBT-137): cache real do ranking de criativos (view global).
import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";


const getCachedRankingCriativo = unstable_cache(
  async () => {
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data } = await supabase
      .from("v_ranking_criativo")
      .select("ad_id, ad_name, campaign_name, periodo, spend, leads, conversoes, cpl, taxa_conversao, roas, status_meta, objetivo");
    return (data ?? []) as unknown as RankRow[];
  },
  ["marketing-ranking-criativo"],
  { revalidate: 300, tags: ["marketing-ranking-criativo"] },
);

export default async function AnunciosPage() {
  const supabase = await createClient();
  // hidrata a sessão (views REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const desde7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  // ranking: cacheado (global, revalidate 300). spark 7d: live (janela rolante).
  const [rank, sparkRes] = await Promise.all([
    getCachedRankingCriativo(),
    supabase
      .from("v_performance_diaria")
      .select("ad_id, data, spend")
      .gte("data", desde7)
      .order("data", { ascending: true }),
  ]);

  const spark = (sparkRes.error ? [] : (sparkRes.data ?? [])) as unknown as SparkRow[];
  const erro = sparkRes.error?.message || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Anúncios
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: theme.font.label }}>
          Ranking de criativos · gasto · leads · CPL · ROAS · tendência 7d (Meta Ads)
        </p>
      </div>

      {erro && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: theme.font.label }}>
          View <code>v_ranking_criativo</code> indisponível. {erro}
        </div>
      )}

      <AnunciosClient rank={rank} spark={spark} />

      <p style={{ color: "#556677", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
        Dados de gasto Meta Ads atualizados diariamente às 06:10 BRT
      </p>
    </div>
  );
}
