// /api/version — padrao do control-plane: expoe SOMENTE o SHA do build ({"sha":...})
// para provar o que esta no ar. Rota PUBLICA por excecao no middleware (proxy.ts isenta
// o path exato /api/version): sem auth, sem sessao, sem banco, sem cookie, sem segredo.
// Metodos: apenas GET e HEAD; qualquer outro -> 405 automatico do App Router (nao ha handler).
// Cache-Control: no-store para o verify-deploy nunca receber um SHA antigo por cache.
export const dynamic = "force-dynamic";

function buildVersionResponse(withBody: boolean): Response {
  const sha = process.env.GIT_SHA ?? "unknown";
  const body = withBody ? JSON.stringify({ sha }) : null;
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    },
  });
}

export function GET(): Response {
  return buildVersionResponse(true);
}

export function HEAD(): Response {
  return buildVersionResponse(false);
}
