import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { lead_id, reason, detail } = await req.json();
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
