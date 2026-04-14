"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, TrendingUp } from "lucide-react";

type Lead = {
  phone: string;
  human_active: boolean | null;
  handoff_at: string | null;
  handoff_confirmed: boolean | null;
  handoff_confirmed_at: string | null;
  first_order_at: string | null;
  qual_stage: number | null;
};

export function LeadActions({ lead: initial }: { lead: Lead }) {
  const router = useRouter();
  const [lead, setLead] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Botão visível apenas quando vendedor está ativo e handoff ainda não foi confirmado
  const showConfirm = lead.human_active === true && lead.handoff_confirmed === false;
  const showConvert = (lead.qual_stage ?? 0) >= 7 && !lead.first_order_at;

  async function confirmHandoff() {
    setLoading("confirm");
    setConfirmError(null);
    try {
      const res = await fetch("/api/handoff/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: lead.phone }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        setConfirmError(err.error ?? "Falha ao confirmar");
        return;
      }
      setLead((l) => ({ ...l, handoff_confirmed: true }));
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function convertLead() {
    setLoading("convert");
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase
      .from("ai_sdr_leads")
      .update({ first_order_at: now })
      .eq("phone", lead.phone);
    setLead((l) => ({ ...l, first_order_at: now }));
    setLoading(null);
    router.refresh();
  }

  if (!showConfirm && !showConvert) {
    return <p className="text-sm text-gray-400">Nenhuma ação disponível.</p>;
  }

  return (
    <div className="space-y-2">
      {showConfirm && (
        <>
          <Button
            className="w-full gap-2 justify-start"
            variant="outline"
            disabled={loading === "confirm"}
            onClick={confirmHandoff}
          >
            <CheckCircle className="w-4 h-4 text-green-500" />
            {loading === "confirm" ? "Confirmando..." : "Confirmar Contato"}
          </Button>
          {confirmError && (
            <p style={{ fontSize: 10, color: "#f85149", fontFamily: "'Courier New', monospace" }}>
              {confirmError}
            </p>
          )}
        </>
      )}
      {lead.handoff_confirmed && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 4,
          background: "rgba(63,185,80,.1)", border: "1px solid rgba(63,185,80,.3)",
          fontSize: 10, letterSpacing: ".10em", textTransform: "uppercase",
          fontFamily: "'Courier New', monospace", color: "#3fb950",
        }}>
          <CheckCircle size={12} /> Contato Confirmado
        </div>
      )}
      {showConvert && (
        <Button
          className="w-full gap-2 justify-start"
          variant="outline"
          disabled={loading === "convert"}
          onClick={convertLead}
        >
          <TrendingUp className="w-4 h-4 text-yellow-600" />
          {loading === "convert" ? "Marcando..." : "Marcar como convertido"}
        </Button>
      )}
    </div>
  );
}
