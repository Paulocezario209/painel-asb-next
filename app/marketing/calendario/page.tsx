import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { CalendarioClient, type DiaRow } from "./calendario-client";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// FIX freeze (2026-07-15): consulta DIRETA por request. A página é force-dynamic; o unstable_cache
// (revalidate 300) congelava no self-hosted standalone (EasyPanel) e a tela travava no dado do último
// deploy (ex.: gasto só até 11/07 com a view já em 14/07). Sem cache → o calendário reflete a view na hora.
async function getPerfDiaria(ano: string) {
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase
    .from("v_performance_diaria")
    .select("data, ad_id, ad_name, spend, leads, cpl")
    .gte("data", `${ano}-01-01`)
    .lte("data", `${ano}-12-31`)
    .order("data", { ascending: true })
    .limit(20000);
  return (data ?? []) as unknown as DiaRow[];
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const sp = await searchParams;
  // default = ano corrente (era "2026" fixo — em jan/2027 a tela abriria vazia)
  const ano = /^\d{4}$/.test(sp?.ano ?? "") ? (sp!.ano as string) : String(new Date().getFullYear());

  const supabase = await createClient();
  // hidrata a sessão (view REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const rows = await getPerfDiaria(ano);  // consulta direta (force-dynamic) — sem freeze de cache

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Calendário
        </h1>
        <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label }}>
          Gasto diário por mês · heatmap · KPIs do dia (Meta Ads)
        </p>
      </div>

      <CalendarioClient ano={Number(ano)} rows={rows} />

      <p style={{ color: "#e4e9f0", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
        Dados de gasto Meta Ads atualizados diariamente às 06:10 BRT
      </p>
    </div>
  );
}
