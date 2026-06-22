import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { AtivosCarteira, type Carteira } from "./ativos-carteira";
// ETAPA8: carteira unificada — abas reusam os server components já existentes das rotas
// (sem reescrever, mover ou deletar; as rotas /recompra //up-sell //churn seguem ativas).
import RecompraPage from "@/app/dashboard/recompra/page";
import UpSellPage from "@/app/dashboard/up-sell/page";
import ChurnPage from "@/app/dashboard/churn/page";

export const dynamic = "force-dynamic";

// ETAPA8: abas da carteira unificada
const TABS = [
  { key: "ativos", label: "Ativos" },
  { key: "recompra", label: "Recompra" },
  { key: "upsell", label: "Up-sell" },
  { key: "churn", label: "Churn" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ── Aba ATIVOS / Carteira viva — fetch (server) → AtivosCarteira (client, busca + colunas) ──────
async function AtivosPanel({ healthFilter }: { healthFilter: string }) {
  const supabase = await createClient();

  // Fonte: v_carteira_360 — carteira REAL ARES. Só a carteira VIVA (ativo/atencao = está comprando);
  // risco/churn/inativo NÃO aparecem aqui (vivem na aba Churn). Chip aplicado no server; a busca por
  // nome/cidade é client-side (zero chamada nova) no AtivosCarteira.
  // RBAC: a aba hoje não escopa por vendedor logado (mostra a carteira inteira).
  const want = healthFilter === "ativo" || healthFilter === "atencao" ? [healthFilter] : ["ativo", "atencao"];
  const { data: carteira } = await supabase
    .from("v_carteira_360")
    .select("ares_pessoa_id, lead_id, name, city, vendedor_nome, customer_status, customer_tier, dias_sem_compra, total_revenue_brl, total_orders")
    .in("customer_status", want)
    .order("total_revenue_brl", { ascending: false, nullsFirst: false });

  return <AtivosCarteira rows={(carteira ?? []) as Carteira[]} healthFilter={healthFilter} />;
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
