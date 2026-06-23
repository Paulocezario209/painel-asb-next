// Helper centralizado de ORIGEM do lead (badge na camada Funil).
// Fonte: ai_sdr_leads.origem_canal (+ origem_utm_source p/ desambiguar; origem_utm_campaign/ad_id p/ tooltip).
// Valores reais hoje: organico 240 · instagram 63 (=Meta) · lp 9 · indicacao 1 · utm_source meta_ads 63.
// 'google' ainda NÃO carimbado (entra depois via n8n) — já mapeado aqui pra quando chegar.

export type OrigemKey = "google" | "meta" | "organico" | "indicacao" | "lp" | "direto";
export type OrigemCfg = { key: OrigemKey; label: string; color: string; bg: string; border: string };

// {label, cor} por origem — ponto único de manutenção.
export const ORIGEM_CFG: Record<OrigemKey, OrigemCfg> = {
  google:    { key: "google",    label: "Google Ads",   color: "#4285F4", bg: "rgba(66,133,244,.12)",  border: "rgba(66,133,244,.45)" },
  meta:      { key: "meta",      label: "Meta",         color: "#C13584", bg: "rgba(193,53,132,.12)",  border: "rgba(193,53,132,.45)" },
  organico:  { key: "organico",  label: "Orgânico",     color: "#22c55e", bg: "rgba(34,197,94,.1)",    border: "rgba(34,197,94,.35)" },
  indicacao: { key: "indicacao", label: "Indicação",    color: "#D4A017", bg: "rgba(212,160,23,.12)",  border: "rgba(212,160,23,.45)" },
  lp:        { key: "lp",        label: "Landing Page", color: "#185FA5", bg: "rgba(24,95,165,.14)",   border: "rgba(24,95,165,.5)" },
  direto:    { key: "direto",    label: "Direto",       color: "#8899aa", bg: "rgba(136,153,170,.08)", border: "rgba(136,153,170,.25)" },
};

export type LeadOrigem = {
  origem_canal?: string | null;
  origem_utm_source?: string | null;
  origem_utm_campaign?: string | null;
  ad_id?: string | null;
};

// origem_canal → cfg. utm_source desambigua (meta_ads/google). Null/desconhecido → "Direto".
export function resolveOrigem(l: LeadOrigem): OrigemCfg {
  const canal = (l.origem_canal ?? "").toLowerCase().trim();
  const src = (l.origem_utm_source ?? "").toLowerCase().trim();
  if (canal === "google" || src === "google" || src === "google_ads") return ORIGEM_CFG.google;
  if (["instagram", "meta", "facebook"].includes(canal) || src === "meta_ads" || src === "meta") return ORIGEM_CFG.meta;
  if (canal === "indicacao") return ORIGEM_CFG.indicacao;
  if (canal === "lp" || canal === "lp_site") return ORIGEM_CFG.lp;
  if (canal === "organico") return ORIGEM_CFG.organico;
  return ORIGEM_CFG.direto;
}

// detalhe p/ tooltip (campanha / ad_id quando houver)
export function origemDetalhe(l: LeadOrigem): string | null {
  const parts: string[] = [];
  if (l.origem_utm_campaign) parts.push(`camp: ${l.origem_utm_campaign}`);
  if (l.ad_id) parts.push(`ad: ${l.ad_id}`);
  return parts.length ? parts.join(" · ") : null;
}

// chips do filtro de origem na camada Funil (ordem fixa)
export const ORIGEM_FILTER_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "origem: todas" },
  { key: "google", label: "Google" },
  { key: "meta", label: "Meta" },
  { key: "organico", label: "Orgânico" },
  { key: "indicacao", label: "Indicação" },
  { key: "lp", label: "LP" },
];
