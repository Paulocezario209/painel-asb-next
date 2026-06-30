import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
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

  if (!user && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
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
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
