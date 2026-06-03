import { createClient } from "@/lib/supabase/server";
import { FunilCacClient, type CampanhaRow } from "./funil-cac-client";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default async function FunilCacPage() {
  const supabase = await createClient();
  // hidrata a sessão (view é REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("v_cac_por_campanha")
    .select("campaign_name, leads, convertidos, conv_pct, receita_brl, gasto_total, cac_por_lead, custo_por_conversao, roas, primeiro_dia_gasto, ultimo_dia_gasto")
    .order("gasto_total", { ascending: false, nullsFirst: false });

  const campRows = (error ? [] : (data ?? [])) as unknown as CampanhaRow[];

  // Linha do SITE (canal lp) — v_cac_site (correspondência declarada, DEBT-119 fase 1).
  // Leads de site não têm ad_id → não entram na v_cac_por_campanha; somam aqui lado a lado.
  const { data: siteData, error: siteError } = await supabase
    .from("v_cac_site")
    .select("campanha, leads, convertidos, receita_brl, gasto_total, cac_por_lead, custo_por_conversao, roas, primeiro_dia, ultimo_dia");

  const siteRows: CampanhaRow[] = (siteError ? [] : (siteData ?? [])).map((s: Record<string, unknown>) => {
    const leads = Number(s.leads ?? 0);
    const convertidos = Number(s.convertidos ?? 0);
    return {
      campaign_name: (s.campanha as string) ?? null,
      leads,
      convertidos,
      conv_pct: leads > 0 ? convertidos / leads : null, // derivada de linha única (v_cac_site não expõe conv_pct)
      receita_brl: Number(s.receita_brl ?? 0),
      gasto_total: Number(s.gasto_total ?? 0),
      cac_por_lead: s.cac_por_lead != null ? Number(s.cac_por_lead) : null,
      custo_por_conversao: s.custo_por_conversao != null ? Number(s.custo_por_conversao) : null,
      roas: s.roas != null ? Number(s.roas) : null,
      primeiro_dia_gasto: (s.primeiro_dia as string) ?? null,
      ultimo_dia_gasto: (s.ultimo_dia as string) ?? null,
      is_canal_level: true,
    };
  });

  const rows = [...campRows, ...siteRows];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Funil CAC
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          CAC e ROAS por campanha
        </p>
      </div>

      {error && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: mono }}>
          View <code>v_cac_por_campanha</code> indisponível — aplicar a migration no Supabase (STOP GATE). {error.message}
        </div>
      )}

      <FunilCacClient rows={rows} />
    </div>
  );
}
