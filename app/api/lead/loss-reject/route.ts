// Pipeline V3 Passo 11 (§12.7) — gerente rejeita perda solicitada, escolhe etapa de retorno.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

export async function POST(req: NextRequest) {
  const { lead_id, return_stage, rejection_reason } = await req.json();
  if (!lead_id || !return_stage || !rejection_reason) {
    return NextResponse.json({ error: "lead_id, return_stage and rejection_reason required" }, { status: 400 });
  }

  const ctx = await getUserContext();
  if (!ctx || !(ctx.isGestor || ctx.isManager || ctx.isGerenteComercial)) {
    return NextResponse.json({ error: "sem permissao para rejeitar perdas" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_lead_loss_rejected", {
    p_lead_id: lead_id,
    p_return_stage: return_stage,
    p_rejection_reason: rejection_reason,
    p_actor: ctx.email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
