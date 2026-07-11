// ETAPA6 residual (DEBT-137): calendário multi-mês do /dashboard/gerente.
// A RPC calendario_metas_mes rodava client-side (browser) → unstable_cache
// (server-only) não alcançava. Padrão das 5 telas cacheadas: auth dinâmica
// FORA do cache; dado global via service role DENTRO (RPC não é per-user).
// Invalidação: metas/upload → revalidateTag("gerente-calendario-historico").
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

const getCalendarioMes = unstable_cache(
  async (ano: number, mes: number) => {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await svc.rpc("calendario_metas_mes", { p_ano: ano, p_mes: mes });
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ["gerente-calendario-historico"],
  { revalidate: 300, tags: ["gerente-calendario-historico"] },
);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ano = Number(req.nextUrl.searchParams.get("ano"));
  const mes = Number(req.nextUrl.searchParams.get("mes"));
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12 || ano < 2020 || ano > 2100) {
    return NextResponse.json({ error: "ano/mes inválidos" }, { status: 400 });
  }

  try {
    const rows = await getCalendarioMes(ano, mes);
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
