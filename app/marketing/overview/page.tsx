import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { OverviewClient, type CacMensalRow, type RankRow, type AlertaRow } from "./overview-client";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// FIX freeze (2026-07-15): consultas DIRETAS por request (eram unstable_cache revalidate 300, que
// congelavam no self-hosted standalone). A página é force-dynamic → CAC e alertas refletem a view na hora.
function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function getCacMensal() {
  const { data } = await svc()
    .from("v_cac_mensal_canal")
    .select("mes, canal, leads, convertidos, receita_brl, gasto_total, cac_por_lead, roas")
    .order("mes", { ascending: true })
    .limit(2000);
  return (data ?? []) as unknown as CacMensalRow[];
}

async function getAlertas() {
  const { data } = await svc()
    .from("v_marketing_alertas")
    .select("flag, ad_id, ad_name, campaign_name, canal, valor_atual, valor_referencia, descricao, severidade")
    .limit(200);
  return (data ?? []) as unknown as AlertaRow[];
}

export default async function OverviewPage() {
  const supabase = await createClient();
  // hidrata a sessão (views REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  // cac + alertas + ranking: live (consulta direta por request).
  // Funil por canal foi REMOVIDO daqui (dedup) — vive só em /marketing/funil-cac.
  const [cac, rankRes, alertas] = await Promise.all([
    getCacMensal(),
    supabase
      .from("v_ranking_criativo")
      .select("ad_name, campaign_name, cpl, leads, spend")
      .eq("periodo", "30d")
      .limit(500),
    getAlertas(),
  ]);

  const rank = (rankRes.error ? [] : (rankRes.data ?? [])) as unknown as RankRow[];

  const erro = rankRes.error?.message || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Overview
        </h1>
        <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label }}>
          Investimento · CAC · ROAS · funil · ranking de criativos (Meta Ads)
        </p>
      </div>

      {erro && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: theme.font.label }}>
          Views de marketing indisponíveis — conferir aplicação das migrations. {erro}
        </div>
      )}

      <OverviewClient cac={cac} rank={rank} alertas={alertas} />

      <p style={{ color: "#e4e9f0", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
        Dados de gasto Meta Ads atualizados diariamente às 06:10 BRT
      </p>
    </div>
  );
}
