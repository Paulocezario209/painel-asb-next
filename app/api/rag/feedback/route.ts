// Server-side proxy — INTERNAL_API_KEY nunca é exposta ao browser.
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone, request_id, rag_domain, feedback, response_preview } = body;

  if (!phone || !request_id || !rag_domain || !feedback) {
    return NextResponse.json({ error: "phone, request_id, rag_domain e feedback são obrigatórios" }, { status: 400 });
  }

  const cpUrl = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) {
    return NextResponse.json({ error: "CP not configured" }, { status: 500 });
  }

  const res = await fetch(`${cpUrl}/internal/rag/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": apiKey },
    body: JSON.stringify({ phone, request_id, rag_domain, feedback, response_preview }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
