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

// ── Aba ATIVOS / Carteira viva — fetch (server) → AtivosCarteira (client, busca + colunas) ──────
async function AtivosPanel({ healthFilter }: { healthFilter: string }) {
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

  return <AtivosCarteira rows={(carteira ?? []) as Carteira[]} healthFilter={healthFilter} />;
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
      {tab === "upsell" ? (
        <UpSellPage />
      ) : tab === "churn" ? (
        <ChurnPage />
      ) : tab === "completa" ? (
        <CompletaPanel healthFilter={healthFilter} />
      ) : (
        <AtivosPanel healthFilter={healthFilter} />
      )}
    </div>
  );
}
