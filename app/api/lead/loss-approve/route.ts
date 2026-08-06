// Pipeline V3 Passo 11 (§12.7) — gerente aprova perda solicitada (perda_solicitada -> perdido).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

export async function POST(req: NextRequest) {
  const { lead_id } = await req.json();
  if (!lead_id) {
    return NextResponse.json({ error: "lead_id required" }, { status: 400 });
  }

  const ctx = await getUserContext();
  if (!ctx || !(ctx.isGestor || ctx.isManager || ctx.isGerenteComercial)) {
    return NextResponse.json({ error: "sem permissao para aprovar perdas" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_lead_loss_approved", {
    p_lead_id: lead_id,
    p_actor: ctx.email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (data?.already_lost) {
    return NextResponse.json({ success: false, message: "Lead ja esta perdido" }, { status: 409 });
  }

  return NextResponse.json({ success: true, data });
}
