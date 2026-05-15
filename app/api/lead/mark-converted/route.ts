import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { phone } = await req.json();
  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const author = user.email ?? "unknown";

  // Buscar lead_id por phone
  const { data: lead, error: errLead } = await supabase
    .from("ai_sdr_leads")
    .select("id")
    .eq("phone", phone)
    .single();

  if (errLead || !lead) {
    return NextResponse.json({ error: "lead not found" }, { status: 404 });
  }

  // RPC atomica com SECURITY DEFINER (bypassa RLS, faz UPDATE + 2 INSERTs em transacao)
  const { data, error: errRpc } = await supabase.rpc("mark_lead_converted", {
    p_lead_id: lead.id,
    p_actor: author || "painel",
  });

  if (errRpc) {
    return NextResponse.json({ error: errRpc.message }, { status: 500 });
  }

  if (data?.already_converted) {
    return NextResponse.json({
      success: true,
      message: "already converted",
      first_order_at: data.first_order_at,
    });
  }

  return NextResponse.json({
    success: true,
    first_order_at: data.first_order_at,
    previous_stage: data.previous_stage,
    lead_id: data.lead_id,
  });
}
