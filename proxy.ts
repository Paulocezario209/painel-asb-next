import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rota publica EXATA, isenta do guard de sessao/Supabase: apenas `/api/version`
 * (retorna SOMENTE o SHA do build). Match EXATO de proposito — `/api/version/<x>`
 * NAO herda a isencao e nenhuma outra `/api/*` vira publica. Extraida para ser
 * testavel sem mock de rede (ver tests/middleware.test.ts).
 */
export function isPublicVersionRoute(pathname: string): boolean {
  return pathname === "/api/version";
}

/**
 * Rota de JOB INTERNO (`/api/cron/*`), chamada por agendador externo (n8n) — nunca
 * por navegador, logo nunca tem cookie de sessao. NAO e publica: so passa pelo guard
 * quando o header `x-internal-key` bate com INTERNAL_API_KEY. Sem a env configurada,
 * ou com header errado/ausente, cai no 401 normal do guard (fail-closed).
 *
 * A comparacao e de tamanho fixo para nao vazar o segredo por tempo de resposta.
 */
export function isAuthorizedCronRoute(pathname: string, headerKey: string | null): boolean {
  if (!pathname.startsWith("/api/cron/")) return false;
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || !headerKey) return false;
  if (headerKey.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= headerKey.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function proxy(request: NextRequest) {
  // /api/version: PUBLICO (so o SHA), resolvido ANTES de qualquer init/consulta Supabase —
  // essa rota nao usa sessao, nao acessa banco, nao le cookie e nao expoe usuario. Mesma
  // classe de excecao publica que /privacidade (LGPD) e o PDF de catalogo no matcher abaixo.
  if (isPublicVersionRoute(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  // /api/cron/*: job interno autenticado por chave — o agendador nao tem sessao.
  if (isAuthorizedCronRoute(request.nextUrl.pathname, request.headers.get("x-internal-key"))) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars not configured (e.g. container missing them), skip auth guard
  // to prevent 500 — routes will fail gracefully when Supabase is actually called
  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  // Rota PÚBLICA (sem login): política de privacidade — exigência LGPD/GATE-2
  // do CAPI (runbook GO_LIVE 2026-07-08). Página estática, zero dado de negócio.
  const isPublicRoute = pathname.startsWith("/privacidade");

  if (!user && !isAuthRoute && !isPublicRoute) {
    // /api sem sessao -> 401 JSON (cliente de API); paginas -> redirect /login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/inicio", request.url));
  }

  // Bloqueio de ESCRITA p/ role 'financeiro' (consultor DRE = SOMENTE LEITURA).
  // Sessao ja e exigida acima (no-session -> /login); aqui so falta barrar o financeiro.
  const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  if (user?.email && pathname.startsWith("/api/") && MUTATING.has(request.method)) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("email", user.email)
      .single();
    if (profile?.role === "financeiro") {
      return NextResponse.json(
        { error: "forbidden: conta somente leitura (financeiro)" },
        { status: 403 },
      );
    }
    // Escrita no workspace COMPRAS (limpar-mes, restore, uploads de âncora/custos,
    // chat de mercado): só gestor e tecnico_compras. Auditoria 2026-07-10 — sem este
    // guard, qualquer sessão não-financeiro podia apagar meses de custos_registro_diario.
    if (
      pathname.startsWith("/api/compras/") &&
      profile?.role !== "gestor" &&
      profile?.role !== "tecnico_compras"
    ) {
      return NextResponse.json(
        { error: "forbidden: escrita em compras restrita a gestor/tecnico_compras" },
        { status: 403 },
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  // pdf na exclusão: catálogo público em /catalogo-asb-hamburgueres.pdf é baixado
  // pelo Evolution SEM sessão — sem isso o redirect manda a página de login como "PDF"
  // (bug 2026-07-09: lead recebia HTML de 11 KB que não abria).
  // manifest.webmanifest na exclusão: é metadado público (nome, cores, caminho dos ícones,
  // zero dado de usuário) e o navegador pode buscá-lo sem sessão ao instalar o atalho —
  // sem isso o fetch volta o HTML do /login e o ícone não resolve.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)"],
};
