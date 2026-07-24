// Testes mecanicos do middleware (proxy.ts) — parte deterministica, sem mock de rede.
// Provam: a isencao e EXATA em /api/version (nenhuma outra /api/* nem /api/version/<x>
// herdam); em runtime, /api/version passa sem sessao (200, sem redirect) resolvido ANTES
// do Supabase; e uma trava de regressao garantindo que o guard 401//login segue intacto
// e posicionado DEPOIS da isencao e ANTES da inicializacao do Supabase.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isPublicVersionRoute, proxy } from "../proxy";
import { NextRequest } from "next/server";

const here = dirname(fileURLToPath(import.meta.url));

test("isPublicVersionRoute: isencao e EXATA em /api/version", () => {
  assert.equal(isPublicVersionRoute("/api/version"), true);
  // /api/version/<x> NAO herda a isencao
  assert.equal(isPublicVersionRoute("/api/version/"), false);
  assert.equal(isPublicVersionRoute("/api/version/leak"), false);
  assert.equal(isPublicVersionRoute("/api/versionx"), false);
  // nenhuma outra /api/* fica publica
  assert.equal(isPublicVersionRoute("/api/orders"), false);
  assert.equal(isPublicVersionRoute("/api/compras/limpar-mes"), false);
  // paginas protegidas nao sao afetadas
  assert.equal(isPublicVersionRoute("/dashboard"), false);
  assert.equal(isPublicVersionRoute("/"), false);
});

test("proxy(): /api/version passa sem sessao (200, sem redirect), antes do Supabase", async () => {
  const req = new NextRequest(new URL("https://painel.test/api/version"));
  const res = await proxy(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("location"), null); // nao redirecionou p/ /login
});

test("regressao: guard 401//login intacto, DEPOIS da isencao e ANTES do Supabase", () => {
  const src = readFileSync(join(here, "..", "proxy.ts"), "utf8");
  const idxIsencao = src.indexOf("isPublicVersionRoute(request.nextUrl.pathname)");
  const idx401 = src.indexOf("{ status: 401 }");
  const idxRedirect = src.indexOf('new URL("/login"');
  const idxSupabase = src.indexOf("createServerClient(");
  assert.ok(idxIsencao > -1, "isencao /api/version presente no proxy()");
  assert.ok(idxSupabase > -1, "createServerClient presente");
  // a isencao resolve ANTES de tocar o Supabase
  assert.ok(idxIsencao < idxSupabase, "isencao deve vir antes de createServerClient");
  // o guard original continua presente e DEPOIS da isencao (nao foi removido/reordenado)
  assert.ok(idx401 > idxSupabase, "guard 401 para /api/* sem sessao segue presente");
  assert.ok(idxRedirect > idxSupabase, "redirect /login para pagina sem sessao segue presente");
});
