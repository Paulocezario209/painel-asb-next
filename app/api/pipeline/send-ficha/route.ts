// app/api/pipeline/send-ficha/route.ts — Funil v3 Onda 3: envia a ficha de cadastro ao lead
// pela instância Evolution DO VENDEDOR (proxy p/ CP /internal/ficha/send). INTERNAL_API_KEY
// nunca vai ao browser. O texto é montado AQUI (server) com a mesma lib do preview (fonte única)
// → o vendedor envia exatamente o que viu, sem poder injetar texto arbitrário.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";
import { fichaCadastro } from "@/lib/fichas";

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
    .select("id, phone, routing_team, restaurant_name, city, funnel_stage, is_test")
    .eq("id", lead_id)
    .single();
  if (error || !lead) return NextResponse.json({ error: "lead nao encontrado" }, { status: 404 });
  if (lead.is_test) return NextResponse.json({ error: "lead de teste" }, { status: 400 });

  // Trava de etapa: ficha só na etapa Cadastro do Cliente (igual à visibilidade do botão).
  if (lead.funnel_stage !== "cadastro_cliente") {
    return NextResponse.json({ error: "ficha só na etapa Cadastro do Cliente" }, { status: 400 });
  }
  // AUTH: gestor envia qualquer; vendedor só os do seu routing_team.
  if (!ctx.isGestor && ctx.routing_team !== lead.routing_team) {
    return NextResponse.json({ error: "sem permissao para este lead" }, { status: 403 });
  }

  const cpUrl = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) return NextResponse.json({ error: "CP not configured" }, { status: 500 });

  const text = fichaCadastro({ restaurant_name: lead.restaurant_name, city: lead.city });

  const res = await fetch(`${cpUrl}/internal/ficha/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": apiKey },
    body: JSON.stringify({ lead_id, text, actor: ctx.email }),
  });
  if (!res.ok) {
    const t = await res.text();
    return NextResponse.json({ error: t }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
