"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReactivateAiButton({
  leadId,
  aiActive,
  humanActive,
  funnelStage,
}: {
  leadId: string;
  aiActive: boolean | null;
  humanActive: boolean | null;
  funnelStage: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Visivel apenas se IA esta desligada (lead em handoff humano)
  // e nao esta em estado terminal
  const TERMINAL = ["pedido_fechado", "cliente_ativo", "cliente_recorrente", "lead_perdido"];
  const visible =
    aiActive === false &&
    humanActive === true &&
    funnelStage !== null &&
    !TERMINAL.includes(funnelStage);

  if (!visible) return null;

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/lead/reactivate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Erro ao reativar IA");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "6px 14px",
          borderRadius: 4,
          background: "transparent",
          border: "1px solid rgba(186,117,23,.4)",
          color: "#ba7517",
          fontSize: 10,
          letterSpacing: ".10em",
          textTransform: "uppercase" as const,
          fontFamily: "'Courier New', monospace",
          cursor: "pointer",
        }}
      >
        Reativar IA
      </button>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 6,
        background: "#0d1117",
        border: "1px solid rgba(186,117,23,.4)",
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
      }}
    >
      <p
        style={{
          color: "#ba7517",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase" as const,
          fontFamily: "'Courier New', monospace",
          fontWeight: 700,
        }}
      >
        Reativar IA neste lead?
      </p>
      <p
        style={{
          color: "#8b949e",
          fontSize: 11,
          fontFamily: "'Courier New', monospace",
          lineHeight: 1.5,
        }}
      >
        A IA volta a responder mensagens deste lead. Vendedor sai do atendimento.
        Acao auditada em events table.
      </p>

      {error && (
        <p
          style={{
            color: "#f85149",
            fontSize: 10,
            fontFamily: "'Courier New', monospace",
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          style={{
            padding: "5px 12px",
            borderRadius: 4,
            background: "transparent",
            border: "1px solid #30363d",
            color: "#8b949e",
            fontSize: 10,
            fontFamily: "'Courier New', monospace",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving}
          style={{
            padding: "5px 12px",
            borderRadius: 4,
            background: saving ? "#30363d" : "#ba7517",
            border: "none",
            color: "#FFFFFF",
            fontSize: 10,
            letterSpacing: ".08em",
            textTransform: "uppercase" as const,
            fontFamily: "'Courier New', monospace",
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "..." : "Reativar"}
        </button>
      </div>
    </div>
  );
}
