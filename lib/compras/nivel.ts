// Classificação de nível de custo/kg + cores (server-side, camada Custos 5.3).
export type Thr = { ideal: number; atencao: number; alerta: number };
export const THR_DEFAULT: Thr = { ideal: 18, atencao: 19, alerta: 20 };
export const COR = { ideal: "#22C55E", atencao: "#EAB308", alerta: "#F97316", critico: "#EF4444", projecao: "#556677" } as const;
export type Nivel = keyof typeof COR;

export function nivelDe(custoKg: number | null | undefined, t: Thr = THR_DEFAULT): { nivel: Nivel; cor: string; label: string } {
  if (custoKg == null || custoKg <= 0) return { nivel: "projecao", cor: COR.projecao, label: "—" };
  if (custoKg <= t.ideal) return { nivel: "ideal", cor: COR.ideal, label: "IDEAL" };
  if (custoKg <= t.atencao) return { nivel: "atencao", cor: COR.atencao, label: "ATENÇÃO" };
  if (custoKg <= t.alerta) return { nivel: "alerta", cor: COR.alerta, label: "ALERTA" };
  return { nivel: "critico", cor: COR.critico, label: "CRÍTICO" };
}

// lê thresholds de custos_alerta_config (fallback default)
export async function thrFromConfig(sb: { from: (t: string) => { select: (c: string) => Promise<{ data: { nivel: string; valor_max: number }[] | null }> } }): Promise<Thr> {
  try {
    const { data } = await sb.from("custos_alerta_config").select("nivel,valor_max");
    if (!data) return THR_DEFAULT;
    const f = (n: string) => data.find((x) => x.nivel === n)?.valor_max;
    return { ideal: f("ideal") ?? 18, atencao: f("atencao") ?? 19, alerta: f("alerta") ?? 20 };
  } catch { return THR_DEFAULT; }
}
