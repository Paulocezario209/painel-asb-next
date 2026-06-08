"use client";

// ETAPA 4 — badge de Lead Score. A=success · B=warning · C=neutral. Formato "A · 87".
import { theme } from "@/lib/theme";

export function LeadScoreBadge({ score, tier, size = "sm" }: { score: number; tier: "A" | "B" | "C"; size?: "sm" | "md" }) {
  const color = tier === "A" ? theme.colors.success : tier === "B" ? theme.colors.warning : theme.colors.neutral;
  const fontSize = size === "md" ? 12 : 10;
  const padding = size === "md" ? "4px 10px" : "2px 6px";
  return (
    <span style={{
      display: "inline-block",
      background: `${color}22`,
      color,
      border: `1px solid ${color}`,
      borderRadius: 4,
      fontSize,
      padding,
      fontFamily: theme.font.mono,
      fontWeight: 700,
      whiteSpace: "nowrap",
      letterSpacing: ".05em",
    }}>
      {tier} · {score}
    </span>
  );
}
