"use client";

// components/ui/sla-badge.tsx — semáforo de SLA compartilhado.
//
// Extraído de components/leads/leads-table.tsx (stageElapsed/StageTimeBadge), que era
// local daquele arquivo. Mesma régua e MESMA animação, agora reutilizável:
//   verde <24h · âmbar 24-72h · vermelho >72h (pulsa)
// Usado pelos alertas da Jornada (Visão Geral) e pela tabela de leads.

export const SLA_COLORS = { green: "#22c55e", amber: "#e0b341", red: "#C8102E", muted: "#6b7280" } as const;

export interface SlaEstado { label: string; color: string; pulse: boolean; horas: number }

/** Tempo decorrido desde `ts` + cor do semáforo. null se a data for inválida/futura. */
export function slaElapsed(ts: string | Date | null, agora: Date = new Date()): SlaEstado | null {
  if (!ts) return null;
  const t = typeof ts === "string" ? new Date(ts).getTime() : ts.getTime();
  const horas = (agora.getTime() - t) / 3600_000;
  if (!isFinite(horas) || horas < 0) return null;
  const d = Math.floor(horas / 24);
  const h = Math.floor(horas % 24);
  const label = d > 0 ? `${d}d ${h}h` : `${h}h`;
  if (horas < 24) return { label, color: SLA_COLORS.green, pulse: false, horas };
  if (horas < 72) return { label, color: SLA_COLORS.amber, pulse: false, horas };
  return { label, color: SLA_COLORS.red, pulse: true, horas };
}

/** Keyframes da pulsação — injetado uma vez por árvore que usa o badge. */
export const SLA_PULSE_CSS =
  "@keyframes asb-pulse-sla{0%,100%{opacity:1}50%{opacity:.45}}.asb-pulse-sla{animation:asb-pulse-sla 1.4s ease-in-out infinite}";

export function SlaBadge({
  ts, agora, title, forcePulse = false, fontSize = 10,
}: {
  ts: string | Date | null;
  agora?: Date;
  title?: string;
  forcePulse?: boolean;   // estado crítico pulsa mesmo abaixo de 72h
  fontSize?: number;
}) {
  const s = slaElapsed(ts, agora);
  if (!s) return <span style={{ color: SLA_COLORS.muted, fontSize }}>—</span>;
  const pulse = s.pulse || forcePulse;
  const color = forcePulse ? SLA_COLORS.red : s.color;
  return (
    <>
      {pulse && <style>{SLA_PULSE_CSS}</style>}
      <span
        className={pulse ? "asb-pulse-sla" : undefined}
        style={{
          display: "inline-block", color, fontSize, fontWeight: 700,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif", whiteSpace: "nowrap",
        }}
        title={title ?? "Tempo decorrido — semáforo SLA"}
      >
        {s.label}
      </span>
    </>
  );
}
