// app/api/pipeline/send-orcamento/route.ts — Funil v3 Onda 4b: envia a FICHA DE ORÇAMENTO ao lead
// pela instância Evolution DO VENDEDOR (proxy p/ CP /internal/ficha/send, source="orcamento").
// INTERNAL_API_KEY nunca vai ao browser. O texto é montado AQUI (server) com a mesma lib do
// preview (fonte única `fichaOrcamento`) → o servidor só emite o TEMPLATE estruturado a partir
// dos itens; o vendedor não injeta texto livre. Preço é 100% manual (nunca sai do ARES).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";
import { fichaOrcamento, type OrcamentoItem } from "@/lib/fichas";

// Sanitiza um item vindo do browser → só os campos do template, tipados. Descarta o resto.
function limpaItem(raw: unknown): OrcamentoItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const nome = typeof r.nome === "string" ? r.nome.trim().slice(0, 120) : "";
  if (!nome) return null;
  const num = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
    return isFinite(n) && n >= 0 ? n : null;
  };
  return {
    nome,
    gramatura_g: num(r.gramatura_g),
    unidades_caixa: num(r.unidades_caixa),
    peso_kg: num(r.peso_kg),
    valor_unitario: num(r.valor_unitario),
    valor_caixa: num(r.valor_caixa),
  };
}

export async function POST(req: NextRequest) {
  let body: { lead_id?: string; itens?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const { lead_id, itens: itensRaw } = body;
  if (!lead_id) return NextResponse.json({ error: "lead_id obrigatorio" }, { status: 400 });

  const itens = (Array.isArray(itensRaw) ? itensRaw : []).map(limpaItem).filter(Boolean) as OrcamentoItem[];
  if (itens.length === 0) return NextResponse.json({ error: "adicione ao menos 1 produto" }, { status: 400 });
  if (itens.length > 20) return NextResponse.json({ error: "máximo 20 produtos" }, { status: 400 });
  // Preço é obrigatório pra enviar (o resto o vendedor pode deixar em branco).
  if (itens.some((it) => it.valor_unitario == null && it.valor_caixa == null))
    return NextResponse.json({ error: "cada produto precisa de valor unitário ou da caixa" }, { status: 400 });

  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: lead, error } = await supabase
    .from("ai_sdr_leads")
    .select("id, phone, routing_team, restaurant_name, funnel_stage, is_test")
    .eq("id", lead_id)
    .single();
  if (error || !lead) return NextResponse.json({ error: "lead nao encontrado" }, { status: 404 });
  if (lead.is_test) return NextResponse.json({ error: "lead de teste" }, { status: 400 });

  // Trava de etapa: orçamento só na etapa Proposta (igual à visibilidade do botão).
  // Negociação = vendedor absorve as infos; Proposta = envia a proposta/orçamento ao lead.
  if (lead.funnel_stage !== "proposta_enviada") {
    return NextResponse.json({ error: "orçamento só na etapa Proposta" }, { status: 400 });
  }
  // AUTH: gestor envia qualquer; vendedor só os do seu routing_team.
  if (!ctx.isGestor && ctx.routing_team !== lead.routing_team) {
    return NextResponse.json({ error: "sem permissao para este lead" }, { status: 403 });
  }

  const cpUrl = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) return NextResponse.json({ error: "CP not configured" }, { status: 500 });

  const text = fichaOrcamento(itens);

  const res = await fetch(`${cpUrl}/internal/ficha/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": apiKey },
    body: JSON.stringify({ lead_id, text, actor: ctx.email, source: "orcamento" }),
  });
  if (!res.ok) {
    const t = await res.text();
    return NextResponse.json({ error: t }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
