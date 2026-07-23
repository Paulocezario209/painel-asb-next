// Prova de RUNTIME do guard de sessao, com @supabase/ssr mockado (getUser -> sem usuario),
// sem tocar a rede. Roda em processo isolado (o test runner do Node separa por arquivo),
// entao o mock nao contamina os demais testes. Se o runtime nao suportar module mocking
// (--experimental-test-module-mocks), o teste se auto-pula com mensagem — nunca quebra a CI.
import test, { mock } from "node:test";
import assert from "node:assert/strict";

test("proxy(): sem sessao -> /api/* responde 401 e pagina protegida redireciona /login", async (t) => {
  // envs presentes para passar do early-return e chegar no client (mockado)
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fake-anon-key";

  try {
    mock.module("@supabase/ssr", {
      namedExports: {
        createServerClient: () => ({
          auth: { getUser: async () => ({ data: { user: null } }) },
          from: () => ({
            select: () => ({ eq: () => ({ single: async () => ({ data: null }) }) }),
          }),
        }),
      },
    });
  } catch (err) {
    t.skip(
      `module mocking indisponivel neste runtime (use --experimental-test-module-mocks): ${
        (err as Error).message
      }`,
    );
    return;
  }

  const { proxy } = await import("../proxy");
  const { NextRequest } = await import("next/server");

  // outra /api/* sem sessao -> 401 (comportamento inalterado)
  const apiRes = await proxy(new NextRequest(new URL("https://painel.test/api/orders")));
  assert.equal(apiRes.status, 401);

  // pagina protegida sem sessao -> redirect /login (comportamento inalterado)
  const pageRes = await proxy(new NextRequest(new URL("https://painel.test/dashboard")));
  assert.ok([302, 307].includes(pageRes.status), `esperado redirect, veio ${pageRes.status}`);
  assert.match(pageRes.headers.get("location") ?? "", /\/login$/);
});
