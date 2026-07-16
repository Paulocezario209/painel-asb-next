import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { AnunciosClient, type RankRow, type SparkRow } from "./anuncios-client";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { PageHead } from "@/app/dashboard/lib/ui";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// FIX freeze (2026-07-15): consulta DIRETA por request (era unstable_cache revalidate 300, que
// congelava no self-hosted standalone). A página é force-dynamic → ranking reflete a view na hora.
async function getRankingCriativo() {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase
    .from("v_ranking_criativo")
    .select("ad_id, ad_name, campaign_name, periodo, spend, leads, cpl, roas, status_meta")
    .limit(5000);
  return (data ?? []) as unknown as RankRow[];
}

export default async function AnunciosPage() {
  const supabase = await createClient();
  // hidrata a sessão (views REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const desde7 = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

  // ranking + spark 7d: live (consulta direta por request).
  const [rank, sparkRes] = await Promise.all([
    getRankingCriativo(),
    supabase
      .from("v_performance_diaria")
      .select("ad_id, data, spend")
      .gte("data", desde7)
      .order("data", { ascending: true })
      .limit(5000),
  ]);

  const spark = (sparkRes.error ? [] : (sparkRes.data ?? [])) as unknown as SparkRow[];
  const erro = sparkRes.error?.message || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Anúncios"
        desc="Ranking de criativos · gasto · leads · CPL · ROAS · tendência 7d (Meta Ads)"
      />

      {erro && (
        <div style={{ background: "var(--asb-card)", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: theme.font.label }}>
          View <code>v_ranking_criativo</code> indisponível. {erro}
        </div>
      )}

      <AnunciosClient rank={rank} spark={spark} />

      <p style={{ color: "#e4e9f0", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
        Dados de gasto Meta Ads atualizados diariamente às 06:10 BRT
      </p>
    </div>
  );
}
