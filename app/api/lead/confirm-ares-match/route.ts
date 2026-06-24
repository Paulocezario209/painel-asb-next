import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

// MOV.2b write-path: gestor confirma match telefone lead->ares.
// Chama a RPC confirm_lead_ares_match (SECURITY DEFINER, idempotente, FK-safe).
export async function POST(req: NextRequest) {
  const ctx = await getUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.isGestor) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { lead_id, ares_pessoa_id } = await req.json();
  if (!lead_id || ares_pessoa_id == null) {
    return NextResponse.json(
      { error: "lead_id e ares_pessoa_id required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_lead_ares_match", {
    p_lead_id: lead_id,
    p_ares_pessoa_id: ares_pessoa_id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // data = { confirmed: 0|1, lead_id, ares_pessoa_id, error? }
  return NextResponse.json(data);
}
