// Server-side route — INTERNAL_API_KEY nunca é exposta ao browser.
// O client-side chama POST /api/handoff/confirm; este módulo proxeia para o CP.
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { phone } = await req.json();
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const cpUrl = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) {
    return NextResponse.json({ error: "CP not configured" }, { status: 500 });
  }

  const res = await fetch(`${cpUrl}/internal/handoff/confirm`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": apiKey },
    body: JSON.stringify({ phone }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
