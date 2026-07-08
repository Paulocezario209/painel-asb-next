// Server-side route — INTERNAL_API_KEY nunca é exposta ao browser.
// Estrategista do vendedor (asb-deal-strategies, Fase A): proxeia para o CP
// POST /internal/deal/suggest, que gera diagnóstico/estratégia/mensagem por
// lead×etapa do pipeline. O vendedor COPIA a mensagem (envio 1-clique = Fase B).
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { phone, stage } = await req.json();
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const cpUrl = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) {
    return NextResponse.json({ error: "CP not configured" }, { status: 500 });
  }

  const res = await fetch(`${cpUrl}/internal/deal/suggest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": apiKey },
    body: JSON.stringify({ phone, stage: stage ?? null }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
