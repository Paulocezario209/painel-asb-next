"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2 } from "lucide-react";
import { STAGE_ORDER, aliasLegacy, stageLabel } from "@/lib/funnel/stages";

// Item 9: "Voltar etapa" — só gestor, com registro (funnel_stage_events via RPC).
// Só aparece se houver etapa anterior. O avanço é só por drag no pipeline; aqui só volta.
export function VoltarEtapaButton({ leadId, currentStage }: { leadId: string; currentStage: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [saving, setSaving] = useState(false);

  const norm = aliasLegacy(currentStage);
  const idx = norm ? (STAGE_ORDER as readonly string[]).indexOf(norm) : -1;
  const anteriores = idx > 0 ? (STAGE_ORDER as readonly string[]).slice(0, idx) : [];

  if (anteriores.length === 0) return null;   // nada pra voltar (etapa inicial ou fora do trilho)

  async function voltar() {
    if (!target || saving) return;
    setErr(""); setSaving(true);
    try {
      const res = await fetch("/api/lead/voltar-etapa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, to_stage: target }),
      });
      const j = await res.json();
      if (!res.ok) { setErr(j.error ?? "erro ao voltar etapa"); return; }
      setOpen(false); setTarget("");
      start(() => router.refresh());
    } catch {
      setErr("falha de rede");
    } finally {
      setSaving(false);
    }
  }

  const C = { border: "#2a2a2a", bg: "#080b14", text: "#FFFFFF", muted: "#c0d0e0", amber: "#f59e0b", red: "#C8102E" };
  const MONO: React.CSSProperties = { fontFamily: "var(--font-geist-sans), system-ui, sans-serif" };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 3,
          border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer",
          fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", ...MONO,
        }}
        title="Voltar o lead a uma etapa anterior (só gestor, fica registrado na timeline)"
      >
        <Undo2 style={{ width: 12, height: 12 }} /> Voltar etapa
      </button>
    );
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <select
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        style={{
          background: C.bg, border: `1px solid ${C.border}`, borderRadius: 3, color: C.text,
          fontSize: 11, padding: "5px 8px", ...MONO, outline: "none",
        }}
      >
        <option value="">voltar para…</option>
        {anteriores.map((s) => (
          <option key={s} value={s}>{stageLabel(s)}</option>
        ))}
      </select>
      <button
        onClick={voltar}
        disabled={!target || saving}
        style={{
          padding: "5px 12px", borderRadius: 3, border: `1px solid ${C.amber}`,
          background: "rgba(245,158,11,.12)", color: C.amber,
          cursor: !target || saving ? "not-allowed" : "pointer", opacity: !target ? 0.5 : 1,
          fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", ...MONO,
        }}
      >
        {saving ? "…" : "Confirmar"}
      </button>
      <button
        onClick={() => { setOpen(false); setTarget(""); setErr(""); }}
        style={{ padding: "5px 10px", borderRadius: 3, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, cursor: "pointer", fontSize: 10, ...MONO }}
      >
        cancelar
      </button>
      {err && <span style={{ color: C.red, fontSize: 10, ...MONO }}>{err}</span>}
    </div>
  );
}
