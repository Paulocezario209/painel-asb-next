// Vocabulário/cores: FONTE ÚNICA em lib/funnel/stages.ts (DEBT-157 fechada).
import { STAGE_LABELS, STAGE_COLORS } from "@/lib/funnel/stages";

// bg 8% / borda 25% derivados da cor semântica (hex + alpha).
const cfgFor = (stage: string | null) => {
  const color = (stage && STAGE_COLORS[stage]) || "#c0d0e0";
  const label = (stage && STAGE_LABELS[stage]) || stage || "?";
  return { label, color, bg: `${color}14`, border: `${color}40` };
};

export function FunnelStageBadge({ stage }: { stage: string | null }) {
  const cfg = cfgFor(stage);
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 3,
      fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
      fontFamily: "'Courier New', monospace", fontWeight: 700,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  );
}
