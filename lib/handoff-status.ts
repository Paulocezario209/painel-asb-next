// Situação de um agendamento (handoff) — ANCORADA no scheduled_at.
// Regra (DEBT-308): um agendamento só "vence" DEPOIS do horário agendado, não pelo
// tempo desde a criação. Agendado pro futuro = no prazo (nunca vermelho/piscando).
// Fonte ÚNICA para o card (KPI "Vencidos") e a coluna SITUAÇÃO da tabela.

export type HandoffSituacao = {
  kind: "agendado" | "no_horario" | "atrasado" | "vencido" | "sem_agenda";
  label: string;
  color: string;
  bg: string;
  border: string;
  pulse: boolean;
  overdue: boolean; // conta como "vencido" no KPI e no filtro
};

const C = {
  blue:  { color: "#8bb4ff", bg: "rgba(139,180,255,.1)", border: "rgba(139,180,255,.35)" },
  amber: { color: "#f59e0b", bg: "rgba(245,158,11,.1)",  border: "rgba(245,158,11,.35)" },
  red:   { color: "#C8102E", bg: "rgba(200,16,46,.1)",   border: "rgba(200,16,46,.4)" },
  green: { color: "#22c55e", bg: "rgba(34,197,94,.1)",   border: "rgba(34,197,94,.35)" },
};

function fmtDur(mins: number): string {
  const m = Math.abs(mins);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return `${h}h${r ? ` ${r}min` : ""}`;
  const d = Math.floor(h / 24), rh = h % 24;
  return `${d}d${rh ? ` ${rh}h` : ""}`;
}

// GRACE: até 30min após o horário agendado ainda é "no horário" (mesma tolerância
// do L1 de escalonamento — scheduled_at + 30min).
const GRACE_MIN = 30;
const LATE_MIN = 180; // depois disso vira "vencido" (vermelho + pulsa)

export function handoffSituacao(
  scheduledAt: string | null,
  handoffAt: string,
  nowMs: number = Date.now(),
): HandoffSituacao {
  if (scheduledAt) {
    const delta = Math.floor((nowMs - new Date(scheduledAt).getTime()) / 60000); // <0 = futuro
    if (delta < 0)         return { kind: "agendado",   label: "Agendado",  ...C.blue,  pulse: false, overdue: false };
    if (delta < GRACE_MIN) return { kind: "no_horario", label: "No horário", ...C.amber, pulse: false, overdue: false };
    if (delta < LATE_MIN)  return { kind: "atrasado",   label: `Atrasado ${fmtDur(delta)}`, ...C.red, pulse: false, overdue: true };
    return { kind: "vencido", label: `Vencido ${fmtDur(delta)}`, ...C.red, pulse: true, overdue: true };
  }
  // Legado sem agenda: SLA por tempo desde o handoff (fallback da regra antiga).
  const mins = Math.floor((nowMs - new Date(handoffAt).getTime()) / 60000);
  if (mins < 60)  return { kind: "sem_agenda", label: fmtDur(mins), ...C.green, pulse: false, overdue: false };
  if (mins < 240) return { kind: "sem_agenda", label: fmtDur(mins), ...C.amber, pulse: false, overdue: false };
  return { kind: "sem_agenda", label: `${fmtDur(mins)} · sem agenda`, ...C.red, pulse: true, overdue: true };
}
