/**
 * POST /api/simulator
 * Proxy server-side para CP /internal/rag — nunca expõe INTERNAL_API_KEY ao browser.
 */
import { NextRequest, NextResponse } from "next/server";

const DOMAIN_TO_AGENT: Record<string, string> = {
  auto:                    "qualification",
  product_rag:             "product",
  logistics_rag:           "logistics",
  objection_rag:           "objection",
  butcher_technical_rag:   "butcher_technical",
  competitor_rag:          "competitor",
  market_pain_rag:         "market_pain",
  lead_qualification_rag:  "qualification",
};

export async function POST(req: NextRequest) {
  const cpUrl  = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) {
    return NextResponse.json({ error: "CP not configured" }, { status: 500 });
  }

  let body: {
    message: string;
    config: {
      segment: string;
      city: string;
      current_etapa: number;
      weekly_volume_kg: number | null;
      current_supplier: string;
      rag_domain: string;
    };
    history?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { message, config, history = [] } = body;
  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const agent = DOMAIN_TO_AGENT[config.rag_domain] ?? "qualification";

  // Build conversation_history string for context
  const historyText = history.length
    ? history.map(t => `${t.role === "user" ? "Lead" : "SDR"}: ${t.content}`).join("\n")
    : undefined;

  const payload = {
    agent,
    message,
    phone:       "simulator",
    company_id:  "00000000-0000-0000-0000-000000000001",
    current_etapa: config.current_etapa,
    conversation_history: historyText,
    lead: {
      segment:          config.segment || null,
      city:             config.city    || null,
      weekly_volume_kg: config.weekly_volume_kg ?? null,
      current_supplier: config.current_supplier || null,
      qual_stage:       config.current_etapa,
    },
  };

  try {
    const start = Date.now();
    const res = await fetch(`${cpUrl}/internal/rag`, {
      method:  "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-internal-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
    const elapsed = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ ...data, _agent: agent, _elapsed_ms: elapsed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "fetch error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
