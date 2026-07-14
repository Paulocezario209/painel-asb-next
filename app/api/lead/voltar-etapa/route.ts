// app/api/lead/voltar-etapa/route.ts — item 9: gestor volta um lead a etapa ANTERIOR (com registro).
// Segurança real = a RPC mark_lead_voltar_etapa (gate gestor via auth.uid()/JWT + guard "só volta"
// + grava funnel_stage_events). Aqui: gate isGestor (UX/defesa) + repassa o email como actor.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

export async function POST(req: NextRequest) {
  let body: { lead_id?: string; to_stage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { lead_id, to_stage } = body;
  if (!lead_id || !to_stage) {
    return NextResponse.json({ error: "lead_id e to_stage obrigatorios" }, { status: 400 });
  }

  const ctx = await getUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!ctx.isGestor) {
    return NextResponse.json({ error: "apenas gestor pode voltar etapa" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_lead_voltar_etapa", {
    p_lead_id: lead_id,
    p_to_stage: to_stage,
    p_actor: ctx.email,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
