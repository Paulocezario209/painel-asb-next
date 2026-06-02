import { createClient } from "@/lib/supabase/server";
import { AnunciosClient, type AnuncioRow } from "./anuncios-client";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default async function AnunciosPage() {
  const supabase = await createClient();
  // hidrata a sessão (view é REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("v_leads_por_anuncio")
    .select("ad_id, ad_name, campaign_name, leads, convertidos, receita_brl, primeiro_lead, ultimo_lead");

  const rows = (error ? [] : (data ?? [])) as unknown as AnuncioRow[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Anúncios
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Lado-lead do CAC · leads · convertidos · receita por anúncio (Meta Ads)
        </p>
      </div>

      {error && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: mono }}>
          View <code>v_leads_por_anuncio</code> indisponível — aplicar a migration no Supabase (STOP GATE). {error.message}
        </div>
      )}

      <AnunciosClient rows={rows} />
    </div>
  );
}
