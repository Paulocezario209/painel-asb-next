// app/api/compras/mercado/chat/route.ts — Lupa de inteligência de mercado (F5).
// Route Handler de streaming: Claude (claude-opus-4-8) + web_search server-side.
// Lê ANTHROPIC_API_KEY do ambiente (server-only). Stream NDJSON: {type:"text"|"search"|"thinking"|"done"|"error"}.
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // web search + análise pode levar alguns segundos

type Cotacao = { proteina: string; valor: number; unidade: string; variacao_pct: number | null };

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY ausente no servidor." }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }

  let body: { question?: string; cotacoes?: Cotacao[] };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question) {
    return new Response(JSON.stringify({ error: "pergunta vazia" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey });

  const cotStr =
    Array.isArray(body.cotacoes) && body.cotacoes.length
      ? body.cotacoes
          .map((c) => `${c.proteina}: R$ ${c.valor} ${c.unidade} (var ${c.variacao_pct ?? 0}%)`)
          .join("; ")
      : "sem cotações disponíveis no painel";

  const system = `Você é analista de mercado de proteínas da ASB (American Steak Brasil), food service B2B de hambúrguer premium. Ajuda o time de compras a decidir o TIMING de compra de boi, suíno e frango.
Use a ferramenta de busca na web para dados ATUAIS quando a pergunta depender deles: preço CEPEA / arroba do boi gordo, suíno, frango, notícias de oferta/demanda, câmbio, exportação, clima que afete o preço.
Responda em português brasileiro, objetivo e acionável (sinalize COMPRAR / AGUARDAR / EVITAR quando fizer sentido). Cite as fontes que a busca trouxer. NÃO invente números — se a busca não trouxer um dado, diga claramente.
Cotações atuais no painel ASB (indicador CEPEA): ${cotStr}.`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
      try {
        // Loop de continuação para o tool-loop server-side (pause_turn).
        for (let turn = 0; turn < 6; turn++) {
          const s = client.messages.stream({
            model: "claude-opus-4-8",
            max_tokens: 6000,
            thinking: { type: "adaptive" },
            system,
            // web_search é tool server-side; dynamic filtering automático no Opus 4.8.
            tools: [{ type: "web_search_20260209", name: "web_search" } as never],
            messages,
          });

          for await (const event of s) {
            if (event.type === "content_block_start") {
              const t = (event.content_block as { type?: string }).type;
              if (t === "server_tool_use") send({ type: "search" });
              else if (t === "thinking") send({ type: "thinking" });
            } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              send({ type: "text", text: event.delta.text });
            }
          }

          const final = await s.finalMessage();
          if (final.stop_reason === "pause_turn") {
            // Retoma o loop server-side de web search reenviando o turno do assistente.
            messages.push({ role: "assistant", content: final.content });
            continue;
          }
          break;
        }
        send({ type: "done" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: "error", error: msg.slice(0, 300) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
