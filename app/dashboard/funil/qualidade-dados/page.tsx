// app/dashboard/funil/qualidade-dados/page.tsx — CRI F9 (tela 9/9, última): Qualidade dos Dados.
// Não inventa métrica nova — CONSOLIDA selos/gaps que as 8 telas anteriores já expõem
// isoladamente (origem_canal, vínculo ARES, margem "não informada" do F4, selo de custo do F2,
// gap do espelho DEBT-093 do Passo 14a). LEI ÚNICA: nenhuma fonte é re-decidida aqui.
import { createClient } from "@/lib/supabase/server";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import Link from "next/link";
import { ShieldCheck, Link2, PieChart, Layers, Info } from "lucide-react";

export const dynamic = "force-dynamic";

interface QualidadeKpis {
  leads_periodo: number;
  leads_com_origem_conhecida: number;
  pct_origem_conhecida: number | null;
  leads_com_vinculo_ares: number;
  pct_vinculo_ares: number | null;
  pedidos_periodo: number;
  pedidos_com_margem_informada: number;
  pct_margem_informada: number | null;
  selo_custo_periodo: string;
}

interface EspelhoSnapshot {
  clientes_total: number;
  clientes_com_gap_espelho: number;
  pct_clientes_com_gap: number | null;
  pedidos_customer_state: number;
  pedidos_no_espelho: number;
  pedidos_faltantes_no_espelho: number;
  pct_cobertura_espelho: number | null;
}

const SELO_COR: Record<string, string> = {
  confirmado: "#22c55e",
  parcial: "#D4A017",
  estimado: "#8bb4ff",
  nao_informado: "#C8102E",
};

const SELO_LABEL: Record<string, string> = {
  confirmado: "Confirmado",
  parcial: "Parcial",
  estimado: "Estimado",
  nao_informado: "Não informado",
};

function fmtInt(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR");
}

function fmtPct(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

// verde >=90%, amber >=60%, vermelho abaixo — mesma leitura de "completude" em toda a tela
function corPct(v: number | null): string {
  if (v == null) return "#83879a";
  if (v >= 0.9) return "#22c55e";
  if (v >= 0.6) return "#D4A017";
  return "#C8102E";
}

const hoje = () => new Date().toISOString().slice(0, 10);
const primeiroDiaDoMes = () => `${new Date().toISOString().slice(0, 7)}-01`;

const selectStyle = {
  background: "var(--asb-card-hi)",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 5,
  padding: "6px 10px",
  color: "#c8d8e8",
  fontSize: 12,
};

export default async function QualidadeDadosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/marketing")) redirect("/dashboard/funil");

  const sp = await searchParams;
  const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
  const inicio = sp?.inicio && dataRegex.test(sp.inicio) ? sp.inicio : primeiroDiaDoMes();
  const fim = sp?.fim && dataRegex.test(sp.fim) ? sp.fim : hoje();

  const supabase = await createClient();
  const [{ data: kpisRaw, error: kpisErr }, { data: espelhoRaw, error: espelhoErr }] = await Promise.all([
    supabase.rpc("fn_cri_qualidade_dados", { p_data_inicio: inicio, p_data_fim: fim }),
    supabase.rpc("fn_cri_qualidade_espelho_snapshot"),
  ]);

  const kpis = (kpisRaw as QualidadeKpis[] | null)?.[0] ?? null;
  const espelho = (espelhoRaw as EspelhoSnapshot[] | null)?.[0] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Qualidade dos Dados"
        desc="Consolida os selos e gaps de completude que as outras 8 telas do CRI já expõem — não é métrica nova, é auditoria"
      />

      <form method="get" style={{ ...S.card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ ...S.label }}>Período (leads/pedidos/custo)</span>
        <input type="date" name="inicio" defaultValue={inicio} style={selectStyle} />
        <span style={{ ...S.muted }}>até</span>
        <input type="date" name="fim" defaultValue={fim} style={selectStyle} />
        <button type="submit" style={{ background: "#185FA5", border: "none", borderRadius: 5, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer" }}>
          Aplicar
        </button>
        <span style={{ ...S.muted, fontSize: 10.5 }}>o bloco &quot;Espelho de Pedidos&quot; abaixo não usa período — é foto de agora</span>
      </form>

      {kpisErr || espelhoErr ? (
        <div style={{ ...S.card, padding: 20, borderTop: "2px solid #C8102E" }}>
          <p style={{ color: "#C8102E" }}>Erro ao carregar dados: {kpisErr?.message ?? espelhoErr?.message}</p>
        </div>
      ) : (
        <>
          <div className="asb-grid-kpi">
            <KpiCard
              label="Origem Conhecida"
              value={fmtPct(kpis?.pct_origem_conhecida ?? null)}
              Icon={PieChart}
              accent={corPct(kpis?.pct_origem_conhecida ?? null)}
              num={corPct(kpis?.pct_origem_conhecida ?? null)}
              note={`${fmtInt(kpis?.leads_com_origem_conhecida ?? 0)} de ${fmtInt(kpis?.leads_periodo ?? 0)} leads`}
            />
            <KpiCard
              label="Vínculo com Cliente ARES"
              value={fmtPct(kpis?.pct_vinculo_ares ?? null)}
              Icon={Link2}
              accent={corPct(kpis?.pct_vinculo_ares ?? null)}
              num={corPct(kpis?.pct_vinculo_ares ?? null)}
              note={`${fmtInt(kpis?.leads_com_vinculo_ares ?? 0)} de ${fmtInt(kpis?.leads_periodo ?? 0)} leads — normal ser baixo (só vincula após 1º pedido)`}
            />
            <KpiCard
              label="Margem Informada"
              value={fmtPct(kpis?.pct_margem_informada ?? null)}
              Icon={ShieldCheck}
              accent={corPct(kpis?.pct_margem_informada ?? null)}
              num={corPct(kpis?.pct_margem_informada ?? null)}
              note={`${fmtInt(kpis?.pedidos_com_margem_informada ?? 0)} de ${fmtInt(kpis?.pedidos_periodo ?? 0)} pedidos — contrato F4, 0% até ganhar fonte real`}
            />
            <KpiCard
              label="Selo de Custo do Período"
              value={SELO_LABEL[kpis?.selo_custo_periodo ?? ""] ?? "—"}
              Icon={Layers}
              accent={SELO_COR[kpis?.selo_custo_periodo ?? ""] ?? "#83879a"}
              num={SELO_COR[kpis?.selo_custo_periodo ?? ""] ?? "#83879a"}
              note="pior selo entre mídia e operacional — mesma régua da Visão Geral"
            />
          </div>

          <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(139,180,255,.06)", border: "1px solid rgba(139,180,255,.3)" }}>
            <Info size={16} color="#8bb4ff" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ ...S.muted, fontSize: 11.5, lineHeight: 1.5 }}>
              <b style={{ color: "#8bb4ff" }}>Leitura correta:</b> baixo % de Vínculo com Cliente ARES não é bug — a maioria
              dos leads de um período recente ainda não converteu em cliente (o vínculo só existe após o 1º pedido faturado).
              Margem Informada em 0% também não é bug: é decisão explícita de nunca inventar custo ou usar percentual fixo
              (contrato <code>v_cri_margem_pedido</code>, F4) até existir fonte real de margem por pedido.
            </p>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead
              Icon={ShieldCheck}
              color="#185FA5"
              title="Espelho de Pedidos — Foto de Agora"
              desc="pedidos_espelho vs customer_state.total_orders — não usa Motor de Período (é gap estrutural da base histórica)"
            />
            <div className="asb-grid-kpi">
              <KpiCard
                label="Cobertura do Espelho"
                value={fmtPct(espelho?.pct_cobertura_espelho ?? null)}
                Icon={PieChart}
                accent={corPct(espelho?.pct_cobertura_espelho ?? null)}
                num={corPct(espelho?.pct_cobertura_espelho ?? null)}
                note={`${fmtInt(espelho?.pedidos_no_espelho ?? 0)} de ${fmtInt(espelho?.pedidos_customer_state ?? 0)} pedidos`}
              />
              <KpiCard
                label="Clientes com Gap"
                value={fmtPct(espelho?.pct_clientes_com_gap ?? null)}
                Icon={Layers}
                accent="#D4A017"
                num="#D4A017"
                note={`${fmtInt(espelho?.clientes_com_gap_espelho ?? 0)} de ${fmtInt(espelho?.clientes_total ?? 0)} clientes`}
              />
              <KpiCard
                label="Pedidos Faltantes no Espelho"
                value={fmtInt(espelho?.pedidos_faltantes_no_espelho ?? null)}
                Icon={Info}
                accent="#C8102E"
                num="#C8102E"
                note="DEBT-093 — histórico antigo ainda não replicado no espelho Postgres"
              />
            </div>
            <p style={{ ...S.muted, fontSize: 11, marginTop: 4 }}>
              <code>customer_state.total_orders</code> é o agregado confiável (backfill híbrido direto do ARES) — o gap não afeta
              nenhum KPI agregado desta tela ou da Visão Geral, só limita o drill-down pedido-a-pedido de alguns clientes antigos.{" "}
              <Link href="/dashboard/funil/pedidos-recorrencia" style={{ color: "#8bb4ff" }}>
                Ver detalhe por cliente em Pedidos e Recorrência →
              </Link>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
