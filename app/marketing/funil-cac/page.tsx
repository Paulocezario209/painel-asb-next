import { createClient } from "@/lib/supabase/server";
import { FunilCacClient, type FunilRow, type ConvMensalRow } from "./funil-cac-client";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default async function FunilCacPage() {
  const supabase = await createClient();
  // hidrata a sessão (views REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const [funilRes, mensalRes] = await Promise.all([
    supabase
      .from("v_funil_por_canal")
      .select("canal, leads_total, qualificados, handoffs, convertidos, pct_qualificacao, pct_handoff, pct_conversao"),
    supabase
      .from("v_cac_mensal_canal")
      .select("mes, leads, convertidos")
      .order("mes", { ascending: true }),
  ]);

  const funil = (funilRes.error ? [] : (funilRes.data ?? [])) as unknown as FunilRow[];
  const mensal = (mensalRes.error ? [] : (mensalRes.data ?? [])) as unknown as ConvMensalRow[];
  const erro = funilRes.error?.message || mensalRes.error?.message || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Funil CAC
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Lead → qualificado → handoff → pedido, por canal + evolução da conversão
        </p>
      </div>

      {erro && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: mono }}>
          View <code>v_funil_por_canal</code> indisponível. {erro}
        </div>
      )}

      <FunilCacClient funil={funil} mensal={mensal} />
    </div>
  );
}
