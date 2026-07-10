// Classificação de custo/kg (client). Thresholds vêm de custos_alerta_config;
// fallback = fonte única lib/compras/custos-thresholds.ts (DEBT-255).
import { CUSTO_KG_THR, CUSTO_NIVEL_COR } from "@/lib/compras/custos-thresholds";

export type Thresholds = { IDEAL: number; ATENCAO: number; ALERTA: number };
export const THRESHOLDS_DEFAULT: Thresholds = { IDEAL: CUSTO_KG_THR.ideal, ATENCAO: CUSTO_KG_THR.atencao, ALERTA: CUSTO_KG_THR.alerta };

export type Status = "ideal" | "atencao" | "alerta" | "critico" | "sem_dados" | "feriado";

export function classificar(custoKg: number | null | undefined, t: Thresholds = THRESHOLDS_DEFAULT): Status {
  if (custoKg == null || custoKg === 0) return "sem_dados";
  if (custoKg <= t.IDEAL) return "ideal";
  if (custoKg <= t.ATENCAO) return "atencao";
  if (custoKg <= t.ALERTA) return "alerta";
  return "critico";
}

export const STATUS_COR: Record<Status, string> = {
  ...CUSTO_NIVEL_COR, sem_dados: "#e4e9f0", feriado: "#1B2A6B",
};
export const STATUS_LABEL: Record<Status, string> = {
  ideal: "IDEAL", atencao: "ATENÇÃO", alerta: "ALERTA",
  critico: "CRÍTICO", sem_dados: "SEM DADOS", feriado: "FERIADO",
};
