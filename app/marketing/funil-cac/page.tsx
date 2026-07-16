import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { FunilCacClient, type FunilRow, type ConvMensalRow, type CacCanalRow } from "./funil-cac-client";

export const dynamic = "force-dynamic";


export default async function FunilCacPage() {
  const supabase = await createClient();
  // hidrata a sessão (views REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const [funilRes, mensalRes, cacRes] = await Promise.all([
    supabase
      .from("v_funil_por_canal")
      .select("canal, leads_total, qualificados_real, handoffs, convertidos, pct_qualificacao_real, pct_handoff, pct_conversao")
      .limit(50),
    supabase
      .from("v_cac_mensal_canal")
      .select("mes, leads, convertidos")
      .order("mes", { ascending: true })
      .limit(2000),
    // CAC por canal — a tela chama "Funil CAC" e agora ENTREGA o CAC (auditoria 2026-07-10)
    supabase
      .from("v_cac_por_canal")
      .select("canal, gasto_total, cac_por_lead, custo_por_conversao")
      .limit(50),
  ]);

  const funil = (funilRes.error ? [] : (funilRes.data ?? [])) as unknown as FunilRow[];
  const mensal = (mensalRes.error ? [] : (mensalRes.data ?? [])) as unknown as ConvMensalRow[];
  const cac = (cacRes.error ? [] : (cacRes.data ?? [])) as unknown as CacCanalRow[];
  const erro = funilRes.error?.message || mensalRes.error?.message || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "var(--asb-page-ink)", fontSize: 20, fontWeight: 800, fontFamily: theme.font.label, letterSpacing: "-.01em", textTransform: "none", marginBottom: 4 }}>
          Funil CAC
        </h1>
        <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label }}>
          Lead → qualificado → handoff → pedido, por canal + evolução da conversão
        </p>
      </div>

      {erro && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: theme.font.label }}>
          View <code>v_funil_por_canal</code> indisponível. {erro}
        </div>
      )}

      <FunilCacClient funil={funil} mensal={mensal} cac={cac} />

      <p style={{ color: "#e4e9f0", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
        Dados de gasto Meta Ads atualizados diariamente às 06:10 BRT
      </p>
    </div>
  );
}
