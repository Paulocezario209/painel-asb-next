// Pipeline V3 Passo 11 (§12.7) — fila de aprovação de perda do Gerente Comercial.
// Lista leads em funnel_stage='perda_solicitada' com o contexto necessário pra decidir
// (etapa de origem, quem/quando solicitou, motivo, última comunicação, contexto extraído
// da conversa) — Paulo: "auditar o estado do perdido pela etapa e se houve comunicação".
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

export async function GET() {
  const ctx = await getUserContext();
  if (!ctx || !(ctx.isGestor || ctx.isManager || ctx.isGerenteComercial)) {
    return NextResponse.json({ error: "sem permissao" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_sdr_leads")
    .select(
      "id, phone, restaurant_name, name, city, segment, weekly_volume_kg, qual_stage, " +
      "routing_team, loss_from_stage, loss_requested_at, loss_requested_by, " +
      "lost_reason, lost_reason_detail, is_encosto, customer_exit_reason, " +
      "last_reply_at, followup_phase, contexto_extraido, first_order_at"
    )
    .eq("funnel_stage", "perda_solicitada")
    .eq("is_test", false)
    .order("loss_requested_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data ?? [] });
}
