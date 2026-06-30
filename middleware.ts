import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ── Chokepoint de ESCRITA do painel ──────────────────────────────────────────
// Intercepta SO metodos mutantes em /api/*:
//   - sem sessao valida           -> 401 (fecha as rotas que hoje aceitam qualquer um)
//   - role 'financeiro' (DRE)     -> 403 (consultor externo e SOMENTE LEITURA)
//   - demais roles autenticados   -> passa (gestor/vendedor/tecnico_compras escrevem normal)
// Leituras (GET) e rotas fora de /api passam direto (a leitura e liberada por canAccess).
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api/") || !MUTATING.has(request.method)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
