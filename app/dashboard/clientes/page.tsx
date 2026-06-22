import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { CUSTOMER_STATUS, statusColor, statusLabel } from "@/lib/customer-status";
// ETAPA8: carteira unificada — abas reusam os server components já existentes das rotas
// (sem reescrever, mover ou deletar; as rotas /recompra //up-sell //churn seguem ativas).
import RecompraPage from "@/app/dashboard/recompra/page";
import UpSellPage from "@/app/dashboard/up-sell/page";
import ChurnPage from "@/app/dashboard/churn/page";

export const dynamic = "force-dynamic";

// aba ATIVOS = carteira VIVA: só os estados que estão comprando.
// risco/pré-churn/churn/inativo vivem na aba Churn — chips removidos daqui.
const LIVE_STATUS = ["ativo", "atencao"] as const;
const STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  ...LIVE_STATUS.map((k) => ({ key: k as string, label: CUSTOMER_STATUS[k].label })),
];

const brl = (n: number | null) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// ETAPA8: abas da carteira unificada
const TABS = [
  { key: "ativos", label: "Ativos" },
  { key: "recompra", label: "Recompra" },
  { key: "upsell", label: "Up-sell" },
  { key: "churn", label: "Churn" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type Carteira = {
  ares_pessoa_id: number;
  lead_id: string | null;
  name: string | null;
  city: string | null;
  vendedor_nome: string | null;
  customer_status: string;
  customer_tier: string | null;
  dias_sem_compra: number | null;
  total_revenue_brl: number | null;
  total_orders: number | null;
};

// ── Aba ATIVOS / Carteira viva — v_carteira_360 (ativo+atencao), por vendedor ──────
async function AtivosPanel({ healthFilter }: { healthFilter: string }) {
  const supabase = await createClient();

  // Fonte: v_carteira_360 — carteira REAL ARES. Só a carteira VIVA (ativo/atencao = está comprando);
  // risco/churn/inativo NÃO aparecem aqui (vivem na aba Churn).
  // RBAC: a aba hoje não escopa por vendedor logado (mostra a carteira inteira); owner_seller_id/
  // vendedor_nome ficam na view se vier a escopar.
  const want = healthFilter === "ativo" || healthFilter === "atencao" ? [healthFilter] : ["ativo", "atencao"];
  const { data: carteira } = await supabase
    .from("v_carteira_360")
    .select("ares_pessoa_id, lead_id, name, city, vendedor_nome, customer_status, customer_tier, dias_sem_compra, total_revenue_brl, total_orders")
    .in("customer_status", want)
    .order("total_revenue_brl", { ascending: false, nullsFirst: false });

  const rows = (carteira ?? []) as Carteira[];

  // Agrupa por vendedor (coluna). rows já vem por receita DESC → cada coluna fica ordenada.
  const byVendedor = new Map<string, Carteira[]>();
  for (const c of rows) {
    const k = c.vendedor_nome ?? "Sem vendedor";
    if (!byVendedor.has(k)) byVendedor.set(k, []);
    byVendedor.get(k)!.push(c);
  }
  const colunas = [...byVendedor.entries()]
    .map(([nome, list]) => ({ nome, list, receita: list.reduce((s, c) => s + (c.total_revenue_brl ?? 0), 0) }))
    .sort((a, b) => b.receita - a.receita);

  const totalCount = rows.length;
  const totalRevenue = rows.reduce((s, c) => s + (c.total_revenue_brl ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-400">
          {totalCount} clientes ativos na carteira · {brl(totalRevenue)} faturado
        </p>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => {
            const active = healthFilter === opt.key;
            return (
              <Link
                key={opt.key}
                href={`/dashboard/clientes?tab=ativos&health=${opt.key}`}
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-all ${
                  active
                    ? "bg-[#193264] text-white"
                    : "bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Colunas por vendedor (carteira viva), receita DESC dentro de cada */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {colunas.map((col) => (
          <div key={col.nome} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2a2a]">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white truncate">{col.nome}</h2>
              <span className="text-xs text-gray-500 font-semibold shrink-0 ml-2">
                {col.list.length} · {brl(col.receita)}
              </span>
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {col.list.map((c) => {
                const card = (
                  <div className="bg-[#0f0f0f] border border-[#2a2a2a] hover:border-[#185FA5] rounded-md p-3 transition-all">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="text-sm font-semibold text-white truncate flex-1">
                        {c.name || `cliente ${c.ares_pessoa_id}`}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.customer_tier && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#193264] text-white">
                            {c.customer_tier}
                          </span>
                        )}
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ background: statusColor(c.customer_status), color: "#fff" }}
                        >
                          {statusLabel(c.customer_status)}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-gray-500 truncate">
                      {[c.city, c.dias_sem_compra != null ? `${c.dias_sem_compra}d s/ comprar` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1">{brl(c.total_revenue_brl)} faturado</div>
                  </div>
                );
                return c.lead_id ? (
                  <Link key={c.ares_pessoa_id} href={`/dashboard/cliente/${c.lead_id}`} className="block">
                    {card}
                  </Link>
                ) : (
                  <div key={c.ares_pessoa_id}>{card}</div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
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
                fontFamily: theme.font.mono,
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
      {tab === "recompra" ? (
        <RecompraPage />
      ) : tab === "upsell" ? (
        <UpSellPage />
      ) : tab === "churn" ? (
        <ChurnPage />
      ) : (
        <AtivosPanel healthFilter={healthFilter} />
      )}
    </div>
  );
}
