import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // /api/version: endpoint PUBLICO de deploy-health — retorna SOMENTE o SHA do build
  // ({sha}), zero dado de negocio. Isento do guard de sessao/Supabase para que o
  // verify-deploy (GitHub Actions) prove o SHA em producao sem auth. Mesma classe de
  // excecao publica que /privacidade (LGPD) e o PDF de catalogo no matcher abaixo.
  if (request.nextUrl.pathname === "/api/version") {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)"],
};
