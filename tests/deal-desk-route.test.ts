// V4 Fase 7 (2026-07-30): prova que app/api/pipeline/deal-desk/route.ts continua com os
// mesmos gates (regressão) e passa a liberar proposta_enviada além de negociacao. Mocka
// as dependências UMA VEZ no hook before (ver suggest-route.test.ts para o motivo).
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
    ({ POST } = await import("../app/api/pipeline/deal-desk/route"));
    ({ NextRequest } = await import("next/server"));
  } catch (err) {
    mockUnavailable = `module mocking indisponivel (--experimental-test-module-mocks): ${(err as Error).message}`;
  }
});

function ctxOf(overrides: Record<string, unknown> = {}) {
  return {
    email: "vendedor@asb.com", role: "vendedor", routing_team: "SETOR_SOROCABA_SAO_PAULO",
    comissaoPerfil: null, isGestor: false, isManager: false, isVendedor: true,
    isTecnicoCompras: false, isFinanceiro: false, isDiretor: false, isGerente: false,
    ...overrides,
  };
}

function req(body: Record<string, unknown>) {
  return new NextRequest("https://painel.test/api/pipeline/deal-desk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("sem sessao -> 401 (regressao)", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = null;
  state.tables = {};
  const res = await POST(req({ lead_id: "lead-1" }));
  assert.equal(res.status, 401);
});

test("etapa fora de negociacao/proposta_enviada -> fonte vazio (regressao)", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf();
  state.tables = { ai_sdr_leads: [{ id: "lead-1", routing_team: "SETOR_SOROCABA_SAO_PAULO", funnel_stage: "handoff", is_test: false }] };
  const res = await POST(req({ lead_id: "lead-1" }));
  const j = await res.json();
  assert.equal(j.fonte, "vazio");
});

test("proposta_enviada -> passa do gate de etapa e chega no fetch ao CP (V4 Fase 7)", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf();
  state.tables = { ai_sdr_leads: [{ id: "lead-1", routing_team: "SETOR_SOROCABA_SAO_PAULO", funnel_stage: "proposta_enviada", is_test: false }] };
  process.env.CP_INTERNAL_URL = "https://cp.test";
  process.env.INTERNAL_API_KEY = "fake-key";
  const originalFetch = global.fetch;
  // Resposta distintiva: só aparece se o código passou do gate de etapa e chamou o CP de verdade.
  global.fetch = (async () => new Response(JSON.stringify({ fonte: "ia", mensagem: "PROVA_CHEGOU_NO_FETCH" }), { status: 200 })) as typeof fetch;
  try {
    const res = await POST(req({ lead_id: "lead-1" }));
    const j = await res.json();
    assert.equal(j.mensagem, "PROVA_CHEGOU_NO_FETCH");
  } finally {
    global.fetch = originalFetch;
  }
});

test("equipe errada -> 403 (regressao)", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf({ routing_team: "SETOR_SOROCABA_SAO_PAULO" });
  state.tables = { ai_sdr_leads: [{ id: "lead-1", routing_team: "SETOR_CAMPINAS_JUNDIAI", funnel_stage: "negociacao", is_test: false }] };
  const res = await POST(req({ lead_id: "lead-1" }));
  assert.equal(res.status, 403);
});
