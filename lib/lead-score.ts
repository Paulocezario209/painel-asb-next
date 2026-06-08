// ETAPA 4 — Lead Score (fallback client/server-computável). Fórmula IDÊNTICA à view
// SQL v_lead_score (pesos: volume 40 · segmento 20 · qual_stage 20 · temperatura 20).
// Usado quando a view ainda não foi aplicada ou para leads fora dela.

export type LeadScoreFields = {
  weekly_volume_kg?: number | null;
  segment?: string | null;
  qual_stage?: number | null;
  lead_temperature?: string | null;
};

export function computeLeadScore(f: LeadScoreFields): number {
  let s = 0;
  const v = Number(f.weekly_volume_kg || 0);
  s += v >= 300 ? 40 : v >= 100 ? 25 : v >= 50 ? 15 : v > 0 ? 8 : 0;

  const seg = (f.segment || "").toLowerCase();
  s += seg === "hamburgueria" ? 20 : seg === "steak_house" ? 18 : seg === "restaurante" ? 12
     : seg === "bar" ? 10 : seg === "pub" ? 10 : seg === "delivery" ? 8 : 5;

  const q = Number(f.qual_stage || 0);
  s += q >= 8 ? 20 : q >= 6 ? 14 : q >= 4 ? 8 : q >= 2 ? 4 : 0;

  const t = (f.lead_temperature || "").toLowerCase();
  s += t === "hot" ? 20 : t === "warm" ? 10 : t === "cold" ? 2 : 0;

  return Math.min(100, s);
}

export function tierOf(score: number): "A" | "B" | "C" {
  return score >= 70 ? "A" : score >= 40 ? "B" : "C";
}
