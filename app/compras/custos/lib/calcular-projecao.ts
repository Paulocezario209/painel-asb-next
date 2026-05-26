// Projeção (portado do protótipo): média dos últimos 3 meses + tendência linear simples.
export type MesAgg = { ano_mes: string; kg_total: number; custo_medio_kg: number };
export type Projecao = {
  kgMensalProjetado: number;
  custoKgProjetado: number;
  kgAnualProjetado: number;
  tendencia: "alta" | "baixa" | "estavel";
  baseMeses: number;
};

export function calcularProjecao(mesesAsc: MesAgg[]): Projecao | null {
  const validos = mesesAsc.filter((m) => m.kg_total > 0);
  if (validos.length === 0) return null;
  const ult = validos.slice(-3);
  const mediaKg = ult.reduce((s, m) => s + m.kg_total, 0) / ult.length;
  const mediaCusto = ult.reduce((s, m) => s + m.custo_medio_kg, 0) / ult.length;

  let tendencia: Projecao["tendencia"] = "estavel";
  if (ult.length >= 2) {
    const delta = ult[ult.length - 1].custo_medio_kg - ult[0].custo_medio_kg;
    if (delta > 0.3) tendencia = "alta";
    else if (delta < -0.3) tendencia = "baixa";
  }
  return {
    kgMensalProjetado: Math.round(mediaKg * 100) / 100,
    custoKgProjetado: Math.round(mediaCusto * 100) / 100,
    kgAnualProjetado: Math.round(mediaKg * 12),
    tendencia,
    baseMeses: ult.length,
  };
}
