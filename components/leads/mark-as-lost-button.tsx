"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Labels gravados crus em lost_reason (RPC mark_lead_lost não normaliza).
// perdidos-list reconhece estes mesmos labels para cor/reabordagem.
// DEBT-318 (SDR): +motivos do padrão ENCOSTO (perdido-quente) → dirigem o ângulo de reconquista.
const REASONS = [
  "Preço",
  "Pagamento / prazo",
  "Sabor / produto",
  "Comprou concorrente",
  "Lealdade / incumbente",
  "Logística",
  "Sem orcamento",
  "Sem interesse",
  "Sem retorno",
  "Fora de rota",
  "Outro",
];

// Motivos que quase sempre são ENCOSTO (perdido mas quente): sugerem manter como backup.
const ENCOSTO_SUGERIDO = new Set(["Sabor / produto", "Comprou concorrente", "Lealdade / incumbente", "Pagamento / prazo"]);

export function MarkAsLostButton({ leadId, currentStage }: { leadId: string; currentStage: string | null }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [isEncosto, setIsEncosto] = useState(false);
  const [touchedEncosto, setTouchedEncosto] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  if (currentStage === "lead_perdido") {
    return null;
  }

  // Ao escolher um motivo "quente", sugere encosto (só até o usuário mexer no checkbox).
  function onReasonChange(r: string) {
    setReason(r);
    if (!touchedEncosto) setIsEncosto(ENCOSTO_SUGERIDO.has(r));
  }

  async function handleConfirm() {
    if (!reason) return;
    setSaving(true);
    try {
      await fetch("/api/lead/mark-lost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          reason,
          detail: detail.trim() || null,
          is_encosto: isEncosto,
          next_followup_days: isEncosto ? 45 : null,
        }),
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
        Encerrar Atendimento
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
        Encerrar Atendimento · Diagnóstico Final
      </p>

      <select
        value={reason}
        onChange={e => onReasonChange(e.target.value)}
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

      {/* DEBT-318: manter como ENCOSTO (perdido-quente/backup ativo) */}
      <label style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", padding: "2px 0" }}>
        <input
          type="checkbox"
          checked={isEncosto}
          onChange={e => { setIsEncosto(e.target.checked); setTouchedEncosto(true); }}
          style={{ marginTop: 2, accentColor: "#FF7A45", cursor: "pointer" }}
        />
        <span style={{ fontSize: 11, lineHeight: 1.35, color: "#c9d1d9", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
          <span style={{ color: "#FF7A45", fontWeight: 700 }}>🔥 Manter como encosto</span> — backup ativo. A conta segue viva na cadência e reengaja em <strong>45 dias</strong> (ou quando o concorrente tropeçar). Use quando a amostra foi aprovada e a relação é boa.
        </span>
      </label>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button
          onClick={() => { setOpen(false); setReason(""); setDetail(""); setIsEncosto(false); setTouchedEncosto(false); }}
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
          {saving ? "..." : isEncosto ? "Encerrar · Encosto" : "Encerrar Atendimento"}
        </button>
      </div>
    </div>
  );
}
