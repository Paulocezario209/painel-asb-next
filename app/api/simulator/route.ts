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

// ── Fake history — simulates lead answers for etapas already completed ─────────
// Index 0 = etapa 1, index 1 = etapa 2, etc.
interface EtapaTurn {
  sdr:    string;
  lead:   (c: SimConfig) => string;
}

interface SimConfig {
  segment:          string;
  city:             string;
  current_etapa:    number;
  weekly_volume_kg: number | null;
  current_supplier: string;
  rag_domain:       string;
}

const ETAPA_TURNS: EtapaTurn[] = [
  // etapa 1 — nome / cidade / segmento
  {
    sdr:  "Olá! Pode me informar o nome do estabelecimento, cidade onde fica e o segmento de atuação?",
    lead: c => {
      const parts: string[] = [];
      if (c.city)    parts.push(c.city);
      if (c.segment) parts.push(c.segment);
      return parts.length ? `Fica em ${parts.join(", ")}` : "Meu estabelecimento, cidade não informada";
    },
  },
  // etapa 2 — tipo de produto
  {
    sdr:  "Que tipo de produto você trabalha hoje? Hambúrguer artesanal, smash, frango, algo diferente?",
    lead: c => {
      if (c.segment === "hamburgueria")  return "Hambúrguer artesanal e smash principalmente";
      if (c.segment === "restaurante")   return "Hambúrguer no cardápio e proteínas grelhadas";
      if (c.segment === "steak_house")   return "Steak e cortes nobres, hambúrguer premium";
      if (c.segment === "bar")           return "Hambúrguer artesanal como petisco principal";
      if (c.segment === "churrascaria")  return "Hambúrguer e cortes bovinos";
      if (c.segment === "distribuidor")  return "Revendo hambúrguer para food service em geral";
      if (c.segment === "delivery")      return "Hambúrguer para delivery e dark kitchen";
      return "Hambúrguer e proteínas em geral";
    },
  },
  // etapa 3 — blend / tipo de carne
  {
    sdr:  "Você tem preferência por algum blend específico? Trabalha com Angus, Nelore, Wagyu?",
    lead: () => "Uso Angus com Nelore hoje, mas estou aberto a conhecer outras opções",
  },
  // etapa 4 — sistema refrigerado / congelado
  {
    sdr:  "Você trabalha com produto refrigerado, congelado, ou os dois?",
    lead: () => "Congelado por enquanto, mas tenho interesse no refrigerado se a logística funcionar",
  },
  // etapa 5 — volume semanal
  {
    sdr:  "Qual o volume aproximado que você consome por semana em hambúrgueres ou proteínas?",
    lead: c => c.weekly_volume_kg
      ? `Estou usando em torno de ${c.weekly_volume_kg} kg por semana`
      : "Algo em torno de 80 a 100 kg por semana",
  },
  // etapa 6 — fornecedor atual
  {
    sdr:  "Quem é seu fornecedor atual? Açougue local, frigorífico, distribuidor?",
    lead: c => {
      const map: Record<string, string> = {
        acougue_local: "Compro de um açougue aqui da cidade mesmo",
        frigorifico:   "Tenho contato direto com um frigorífico da região",
        distribuidor:  "Trabalho com um distribuidor que passa aqui toda semana",
        outro:         "Tenho um fornecedor mas não estou completamente satisfeito",
      };
      return c.current_supplier
        ? (map[c.current_supplier] ?? "Tenho fornecedor mas quero conhecer alternativas")
        : "Tenho fornecedor mas quero ver o que vocês oferecem";
    },
  },
  // etapa 7 — dor / problema principal
  {
    sdr:  "Qual é a sua maior dificuldade hoje com o produto? Consistência, prazo de entrega, preço?",
    lead: () => "Consistência do produto às vezes varia e o prazo de entrega falha em datas de pico",
  },
  // etapa 8 — contexto de preço / orçamento
  {
    sdr:  "Você já tem uma noção do quanto investe em hambúrgueres por mês?",
    lead: () => "Tenho uma noção sim, mas quero entender melhor o custo-benefício antes de fechar qualquer coisa",
  },
];

function buildFakeHistory(config: SimConfig): Array<{ role: "user" | "assistant"; content: string }> {
  const turns: Array<{ role: "user" | "assistant"; content: string }> = [];
  // Generate turns for etapas 1 … current_etapa-1
  const limit = Math.min(config.current_etapa - 1, ETAPA_TURNS.length);
  for (let i = 0; i < limit; i++) {
    const t = ETAPA_TURNS[i];
    turns.push({ role: "assistant", content: t.sdr });
    turns.push({ role: "user",      content: t.lead(config) });
  }
  return turns;
}

export async function POST(req: NextRequest) {
  const cpUrl  = process.env.CP_INTERNAL_URL;
  const apiKey = process.env.INTERNAL_API_KEY;
  if (!cpUrl || !apiKey) {
    return NextResponse.json({ error: "CP not configured" }, { status: 500 });
  }

  let body: {
    message: string;
    config: SimConfig;
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

  // Profile turn — key=value format mirrors the exact field names the CP extraction
  // layer looks for, making GPT-4o-mini extraction deterministic regardless of
  // the current message content.
  const profileKV: string[] = [];
  if (config.city)             profileKV.push(`city=${config.city}`);
  if (config.segment)          profileKV.push(`segment=${config.segment}`);
  if (config.weekly_volume_kg) profileKV.push(`weekly_volume_kg=${config.weekly_volume_kg}`);
  if (config.current_supplier) profileKV.push(`current_supplier=${config.current_supplier}`);
  // "SDR: ... \n Lead: ..." — looks like a real exchange to the extraction GPT call
  const profileTurnLines = profileKV.length
    ? `SDR: Confirme os dados do seu estabelecimento.\nLead: ${profileKV.join("; ")}.`
    : "";

  // Build full conversation context:
  // 1. Profile turn — config fields always present as Lead: line
  // 2. Fake history — synthetic SDR/lead turns simulating completed etapas
  // 3. Real session history — actual back-and-forth from this simulation session
  const fakeHistory  = buildFakeHistory(config);
  const allTurns     = [...fakeHistory, ...history];
  const historyLines = allTurns.length
    ? allTurns.map(t => `${t.role === "user" ? "Lead" : "SDR"}: ${t.content}`).join("\n")
    : "";
  // Bridge: if both profile turn and session history are present, insert an SDR
  // acknowledgment line to break consecutive Lead: turns.
  // Two consecutive Lead: lines (profile Lead + first session Lead) caused
  // non-deterministic entity extraction in GPT-4o-mini.
  const parts: string[] = [];
  if (profileTurnLines) parts.push(profileTurnLines);
  if (historyLines) {
    if (profileTurnLines) parts.push("SDR: Certo, seus dados foram registrados.");
    parts.push(historyLines);
  }
  const conversationHistory = parts.length ? parts.join("\n") : undefined;

  const payload = {
    agent,
    message,
    phone:                "simulator",
    company_id:           "00000000-0000-0000-0000-000000000001",
    current_etapa:        config.current_etapa,
    conversation_history: conversationHistory,
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
