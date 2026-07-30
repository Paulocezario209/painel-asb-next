// app/api/pipeline/deal-suggestion-event/route.ts — V4 Fase 5 (2026-07-30): fecha o ciclo
// do suggestion_id (Estrategista + Deal Desk). Registra "copiou"/"marcou como enviada" em
// deal_suggestions. Confirmação de envio é EXPLÍCITA (botão no modal) — não inferida de
// vendor_messages (isso exigiria um reconciliador de fuzzy-match, fora do escopo do V4).
//
// Isolamento por equipe: o suggestion_id sozinho não carrega routing_team, então a rota
// busca o lead por trás dele (lead_phone → ai_sdr_leads) e aplica o MESMO gate das outras
// rotas do Deal Desk/Estrategista — sem isso, o ciclo do suggestion_id vazaria o isolamento
// por setor que a Fase 2 acabou de fechar.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";

type EventBody = { suggestion_id?: string; event?: "copied" | "sent"; mensagem_enviada?: string };

export async function POST(req: NextRequest) {
  let body: EventBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { suggestion_id, event, mensagem_enviada } = body;
  if (!suggestion_id || (event !== "copied" && event !== "sent")) {
    return NextResponse.json({ error: "suggestion_id e event (copied|sent) obrigatorios" }, { status: 400 });
  }

  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: rows, error: sugError } = await supabase
    .from("deal_suggestions")
    .select("id, lead_phone, agente, content")
    .eq("id", suggestion_id)
    .limit(1);
  const sugestao = rows?.[0];
  if (sugError || !sugestao) return NextResponse.json({ error: "sugestao nao encontrada" }, { status: 404 });

  const { data: leads, error: leadError } = await supabase
    .from("ai_sdr_leads")
    .select("routing_team")
    .eq("phone", sugestao.lead_phone)
    .limit(1);
  const lead = leads?.[0];
  if (leadError || !lead) return NextResponse.json({ error: "lead nao encontrado" }, { status: 404 });
  if (!ctx.isGestor && ctx.routing_team !== lead.routing_team) {
    return NextResponse.json({ error: "sem permissao para esta sugestao" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (event === "copied") {
    patch.copied_at = new Date().toISOString();
  } else {
    const content = (sugestao.content as Record<string, unknown> | null) ?? {};
    const original = sugestao.agente === "dealdesk" ? content.mensagem : content.mensagem_whatsapp;
    patch.sent_at = new Date().toISOString();
    patch.sent_message = mensagem_enviada ?? null;
    patch.edited = typeof mensagem_enviada === "string" && mensagem_enviada !== original;
  }

  const { error: updateError } = await supabase.from("deal_suggestions").update(patch).eq("id", suggestion_id);
  if (updateError) return NextResponse.json({ error: "falha ao registrar evento" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
