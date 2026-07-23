import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { PageHead } from "@/app/dashboard/lib/ui";
import { theme } from "@/lib/theme";
import { AtribuicaoClient, type CampanhaRow, type AnuncioRow, type SemRetornoRow, type NaoAtribRow, type CanalJornadaCell } from "./atribuicao-client";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// Fase 3 (atribuição): consulta DIRETA por request (força-dinâmica), lê as views
// v_cac_*_full / v_gasto_sem_retorno / v_leads_nao_atribuidos / v_lead_canal_jornada
// (migration 2026_07_20_marketing_fase3_atribuicao.sql). Régua: qualificado=qual_stage≥7,
// agendamento=seller_first_reply_at, CAC=gasto/convertidos, ROAS=receita/gasto (asb-acquisition).
async function svc() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export default async function AtribuicaoPage() {
  const supabase = await createClient();
  await supabase.auth.getUser(); // hidrata sessão (views GRANT authenticated)

  const s = await svc();
  const [camp, anun, sem, nao, cj] = await Promise.all([
    s.from("v_cac_campanha_full").select("*").order("gasto_total", { ascending: false }).limit(200),
    s.from("v_cac_anuncio_full").select("*").order("gasto_total", { ascending: false }).limit(300),
    s.from("v_gasto_sem_retorno").select("*").order("gasto_total", { ascending: false }).limit(200),
    s.from("v_leads_nao_atribuidos").select("*").order("leads_sem_ad", { ascending: false }).limit(50),
    s.from("v_lead_canal_jornada").select("channel, journey").limit(5000),
  ]);

  const erro = camp.error?.message || anun.error?.message || cj.error?.message
    || sem.error?.message || nao.error?.message || null;

  // agrega canal×jornada no server (client fica leve)
  const cjMap = new Map<string, number>();
  for (const r of (cj.data ?? []) as { channel: string; journey: string }[]) {
    const k = `${r.channel}||${r.journey}`;
    cjMap.set(k, (cjMap.get(k) ?? 0) + 1);
  }
  const canalJornada: CanalJornadaCell[] = [...cjMap.entries()]
    .map(([k, count]) => { const [channel, journey] = k.split("||"); return { channel, journey, count }; })
    .sort((a, b) => b.count - a.count);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Atribuição"
        desc="Campanha · conjunto · anúncio — gasto, leads, CPL, CPQL, CAC, ROAS + gasto sem retorno"
      />
      {erro && (
        <div style={{ background: "var(--asb-card)", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: theme.font.label }}>
          Views de atribuição indisponíveis. {erro}
        </div>
      )}
      <AtribuicaoClient
        campanhas={(camp.data ?? []) as unknown as CampanhaRow[]}
        anuncios={(anun.data ?? []) as unknown as AnuncioRow[]}
        semRetorno={(sem.data ?? []) as unknown as SemRetornoRow[]}
        naoAtrib={(nao.data ?? []) as unknown as NaoAtribRow[]}
        canalJornada={canalJornada}
      />
      <p style={{ color: "#e4e9f0", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
        Gasto Meta 06:10 · Google 06:15 BRT · funil real-time. Receita atribuída ao lead de forma aproximada.
      </p>
    </div>
  );
}
