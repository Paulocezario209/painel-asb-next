import { createClient } from "@/lib/supabase/server";
import { ContasEncostoList, type ContaEncosto } from "@/components/leads/contas-encosto-list";
import { theme } from "@/lib/theme";

// DEBT-318 (SDR): Contas de Encosto — perdido-quente/backup ativo (view v_contas_encosto).
export const dynamic = "force-dynamic";

export default async function ContasEncostoPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("v_contas_encosto")
    .select("phone, restaurant_name, city, segment, weekly_volume_kg, motivo_categoria, motivo_detalhe, lost_at, dias_desde_perda, next_followup_at")
    .order("next_followup_at", { ascending: true, nullsFirst: false });

  const contas = (data ?? []) as ContaEncosto[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 750, color: "#fff", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", letterSpacing: "-.01em" }}>
          Contas de Encosto
        </h1>
        <p style={{ fontSize: 12, color: theme.colors.neutral, marginTop: 4, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", maxWidth: "70ch", lineHeight: 1.5 }}>
          Leads perdidos mas <strong style={{ color: "#FF7A45" }}>quentes</strong> — amostra aprovada, relação boa, ficou com o incumbente.
          Não são leads mortos: são backups que reengajam no gatilho certo (a data de volta, ou quando o concorrente tropeça).
        </p>
      </div>
      <ContasEncostoList contas={contas} />
    </div>
  );
}
