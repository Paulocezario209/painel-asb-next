import { createClient } from "@/lib/supabase/server";
import { OrigemClient, type CanalRow } from "./origem-client";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default async function OrigemPage() {
  const supabase = await createClient();
  // hidrata a sessão (view é REVOKE anon / GRANT authenticated — 069c/DEBT-110)
  await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("v_leads_por_canal")
    .select("canal, segmento, leads, convertidos, faturamento_brl, primeira_atribuicao");

  const rows = (error ? [] : (data ?? [])) as unknown as CanalRow[];

  // data da 1ª atribuição (menor primeira_atribuicao não-nula) — pra nota
  const datas = rows.map(r => r.primeira_atribuicao).filter(Boolean) as string[];
  const primeiraAtribuicao = datas.length ? datas.sort()[0] : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Origem dos Leads
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Leads · convertidos · faturamento por canal de aquisição
        </p>
      </div>

      {error && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: mono }}>
          View <code>v_leads_por_canal</code> indisponível — aplicar a migration no Supabase (STOP GATE). {error.message}
        </div>
      )}

      <OrigemClient rows={rows} primeiraAtribuicao={primeiraAtribuicao} />
    </div>
  );
}
