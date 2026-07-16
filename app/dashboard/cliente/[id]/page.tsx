import { createClient } from "@/lib/supabase/server";
import { theme } from "@/lib/theme";
import { statusColor, statusLabel } from "@/lib/customer-status";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerActions } from "./customer-actions";
import { PageHead, SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import {
  Info,
  Settings2,
  BarChart3,
  Sparkles,
  Target,
  TrendingDown,
  ChevronsUp,
  History,
  Repeat,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Vendor = { id: string; name: string; routing_team: string | null };

const HEALTH_COLORS: Record<string, string> = {
  healthy: "#22C55E",
  at_risk: "#BA7517",
  inactive: "#BA1717",
  recovered: theme.colors.brandAsb,
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

  // 3b: status oficial (régua absoluta fn_status_cliente) — fonte CANÔNICA
  // v_carteira_360 (carteira real ARES). Era o ÚLTIMO consumidor de v_cliente_360
  // (em depreciação, DEBT-179) — mesmas colunas, zero mudança visual (fix 2026-07-10).
  const { data: cliente360 } = await supabase
    .from("v_carteira_360")
    .select("customer_status, dias_sem_compra")
    .eq("lead_id", id)
    .maybeSingle();

  // Bonus: up-sell oportunidade (se aplicável)
  const { data: upsellOp } = await supabase
    .from("v_upsell_oportunidades")
    .select("*")
    .eq("lead_id", id)
    .maybeSingle();

  // Bonus: downsell risco queda (espelho simétrico do up-sell)
  const { data: downsellRisk } = await supabase
    .from("v_downsell_risco_queda")
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
        className="inline-flex items-center gap-2 text-xs text-slate-200 hover:text-white"
      >
        ← Carteira de Clientes
      </Link>

      {/* Header */}
      <div className="asb-card p-5" style={{ borderTop: "2px solid #C8102E" }}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <PageHead
              title={lead.restaurant_name || lead.name || lead.phone}
              desc={[lead.city, lead.segment, lead.weekly_volume_kg ? `${lead.weekly_volume_kg}kg/sem` : null, lead.phone]
                .filter(Boolean)
                .join(" · ")}
            />
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white px-3 py-1 rounded">
              {STAGE_LABELS[lead.funnel_stage] ?? lead.funnel_stage}
            </span>
            {cliente360?.customer_status && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded"
                style={{
                  background: statusColor(cliente360.customer_status),
                  color: "#fff",
                }}
              >
                {statusLabel(cliente360.customer_status)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Data card */}
        <div className="col-span-2 asb-card p-4">
          <SectionHead Icon={Info} color="#8bb4ff" title="Dados" desc="Ficha do cliente" />
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 gap-x-4 text-sm">
            <dt className="text-slate-200 text-xs uppercase tracking-wide">Cidade</dt>
            <dd className="text-white">{lead.city ?? "—"}</dd>
            <dt className="text-slate-200 text-xs uppercase tracking-wide">Segmento</dt>
            <dd className="text-white">{lead.segment ?? "—"}</dd>
            <dt className="text-slate-200 text-xs uppercase tracking-wide">Produto</dt>
            <dd className="text-white">{lead.product_type ?? "—"}</dd>
            <dt className="text-slate-200 text-xs uppercase tracking-wide">Volume</dt>
            <dd className="text-white">{lead.weekly_volume_kg ? `${lead.weekly_volume_kg}kg/sem` : "—"}</dd>
            <dt className="text-slate-200 text-xs uppercase tracking-wide">First order</dt>
            <dd className="text-white">{lead.first_order_at ? new Date(lead.first_order_at).toLocaleDateString("pt-BR") : "—"}</dd>
            <dt className="text-slate-200 text-xs uppercase tracking-wide">Owner</dt>
            <dd className="text-white">{lead.owner_seller_id ? vendorMap.get(lead.owner_seller_id) ?? "—" : "—"}</dd>
            <dt className="text-slate-200 text-xs uppercase tracking-wide">Team</dt>
            <dd className="text-white">{lead.routing_team ?? "—"}</dd>
            {lead.customer_exit_reason && (
              <>
                <dt className="text-slate-200 text-xs uppercase tracking-wide">Exit reason</dt>
                <dd className="text-red-400">{lead.customer_exit_reason}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Actions (apenas se em carteira) */}
        <div className="asb-card p-4">
          <SectionHead Icon={Settings2} color="#f59e0b" title="Ações" desc="Gestão do cliente" />
          {inCarteira ? (
            <CustomerActions
              leadId={lead.id}
              stage={lead.funnel_stage}
              currentHealth={lead.customer_health}
              currentOwner={lead.owner_seller_id}
              vendors={vendors ?? []}
            />
          ) : (
            <div className="text-xs text-slate-200 italic">
              Lead fora da carteira ({STAGE_LABELS[lead.funnel_stage] ?? lead.funnel_stage}).
              Ações cliente desabilitadas.
            </div>
          )}
        </div>
      </div>

      {/* F3 — Métricas calculadas pelo worker */}
      {lifecycleState && (
        <div className="asb-card p-4">
          <SectionHead
            Icon={BarChart3}
            color="#22c55e"
            title="Métricas da Carteira"
            desc={`Worker diário 6h BRT · calculado ${lifecycleState.last_computed_at ? new Date(lifecycleState.last_computed_at).toLocaleString("pt-BR") : "—"}`}
          />
          <div className="grid grid-cols-4 gap-3">
            <StatTile label="Pedidos" value={lifecycleState.total_orders ?? 0} />
            <StatTile
              label="Tier ABC"
              value={lifecycleState.customer_tier ?? "—"}
              num={
                lifecycleState.customer_tier === "A" ? theme.colors.warning :
                lifecycleState.customer_tier === "B" ? theme.colors.brandAsb :
                lifecycleState.customer_tier === "C" ? "#9696AF" : "#555"
              }
            />
            <StatTile
              label="Receita BRL"
              value={`R$ ${Number(lifecycleState.total_revenue_brl ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <StatTile
              label="Ticket Médio"
              value={`R$ ${Number(lifecycleState.avg_ticket_brl ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <StatTile
              label="1º Pedido"
              value={lifecycleState.first_order_at ? new Date(lifecycleState.first_order_at).toLocaleDateString("pt-BR") : "—"}
            />
            <StatTile
              label="Último Pedido"
              value={lifecycleState.last_order_at ? new Date(lifecycleState.last_order_at).toLocaleDateString("pt-BR") : "—"}
            />
            <StatTile
              label="Dias Sem Comprar"
              value={`${lifecycleState.days_since_last_order ?? "—"}d`}
              num={
                !lifecycleState.days_since_last_order ? "#FFFFFF" :
                lifecycleState.days_since_last_order > 60 ? "#BA1717" :
                lifecycleState.days_since_last_order > 14 ? "#BA7517" : "#22C55E"
              }
            />
            <StatTile
              label="Próxima Esperada"
              value={lifecycleState.next_expected_order_at ? new Date(lifecycleState.next_expected_order_at).toLocaleDateString("pt-BR") : "—"}
              sub={lifecycleState.avg_order_interval_days ? `média ${Number(lifecycleState.avg_order_interval_days).toFixed(1)}d` : undefined}
            />
          </div>
        </div>
      )}

      {/* FIX3: Oportunidades de expansão — seção sempre visível (cards ou empty state) */}
      <div>
        <SectionHead Icon={Sparkles} color="#f59e0b" title="Oportunidades de Expansão" desc="Up-sell, risco de queda e upgrade de tier" />
        {(upsellOp || downsellRisk || tierUp) ? (
        <div className="grid grid-cols-2 gap-4">
          {upsellOp && (
            <div
              className="asb-card p-4"
              style={{ borderLeft: "3px solid #BA7517" }}
            >
              <SectionHead Icon={Target} color="#E0993A" title="Oportunidade de Up-sell" />

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-200">Ticket atual:</span>{" "}
                  <span className="text-white font-semibold">
                    R$ {Number(upsellOp.cliente_ticket).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-200">Média Tier {upsellOp.customer_tier}:</span>{" "}
                  <span className="text-white font-semibold">
                    R$ {Number(upsellOp.tier_avg_ticket).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-200">Gap:</span>{" "}
                  <span className="text-[#E0993A] font-bold">{upsellOp.gap_pct}% abaixo</span>
                </div>
                <div className="pt-2 mt-2 border-t border-[var(--asb-border)]">
                  <span className="text-slate-200">Potencial anual se subir pra média:</span>
                  <div className="text-[#22C55E] font-bold text-lg mt-1">
                    + R$ {Number(upsellOp.potencial_anual_brl).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                {lead.phone && (
                  <a
                    href={`https://wa.me/${String(lead.phone).replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center justify-center gap-1 w-full rounded px-3 py-2 text-xs font-bold uppercase tracking-wider"
                    style={{
                      background: theme.colors.success,
                      color: "#0a0f1f",
                      fontFamily: theme.font.label,
                    }}
                  >
                    💬 Iniciar conversa
                  </a>
                )}
              </div>
            </div>
          )}

          {downsellRisk && (
            <div
              className="asb-card p-4"
              style={{ borderLeft: "3px solid #BA1717" }}
            >
              <SectionHead Icon={TrendingDown} color="#E84545" title="Risco de Queda — Ticket Inflado" />

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-200">Ticket atual:</span>{" "}
                  <span className="text-white font-semibold">
                    R$ {Number(downsellRisk.cliente_ticket).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-200">Média Tier {downsellRisk.customer_tier}:</span>{" "}
                  <span className="text-white font-semibold">
                    R$ {Number(downsellRisk.tier_avg_ticket).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-200">Acima da média:</span>{" "}
                  <span className="text-[#E84545] font-bold">+{downsellRisk.excesso_pct}%</span>
                </div>
                <div className="pt-2 mt-2 border-t border-[var(--asb-border)]">
                  <span className="text-slate-200">Revenue em risco (se buscar alternativa mais barata):</span>
                  <div className="text-[#E84545] font-bold text-lg mt-1">
                    R$ {Number(downsellRisk.revenue_em_risco_brl).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tierUp && (
            <div
              className="asb-card p-4"
              style={{ borderLeft: `3px solid ${theme.colors.brandAsb}` }}
            >
              <SectionHead Icon={ChevronsUp} color="#4FA3E8" title="Sugestão de Tier Upgrade" />

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-200">Tier atual:</span>
                  <span
                    className="px-2 py-0.5 rounded font-bold"
                    style={{ background: "#9696AF", color: "#fff" }}
                  >
                    {tierUp.tier_atual}
                  </span>
                  <span className="text-slate-200">→</span>
                  <span className="text-slate-200">Sugerido:</span>
                  <span
                    className="px-2 py-0.5 rounded font-bold"
                    style={{
                      background: tierUp.tier_sugerido === "A" ? theme.colors.warning : theme.colors.brandAsb,
                      color: "#fff",
                    }}
                  >
                    {tierUp.tier_sugerido}
                  </span>
                </div>
                <div>
                  <span className="text-slate-200">Volume:</span>{" "}
                  <span className="text-white font-semibold">{tierUp.weekly_volume_kg} kg/sem</span>
                </div>
                <div>
                  <span className="text-slate-200">Razão:</span>{" "}
                  <span className="text-slate-200 text-[10px]">{tierUp.razao}</span>
                </div>
                <div className="pt-2 mt-2 border-t border-[var(--asb-border)] text-[10px] text-slate-200">
                  Reclassificação manual pelo gestor — worker calcula tier
                  automaticamente após first_order+30d baseado em weekly_volume_kg.
                </div>
              </div>
            </div>
          )}
        </div>
        ) : (
          <div className="asb-card p-4 text-xs text-gray-600 italic">
            Sem oportunidades identificadas no momento.
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="asb-card p-4">
        <SectionHead Icon={History} color="#8bb4ff" title="Timeline" desc={`${events?.length ?? 0} eventos de etapa`} />
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {(events ?? []).map((ev, i: number) => (
            <div key={i} className="flex items-start gap-3 text-xs border-l-2 border-[#185FA5] pl-3 py-1">
              <span className="text-slate-200 shrink-0 w-32 font-mono">
                {new Date(ev.created_at).toLocaleString("pt-BR")}
              </span>
              <span className="text-white">
                <span className="text-slate-200">{ev.from_stage}</span>
                {" → "}
                <span className="font-semibold">{ev.to_stage}</span>
                <span className="text-slate-200 ml-2">({ev.actor})</span>
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
        <div className="asb-card p-4">
          <SectionHead Icon={Repeat} color="#f59e0b" title="Reassign Log" desc={`${overrides.length} reatribuições`} />
          <div className="space-y-2">
            {overrides.map((o, i: number) => (
              <div key={i} className="text-xs flex items-start gap-3 border-l-2 border-[#BA7517] pl-3 py-1">
                <span className="text-slate-200 shrink-0 w-32 font-mono">
                  {new Date(o.created_at).toLocaleString("pt-BR")}
                </span>
                <span className="text-white">
                  <span className="text-slate-200">{o.from_owner_seller_id ? vendorMap.get(o.from_owner_seller_id) ?? "—" : "—"}</span>
                  {" → "}
                  <span className="font-semibold">{vendorMap.get(o.to_owner_seller_id) ?? "—"}</span>
                  <div className="text-slate-200">Motivo: {o.motivo}</div>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
