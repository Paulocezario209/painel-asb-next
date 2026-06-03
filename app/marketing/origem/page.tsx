import { createClient } from "@/lib/supabase/server";
import { OrigemClient, type CanalConsolidado, type CacMensalRow } from "./origem-client";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default async function OrigemPage() {
  const supabase = await createClient();
  // hidrata a sessão (views REVOKE anon / GRANT authenticated — 069c/DEBT-110)
  await supabase.auth.getUser();

  const [canalRes, mensalRes] = await Promise.all([
    supabase
      .from("v_cac_por_canal")
      .select("canal, leads, convertidos, receita_brl, gasto_total, cac_por_lead, custo_por_conversao, roas"),
    supabase
      .from("v_cac_mensal_canal")
      .select("mes, canal, leads, gasto_total, cac_por_lead, roas")
      .order("mes", { ascending: true }),
  ]);

  const canais = (canalRes.error ? [] : (canalRes.data ?? [])) as unknown as CanalConsolidado[];
  const mensal = (mensalRes.error ? [] : (mensalRes.data ?? [])) as unknown as CacMensalRow[];
  const erro = canalRes.error?.message || mensalRes.error?.message || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Origem dos Leads
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Gasto · leads · CAC · ROAS por canal de aquisição + evolução mensal
        </p>
      </div>

      {erro && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: mono }}>
          View <code>v_cac_por_canal</code>/<code>v_cac_mensal_canal</code> indisponível. {erro}
        </div>
      )}

      <OrigemClient canais={canais} mensal={mensal} />
    </div>
  );
}
