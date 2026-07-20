import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  // DEBT-318 (SDR): encerramento com diagnóstico + ENCOSTO (perdido-quente/backup).
  // is_encosto → o RPC v3 mantém followup_eligible=true (alcançável pela LONGA) e
  // agenda o reengajamento (default 45d no RPC, ou next_followup_days informado aqui).
  const { lead_id, reason, detail, is_encosto, next_followup_days } = await req.json();
  if (!lead_id || !reason) {
    return NextResponse.json({ error: "lead_id and reason required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const author = user.email ?? "unknown";

  const { data, error } = await supabase.rpc("mark_lead_lost", {
    p_lead_id: lead_id,
    p_reason: reason,
    p_detail: detail || null,
    p_actor: author,
    p_is_encosto: is_encosto === true,
    p_next_followup_days: typeof next_followup_days === "number" ? next_followup_days : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data?.already_lost) {
    return NextResponse.json(
      { success: false, message: "Lead ja esta marcado como perdido" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, data });
}
