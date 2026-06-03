import { createClient } from "@/lib/supabase/server";
import { AnunciosClient, type RankRow, type SparkRow } from "./anuncios-client";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default async function AnunciosPage() {
  const supabase = await createClient();
  // hidrata a sessão (views REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const desde7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  const [rankRes, sparkRes] = await Promise.all([
    supabase
      .from("v_ranking_criativo")
      .select("ad_id, ad_name, campaign_name, periodo, spend, leads, conversoes, cpl, taxa_conversao, roas, status_meta, objetivo"),
    supabase
      .from("v_performance_diaria")
      .select("ad_id, data, spend")
      .gte("data", desde7)
      .order("data", { ascending: true }),
  ]);

  const rank = (rankRes.error ? [] : (rankRes.data ?? [])) as unknown as RankRow[];
  const spark = (sparkRes.error ? [] : (sparkRes.data ?? [])) as unknown as SparkRow[];
  const erro = rankRes.error?.message || sparkRes.error?.message || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Anúncios
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Ranking de criativos · gasto · leads · CPL · ROAS · tendência 7d (Meta Ads)
        </p>
      </div>

      {erro && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: mono }}>
          View <code>v_ranking_criativo</code> indisponível. {erro}
        </div>
      )}

      <AnunciosClient rank={rank} spark={spark} />
    </div>
  );
}
