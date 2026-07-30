// V4 Fase 5 (2026-07-30): prova o ponto de risco identificado no plano — o suggestion_id
// sozinho não carrega routing_team, então a rota precisa buscar o lead por trás dele e
// aplicar o MESMO isolamento por equipe das outras rotas do Deal Desk/Estrategista. Mocka
// as dependências UMA VEZ no hook before (ver suggest-route.test.ts para o motivo).
import test, { before } from "node:test";
import assert from "node:assert/strict";
import { makeFakeSupabase } from "./fakeSupabase";

const state: { ctx: unknown; tables: Record<string, unknown[]>; captured: Array<{ table: string; patch: Record<string, unknown> }> } = {
  ctx: null, tables: {}, captured: [],
};
let POST: any;
let NextRequest: any;
let mockUnavailable: string | null = null;

before(async () => {
  try {
    const { mock } = await import("node:test");
    mock.module("@/lib/auth/get-user-role", { namedExports: { getUserContext: async () => state.ctx } });
    mock.module("@/lib/supabase/server", { namedExports: { createClient: async () => makeFakeSupabase(state.tables, state.captured) } });
    ({ POST } = await import("../app/api/pipeline/deal-suggestion-event/route"));
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
  return new NextRequest("https://painel.test/api/pipeline/deal-suggestion-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SUGESTAO = { id: "sug-1", lead_phone: "5511999990001", agente: "estrategista", content: { mensagem_whatsapp: "oi original" } };
const LEAD_MESMA_EQUIPE = { routing_team: "SETOR_SOROCABA_SAO_PAULO" };
const LEAD_OUTRA_EQUIPE = { routing_team: "SETOR_CAMPINAS_JUNDIAI" };

test("sem sessao -> 401", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = null;
  state.tables = {};
  state.captured = [];
  const res = await POST(req({ suggestion_id: "sug-1", event: "copied" }));
  assert.equal(res.status, 401);
});

test("suggestion_id inexistente -> 404", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf();
  state.tables = { deal_suggestions: [] };
  state.captured = [];
  const res = await POST(req({ suggestion_id: "nao-existe", event: "copied" }));
  assert.equal(res.status, 404);
});

test("equipe errada -> 403 (isolamento via lead por tras do suggestion_id)", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf({ routing_team: "SETOR_SOROCABA_SAO_PAULO" });
  state.tables = { deal_suggestions: [SUGESTAO], ai_sdr_leads: [LEAD_OUTRA_EQUIPE] };
  state.captured = [];
  const res = await POST(req({ suggestion_id: "sug-1", event: "copied" }));
  assert.equal(res.status, 403);
  assert.equal(state.captured.length, 0, "nao deve gravar update quando bloqueado por equipe");
});

test("mesma equipe + event=copied -> ok e grava copied_at", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf();
  state.tables = { deal_suggestions: [SUGESTAO], ai_sdr_leads: [LEAD_MESMA_EQUIPE] };
  state.captured = [];
  const res = await POST(req({ suggestion_id: "sug-1", event: "copied" }));
  assert.equal(res.status, 200);
  assert.ok(state.captured[0]?.patch?.copied_at);
});

test("gestor de outra equipe -> bypassa o isolamento", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf({ isGestor: true, role: "gestor", routing_team: "SETOR_CAMPINAS_JUNDIAI" });
  state.tables = { deal_suggestions: [SUGESTAO], ai_sdr_leads: [LEAD_MESMA_EQUIPE] };
  state.captured = [];
  const res = await POST(req({ suggestion_id: "sug-1", event: "copied" }));
  assert.equal(res.status, 200);
});

test("event=sent grava sent_at + sent_message + edited", async (t) => {
  if (mockUnavailable) return t.skip(mockUnavailable);
  state.ctx = ctxOf();
  state.tables = { deal_suggestions: [SUGESTAO], ai_sdr_leads: [LEAD_MESMA_EQUIPE] };
  state.captured = [];
  const res = await POST(req({ suggestion_id: "sug-1", event: "sent", mensagem_enviada: "oi editada" }));
  assert.equal(res.status, 200);
  assert.equal(state.captured[0]?.patch?.sent_message, "oi editada");
  assert.equal(state.captured[0]?.patch?.edited, true);
});
