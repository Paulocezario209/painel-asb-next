"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const VENDOR_OPTIONS = [
  { value: "SETOR_SOROCABA_SAO_PAULO", label: "Ana Paula" },
  { value: "SETOR_CAMPINAS_JUNDIAI", label: "Alan" },
  { value: "SETOR_CUIT", label: "Paulo / CUIT" },
  { value: "UNROUTABLE", label: "Fora de area (sem cobertura)" },
];

export function ReassignVendorButton({
  leadId,
  currentTeam,
}: {
  leadId: string;
  currentTeam: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const options = VENDOR_OPTIONS.filter((o) => o.value !== currentTeam);

  async function handleConfirm() {
    if (!team) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/lead/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          routing_team: team,
          motivo: motivo.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || data.message || "Erro ao reatribuir");
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
          border: "1px solid rgba(88,166,255,.3)",
          color: "#58a6ff",
          fontSize: 10,
          letterSpacing: ".10em",
          textTransform: "uppercase" as const,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          cursor: "pointer",
        }}
      >
        Trocar Vendedor
      </button>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 6,
        background: "#0d1117",
        border: "1px solid rgba(88,166,255,.3)",
        display: "flex",
        flexDirection: "column" as const,
        gap: 12,
      }}
    >
      <p
        style={{
          color: "#58a6ff",
          fontSize: 10,
          letterSpacing: ".12em",
          textTransform: "uppercase" as const,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontWeight: 700,
        }}
      >
        Reatribuir Vendedor
      </p>

      <select
        value={team}
        onChange={(e) => setTeam(e.target.value)}
        style={{
          padding: "6px 10px",
          borderRadius: 4,
          background: "#161b22",
          border: "1px solid #30363d",
          color: "#c9d1d9",
          fontSize: 11,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        <option value="">Selecione vendedor...</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <textarea
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo da reatribuicao (opcional)..."
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
            setTeam("");
            setMotivo("");
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
          disabled={!team || saving}
          style={{
            padding: "5px 12px",
            borderRadius: 4,
            background: saving ? "#30363d" : "#1f6feb",
            border: "none",
            color: "#FFFFFF",
            fontSize: 10,
            letterSpacing: ".08em",
            textTransform: "uppercase" as const,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            cursor: saving ? "wait" : "pointer",
            opacity: !team ? 0.4 : 1,
          }}
        >
          {saving ? "..." : "Confirmar"}
        </button>
      </div>
    </div>
  );
}
