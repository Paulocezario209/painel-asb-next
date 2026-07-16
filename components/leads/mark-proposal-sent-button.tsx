"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const VALID_STAGES = ["vendedor_assumiu", "diagnostico_comercial"];

export function MarkProposalSentButton({
  leadId,
  currentStage,
}: {
  leadId: string;
  currentStage: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!currentStage || !VALID_STAGES.includes(currentStage)) return null;

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/lead/mark-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          proposal_value: value ? parseFloat(value) : null,
          proposal_notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Erro ao marcar proposta");
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
          border: "1px solid rgba(63,185,80,.3)",
          color: "#3fb950",
          fontSize: 10,
          letterSpacing: ".10em",
          textTransform: "uppercase" as const,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        Marcar Proposta Enviada
      </button>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 6,
        background: "#0d1117",
        border: "1px solid rgba(63,185,80,.3)",
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
      }}
    >
      <p
        style={{
          color: "#3fb950",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase" as const,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontWeight: 700,
        }}
      >
        Marcar Proposta Enviada
      </p>

      <div>
        <label
          style={{
            fontSize: 9,
            letterSpacing: ".14em",
            textTransform: "uppercase" as const,
            color: "#8b949e",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Valor da proposta (R$) — opcional
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0.00"
          style={{
            width: "100%",
            marginTop: 4,
            padding: "6px 10px",
            borderRadius: 4,
            background: "#161b22",
            border: "1px solid #30363d",
            color: "#c9d1d9",
            fontSize: 11,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        />
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas sobre a proposta (opcional)..."
        style={{
          minHeight: 50,
          padding: "6px 10px",
          borderRadius: 4,
          background: "#161b22",
          border: "1px solid #30363d",
          color: "#c9d1d9",
          fontSize: 11,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          resize: "vertical" as const,
        }}
      />

      {error && (
        <p
          style={{
            color: "#f85149",
            fontSize: 10,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={() => {
            setOpen(false);
            setValue("");
            setNotes("");
            setError(null);
          }}
          style={{
            padding: "5px 12px",
            borderRadius: 4,
            background: "transparent",
            border: "1px solid #30363d",
            color: "#8b949e",
            fontSize: 10,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
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
            background: saving ? "#30363d" : "#238636",
            border: "none",
            color: "#FFFFFF",
            fontSize: 10,
            letterSpacing: ".08em",
            textTransform: "uppercase" as const,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "..." : "Confirmar Proposta"}
        </button>
      </div>
    </div>
  );
}
