"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// Fonte única da taxonomia de motivo + sugestão de encosto (ficha E pipeline).
import { LOST_REASONS as REASONS, ENCOSTO_SUGERIDO } from "@/lib/funnel/stages";

export function MarkAsLostButton({ leadId, currentStage }: { leadId: string; currentStage: string | null }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [isEncosto, setIsEncosto] = useState(false);
  const [touchedEncosto, setTouchedEncosto] = useState(false);
  const [verdict, setVerdict] = useState<{ engajamento: string; justificativa: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  if (currentStage === "lead_perdido") {
    return null;
  }

  // Porteiro: pergunta ao LLM se o lead engajou+declinou (encosto) ou sumiu (ghost).
  async function runCheck() {
    setChecking(true); setVerdict(null);
    try {
      const r = await fetch("/api/lead/encosto-classify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const j = await r.json();
      setVerdict({ engajamento: j.engajamento ?? "indefinido", justificativa: j.justificativa ?? "" });
    } catch { setVerdict(null); } finally { setChecking(false); }
  }

  function setEncosto(v: boolean, touched = true) {
    setIsEncosto(v); if (touched) setTouchedEncosto(true);
    if (v) runCheck(); else setVerdict(null);
  }

  // Ao escolher um motivo "quente", sugere encosto (só até o usuário mexer no checkbox).
  function onReasonChange(r: string) {
    setReason(r);
    if (!touchedEncosto) setEncosto(ENCOSTO_SUGERIDO.has(r), false);
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
          onChange={e => setEncosto(e.target.checked)}
          style={{ marginTop: 2, accentColor: "#FF7A45", cursor: "pointer" }}
        />
        <span style={{ fontSize: 11, lineHeight: 1.35, color: "#c9d1d9", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
          <span style={{ color: "#FF7A45", fontWeight: 700 }}>🔥 Manter como encosto</span> — backup ativo. A conta segue viva na cadência e reengaja em <strong>45 dias</strong> (ou quando o concorrente tropeçar). Use quando a amostra foi aprovada e a relação é boa.
        </span>
      </label>

      {/* Veredito do porteiro (LLM leu a conversa) */}
      {isEncosto && (checking ? (
        <p style={{ fontSize: 10.5, color: "#8b949e", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", margin: "-6px 0 6px 24px" }}>analisando a conversa…</p>
      ) : verdict && verdict.engajamento === "silencio" ? (
        <p style={{ fontSize: 10.5, color: "#f59e0b", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", margin: "-6px 0 6px 24px", lineHeight: 1.4 }}>
          ⚠ Esse lead parece ter <strong>sumido</strong> (não declinou) — encosto é pra quem respondeu e disse não. {verdict.justificativa} Marcar mesmo assim?
        </p>
      ) : verdict && verdict.engajamento === "consciente" ? (
        <p style={{ fontSize: 10.5, color: "#22c55e", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", margin: "-6px 0 6px 24px", lineHeight: 1.4 }}>
          ✓ Engajou e declinou — encosto confere. {verdict.justificativa}
        </p>
      ) : null)}

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
