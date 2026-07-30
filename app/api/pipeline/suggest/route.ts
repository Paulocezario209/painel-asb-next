// Server-side route — INTERNAL_API_KEY nunca é exposta ao browser.
// Estrategista do vendedor (asb-deal-strategies, Fase A): proxeia para o CP
// POST /internal/deal/suggest, que gera diagnóstico/estratégia/mensagem por
// lead×etapa do pipeline. O vendedor COPIA a mensagem (envio 1-clique = Fase B).
// V4 (2026-07-30, Fase 2): mesmos gates do Deal Desk (deal-desk/route.ts) — sessão
// autenticada, lead válido, bloqueio de lead de teste, etapa permitida, isolamento por
// routing_team. Antes desta mudança a rota não checava NENHUM desses pontos.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";
import { PIPELINE_STAGES } from "@/lib/funnel/stages";

export async function POST(req: NextRequest) {
  let body: { phone?: string; stage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { phone, stage } = body;
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  // Etapa permitida: valida contra a FONTE ÚNICA do vocabulário de funnel_stage
  // (lib/funnel/stages.ts, fechou o DEBT-157) — não contra o _STAGE_FOCO do CP, que é mais
  // estreito (só as etapas com texto dedicado) e quebraria o Estrategista em Cadastro do
  // Cliente/Pedido Fechado/Perdidos, onde o botão 💡 já funciona hoje sem restrição de etapa.
  if (stage && !(PIPELINE_STAGES as readonly string[]).includes(stage)) {
    return NextResponse.json({ error: "etapa invalida" }, { status: 400 });
  }

  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: leads, error } = await supabase
    .from("ai_sdr_leads")
    .select("id, routing_team, funnel_stage, is_test")
    .eq("phone", phone)
    .limit(1);
  const lead = leads?.[0];
  if (error || !lead) return NextResponse.json({ error: "lead nao encontrado" }, { status: 404 });
  if (lead.is_test) return NextResponse.json({ error: "lead de teste" }, { status: 403 });
  if (!ctx.isGestor && ctx.routing_team !== lead.routing_team) {
    return NextResponse.json({ error: "sem permissao para este lead" }, { status: 403 });
  }

  const cpUrl = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) {
    return NextResponse.json({ error: "CP not configured" }, { status: 500 });
  }

  const res = await fetch(`${cpUrl}/internal/deal/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": apiKey },
    body: JSON.stringify({ phone, stage: stage ?? null, actor_email: ctx.email }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
