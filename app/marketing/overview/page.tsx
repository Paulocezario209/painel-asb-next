import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { OverviewClient, type CacMensalRow, type RankRow, type AlertaRow } from "./overview-client";
// ETAPA6 (DEBT-137): cache real das views globais de marketing (sem auth).
import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";


function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const getCachedCacMensal = unstable_cache(
  async () => {
    const { data } = await svc()
      .from("v_cac_mensal_canal")
      .select("mes, canal, leads, convertidos, receita_brl, gasto_total, cac_por_lead, roas")
      .order("mes", { ascending: true });
    return (data ?? []) as unknown as CacMensalRow[];
  },
  ["marketing-cac-mensal"],
  { revalidate: 300, tags: ["marketing-cac-mensal"] },
);

const getCachedAlertas = unstable_cache(
  async () => {
    const { data } = await svc()
      .from("v_marketing_alertas")
      .select("flag, ad_id, ad_name, campaign_name, canal, valor_atual, valor_referencia, descricao, severidade");
    return (data ?? []) as unknown as AlertaRow[];
  },
  ["marketing-alertas"],
  { revalidate: 300, tags: ["marketing-alertas"] },
);

export default async function OverviewPage() {
  const supabase = await createClient();
  // hidrata a sessão (views REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  // cac + alertas: cacheados (global, revalidate 300). ranking: live (cookie).
  // Funil por canal foi REMOVIDO daqui (dedup) — vive só em /marketing/funil-cac.
  const [cac, rankRes, alertas] = await Promise.all([
    getCachedCacMensal(),
    supabase
      .from("v_ranking_criativo")
      .select("ad_name, campaign_name, cpl, leads, spend")
      .eq("periodo", "30d"),
    getCachedAlertas(),
  ]);

  const rank = (rankRes.error ? [] : (rankRes.data ?? [])) as unknown as RankRow[];

  const erro = rankRes.error?.message || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Overview
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: theme.font.label }}>
          Investimento · CAC · ROAS · funil · ranking de criativos (Meta Ads)
        </p>
      </div>

      {erro && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: theme.font.label }}>
          Views de marketing indisponíveis — conferir aplicação das migrations. {erro}
        </div>
      )}

      <OverviewClient cac={cac} rank={rank} alertas={alertas} />

      <p style={{ color: "#556677", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
        Dados de gasto Meta Ads atualizados diariamente às 06:10 BRT
      </p>
    </div>
  );
}
