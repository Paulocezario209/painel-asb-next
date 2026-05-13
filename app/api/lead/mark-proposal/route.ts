import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

export async function POST(req: NextRequest) {
  const { lead_id, proposal_value, proposal_notes } = await req.json();
  if (!lead_id) {
    return NextResponse.json({ error: "lead_id required" }, { status: 400 });
  }

  const ctx = await getUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Auth: gestor OR vendedor proprietario (routing_team match)
  if (!ctx.isGestor) {
    const { data: lead } = await supabase
      .from("ai_sdr_leads")
      .select("routing_team")
      .eq("id", lead_id)
      .single();

    if (!lead || !ctx.isVendedor || lead.routing_team !== ctx.routing_team) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const actorRole = ctx.isGestor ? "gestor" : "vendedor";

  const { data, error } = await supabase.rpc("mark_proposal_sent", {
    p_lead_id: lead_id,
    p_proposal_value: proposal_value ?? null,
    p_proposal_notes: proposal_notes ?? null,
    p_actor: ctx.email,
    p_actor_role: actorRole,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data?.already_sent) {
    return NextResponse.json(
      { success: false, message: "Proposta ja marcada como enviada" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, data });
}
