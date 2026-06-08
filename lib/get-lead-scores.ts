// ETAPA 4 — leitura best-effort da view v_lead_score via service role (bypassa RLS).
// Se a view ainda não foi aplicada (Paulo) → retorna {} e o chamador usa computeLeadScore.
import { createClient } from "@supabase/supabase-js";

export async function getLeadScoreMap(): Promise<Record<string, { score: number; tier: "A" | "B" | "C" }>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return {};
  try {
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await sb.from("v_lead_score").select("phone, lead_score, lead_tier");
    if (error || !data) return {};
    const m: Record<string, { score: number; tier: "A" | "B" | "C" }> = {};
    for (const r of data as { phone: string | null; lead_score: number | null; lead_tier: string | null }[]) {
      if (r.phone) m[r.phone] = { score: Number(r.lead_score ?? 0), tier: (r.lead_tier as "A" | "B" | "C") ?? "C" };
    }
    return m;
  } catch {
    return {};
  }
}
