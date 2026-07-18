// app/api/pipeline/deal-desk/route.ts — Setor Negociação · agente Deal Desk (Voss).
// READ-ONLY: pede ao CP a virada da objeção (IA lê a conversa real). Não envia nada ao lead.
// Autorização por setor + etapa (negociação/proposta); INTERNAL_API_KEY só no servidor.
// Dark launch: CP responde {fonte:"off"} enquanto DEAL_DESK_LIVE=false.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

const OFF = { fonte: "vazio" as const };

export async function POST(req: NextRequest) {
  let body: { lead_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { lead_id } = body;
  if (!lead_id) return NextResponse.json({ error: "lead_id obrigatorio" }, { status: 400 });

  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("ai_sdr_leads")
    .select("id, routing_team, funnel_stage, is_test")
    .eq("id", lead_id)
    .single();
  if (error || !lead) return NextResponse.json({ error: "lead nao encontrado" }, { status: 404 });
  if (lead.is_test) return NextResponse.json(OFF);
  // Deal Desk atua na negociação (e vale também na proposta, onde a objeção reaparece)
  if (lead.funnel_stage !== "negociacao" && lead.funnel_stage !== "proposta_enviada") return NextResponse.json(OFF);
  if (!ctx.isGestor && ctx.routing_team !== lead.routing_team) {
    return NextResponse.json({ error: "sem permissao para este lead" }, { status: 403 });
  }

  const cpUrl = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) return NextResponse.json(OFF);

  try {
    const res = await fetch(`${cpUrl}/internal/deal-desk/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-api-key": apiKey },
      body: JSON.stringify({ lead_id }),
    });
    if (!res.ok) return NextResponse.json(OFF);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(OFF); // o agente nunca derruba o painel
  }
}
