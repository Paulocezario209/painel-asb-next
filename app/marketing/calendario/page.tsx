import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { CalendarioClient, type DiaRow } from "./calendario-client";
// ETAPA6 (DEBT-137): cache real da performance diária (view global, chave inclui o ano).
import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";


// unstable_cache inclui os argumentos (ano) na chave automaticamente → 1 entrada por ano.
const getCachedPerfDiaria = unstable_cache(
  async (ano: string) => {
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
  },
  ["marketing-performance-diaria"],
  { revalidate: 300, tags: ["marketing-performance-diaria"] },
);

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const sp = await searchParams;
  const ano = /^\d{4}$/.test(sp?.ano ?? "") ? (sp!.ano as string) : "2026";

  const supabase = await createClient();
  // hidrata a sessão (view REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const rows = await getCachedPerfDiaria(ano);  // ETAPA6: cacheado por ano (revalidate 300)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Calendário
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: theme.font.label }}>
          Gasto diário por mês · heatmap · KPIs do dia (Meta Ads)
        </p>
      </div>

      <CalendarioClient ano={Number(ano)} rows={rows} />

      <p style={{ color: "#556677", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
        Dados de gasto Meta Ads atualizados diariamente às 06:10 BRT
      </p>
    </div>
  );
}
