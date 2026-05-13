import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

export async function POST(req: NextRequest) {
  const { lead_id, routing_team, motivo } = await req.json();
  if (!lead_id || !routing_team) {
    return NextResponse.json({ error: "lead_id and routing_team required" }, { status: 400 });
  }

  const ctx = await getUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.isGestor) {
    return NextResponse.json({ error: "somente gestor pode reatribuir vendedor" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("reassign_lead_vendor", {
    p_lead_id: lead_id,
    p_new_routing_team: routing_team,
    p_motivo: motivo || null,
    p_actor: ctx.email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data?.reason === "no_change") {
    return NextResponse.json(
      { success: false, message: "Lead ja esta neste vendedor" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, data });
}
