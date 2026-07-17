// app/api/pipeline/orcamento-sugestao/route.ts — Onda 4b Fase B: pede ao CP a sugestão de
// produtos do orçamento (IA lê a conversa da negociação). READ-ONLY — não envia nada.
// Mesma autorização do envio (setor + etapa Proposta); INTERNAL_API_KEY só no servidor.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

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
  if (lead.is_test) return NextResponse.json({ itens: [], fonte: "vazio" });
  if (lead.funnel_stage !== "proposta_enviada") return NextResponse.json({ itens: [], fonte: "vazio" });
  if (!ctx.isGestor && ctx.routing_team !== lead.routing_team) {
    return NextResponse.json({ error: "sem permissao para este lead" }, { status: 403 });
  }

  const cpUrl = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) return NextResponse.json({ itens: [], fonte: "vazio" });

  try {
    const res = await fetch(`${cpUrl}/internal/orcamento/sugestao`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-api-key": apiKey },
      body: JSON.stringify({ lead_id }),
    });
    if (!res.ok) return NextResponse.json({ itens: [], fonte: "vazio" });
    return NextResponse.json(await res.json());
  } catch {
    // sugestão nunca derruba o modal
    return NextResponse.json({ itens: [], fonte: "vazio" });
  }
}
