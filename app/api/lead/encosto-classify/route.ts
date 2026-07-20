// app/api/lead/encosto-classify/route.ts — porteiro do ENCOSTO (perdido-quente).
// READ-ONLY: pede ao CP a classificação (LLM lê vendor_messages + conversas_sdr) de se o lead
// ENGAJOU e declinou consciente (encosto) ou SUMIU (ghost). INTERNAL_API_KEY só no servidor.
// Doutrina: CADENCIA_INTELIGENTE §11.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const INDEF = { engajamento: "indefinido", sugere_encosto: false, justificativa: "", fonte: "vazio" as const };

export async function POST(req: NextRequest) {
  let body: { lead_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (!body.lead_id) return NextResponse.json({ error: "lead_id obrigatorio" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const cpUrl = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) return NextResponse.json(INDEF); // sem CP → não trava a marcação

  try {
    const res = await fetch(`${cpUrl}/internal/encosto/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-api-key": apiKey },
      body: JSON.stringify({ lead_id: body.lead_id }),
    });
    if (!res.ok) return NextResponse.json(INDEF);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json(INDEF);
  }
}
