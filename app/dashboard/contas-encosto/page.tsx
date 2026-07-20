import { createClient } from "@/lib/supabase/server";
import { ContasEncostoList, type ContaEncosto } from "@/components/leads/contas-encosto-list";
import { PageHead } from "@/app/dashboard/lib/ui";

// DEBT-318 (SDR): Contas de Encosto — perdido-quente/backup ativo (view v_contas_encosto).
export const dynamic = "force-dynamic";

export default async function ContasEncostoPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("v_contas_encosto")
    .select("phone, restaurant_name, city, segment, weekly_volume_kg, motivo_categoria, motivo_detalhe, lost_at, dias_desde_perda, next_followup_at, fase_teste")
    .order("next_followup_at", { ascending: true, nullsFirst: false });

  const contas = (data ?? []) as ContaEncosto[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHead
        title="Contas de Encosto"
        desc="Leads perdidos mas quentes — amostra aprovada, relação boa, ficou com o incumbente. Não são leads mortos: são backups que reengajam no gatilho certo (a data de volta, ou quando o concorrente tropeça)."
      />
      <ContasEncostoList contas={contas} />
    </div>
  );
}
