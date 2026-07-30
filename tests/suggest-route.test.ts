// V4 Fase 2/6 (2026-07-30): prova os gates novos de app/api/pipeline/suggest/route.ts
// (Estrategista) — sem sessão, lead de teste, etapa inválida, equipe errada, gestor
// bypassa. Mocka @/lib/auth/get-user-role e @/lib/supabase/server UMA VEZ (hook before —
// este projeto roda .test.ts como CJS via tsx, que não aceita top-level await; e node:test
// roda os testes de um arquivo no MESMO processo, então remockar por teste deixaria a
// rota presa no binding do 1º mock). Cada teste muda o `state` mutável antes de chamar POST.
import test, { before } from "node:test";
import assert from "node:assert/strict";
import { makeFakeSupabase } from "./fakeSupabase";

const state: { ctx: unknown; tables: Record<string, unknown[]> } = { ctx: null, tables: {} };
let POST: any;
let NextRequest: any;
let mockUnavailable: string | null = null;

before(async () => {
  try {
    const { mock } = await import("node:test");
    mock.module("@/lib/auth/get-user-role", { namedExports: { getUserContext: async () => state.ctx } });
    mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => makeFakeSupabase(state.tables) } });
    ({ POST } = await import("../app/api/pipeline/suggest/route"));
    ({ NextRequest } = await import("next/server"));
  } catch (err) {
    mockUnavailable = `module mocking indisponivel (--experimental-test-module-mocks): ${(err as Error).message}`;
  }
});

const LEAD = { id: "lead-1", routing_team: "SETOR_SOROCABA_SAO_PAULO", funnel_stage: "negociacao", is_test: false };

function ctxOf(overrides: Record<string, unknown> = {}) {
  return {
    email: "vendedor@asb.com", role: "vendedor", routing_team: "SETOR_SOROCABA_SAO_PAULO",
    comissaoPerfil: null, isGestor: false, isManager: false, isVendedor: true,
    isTecnicoCompras: false, isFinanceiro: false, isDiretor: false, isGerente: false,
    ...overrides,
  };
}

function req(body: Record<string, unknown>) {
  return new NextRequest("https://painel.test/api/pipeline/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("sem sessao -> 401", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = null;
  state.tables = { ai_sdr_leads: [LEAD] };
  const res = await POST(req({ phone: "5511999990001" }));
  assert.equal(res.status, 401);
});

test("etapa invalida -> 400", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf();
  state.tables = { ai_sdr_leads: [LEAD] };
  const res = await POST(req({ phone: "5511999990001", stage: "etapa_que_nao_existe" }));
  assert.equal(res.status, 400);
});

test("lead de teste -> bloqueado", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf();
  state.tables = { ai_sdr_leads: [{ ...LEAD, is_test: true }] };
  const res = await POST(req({ phone: "5511999990001" }));
  assert.equal(res.status, 403);
});

test("equipe errada -> 403", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf({ routing_team: "SETOR_CAMPINAS_JUNDIAI" });
  state.tables = { ai_sdr_leads: [LEAD] };
  const res = await POST(req({ phone: "5511999990001" }));
  assert.equal(res.status, 403);
});

test("gestor bypassa a checagem de equipe (nao e 403)", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  process.env.CP_INTERNAL_URL = "https://cp.test";
  process.env.INTERNAL_API_KEY = "fake-key";
  const originalFetch = global.fetch;
  global.fetch = (async () =>
    new Response(JSON.stringify({ diagnostico: "ok", estrategia: "ok", mensagem_whatsapp: "ok", proximo_passo: "ok", suggestion_id: "x" }), { status: 200 })
  ) as typeof fetch;
  try {
    state.ctx = ctxOf({ isGestor: true, role: "gestor", routing_team: "SETOR_CAMPINAS_JUNDIAI" });
    state.tables = { ai_sdr_leads: [LEAD] };
    const res = await POST(req({ phone: "5511999990001" }));
    assert.notEqual(res.status, 403);
  } finally {
    global.fetch = originalFetch;
  }
});

test("lead nao encontrado -> 404", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf();
  state.tables = { ai_sdr_leads: [] };
  const res = await POST(req({ phone: "5511999990009" }));
  assert.equal(res.status, 404);
});
