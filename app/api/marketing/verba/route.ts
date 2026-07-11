import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

const CANAIS = new Set(["meta", "google"]);

export async function POST(req: NextRequest) {
  const { mes, canal, verba_brl, nota } = await req.json();

  if (typeof mes !== "string" || !/^\d{4}-\d{2}-01$/.test(mes)) {
    return NextResponse.json({ error: "mes deve ser YYYY-MM-01" }, { status: 400 });
  }
  if (typeof canal !== "string" || !CANAIS.has(canal)) {
    return NextResponse.json({ error: "canal deve ser meta ou google" }, { status: 400 });
  }
  const valor = Number(verba_brl);
  if (!Number.isFinite(valor) || valor < 0 || valor > 1_000_000) {
    return NextResponse.json({ error: "verba_brl inválida" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // escrita via service role (tabela sem grant de escrita p/ authenticated)
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { error } = await service
    .from("marketing_verba_mensal")
    .upsert(
      {
        mes,
        canal,
        verba_brl: valor,
        nota: typeof nota === "string" && nota.trim() ? nota.trim() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mes,canal" },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
