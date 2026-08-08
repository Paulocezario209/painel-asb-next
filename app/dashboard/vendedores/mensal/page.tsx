// Visão MENSAL por vendedor — apoio ao feedback do líder comercial (consultoria item 7).
// Compara o mês selecionado com o mês ANTERIOR, por setor, só com fontes oficiais já
// existentes (zero régua nova): meta/realizado = RPC resumo_mes_vendedor_mes (regra
// data_meta + CNB); novos/recompra = fn_visao_geral_compras (v_cri_pedidos_sequencia);
// carteira = v_carteira_360 (fn_status_cliente); perdidos = ai_sdr_leads.lost_at;
// parados = v_leads_parados. Evidência, não avaliação: nenhum julgamento automático.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { PageHead, SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { VENDOR_LABELS } from "@/lib/vendor-labels";
import { brl } from "@/lib/top10-share";
import { UserCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const SETORES = ["SETOR_SOROCABA_SAO_PAULO", "SETOR_CAMPINAS_JUNDIAI", "SETOR_CUIT"] as const;

type ResumoRow = {
  vendedor_routing_team: string;
  meta_total_mes_brl: number;
  realizado_mes_brl: number;
  pct_atingido_mes: number;
  dias_batidos: number;
  dias_abaixo: number;
  dias_uteis_decorridos: number;
  dias_uteis_mes: number;
};
type BucketRow = { bucket: number; pedidos: number; clientes: number; faturamento: number };

function mesAnterior(mes: string): { mes: string; ano: number; m: number } {
  const [a, m] = mes.split("-").map(Number);
  const pa = m === 1 ? a - 1 : a;
  const pm = m === 1 ? 12 : m - 1;
  return { mes: `${pa}-${String(pm).padStart(2, "0")}`, ano: pa, m: pm };
}

export default async function VendedoresMensalPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  // Mesma política da tela-mãe /dashboard/vendedores (vendedor não vê comparativo do time)
  if (!ctx || !canAccess(ctx.role, "/dashboard/vendedores")) redirect("/dashboard");

  const sp = await searchParams;
  const hoje = new Date();
  const mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const mes = sp?.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : mesCorrente;
  const [ano, mNum] = mes.split("-").map(Number);
  const ant = mesAnterior(mes);
  const mesIni = `${mes}-01`;
  const mesFimEx = `${mNum === 12 ? ano + 1 : ano}-${String(mNum === 12 ? 1 : mNum + 1).padStart(2, "0")}-01`;

  const supabase = await createClient();

  const [
    { data: resumoSel },
    { data: resumoAnt },
    comprasSel,
    comprasAnt,
    { data: carteira },
    { data: perdidos },
    { data: parados },
  ] = await Promise.all([
    supabase.rpc("resumo_mes_vendedor_mes", { p_ano: ano, p_mes: mNum }),
    supabase.rpc("resumo_mes_vendedor_mes", { p_ano: ant.ano, p_mes: ant.m }),
    Promise.all(SETORES.map((s) => supabase.rpc("fn_visao_geral_compras", { p_mes: mes, p_vendedor: s }))),
    Promise.all(SETORES.map((s) => supabase.rpc("fn_visao_geral_compras", { p_mes: ant.mes, p_vendedor: s }))),
    supabase.from("v_carteira_360").select("routing_team, customer_status"),
    supabase.from("ai_sdr_leads").select("routing_team").eq("is_test", false).gte("lost_at", mesIni).lt("lost_at", mesFimEx),
    supabase.from("v_leads_parados").select("routing_team"),
  ]);

  const resumoDe = (rows: unknown, setor: string): ResumoRow | undefined =>
    ((rows ?? []) as ResumoRow[]).find((r) => r.vendedor_routing_team === setor);
  const bucketsDe = (arr: { data: unknown }[], i: number): BucketRow[] => ((arr[i]?.data ?? []) as BucketRow[]);
  const fatNovos = (b: BucketRow[]) => Number(b.find((x) => Number(x.bucket) === 1)?.faturamento ?? 0);
  const cliNovos = (b: BucketRow[]) => Number(b.find((x) => Number(x.bucket) === 1)?.clientes ?? 0);
  const fatRecompra = (b: BucketRow[]) => b.filter((x) => Number(x.bucket) >= 2).reduce((s, x) => s + Number(x.faturamento || 0), 0);

  const contar = (rows: { routing_team: string | null }[] | null | undefined, setor: string) =>
    (rows ?? []).filter((r) => r.routing_team === setor).length;
  const carteiraAtiva = (setor: string) =>
    ((carteira ?? []) as { routing_team: string | null; customer_status: string }[])
      .filter((c) => c.routing_team === setor && ["ativo", "atencao", "risco"].includes(c.customer_status)).length;
  const carteiraChurn = (setor: string) =>
    ((carteira ?? []) as { routing_team: string | null; customer_status: string }[])
      .filter((c) => c.routing_team === setor && ["pre_churn", "churn_comercial", "inativo_definitivo"].includes(c.customer_status)).length;

  const delta = (atual: number, anterior: number): string => {
    if (!anterior) return "—";
    const d = ((atual - anterior) / anterior) * 100;
    return `${d >= 0 ? "+" : ""}${d.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% vs mês ant.`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <PageHead
        title="Vendedores — Visão Mensal"
        desc={`Comparativo ${mes} × ${ant.mes} por setor · fontes oficiais (meta data_meta+CNB, sequência de compras CRI, carteira fn_status_cliente) · evidência para o feedback mensal`}
      />
      <DashboardFilters showMonth defaultMes={mesCorrente} />

      {SETORES.map((setor) => {
        const rSel = resumoDe(resumoSel, setor);
        const rAnt = resumoDe(resumoAnt, setor);
        const i = SETORES.indexOf(setor);
        const bSel = bucketsDe(comprasSel as { data: unknown }[], i);
        const bAnt = bucketsDe(comprasAnt as { data: unknown }[], i);
        const metaSel = Number(rSel?.meta_total_mes_brl ?? 0);
        const realSel = Number(rSel?.realizado_mes_brl ?? 0);
        const realAnt = Number(rAnt?.realizado_mes_brl ?? 0);
        return (
          <div key={setor} className="asb-card" style={{ padding: "20px 24px" }}>
            <SectionHead
              Icon={UserCheck}
              color="#5B8DEF"
              title={VENDOR_LABELS[setor] ?? setor}
              desc={rSel ? `${rSel.dias_uteis_decorridos}/${rSel.dias_uteis_mes} dias úteis decorridos no mês selecionado` : "sem meta cadastrada no mês"}
            />
            <div className="asb-grid-kpi">
              <StatTile label="Meta do mês" value={brl(metaSel)} accent="#8bb4ff" num="#fff" sub={`mês anterior: ${brl(Number(rAnt?.meta_total_mes_brl ?? 0))}`} />
              <StatTile label="Faturado (ASB+CNB)" value={brl(realSel)} accent="#22C55E" num="#22C55E" sub={delta(realSel, realAnt)} />
              <StatTile label="% da meta (mês)" value={`${Number(rSel?.pct_atingido_mes ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`} accent="#E0A93E" num="#fff" sub={`mês ant.: ${Number(rAnt?.pct_atingido_mes ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`} />
              <StatTile label="Dias batidos × abaixo" value={`${rSel?.dias_batidos ?? 0} × ${rSel?.dias_abaixo ?? 0}`} accent="#6E86FF" num="#fff" sub="dias-meta do ciclo do vendedor" />
              <StatTile label="Clientes novos (1ª compra)" value={cliNovos(bSel)} accent="#5B8DEF" num="#fff" sub={`${brl(fatNovos(bSel))} · mês ant.: ${cliNovos(bAnt)}`} />
              <StatTile label="Recompra (2ª+)" value={brl(fatRecompra(bSel))} accent="#22C55E" num="#fff" sub={delta(fatRecompra(bSel), fatRecompra(bAnt))} />
              <StatTile label="Carteira ativa (ativo/atenção/risco)" value={carteiraAtiva(setor)} accent="#22C55E" num="#fff" sub={`agora · churn+: ${carteiraChurn(setor)}`} />
              <StatTile label="Leads perdidos no mês" value={contar(perdidos as { routing_team: string | null }[], setor)} accent="#FF3B57" num="#FF3B57" sub={`parados agora: ${contar(parados as { routing_team: string | null }[], setor)}`} />
            </div>
          </div>
        );
      })}

      <p style={{ fontSize: 10.5, color: "#83879a", textAlign: "center" }}>
        Carteira, parados e estado do funil são fotografias de AGORA (não retroagem ao mês selecionado).
        Meta/faturado/novos/recompra/perdidos respeitam o mês do filtro.
      </p>
    </div>
  );
}
