import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerActions } from "./customer-actions";

export const dynamic = "force-dynamic";

type Vendor = { id: string; name: string; routing_team: string | null };

const HEALTH_COLORS: Record<string, string> = {
  healthy: "#22C55E",
  at_risk: "#BA7517",
  inactive: "#BA1717",
  recovered: "#185FA5",
};

const STAGE_LABELS: Record<string, string> = {
  cliente_em_ativacao: "Em Ativação",
  cliente_ativo: "Cliente Ativo",
  cliente_recorrente: "Recorrente",
  lead_perdido: "Perdido",
};

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from("ai_sdr_leads")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !lead) return notFound();

  const { data: vendors } = await supabase
    .from("vendors")
    .select("id, name, routing_team")
    .eq("active", true)
    .order("name");

  const { data: events } = await supabase
    .from("funnel_stage_events")
    .select("from_stage, to_stage, actor, created_at, metadata")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const { data: overrides } = await supabase
    .from("customer_overrides")
    .select("from_owner_seller_id, to_owner_seller_id, motivo, actor, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // F3: métricas calculadas pelo worker customer_lifecycle (cache)
  const { data: lifecycleState } = await supabase
    .from("customer_lifecycle_state")
    .select("*")
    .eq("lead_id", id)
    .maybeSingle();

  // Bonus: up-sell oportunidade (se aplicável)
  const { data: upsellOp } = await supabase
    .from("v_upsell_oportunidades")
    .select("*")
    .eq("lead_id", id)
    .maybeSingle();

  // Bonus: tier upgrade candidate (se aplicável)
  const { data: tierUp } = await supabase
    .from("v_tier_upgrade_candidates")
    .select("*")
    .eq("lead_id", id)
    .maybeSingle();

  const vendorMap = new Map<string, string>(
    (vendors ?? []).map((v: Vendor) => [v.id, v.name])
  );

  const inCarteira = ["cliente_em_ativacao", "cliente_ativo", "cliente_recorrente"].includes(
    lead.funnel_stage
  );

  return (
    <div className="space-y-4 max-w-5xl">
      <Link
        href="/dashboard/clientes"
        className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-white"
      >
        ← Carteira de Clientes
      </Link>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#193264] to-[#0F1F40] border-b-2 border-[#BA1717] rounded-lg p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-white truncate">
              {lead.restaurant_name || lead.name || lead.phone}
            </h1>
            <div className="text-sm text-white/70 mt-1 truncate">
              {[lead.city, lead.segment, lead.weekly_volume_kg ? `${lead.weekly_volume_kg}kg/sem` : null, lead.phone]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white px-3 py-1 rounded">
              {STAGE_LABELS[lead.funnel_stage] ?? lead.funnel_stage}
            </span>
            {lead.customer_health && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
                style={{
                  background: HEALTH_COLORS[lead.customer_health] ?? "#9696AF",
                  color: "#fff",
                }}
              >
                {lead.customer_health}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Data card */}
        <div className="col-span-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Dados</h2>
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-4 text-sm">
            <dt className="text-gray-500 text-xs uppercase tracking-wide">Cidade</dt>
            <dd className="text-white">{lead.city ?? "—"}</dd>
            <dt className="text-gray-500 text-xs uppercase tracking-wide">Segmento</dt>
            <dd className="text-white">{lead.segment ?? "—"}</dd>
            <dt className="text-gray-500 text-xs uppercase tracking-wide">Produto</dt>
            <dd className="text-white">{lead.product_type ?? "—"}</dd>
            <dt className="text-gray-500 text-xs uppercase tracking-wide">Volume</dt>
            <dd className="text-white">{lead.weekly_volume_kg ? `${lead.weekly_volume_kg}kg/sem` : "—"}</dd>
            <dt className="text-gray-500 text-xs uppercase tracking-wide">First order</dt>
            <dd className="text-white">{lead.first_order_at ? new Date(lead.first_order_at).toLocaleDateString("pt-BR") : "—"}</dd>
            <dt className="text-gray-500 text-xs uppercase tracking-wide">Owner</dt>
            <dd className="text-white">{lead.owner_seller_id ? vendorMap.get(lead.owner_seller_id) ?? "—" : "—"}</dd>
            <dt className="text-gray-500 text-xs uppercase tracking-wide">Team</dt>
            <dd className="text-white">{lead.routing_team ?? "—"}</dd>
            {lead.customer_exit_reason && (
              <>
                <dt className="text-gray-500 text-xs uppercase tracking-wide">Exit reason</dt>
                <dd className="text-red-400">{lead.customer_exit_reason}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Actions (apenas se em carteira) */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Ações</h2>
          {inCarteira ? (
            <CustomerActions
              leadId={lead.id}
              stage={lead.funnel_stage}
              currentHealth={lead.customer_health}
              currentOwner={lead.owner_seller_id}
              vendors={vendors ?? []}
            />
          ) : (
            <div className="text-xs text-gray-500 italic">
              Lead fora da carteira ({STAGE_LABELS[lead.funnel_stage] ?? lead.funnel_stage}).
              Ações cliente desabilitadas.
            </div>
          )}
        </div>
      </div>

      {/* F3 — Métricas calculadas pelo worker */}
      {lifecycleState && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Métricas da Carteira (worker daily 6h BRT)
            </h2>
            <span className="text-[10px] text-gray-500 font-mono">
              Calculado em {lifecycleState.last_computed_at ? new Date(lifecycleState.last_computed_at).toLocaleString("pt-BR") : "—"}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Pedidos</div>
              <div className="text-2xl font-bold text-white mt-1">{lifecycleState.total_orders ?? 0}</div>
            </div>
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Tier ABC</div>
              <div
                className="text-2xl font-bold mt-1"
                style={{
                  color: lifecycleState.customer_tier === "A" ? "#D4A017" :
                         lifecycleState.customer_tier === "B" ? "#185FA5" :
                         lifecycleState.customer_tier === "C" ? "#9696AF" : "#555",
                }}
              >
                {lifecycleState.customer_tier ?? "—"}
              </div>
            </div>
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Receita BRL</div>
              <div className="text-xl font-bold text-white mt-1">
                R$ {Number(lifecycleState.total_revenue_brl ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Ticket Médio</div>
              <div className="text-xl font-bold text-white mt-1">
                R$ {Number(lifecycleState.avg_ticket_brl ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">1º Pedido</div>
              <div className="text-sm font-semibold text-white mt-1">
                {lifecycleState.first_order_at ? new Date(lifecycleState.first_order_at).toLocaleDateString("pt-BR") : "—"}
              </div>
            </div>
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Último Pedido</div>
              <div className="text-sm font-semibold text-white mt-1">
                {lifecycleState.last_order_at ? new Date(lifecycleState.last_order_at).toLocaleDateString("pt-BR") : "—"}
              </div>
            </div>
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Dias Sem Comprar</div>
              <div
                className="text-xl font-bold mt-1"
                style={{
                  color: !lifecycleState.days_since_last_order ? "#fff" :
                         lifecycleState.days_since_last_order > 60 ? "#BA1717" :
                         lifecycleState.days_since_last_order > 14 ? "#BA7517" : "#22C55E",
                }}
              >
                {lifecycleState.days_since_last_order ?? "—"}d
              </div>
            </div>
            <div className="bg-[#0f0f0f] border border-[#2a2a2a] rounded p-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Próxima Esperada</div>
              <div className="text-sm font-semibold text-white mt-1">
                {lifecycleState.next_expected_order_at ? new Date(lifecycleState.next_expected_order_at).toLocaleDateString("pt-BR") : "—"}
              </div>
              {lifecycleState.avg_order_interval_days && (
                <div className="text-[10px] text-gray-500 mt-1">
                  avg {Number(lifecycleState.avg_order_interval_days).toFixed(1)}d
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bonus: cards de oportunidade lado a lado */}
      {(upsellOp || tierUp) && (
        <div className="grid grid-cols-2 gap-4">
          {upsellOp && (
            <div
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4"
              style={{ borderLeft: "3px solid #BA7517" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 18 }}>🎯</span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#E0993A]">
                  Oportunidade de Up-sell
                </h2>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-500">Ticket atual:</span>{" "}
                  <span className="text-white font-semibold">
                    R$ {Number(upsellOp.cliente_ticket).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Média Tier {upsellOp.customer_tier}:</span>{" "}
                  <span className="text-white font-semibold">
                    R$ {Number(upsellOp.tier_avg_ticket).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Gap:</span>{" "}
                  <span className="text-[#E0993A] font-bold">{upsellOp.gap_pct}% abaixo</span>
                </div>
                <div className="pt-2 mt-2 border-t border-[#2a2a2a]">
                  <span className="text-gray-500">Potencial anual se subir pra média:</span>
                  <div className="text-[#22C55E] font-bold text-lg mt-1">
                    + R$ {Number(upsellOp.potencial_anual_brl).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tierUp && (
            <div
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4"
              style={{ borderLeft: "3px solid #185FA5" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 18 }}>⬆</span>
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#4FA3E8]">
                  Sugestão de Tier Upgrade
                </h2>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Tier atual:</span>
                  <span
                    className="px-2 py-0.5 rounded font-bold"
                    style={{ background: "#9696AF", color: "#fff" }}
                  >
                    {tierUp.tier_atual}
                  </span>
                  <span className="text-gray-500">→</span>
                  <span className="text-gray-500">Sugerido:</span>
                  <span
                    className="px-2 py-0.5 rounded font-bold"
                    style={{
                      background: tierUp.tier_sugerido === "A" ? "#D4A017" : "#185FA5",
                      color: "#fff",
                    }}
                  >
                    {tierUp.tier_sugerido}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Volume:</span>{" "}
                  <span className="text-white font-semibold">{tierUp.weekly_volume_kg} kg/sem</span>
                </div>
                <div>
                  <span className="text-gray-500">Razão:</span>{" "}
                  <span className="text-gray-300 text-[10px] font-mono">{tierUp.razao}</span>
                </div>
                <div className="pt-2 mt-2 border-t border-[#2a2a2a] text-[10px] text-gray-500">
                  Reclassificação manual pelo gestor — worker calcula tier
                  automaticamente após first_order+30d baseado em weekly_volume_kg.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
          Timeline ({events?.length ?? 0} eventos)
        </h2>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {(events ?? []).map((ev, i: number) => (
            <div key={i} className="flex items-start gap-3 text-xs border-l-2 border-[#185FA5] pl-3 py-1">
              <span className="text-gray-500 shrink-0 w-32 font-mono">
                {new Date(ev.created_at).toLocaleString("pt-BR")}
              </span>
              <span className="text-white">
                <span className="text-gray-400">{ev.from_stage}</span>
                {" → "}
                <span className="font-semibold">{ev.to_stage}</span>
                <span className="text-gray-500 ml-2">({ev.actor})</span>
              </span>
            </div>
          ))}
          {(!events || events.length === 0) && (
            <div className="text-xs text-gray-600 italic">Sem eventos.</div>
          )}
        </div>
      </div>

      {/* Reassign log */}
      {overrides && overrides.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
            Reassign log ({overrides.length})
          </h2>
          <div className="space-y-2">
            {overrides.map((o, i: number) => (
              <div key={i} className="text-xs flex items-start gap-3 border-l-2 border-[#BA7517] pl-3 py-1">
                <span className="text-gray-500 shrink-0 w-32 font-mono">
                  {new Date(o.created_at).toLocaleString("pt-BR")}
                </span>
                <span className="text-white">
                  <span className="text-gray-400">{o.from_owner_seller_id ? vendorMap.get(o.from_owner_seller_id) ?? "—" : "—"}</span>
                  {" → "}
                  <span className="font-semibold">{vendorMap.get(o.to_owner_seller_id) ?? "—"}</span>
                  <div className="text-gray-500">Motivo: {o.motivo}</div>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
