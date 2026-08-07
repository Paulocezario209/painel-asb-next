// POST /api/jornada/alertas/registrar-contato — registro MANUAL de ação comercial.
//
// Fallback obrigatório (Paulo, 2026-08-05) para os casos em que a detecção automática
// por vendor_messages não alcança: cliente sem telefone, telefone ambíguo, sem match
// ARES×Evolution, ou contato por ligação/visita/canal não monitorado.
//
// AUDITÁVEL: grava quem, quando, canal, observação e próxima ação. NUNCA é disparado
// por abrir/visualizar a tela — exige POST explícito com corpo.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserContext } from "@/lib/auth/get-user-role";

export const dynamic = "force-dynamic";

const CANAIS = new Set(["ligacao", "visita", "whatsapp_pessoal", "email", "outro"]);

export async function POST(req: Request) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  // Vendedor, manager e gestor registram; perfis não-comerciais não.
  if (!["gestor", "manager", "vendedor"].includes(ctx.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { alerta_id?: string; canal?: string; observacao?: string; proxima_acao?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "json inválido" }, { status: 400 }); }

  const { alerta_id, canal, observacao, proxima_acao } = body;
  if (!alerta_id) return NextResponse.json({ ok: false, error: "alerta_id obrigatório" }, { status: 400 });
  if (!canal || !CANAIS.has(canal)) {
    return NextResponse.json({ ok: false, error: `canal inválido (use: ${[...CANAIS].join(", ")})` }, { status: 400 });
  }
  if (!observacao || observacao.trim().length < 3) {
    return NextResponse.json({ ok: false, error: "observação obrigatória (mín. 3 caracteres)" }, { status: 400 });
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  // Carrega o alerta para checar escopo e janela antes de gravar.
  const { data: alerta, error: e1 } = await sb.from("jornada_alertas")
    .select("id, estado, vence_em, critico_em, acao_em, routing_team_no_venc")
    .eq("id", alerta_id).maybeSingle();
  if (e1 || !alerta) return NextResponse.json({ ok: false, error: "alerta não encontrado" }, { status: 404 });

  // PERMISSÃO no servidor: vendedor só registra no próprio setor.
  if (ctx.role === "vendedor" && alerta.routing_team_no_venc !== ctx.routing_team) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  if (alerta.estado === "convertido" || alerta.estado === "dispensado") {
    return NextResponse.json({ ok: false, error: "alerta já encerrado" }, { status: 409 });
  }
  if (alerta.acao_em) {
    // Idempotente: não sobrescreve a primeira evidência.
    return NextResponse.json({ ok: true, jaRegistrado: true, acao_em: alerta.acao_em });
  }

  const agora = new Date();
  // A ação só impede a escalada se cair DENTRO da janela de 24h após o vencimento.
  // Fora dela o registro é gravado (histórico) mas não desfaz o crítico.
  const dentroDaJanela =
    agora >= new Date(alerta.vence_em) && agora <= new Date(alerta.critico_em);

  const { error: e2 } = await sb.from("jornada_alertas").update({
    acao_tipo: "manual",
    acao_em: agora.toISOString(),
    acao_usuario: ctx.email,
    acao_canal: canal,
    acao_observacao: observacao.trim().slice(0, 500),
    acao_proxima: proxima_acao?.trim().slice(0, 300) ?? null,
    ...(dentroDaJanela ? { estado: "acao_registrada" } : {}),
  }).eq("id", alerta_id);
  if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });

  return NextResponse.json({
    ok: true, alerta_id, registrado_em: agora.toISOString(),
    dentro_da_janela: dentroDaJanela,
    estado: dentroDaJanela ? "acao_registrada" : alerta.estado,
  });
}
