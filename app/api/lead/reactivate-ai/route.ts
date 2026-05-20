import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

export async function POST(req: NextRequest) {
  const { lead_id } = await req.json();
  if (!lead_id) {
    return NextResponse.json({ error: "lead_id required" }, { status: 400 });
  }

  const ctx = await getUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.isGestor) {
    return NextResponse.json({ error: "somente gestor pode reativar IA" }, { status: 403 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("reactivate_lead_ai", {
    p_lead_id: lead_id,
    p_actor: ctx.email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (data?.already_active) {
    return NextResponse.json(
      { success: false, message: "IA ja esta ativa neste lead" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true, data });
}
