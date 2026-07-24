// Testes mecanicos do endpoint publico /api/version.
// Provam: GET/HEAD passam e retornam 200; corpo e SOMENTE {"sha":...} (zero vazamento
// de dado de sessao/segredo); Cache-Control no-store; e que NENHUM outro metodo tem
// handler (o App Router responde 405 automaticamente aos demais).
import test from "node:test";
import assert from "node:assert/strict";
import { GET, HEAD } from "../app/api/version/route";
import * as routeModule from "../app/api/version/route";

test("GET /api/version -> 200, application/json, no-store, SO o SHA", async () => {
  const res = GET();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/json/);
  assert.equal(res.headers.get("cache-control"), "no-store, max-age=0");
  const json = (await res.json()) as Record<string, unknown>;
  // A resposta so pode ter a chave `sha` — prova de nao-vazamento.
  assert.deepEqual(Object.keys(json), ["sha"]);
  assert.equal(typeof json.sha, "string");
});

test("HEAD /api/version -> 200, sem corpo, no-store", async () => {
  const res = HEAD();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store, max-age=0");
  const text = await res.text();
  assert.equal(text, "");
});

test("endpoint expoe SOMENTE GET e HEAD (demais metodos -> 405 do App Router)", () => {
  const mod = routeModule as Record<string, unknown>;
  for (const m of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    assert.equal(typeof mod[m], "undefined", `nao pode haver handler ${m}`);
  }
  assert.equal(typeof mod.GET, "function");
  assert.equal(typeof mod.HEAD, "function");
});

test("resposta nao contem qualquer dado de sessao/segredo", async () => {
  const json = await GET().json();
  const flat = JSON.stringify(json).toLowerCase();
  for (const proibido of [
    "password", "senha", "service_role", "supabase", "token",
    "cookie", "authorization", "email", "user", "anon",
  ]) {
    assert.ok(!flat.includes(proibido), `resposta nao pode conter '${proibido}'`);
  }
});
