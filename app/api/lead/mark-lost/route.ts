import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { lead_id, reason, detail } = await req.json();
  if (!lead_id || !reason) {
    return NextResponse.json({ error: "lead_id and reason required" }, { status: 400 });
  }

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const author = user.email ?? "unknown";

  // 1. Get current funnel_stage
  const { data: lead } = await supabase
    .from("ai_sdr_leads")
    .select("funnel_stage")
    .eq("id", lead_id)
    .single();

  const fromStage = lead?.funnel_stage ?? "unknown";

  // 2. Update lead
  const { error: updateErr } = await supabase
    .from("ai_sdr_leads")
    .update({
      lost_reason: reason,
      lost_reason_detail: detail || null,
      lost_at: now,
      funnel_stage: "lead_perdido",
      lead_status: "lost",
    })
    .eq("id", lead_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 3. Insert funnel_stage_events
  const { error: fseErr } = await supabase.from("funnel_stage_events").insert({
    lead_id,
    from_stage: fromStage,
    to_stage: "lead_perdido",
    actor: author,
    metadata: { reason, detail: detail || null },
  });
  if (fseErr) {
    console.error("[mark-lost] funnel_stage_events insert failed:", fseErr.message);
  }

  // 4. Insert events
  const { error: evErr } = await supabase.from("events").insert({
    lead_id,
    event_type: "lead_lost",
    payload: { reason, detail: detail || null, from_stage: fromStage, actor: author },
  });
  if (evErr) {
    console.error("[mark-lost] events insert failed:", evErr.message);
  }

  return NextResponse.json({ ok: true });
}
