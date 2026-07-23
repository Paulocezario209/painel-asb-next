import type { CSSProperties } from "react";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { theme } from "@/lib/theme";
import { PageHead, SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { AtivosCarteira, type Carteira } from "./ativos-carteira";
import { getUserContext } from "@/lib/auth/get-user-role";
import { STATUS_FILTER_KEYS } from "@/lib/customer-status";
// ETAPA8: carteira unificada — abas reusam os server components das rotas /up-sell /churn.
// Recompra saiu daqui na Fase 0 (virou a camada própria /dashboard/carteira-ativa).
import UpSellPage from "@/app/dashboard/up-sell/page";
import ChurnPage from "@/app/dashboard/churn/page";

export const dynamic = "force-dynamic";

// ETAPA8: abas da carteira unificada
const TABS = [
  { key: "ativos", label: "Ativos" },
  { key: "upsell", label: "Up-sell" },
  { key: "churn", label: "Churn" },
  { key: "completa", label: "Completa" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ── Movimento de Carteira (hero ATIVOS) — entrou/voltou × deixou de faturar × saldo, M vs M-1 ──
// Fonte: v_carteira_movimento_mensal (pedidos_espelho faturado, eixo data_faturamento; pura comparação de conjuntos).
const MESES_DRE = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

const brl = (n: number | null) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const sBrl = (n: number) => (n >= 0 ? "+" : "") + brl(n);   // R$ com sinal explícito
const sNum = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

// chip numérico secundário (BRL) dentro do StatTile — número SEMPRE mono/tabular.
const monoChip = (c: string): CSSProperties => ({
  fontSize: 13, fontWeight: 800, color: c,
  fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums",
});

function shiftMonthDre(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function DRECarteiraCard({ mes }: { mes?: string }) {
  const now = new Date();
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mesYM = mes && /^\d{4}-\d{2}$/.test(mes) && mes <= curYM ? mes : curYM; // nunca além do corrente
  const [y, m] = mesYM.split("-").map(Number);

  // Query escopada: 1 linha do mês (não reusa o fetch de ativos). Sem row → tudo 0 (não quebra).
  const supabase = await createClient();
  // RECUPERADOS segue o mês selecionado no seletor: corrente = MTD (acumulando); fechado = mês fechado.
  const recMesAlvo = mesYM;
  const [movRes, recRes] = await Promise.all([
    supabase
      .from("v_carteira_movimento_mensal")
      .select("entraram, receita_entrou, sairam, receita_saiu, saldo_clientes, saldo_receita, novos_clientes, receita_novos, novos_cp, novos_org")
      .eq("mes", `${mesYM}-01`)
      .maybeSingle(),
    supabase
      .from("v_clientes_recuperados")
      .select("ares_cliente_id, valor_retorno, gap_dias")
      .eq("mes_retorno", `${recMesAlvo}-01`),
  ]);
  const data = movRes.data;
  // RECUPERADOS: view devolve 1 linha por retorno → agrega no server (distinct cliente, soma, média gap).
  const recRows = (recRes.data ?? []) as { ares_cliente_id: number; valor_retorno: number; gap_dias: number }[];
  const recCount = new Set(recRows.map((r) => r.ares_cliente_id)).size;
  const recReceita = recRows.reduce((s, r) => s + Number(r.valor_retorno || 0), 0);
  const recGap = recRows.length ? Math.round(recRows.reduce((s, r) => s + Number(r.gap_dias || 0), 0) / recRows.length) : 0;
  const recMesLabel = MESES_DRE[Number(recMesAlvo.split("-")[1]) - 1];
  const recMesTitle = recMesLabel.charAt(0) + recMesLabel.slice(1).toLowerCase(); // "Jul"
  const entraram = Number(data?.entraram ?? 0);
  const receitaEntrou = Number(data?.receita_entrou ?? 0);
  // Novos = só first order no mês (recuperados fora) — coluna aditiva da view (variante B).
  const novosClientes = Number(data?.novos_clientes ?? 0);
  const receitaNovos = Number(data?.receita_novos ?? 0);
  // Quebra CP (campanha/mídia paga) × ORG (orgânico: sem lead OU lead sem ad_id + walk-in) — DEBT-330.
  const novosCp = Number(data?.novos_cp ?? 0);
  const novosOrg = Number(data?.novos_org ?? 0);
  const sairam = Number(data?.sairam ?? 0);
  const receitaSaiu = Number(data?.receita_saiu ?? 0);
  const saldoCli = Number(data?.saldo_clientes ?? entraram - sairam);
  const saldoRec = Number(data?.saldo_receita ?? receitaEntrou - receitaSaiu);

  const prevYM = shiftMonthDre(mesYM, -1);
  const nextYM = shiftMonthDre(mesYM, 1);
  const canNext = nextYM <= curYM;
  const navBase = "px-2 py-1 rounded border text-xs transition-colors";
  const isMTD = mesYM === curYM;

  return (
    <div className="bg-[var(--asb-card)] border border-[var(--asb-border)] rounded-lg p-4 shadow-[0_0_24px_-8px_rgba(79,125,240,0.45)]">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2" style={{ marginBottom: -18 }}>
          <SectionHead Icon={ArrowLeftRight} color="#4f7df0" title="Movimento de carteira" desc={`${MESES_DRE[m - 1]} ${y}`} />
          {isMTD && (
            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded" style={{ background: "#D4A01722", color: "#D4A017", fontFamily: theme.font.label }}>
              MTD · mês em curso
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/clientes?tab=ativos&mes=${prevYM}`} className={`${navBase} border-[var(--asb-border)] text-slate-200 hover:border-[#185FA5]`}>{"<"}</Link>
          {canNext ? (
            <Link href={`/dashboard/clientes?tab=ativos&mes=${nextYM}`} className={`${navBase} border-[var(--asb-border)] text-slate-200 hover:border-[#185FA5]`}>{">"}</Link>
          ) : (
            <span className={`${navBase} border-[var(--asb-card)] text-gray-700 cursor-not-allowed`} aria-disabled>{">"}</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile
          label="Novos clientes"
          value={novosClientes}
          accent="#22c55e"
          num="#22c55e"
          badges={
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={monoChip("#22c55e")}>{brl(receitaNovos)}</span>
              <span style={{ fontSize: 10, fontWeight: 800, fontFamily: theme.font.label, color: "#8bb4ff", background: "#8bb4ff1a", borderRadius: 3, padding: "1px 5px" }}>CP {novosCp}</span>
              <span style={{ fontSize: 10, fontWeight: 800, fontFamily: theme.font.label, color: "#22c55e", background: "#22c55e1a", borderRadius: 3, padding: "1px 5px" }}>ORG {novosOrg}</span>
            </span>
          }
          sub="CP campanha · ORG orgânico · 1º pedido no mês"
        />
        <StatTile
          label="Deixou de faturar"
          value={sairam}
          accent="#D4A017"
          num="#D4A017"
          badges={<span style={monoChip("#D4A017")}>{brl(receitaSaiu)}</span>}
          sub="faturava e parou no mês"
        />
        <StatTile
          label="Saldo"
          value={sNum(saldoCli)}
          accent={saldoCli >= 0 ? "#22c55e" : "#C8102E"}
          num={saldoCli >= 0 ? "#22c55e" : "#C8102E"}
          badges={<span style={monoChip(saldoRec >= 0 ? "#22c55e" : "#C8102E")}>{sBrl(saldoRec)}</span>}
          sub="líquido (entrou − saiu)"
        />
        <StatTile
          label={`Recuperados · ${recMesTitle}`}
          value={recCount}
          accent="#f97316"
          num="#f97316"
          badges={<span style={monoChip("#f97316")}>{brl(recReceita)}</span>}
          sub={`voltaram após 60+ dias fora · gap méd ${recGap}d`}
        />
      </div>
    </div>
  );
}

// ── Aba ATIVOS / Carteira viva — fetch (server) → AtivosCarteira (client, busca + colunas) ──────
async function AtivosPanel({ healthFilter, mes }: { healthFilter: string; mes?: string }) {
  const supabase = await createClient();

  // Fonte: v_carteira_360 — carteira REAL ARES. Só a carteira VIVA (ativo/atencao = está comprando);
  // risco/churn/inativo NÃO aparecem aqui (vivem na aba Churn). Chip aplicado no server; a busca por
  // nome/cidade é client-side (zero chamada nova) no AtivosCarteira.
  // RBAC: a aba hoje não escopa por vendedor logado (mostra a carteira inteira).
  // universo VIVO completo (ativo+atencao); o filtro por status é client-side no AtivosCarteira.
  // RECUPERADOS (KPI informativo, não-clicável): contagem do mês selecionado — mesma resolução do hero.
  const now = new Date();
  const curYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mesYM = mes && /^\d{4}-\d{2}$/.test(mes) && mes <= curYM ? mes : curYM;
  const [{ data: carteira }, { data: recData }] = await Promise.all([
    supabase
      .from("v_carteira_360")
      .select("ares_pessoa_id, lead_id, name, city, vendedor_nome, customer_status, customer_tier, dias_sem_compra, total_revenue_brl, total_orders")
      .in("customer_status", ["ativo", "atencao"])
      .order("total_revenue_brl", { ascending: false, nullsFirst: false }),
    supabase
      .from("v_clientes_recuperados")
      .select("ares_cliente_id, cliente_nome, vendedor_routing_team, data_retorno, gap_dias, valor_retorno")
      .eq("mes_retorno", `${mesYM}-01`)
      .order("data_retorno", { ascending: false }),
  ]);
  const recRows = (recData ?? []) as {
    ares_cliente_id: number; cliente_nome: string | null; vendedor_routing_team: string | null;
    data_retorno: string; gap_dias: number; valor_retorno: number | null;
  }[];
  const recIds = [...new Set(recRows.map((r) => r.ares_cliente_id))];
  const recuperadosCount = recIds.length;
  const recuperadosMes = MESES_DRE[Number(mesYM.split("-")[1]) - 1];
  // cidade: v_clientes_recuperados.cliente_cidade vem NULL → pega `city` da v_carteira_360 por id.
  const cityById = new Map<number, string | null>();
  if (recIds.length) {
    const { data: recCity } = await supabase
      .from("v_carteira_360")
      .select("ares_pessoa_id, city")
      .in("ares_pessoa_id", recIds);
    for (const x of (recCity ?? []) as { ares_pessoa_id: number; city: string | null }[]) cityById.set(x.ares_pessoa_id, x.city);
  }
  const recuperadosDetalhe = recRows.map((r) => ({
    ares_cliente_id: r.ares_cliente_id,
    cliente_nome: r.cliente_nome,
    cidade: cityById.get(r.ares_cliente_id) ?? null,
    vendedor_routing_team: r.vendedor_routing_team,
    data_retorno: r.data_retorno,
    gap_dias: r.gap_dias,
    valor_retorno: r.valor_retorno,
  }));

  return (
    <>
      <DRECarteiraCard mes={mes} />
      <AtivosCarteira rows={(carteira ?? []) as Carteira[]} healthFilter={healthFilter} recuperadosCount={recuperadosCount} recuperadosMes={recuperadosMes} recuperadosDetalhe={recuperadosDetalhe} />
    </>
  );
}

// ── Aba COMPLETA — carteira INTEIRA por vendedor (1259, todos os status + sem_movimentacao) ──────
// Fonte: v_carteira_completa (ares_pessoas atribuídos ⋈ v_carteira_360). Reusa AtivosCarteira.
// Acesso por vendedor: gestor vê 1259; restrito (≠ CUIT) só a própria (.eq routing_team).
// ⚠️ PostgREST trunca em 1000 (DEBT-P2) e a COMPLETA tem 1259 (gestor) → PAGINAR via .range().
const COMPLETA_STATUS = [...STATUS_FILTER_KEYS, "sem_movimentacao"] as const;

async function CompletaPanel({ healthFilter }: { healthFilter: string }) {
  const supabase = await createClient();
  const ctx = await getUserContext();
  const isVendedorRestrito = !!ctx && ctx.isVendedor && !!ctx.routing_team && ctx.routing_team !== "SETOR_CUIT";

  const ALL = COMPLETA_STATUS as readonly string[];

  // universo COMPLETO (todos os 7 status); filtro por status é client-side no AtivosCarteira.
  const PAGE = 1000;
  let all: Carteira[] = [];
  for (let off = 0; ; off += PAGE) {
    let q = supabase
      .from("v_carteira_completa")
      .select("ares_pessoa_id, lead_id, name, city, vendedor_nome, customer_status, customer_tier, dias_sem_compra, total_revenue_brl, total_orders")
      .in("customer_status", [...ALL])
      .order("total_revenue_brl", { ascending: false, nullsFirst: false })
      .range(off, off + PAGE - 1);
    if (isVendedorRestrito) q = q.eq("routing_team", ctx!.routing_team!);
    const { data } = await q;
    const batch = (data ?? []) as Carteira[];
    all = all.concat(batch);
    if (batch.length < PAGE) break; // última página
  }

  return (
    <AtivosCarteira
      rows={all}
      healthFilter={healthFilter}
      tab="completa"
      statusKeys={ALL}
    />
  );
}

// ── Host /clientes — barra de abas + roteamento por ?tab= (server-side) ────────────
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const rawTab = sp.tab ?? "ativos";
  const tab: TabKey = (TABS.some((t) => t.key === rawTab) ? rawTab : "ativos") as TabKey;
  const healthFilter = sp.health ?? "all";
  const mes = sp.mes; // YYYY-MM p/ o DRE de Carteira (default = mes corrente no DRECarteiraCard)

  return (
    <div className="space-y-4">
      <PageHead title="Carteira de Clientes" desc="Carteira real ARES · movimento, saúde e recuperação por vendedor" />

      {/* Abas — pill, ativa = brandAsb + branco + border-bottom 2px */}
      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: `1px solid ${theme.colors.borderDefault}`,
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Link
              key={t.key}
              href={`/dashboard/clientes?tab=${t.key}`}
              style={{
                padding: "8px 16px",
                fontFamily: theme.font.label,
                fontSize: 11,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: active ? "#fff" : theme.colors.neutral,
                background: active ? theme.colors.brandAsb : "transparent",
                borderTopLeftRadius: 4,
                borderTopRightRadius: 4,
                borderBottom: active
                  ? `2px solid ${theme.colors.brandAsb}`
                  : "2px solid transparent",
                textDecoration: "none",
                transition: "all .15s",
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {/* Conteúdo da aba — reusa os server components das rotas existentes */}
      {tab === "upsell" ? (
        <UpSellPage />
      ) : tab === "churn" ? (
        <ChurnPage />
      ) : tab === "completa" ? (
        <CompletaPanel healthFilter={healthFilter} />
      ) : (
        <AtivosPanel healthFilter={healthFilter} mes={mes} />
      )}
    </div>
  );
}
