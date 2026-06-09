"use client";

import { useState } from "react";
import { theme } from "@/lib/theme";

// ETAPA A / FIX4 — timeline de cadência de follow-up por lead.
export type FollowupRow = {
  followup_sequence: number | null;
  phase: string | null;
  angle: string | null;
  message_sent: string | null;
  sent_at: string | null;
  responded: boolean | null;
};

// Cores de ângulo (spec): retomada azul · dor laranja · prova_social verde · valor âmbar · reposicionamento roxo
const ANGLE_COLOR: Record<string, string> = {
  retomada: "#185FA5",
  dor: "#D85A30",
  prova_social: "#22c55e",
  valor: "#D4A017",
  reposicionamento: "#9333ea",
};

const ANGLE_LABEL: Record<string, string> = {
  retomada: "Retomada", dor: "Dor", prova_social: "Prova Social",
  valor: "Valor", reposicionamento: "Reposicionamento",
};

const PHASE_LABEL: Record<string, string> = {
  active: "Active", monthly: "Monthly", semestral: "Semestral", post_active: "Pós-handoff",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function FollowupCadence({ rows }: { rows: FollowupRow[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <p style={{ color: theme.colors.neutral, fontSize: 11, fontFamily: theme.font.mono, fontStyle: "italic" }}>
        Nenhum follow-up enviado ainda
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {rows.map((r, i) => {
        const color = ANGLE_COLOR[r.angle ?? ""] ?? theme.colors.neutral;
        const isOpen = openIdx === i;
        const last = i === rows.length - 1;
        return (
          <div key={i} style={{ display: "flex", gap: 12 }}>
            {/* Trilho vertical + bolinha */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <div style={{ width: 11, height: 11, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, marginTop: 4 }} />
              {!last && <div style={{ width: 2, flex: 1, background: theme.colors.borderDefault, minHeight: 24 }} />}
            </div>

            {/* Conteúdo do item */}
            <div style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                style={{
                  width: "100%", textAlign: "left", background: "transparent", border: "none",
                  cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
                }}
              >
                <span style={{ color: theme.colors.textPrimary, fontSize: 11, fontWeight: 700, fontFamily: theme.font.mono }}>
                  Wave #{r.followup_sequence ?? "?"}
                </span>
                <span style={{ color: theme.colors.neutral, fontSize: 9, fontFamily: theme.font.mono, letterSpacing: ".06em", textTransform: "uppercase" }}>
                  {PHASE_LABEL[r.phase ?? ""] ?? r.phase ?? "—"}
                </span>
                <span style={{
                  display: "inline-block", padding: "1px 7px", borderRadius: 3, fontSize: 9, fontWeight: 700,
                  fontFamily: theme.font.mono, letterSpacing: ".06em", textTransform: "uppercase",
                  color, background: `${color}1a`, border: `1px solid ${color}66`,
                }}>
                  {ANGLE_LABEL[r.angle ?? ""] ?? r.angle ?? "—"}
                </span>
                <span style={{ color: theme.colors.neutral, fontSize: 9, fontFamily: theme.font.mono }}>{fmt(r.sent_at)}</span>
                <span style={{ color: r.responded ? theme.colors.success : theme.colors.critical, fontSize: 11, fontWeight: 700, fontFamily: theme.font.mono }}>
                  {r.responded ? "✓" : "✗"}
                </span>
                <span style={{ marginLeft: "auto", color: theme.colors.neutral, fontSize: 10 }}>{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div style={{ marginTop: 8, background: theme.colors.bgElevated, borderRadius: 4, padding: "10px 12px" }}>
                  {r.message_sent
                    ? <span style={{ color: theme.colors.textPrimary, fontFamily: theme.font.mono, fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{r.message_sent}</span>
                    : <span style={{ color: theme.colors.neutral, fontFamily: theme.font.mono, fontSize: 12, fontStyle: "italic" }}>Mensagem não registrada</span>}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
