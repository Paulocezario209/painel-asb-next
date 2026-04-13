"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, TrendingUp } from "lucide-react";

type Lead = {
  phone: string;
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

  const showConfirm = !!lead.handoff_at && lead.handoff_confirmed === false;
  const showConvert = (lead.qual_stage ?? 0) >= 7 && !lead.first_order_at;

  async function confirmHandoff() {
    setLoading("confirm");
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase
      .from("ai_sdr_leads")
      .update({ handoff_confirmed: true, handoff_confirmed_at: now })
      .eq("phone", lead.phone);
    setLead((l) => ({ ...l, handoff_confirmed: true, handoff_confirmed_at: now }));
    setLoading(null);
    router.refresh();
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
        <Button
          className="w-full gap-2 justify-start"
          variant="outline"
          disabled={loading === "confirm"}
          onClick={confirmHandoff}
        >
          <CheckCircle className="w-4 h-4 text-orange-600" />
          {loading === "confirm" ? "Confirmando..." : "Confirmar atendimento"}
        </Button>
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
