// Classificação de custo/kg (portado do protótipo). Thresholds vêm de custos_alerta_config (fallback hardcode).
export type Thresholds = { IDEAL: number; ATENCAO: number; ALERTA: number };
export const THRESHOLDS_DEFAULT: Thresholds = { IDEAL: 18, ATENCAO: 19, ALERTA: 20 };

export type Status = "ideal" | "atencao" | "alerta" | "critico" | "sem_dados" | "feriado";

export function classificar(custoKg: number | null | undefined, t: Thresholds = THRESHOLDS_DEFAULT): Status {
  if (custoKg == null || custoKg === 0) return "sem_dados";
  if (custoKg <= t.IDEAL) return "ideal";
  if (custoKg <= t.ATENCAO) return "atencao";
  if (custoKg <= t.ALERTA) return "alerta";
  return "critico";
}

export const STATUS_COR: Record<Status, string> = {
  ideal: "#22C55E", atencao: "#EAB308", alerta: "#F97316",
  critico: "#EF4444", sem_dados: "#e4e9f0", feriado: "#1B2A6B",
};
export const STATUS_LABEL: Record<Status, string> = {
  ideal: "IDEAL", atencao: "ATENÇÃO", alerta: "ALERTA",
  critico: "CRÍTICO", sem_dados: "SEM DADOS", feriado: "FERIADO",
};
