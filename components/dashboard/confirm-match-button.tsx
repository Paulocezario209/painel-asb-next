"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const mono = "'Courier New', monospace";

// Botão "Confirmar match" — grava ares_pessoa_id via /api/lead/confirm-ares-match.
// Ao confirmar, router.refresh() re-renderiza o server component e a linha some
// (a view v_lead_ares_pendentes filtra ares_pessoa_id IS NULL).
export function ConfirmMatchButton({
  leadId,
  aresPessoaId,
}: {
  leadId: string;
  aresPessoaId: number;
}) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function handle() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/lead/confirm-ares-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, ares_pessoa_id: aresPessoaId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? "erro");
        setSaving(false);
        return;
      }
      if (data?.confirmed === 0) {
        setErr(data?.error === "ares_pessoa_id_inexistente" ? "id inválido" : "já ligado");
        setSaving(false);
        return;
      }
      router.refresh();
    } catch {
      setErr("falha de conexão");
      setSaving(false);
    }
  }

  if (err) {
    return (
      <span style={{ color: "#f0a04b", fontSize: 10, fontFamily: mono }}>{err}</span>
    );
  }

  return (
    <button
      onClick={handle}
      disabled={saving}
      style={{
        padding: "5px 12px",
        borderRadius: 4,
        background: "transparent",
        border: "1px solid rgba(46,160,67,.4)",
        color: "#2ea043",
        fontSize: 10,
        letterSpacing: ".08em",
        textTransform: "uppercase",
        fontFamily: mono,
        cursor: saving ? "not-allowed" : "pointer",
        opacity: saving ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {saving ? "..." : "Confirmar match"}
    </button>
  );
}
