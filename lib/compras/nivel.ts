// Classificação de nível de custo/kg + cores (server-side, camada Custos 5.3).
import { CUSTO_KG_THR, CUSTO_NIVEL_COR } from "@/lib/compras/custos-thresholds";

export type Thr = { ideal: number; atencao: number; alerta: number };
export const THR_DEFAULT: Thr = { ...CUSTO_KG_THR };
export const COR = { ...CUSTO_NIVEL_COR, projecao: "#e4e9f0" } as const;
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
    return { ideal: f("ideal") ?? CUSTO_KG_THR.ideal, atencao: f("atencao") ?? CUSTO_KG_THR.atencao, alerta: f("alerta") ?? CUSTO_KG_THR.alerta };
  } catch { return THR_DEFAULT; }
}
