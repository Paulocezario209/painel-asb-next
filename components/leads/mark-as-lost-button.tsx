"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Labels gravados crus em lost_reason (RPC mark_lead_lost não normaliza).
// perdidos-list reconhece estes mesmos labels para cor/reabordagem.
const REASONS = [
  "Preço",
  "Sem orcamento",
  "Comprou concorrente",
  "Sem interesse",
  "Sem retorno",
  "Fora de rota",
  "Outro",
];

export function MarkAsLostButton({ leadId, currentStage }: { leadId: string; currentStage: string | null }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  if (currentStage === "lead_perdido") {
    return null;
  }

  async function handleConfirm() {
    if (!reason) return;
    setSaving(true);
    try {
      await fetch("/api/lead/mark-lost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, reason, detail: detail.trim() || null }),
      });
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
          padding: "6px 14px", borderRadius: 4,
          background: "transparent", border: "1px solid rgba(200,16,46,.3)",
          color: "#C8102E", fontSize: 10, letterSpacing: ".10em", textTransform: "uppercase",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif", cursor: "pointer",
        }}
      >
        Marcar Perdido
      </button>
    );
  }

  return (
    <div style={{
      padding: 16, borderRadius: 6,
      background: "#0d1117", border: "1px solid rgba(200,16,46,.3)",
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <p style={{ color: "#C8102E", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: 700 }}>
        Marcar como Perdido
      </p>

      <select
        value={reason}
        onChange={e => setReason(e.target.value)}
        style={{
          padding: "6px 10px", borderRadius: 4,
          background: "#161b22", border: "1px solid #30363d", color: "#c9d1d9",
          fontSize: 11, fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        <option value="">Selecione motivo...</option>
        {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
      </select>

      <textarea
        value={detail}
        onChange={e => setDetail(e.target.value)}
        placeholder="Detalhes adicionais (opcional)..."
        style={{
          minHeight: 50, padding: "6px 10px", borderRadius: 4,
          background: "#161b22", border: "1px solid #30363d", color: "#c9d1d9",
          fontSize: 11, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", resize: "vertical",
        }}
      />

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={() => { setOpen(false); setReason(""); setDetail(""); }}
          style={{
            padding: "5px 12px", borderRadius: 4,
            background: "transparent", border: "1px solid #30363d",
            color: "#8b949e", fontSize: 10, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleConfirm}
          disabled={!reason || saving}
          style={{
            padding: "5px 12px", borderRadius: 4,
            background: saving ? "#30363d" : "#C8102E", border: "none",
            color: "#FFFFFF", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif", cursor: saving ? "wait" : "pointer",
            opacity: !reason ? 0.4 : 1,
          }}
        >
          {saving ? "..." : "Confirmar Perda"}
        </button>
      </div>
    </div>
  );
}
