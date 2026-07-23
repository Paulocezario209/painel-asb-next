import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { PageHead } from "@/app/dashboard/lib/ui";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { FunilCacClient, type FunilMensalRow, type CacMensalRow } from "./funil-cac-client";

export const dynamic = "force-dynamic";


export default async function FunilCacPage() {
  const supabase = await createClient();
  // hidrata a sessão (views REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  // Funil mês-granular (coorte por mês) + CAC mensal por canal (mesma janela) — o cliente
  // soma a janela selecionada (default Acumulado = mesmo número de sempre). Reconcilia com
  // a Visão Geral (1 mês) e o Comercial (coorte do mês). DEBT-328.
  const [funilRes, cacRes] = await Promise.all([
    supabase
      .from("v_funil_por_canal_mensal")
      .select("canal, mes, leads_total, qualificados_real, agendamentos, convertidos")
      .order("mes", { ascending: true })
      .limit(5000),
    supabase
      .from("v_cac_mensal_canal")
      .select("canal, mes, leads, convertidos, gasto_total")
      .order("mes", { ascending: true })
      .limit(2000),
  ]);

  const funilMensal = (funilRes.error ? [] : (funilRes.data ?? [])) as unknown as FunilMensalRow[];
  const cacMensal = (cacRes.error ? [] : (cacRes.data ?? [])) as unknown as CacMensalRow[];
  const erro = funilRes.error?.message || cacRes.error?.message || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Funil CAC"
        desc="Lead → qualificado → agendamento → pedido, por canal + evolução da conversão"
      />

      {erro && (
        <div style={{ ...S.card, border: "1px solid #C8102E", padding: 16, color: "#C8102E", fontSize: 12, fontFamily: theme.font.label }}>
          Views de funil/CAC indisponíveis (v_funil_por_canal_mensal · v_cac_mensal_canal). {erro}
        </div>
      )}

      <FunilCacClient funilMensal={funilMensal} cacMensal={cacMensal} />

      <p style={{ color: "#e4e9f0", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
        Dados de gasto Meta Ads atualizados diariamente às 06:10 BRT
      </p>
    </div>
  );
}
