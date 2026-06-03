import { createClient } from "@/lib/supabase/server";
import { OverviewClient, type CacMensalRow, type FunilRow, type RankRow } from "./overview-client";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default async function OverviewPage() {
  const supabase = await createClient();
  // hidrata a sessão (views REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const [cacRes, funilRes, rankRes] = await Promise.all([
    supabase
      .from("v_cac_mensal_canal")
      .select("mes, canal, leads, convertidos, receita_brl, gasto_total, cac_por_lead, roas")
      .order("mes", { ascending: true }),
    supabase
      .from("v_funil_por_canal")
      .select("canal, leads_total, qualificados, handoffs, convertidos"),
    supabase
      .from("v_ranking_criativo")
      .select("ad_name, campaign_name, cpl, leads, spend")
      .eq("periodo", "30d"),
  ]);

  const cac = (cacRes.error ? [] : (cacRes.data ?? [])) as unknown as CacMensalRow[];
  const funil = (funilRes.error ? [] : (funilRes.data ?? [])) as unknown as FunilRow[];
  const rank = (rankRes.error ? [] : (rankRes.data ?? [])) as unknown as RankRow[];

  const erro = cacRes.error?.message || funilRes.error?.message || rankRes.error?.message || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Overview
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Investimento · CAC · ROAS · funil · ranking de criativos (Meta Ads)
        </p>
      </div>

      {erro && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: mono }}>
          Views de marketing indisponíveis — conferir aplicação das migrations. {erro}
        </div>
      )}

      <OverviewClient cac={cac} funil={funil} rank={rank} />
    </div>
  );
}
