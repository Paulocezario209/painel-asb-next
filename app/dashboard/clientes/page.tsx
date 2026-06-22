import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { CUSTOMER_STATUS, STATUS_FILTER_KEYS, statusColor, statusLabel } from "@/lib/customer-status";
// ETAPA8: carteira unificada — abas reusam os server components já existentes das rotas
// (sem reescrever, mover ou deletar; as rotas /recompra //up-sell //churn seguem ativas).
import RecompraPage from "@/app/dashboard/recompra/page";
import UpSellPage from "@/app/dashboard/up-sell/page";
import ChurnPage from "@/app/dashboard/churn/page";

export const dynamic = "force-dynamic";

const STAGE_COLS = [
  { key: "cliente_em_ativacao", label: "Em Ativação", color: "#22C55E" },
  { key: "cliente_ativo", label: "Cliente Ativo", color: "#0F6E56" },
  { key: "cliente_recorrente", label: "Recorrente", color: "#064E3B" },
] as const;

const STATUS_OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "Todos" },
  ...STATUS_FILTER_KEYS.map((k) => ({ key: k as string, label: CUSTOMER_STATUS[k].label })),
];

// ETAPA8: abas da carteira unificada
const TABS = [
  { key: "ativos", label: "Ativos" },
  { key: "recompra", label: "Recompra" },
  { key: "upsell", label: "Up-sell" },
  { key: "churn", label: "Churn" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type Customer = {
  id: string;
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  weekly_volume_kg: number | null;
  funnel_stage: string;
  customer_health: string | null;
  routing_team: string | null;
  owner_seller_id: string | null;
  first_order_at: string | null;
  handoff_at: string | null;
};

type Vendor = { id: string; name: string };

// ── Aba ATIVOS — kanban da carteira (conteúdo original de /clientes, intacto) ──────
async function AtivosPanel({ healthFilter }: { healthFilter: string }) {
  const supabase = await createClient();

  // Carteira inteira (18) — o filtro de saúde é aplicado client-side sobre a saúde MERGED (v_cliente_360).
  const { data: customers } = await supabase
    .from("ai_sdr_leads")
    .select(
      "id, phone, name, restaurant_name, city, weekly_volume_kg, funnel_stage, customer_health, routing_team, owner_seller_id, first_order_at, handoff_at"
    )
    .in("funnel_stage", ["cliente_em_ativacao", "cliente_ativo", "cliente_recorrente"])
    .eq("is_test", false)
    .order("first_order_at", { ascending: false, nullsFirst: false });
  const { data: vendors } = await supabase.from("vendors").select("id, name");
  const vendorMap = new Map<string, string>((vendors ?? []).map((v: Vendor) => [v.id, v.name]));

  // Enriquece badge de saúde/tier via v_cliente_360 (merge por lead_id) — NÃO troca a fonte:
  // a carteira segue de ai_sdr_leads (18). Vinculados por ares_pessoa_id ganham health/tier reais;
  // os sem ares ficam neutros até a ponte por telefone (Fase A p4).
  const leadIds = (customers ?? []).map((c: Customer) => c.id);
  const { data: enrich } = leadIds.length > 0
    ? await supabase.from("v_cliente_360").select("lead_id, customer_status, customer_tier, dias_sem_compra").in("lead_id", leadIds)
    : { data: [] };
  const v360 = new Map<string, { customer_status: string | null; customer_tier: string | null; dias_sem_compra: number | null }>(
    (enrich ?? []).map((e: { lead_id: string; customer_status: string | null; customer_tier: string | null; dias_sem_compra: number | null }) => [
      e.lead_id, { customer_status: e.customer_status, customer_tier: e.customer_tier, dias_sem_compra: e.dias_sem_compra },
    ])
  );

  // Filtro de saúde opera sobre o customer_status MERGED (régua absoluta, mesma fonte do badge).
  // Sem chip: carteira inteira (18). Com chip: só quem casa o status real (os sem vínculo somem).
  const visiveis = healthFilter === "all"
    ? ((customers ?? []) as Customer[])
    : ((customers ?? []) as Customer[]).filter((c) => v360.get(c.id)?.customer_status === healthFilter);

  const byStage: Record<string, Customer[]> = {
    cliente_em_ativacao: [],
    cliente_ativo: [],
    cliente_recorrente: [],
  };
  for (const c of visiveis) {
    byStage[c.funnel_stage]?.push(c);
  }

  const totalCount = visiveis.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{totalCount} clientes na carteira</p>
        <div className="flex gap-2">
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

      {/* Kanban 3 colunas */}
      <div className="grid grid-cols-3 gap-4">
        {STAGE_COLS.map((col) => (
          <div key={col.key} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: col.color, boxShadow: `0 0 6px ${col.color}` }}
                />
                <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                  {col.label}
                </h2>
              </div>
              <span className="text-xs text-gray-500 font-semibold">
                {byStage[col.key].length}
              </span>
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {byStage[col.key].length === 0 && (
                <div className="text-xs text-gray-600 italic py-4 text-center">
                  Nenhum cliente nesta coluna
                </div>
              )}
              {byStage[col.key].map((c) => {
                const m = v360.get(c.id);
                const status = m?.customer_status ?? null;
                return (
                <Link
                  key={c.id}
                  href={`/dashboard/cliente/${c.id}`}
                  className="block bg-[#0f0f0f] border border-[#2a2a2a] hover:border-[#185FA5] rounded-md p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-sm font-semibold text-white truncate flex-1">
                      {c.restaurant_name || c.name || c.phone}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {m?.customer_tier && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#193264] text-white">
                          {m.customer_tier}
                        </span>
                      )}
                      <span
                        className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: statusColor(status), color: "#fff" }}
                      >
                        {statusLabel(status)}
                      </span>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {[c.city, c.weekly_volume_kg ? `${c.weekly_volume_kg}kg/sem` : null,
                      m?.dias_sem_compra != null ? `${m.dias_sem_compra}d s/ comprar` : null, c.phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1">
                    Vendor: {c.owner_seller_id ? vendorMap.get(c.owner_seller_id) ?? "—" : "—"}
                  </div>
                </Link>
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
