// lib/pricing.ts — FONTE ÚNICA do preço médio por kg usado nas ESTIMATIVAS do painel.
//
// Antes: R$25 no Pipeline e R$35 em Perdidos/Vendedores — mesmo lead "valia" 40% a
// mais dependendo da tela. Padronizado em 2026-07-10 com os preços REAIS de campanha
// informados por Paulo:
//   · Blend moído ................. R$ 35,90/kg
//   · Steak burger modelado ....... R$ 37,90/kg
//   · Smash ....................... R$ 37,90/kg
// Estimativa usa o PISO (conservador — estimativa de pipeline nunca infla).
// Campanha mudou de preço? Ajustar SÓ aqui.

export const PRECO_CAMPANHA = {
  blend_moido: 35.9,
  steak_modelado: 37.9,
  smash: 37.9,
} as const;

// R$/kg das estimativas (Pipeline "Valor estimado" · Perdidos "Pipeline Perdido" ·
// Vendedores "Total em Pipeline") — piso conservador da campanha.
export const PRECO_KG = 35.9;
