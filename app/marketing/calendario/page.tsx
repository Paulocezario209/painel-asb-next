import { createClient } from "@/lib/supabase/server";
import { CalendarioClient, type DiaRow } from "./calendario-client";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

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

  const { data, error } = await supabase
    .from("v_performance_diaria")
    .select("data, ad_id, ad_name, spend, leads, cpl")
    .gte("data", `${ano}-01-01`)
    .lte("data", `${ano}-12-31`)
    .order("data", { ascending: true })
    .limit(20000);

  const rows = (error ? [] : (data ?? [])) as unknown as DiaRow[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Calendário
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Gasto diário por mês · heatmap · KPIs do dia (Meta Ads)
        </p>
      </div>

      {error && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: mono }}>
          View <code>v_performance_diaria</code> indisponível. {error.message}
        </div>
      )}

      <CalendarioClient ano={Number(ano)} rows={rows} />
    </div>
  );
}
