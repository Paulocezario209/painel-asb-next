// app/api/pipeline/move/route.ts — P1: move de lead entre etapas do pipeline (drag-drop do Kanban).
// Escreve em PRODUCAO via RPCs de transicao validadas. Auth por routing_team (gestor move qualquer,
// vendedor so os seus). Transicoes com input extra (proposta=valor, perdido=motivo) validadas aqui.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";
import { MOVIVEIS, vendedorPodeMover, ehRetrocesso } from "@/lib/funnel/stages";


export async function POST(req: NextRequest) {
  let body: {
    lead_id?: string; to_stage?: string;
    proposal_value?: number | null; proposal_notes?: string | null;
    reason?: string | null; detail?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { lead_id, to_stage } = body;
  if (!lead_id || !to_stage) {
    return NextResponse.json({ error: "lead_id e to_stage obrigatorios" }, { status: 400 });
  }
  if (!MOVIVEIS.has(to_stage)) {
    return NextResponse.json({ error: `etapa nao-movivel: ${to_stage}` }, { status: 400 });
  }

  const supabase = await createClient();
  const ctx = await getUserContext();
  if (!ctx) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Carrega o lead para autorizacao por routing_team
  const { data: lead, error: errLead } = await supabase
    .from("ai_sdr_leads")
    .select("id, routing_team, funnel_stage, is_test")
    .eq("id", lead_id)
    .single();
  if (errLead || !lead) {
    return NextResponse.json({ error: "lead nao encontrado" }, { status: 404 });
  }
  if (lead.is_test) {
    return NextResponse.json({ error: "lead de teste nao e movivel" }, { status: 400 });
  }
  // AUTH: gestor move qualquer; vendedor so os leads do seu routing_team
  if (!ctx.isGestor && ctx.routing_team !== lead.routing_team) {
    return NextResponse.json({ error: "sem permissao para mover este lead" }, { status: 403 });
  }
  // TRAVA SEQUENCIAL (Paulo 2026-07-17): vendedor move só 1 passo por vez (sem pular/voltar);
  // "perdido" sempre liberado. Gestor move livre (override). Verdade no servidor.
  if (!ctx.isGestor && !vendedorPodeMover(lead.funnel_stage, to_stage)) {
    return NextResponse.json(
      { error: "Trava de etapa: mova um passo por vez, sem pular nem voltar. Só o gestor libera etapas fora de ordem." },
      { status: 403 },
    );
  }

  // RETROCESSO do gestor (Paulo 2026-07-17): as RPCs de avanco sao forward-only (guardam a from-stage),
  // entao arrastar pra tras por elas falha ("Lead deve estar em X. Atual: Y"). O gestor volta pela RPC
  // propria mark_lead_voltar_etapa (gestor-only via auth.uid(), aceita qualquer etapa anterior + grava
  // evento). Vendedor nunca cai aqui — a trava sequencial acima ja barrou. Nada do avanco muda.
  if (ctx.isGestor && ehRetrocesso(lead.funnel_stage, to_stage)) {
    const { data, error: errVoltar } = await supabase.rpc("mark_lead_voltar_etapa", {
      p_lead_id: lead_id, p_to_stage: to_stage, p_actor: ctx.email,
    });
    if (errVoltar) {
      return NextResponse.json({ error: errVoltar.message, rpc: "mark_lead_voltar_etapa" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, lead_id, from: lead.funnel_stage, to: to_stage, ...(data as Record<string, unknown>) });
  }

  // Mapeia to_stage -> RPC + params (mesmas RPCs dos botoes existentes)
  let rpcName: string;
  let params: Record<string, unknown>;
  switch (to_stage) {
    case "lead_em_andamento":
      rpcName = "mark_lead_em_andamento"; params = { p_lead_id: lead_id, p_actor: ctx.email }; break;
    case "negociacao":
      rpcName = "mark_negociacao"; params = { p_lead_id: lead_id, p_actor: ctx.email }; break;
    case "cadastro_cliente":
      // Funil v3 (2026-07-16): SÓ seta a etapa (pré-pedido). NÃO converte — a conversão
      // fica 100% no ARES (trigger set_converted_on_first_order). Substitui a antiga
      // "pedido_teste" (mark_lead_pedido_teste, que convertia na hora — deprecada).
      rpcName = "mark_cadastro_cliente"; params = { p_lead_id: lead_id, p_actor: ctx.email }; break;
    case "pedido_fechado":
      rpcName = "mark_lead_converted"; params = { p_lead_id: lead_id, p_actor: ctx.email }; break;
    case "proposta_enviada":
      // Funil v3 (2026-07-17, Paulo): mover pra Proposta NÃO exige mais valor — a proposta é o
      // formulário 🧾 (orçamento) dentro da coluna. O RPC aceita valor null (DEFAULT NULL).
      rpcName = "mark_proposal_sent";
      params = {
        p_lead_id: lead_id, p_proposal_value: body.proposal_value ?? null,
        p_proposal_notes: body.proposal_notes ?? null, p_actor: ctx.email, p_actor_role: ctx.role,
      };
      break;
    case "lead_perdido":
      if (!body.reason) {
        return NextResponse.json({ error: "perdido exige motivo (reason)" }, { status: 400 });
      }
      rpcName = "mark_lead_lost";
      params = { p_lead_id: lead_id, p_reason: body.reason, p_detail: body.detail ?? null, p_actor: ctx.email };
      break;
    default:
      return NextResponse.json({ error: "etapa invalida" }, { status: 400 });
  }

  const { error: errRpc } = await supabase.rpc(rpcName, params);
  if (errRpc) {
    return NextResponse.json({ error: errRpc.message, rpc: rpcName }, { status: 500 });
  }
  return NextResponse.json({ ok: true, lead_id, from: lead.funnel_stage, to: to_stage });
}
