import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { theme } from "@/lib/theme";
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
      .select("entraram, receita_entrou, sairam, receita_saiu, saldo_clientes, saldo_receita")
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
  const entraram = Number(data?.entraram ?? 0);
  const receitaEntrou = Number(data?.receita_entrou ?? 0);
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
    <div className="bg-[#16161c] border border-[#2a2a35] rounded-lg p-4 shadow-[0_0_24px_-8px_rgba(79,125,240,0.45)]">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            Movimento de Carteira · {MESES_DRE[m - 1]} {y}
          </h2>
          {isMTD && (
            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded" style={{ background: "#D4A01722", color: "#D4A017" }}>
              MTD · mês em curso
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/clientes?tab=ativos&mes=${prevYM}`} className={`${navBase} border-[#2a2a35] text-slate-200 hover:border-[#185FA5]`}>{"<"}</Link>
          {canNext ? (
            <Link href={`/dashboard/clientes?tab=ativos&mes=${nextYM}`} className={`${navBase} border-[#2a2a35] text-slate-200 hover:border-[#185FA5]`}>{">"}</Link>
          ) : (
            <span className={`${navBase} border-[#1a1a1a] text-gray-700 cursor-not-allowed`} aria-disabled>{">"}</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <div className="text-3xl font-bold" style={{ color: "#22c55e" }}>{entraram}</div>
          <div className="text-sm font-bold" style={{ color: "#22c55e" }}>{brl(receitaEntrou)}</div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-white mt-1">Entrou / Voltou</div>
          <div className="text-[10px] text-slate-400">faturou no mês, não no anterior</div>
        </div>
        <div>
          <div className="text-3xl font-bold" style={{ color: "#D4A017" }}>{sairam}</div>
          <div className="text-sm font-bold" style={{ color: "#D4A017" }}>{brl(receitaSaiu)}</div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-white mt-1">Deixou de Faturar</div>
          <div className="text-[10px] text-slate-400">faturava e parou no mês</div>
        </div>
        <div>
          <div className="text-3xl font-bold" style={{ color: saldoCli >= 0 ? "#22c55e" : "#C8102E" }}>{sNum(saldoCli)}</div>
          <div className="text-sm font-bold" style={{ color: saldoRec >= 0 ? "#22c55e" : "#C8102E" }}>{sBrl(saldoRec)}</div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-white mt-1">Saldo</div>
          <div className="text-[10px] text-slate-400">líquido (entrou − saiu)</div>
        </div>
        <div>
          <div className="text-3xl font-bold" style={{ color: "#22c55e" }}>{recCount}</div>
          <div className="text-sm font-bold" style={{ color: "#22c55e" }}>{brl(recReceita)}</div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-white mt-1">Recuperados · {recMesLabel}</div>
          <div className="text-[10px] text-slate-400">voltaram após 60+ dias fora · gap méd {recGap}d</div>
        </div>
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
  const { data: carteira } = await supabase
    .from("v_carteira_360")
    .select("ares_pessoa_id, lead_id, name, city, vendedor_nome, customer_status, customer_tier, dias_sem_compra, total_revenue_brl, total_orders")
    .in("customer_status", ["ativo", "atencao"])
    .order("total_revenue_brl", { ascending: false, nullsFirst: false });

  return (
    <>
      <DRECarteiraCard mes={mes} />
      <AtivosCarteira rows={(carteira ?? []) as Carteira[]} healthFilter={healthFilter} />
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
      <h1 className="text-2xl font-bold text-white">Carteira de Clientes</h1>

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
