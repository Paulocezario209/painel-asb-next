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

  const rows = (error ? [] : (data ?? [])) as unknown as CampanhaRow[];

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
