import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { VerbaClient, type VerbaRow } from "./verba-client";

export const dynamic = "force-dynamic";

export default async function VerbaPage() {
  const supabase = await createClient();
  // hidrata a sessão (view REVOKE anon / GRANT authenticated — DEBT-110)
  await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("v_verba_x_gasto_mensal")
    .select("mes, canal, verba_brl, gasto_brl, saldo_brl, aporte_brl, nota")
    .order("mes", { ascending: false })
    .limit(500);

  const rows = (error ? [] : (data ?? [])) as unknown as VerbaRow[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "var(--asb-page-ink)", fontSize: 20, fontWeight: 800, fontFamily: theme.font.label, letterSpacing: "-.01em", textTransform: "none", marginBottom: 4 }}>
          Verba &amp; Gasto
        </h1>
        <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label }}>
          Verba definida × gasto real por mês/canal · saldo · aporte a pedir no mês seguinte
        </p>
      </div>

      {error && (
        <div style={{ background: "#1a1a1a", border: "1px solid #C8102E", borderRadius: 6, padding: 16, color: "#C8102E", fontSize: 11, fontFamily: theme.font.label }}>
          View <code>v_verba_x_gasto_mensal</code> indisponível (migration aplicada?). {error.message}
        </div>
      )}

      <VerbaClient rows={rows} />

      <p style={{ color: "#e4e9f0", fontSize: 10, fontFamily: theme.font.label, textAlign: "right" }}>
        Gasto Meta atualizado diariamente às 06:10 BRT · Google às 06:15 BRT
      </p>
    </div>
  );
}
