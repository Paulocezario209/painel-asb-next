// Bloco "Compras & Recorrência" da Visão Geral (consultoria item 1).
// Server Component. Duas lentes, mesma régua da Pipeline Canônica V3 (§12.3):
//  (a) ESTADO ATUAL — quantos clientes estão HOJE em pedido_1..pedido_4 /
//      cliente_recorrente (ai_sdr_leads.funnel_stage, promovido automaticamente
//      pelo cascade ARES a cada 15min; snapshot — o filtro de mês não se aplica);
//  (b) FATURAMENTO DO PERÍODO por Nº da compra do cliente — RPC
//      fn_visao_geral_compras sobre v_cri_pedidos_sequencia (CRI F9):
//      1ª compra = cliente novo · 2ª+ = recompra · 5+ = recorrente.
import { createClient } from "@/lib/supabase/server";
import { SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { Repeat } from "lucide-react";
import { brl } from "@/lib/top10-share";

const STAGES = ["pedido_1", "pedido_2", "pedido_3", "pedido_4", "cliente_recorrente"] as const;
const STAGE_LABEL: Record<string, string> = {
  pedido_1: "Clientes na compra 1",
  pedido_2: "Clientes na compra 2",
  pedido_3: "Clientes na compra 3",
  pedido_4: "Clientes na compra 4",
  cliente_recorrente: "Recorrentes ativos (5+)",
};
const ACCENT: Record<string, string> = {
  pedido_1: "#5B8DEF", pedido_2: "#6E86FF", pedido_3: "#8bb4ff",
  pedido_4: "#E0A93E", cliente_recorrente: "#22C55E",
};

type BucketRow = { bucket: number; pedidos: number; clientes: number; faturamento: number };

export async function CardComprasRecorrencia({
  mes = null,
  vendedor = null,
}: { mes?: string | null; vendedor?: string | null } = {}) {
  const supabase = await createClient();

  let stagesQ = supabase
    .from("ai_sdr_leads")
    .select("funnel_stage")
    .in("funnel_stage", [...STAGES])
    .eq("is_test", false);
  if (vendedor) stagesQ = stagesQ.eq("routing_team", vendedor);

  const [{ data: stageRows }, { data: bucketData, error: rpcErr }] = await Promise.all([
    stagesQ,
    supabase.rpc("fn_visao_geral_compras", { p_mes: mes, p_vendedor: vendedor }),
  ]);

  const stageCount: Record<string, number> = {};
  for (const r of (stageRows ?? []) as { funnel_stage: string }[]) {
    stageCount[r.funnel_stage] = (stageCount[r.funnel_stage] ?? 0) + 1;
  }

  const buckets = (rpcErr ? [] : ((bucketData ?? []) as BucketRow[]));
  const b = (n: number) => buckets.find((x) => Number(x.bucket) === n);
  const fat = (n: number) => Number(b(n)?.faturamento ?? 0);
  const cli = (n: number) => Number(b(n)?.clientes ?? 0);
  const totalRecompra = buckets.filter((x) => Number(x.bucket) >= 2).reduce((s, x) => s + Number(x.faturamento || 0), 0);

  return (
    <div className="asb-card" style={{ padding: "20px 24px" }}>
      <SectionHead
        Icon={Repeat}
        color="#22C55E"
        title="Compras & Recorrência"
        desc="Régua da Pipeline V3: 1ª compra = cliente novo · 2ª+ = recompra · 5+ = recorrente. Estado atual (cascade ARES 15min) + faturamento do período por Nº da compra."
      />
      {/* (a) Estado atual — snapshot por estágio (mês não se aplica; setor sim) */}
      <div className="asb-grid-kpi" style={{ marginBottom: 14 }}>
        {STAGES.map((s) => (
          <StatTile
            key={s}
            label={STAGE_LABEL[s]}
            value={stageCount[s] ?? 0}
            accent={ACCENT[s]}
            num={ACCENT[s]}
            sub={s === "cliente_recorrente" ? "5+ pedidos faturados" : "estado atual do funil"}
          />
        ))}
      </div>
      {/* (b) Faturamento do período por Nº da compra */}
      {buckets.length > 0 && (
        <div className="asb-grid-kpi">
          <StatTile label="Fat. clientes novos (1ª compra)" value={brl(fat(1))} accent="#5B8DEF" num="#fff" sub={`${cli(1)} clientes no período`} />
          <StatTile label="Fat. compra 2" value={brl(fat(2))} accent="#6E86FF" num="#fff" sub={`${cli(2)} clientes`} />
          <StatTile label="Fat. compra 3" value={brl(fat(3))} accent="#8bb4ff" num="#fff" sub={`${cli(3)} clientes`} />
          <StatTile label="Fat. compra 4" value={brl(fat(4))} accent="#E0A93E" num="#fff" sub={`${cli(4)} clientes`} />
          <StatTile label="Fat. recorrentes (5+)" value={brl(fat(5))} accent="#22C55E" num="#fff" sub={`${cli(5)} clientes`} />
          <StatTile label="Total recompra (2ª em diante)" value={brl(totalRecompra)} accent="#22C55E" num="#22C55E" sub="soma das compras 2, 3, 4 e 5+" />
        </div>
      )}
    </div>
  );
}
