import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { lead_id, content } = await req.json();
  if (!lead_id || !content) {
    return NextResponse.json({ error: "lead_id and content required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const author = user.email ?? "unknown";

  const { error } = await supabase.from("events").insert({
    lead_id,
    event_type: "note_added",
    payload: { author, content },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
