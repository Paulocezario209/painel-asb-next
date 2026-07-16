import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  QualificationFunnel,
  WeeklyConversions,
  VendorPerformance,
} from "@/components/dashboard/charts";
import { CardTop10ClientesMes } from "@/components/dashboard/card-top10-clientes-mes";
import { CardReconciliarAres } from "@/components/dashboard/card-reconciliar-ares";
import { MotivosPerdaChart, type MotivoPerda } from "@/components/dashboard/motivos-perda-chart";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { theme } from "@/lib/theme";
import { VENDOR_LABELS } from "@/lib/vendor-labels";
import { S } from "./lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "./lib/ui";
import { Users, BadgeCheck, PhoneCall, Trophy, XCircle, Target, Filter as FilterIcon, TrendingUp, BarChart3 } from "lucide-react";

export const dynamic = "force-dynamic";


function getWeekLabel(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function abcCurve(vol: number | null): "A" | "B" | "C" {
  if ((vol ?? 0) >= 300) return "A";
  if ((vol ?? 0) >= 100) return "B";
  return "C";
}

const PRODUCT_LABELS: Record<string, string> = {
  hamburguer: "Hambúrguer", espeto: "Espeto", boteco: "Boteco",
  cortes_especiais: "Cortes Especiais", mercearia: "Mercearia",
  molhos: "Molhos", defumados: "Defumados", paes: "Pães", embalagens: "Embalagens",
};

// ── Sparkline: série semanal REAL (últimas 8 semanas) ────────────────────────
const SPARK_WEEKS = 8;
function weeklySeries<T extends Record<string, unknown>>(items: T[], field: keyof T): number[] {
  const now = Date.now();
  const wk = 7 * 24 * 3600 * 1000;
  const buckets = new Array(SPARK_WEEKS).fill(0);
  for (const it of items) {
    const raw = it[field] as string | null;
    if (!raw) continue;
    const diff = Math.floor((now - new Date(raw).getTime()) / wk);
    if (diff >= 0 && diff < SPARK_WEEKS) buckets[SPARK_WEEKS - 1 - diff]++;
  }
  return buckets;
}
function trendPct(s: number[]): number | null {
  const h = Math.floor(s.length / 2);
  const a = s.slice(0, h).reduce((x, y) => x + y, 0);
  const b = s.slice(h).reduce((x, y) => x + y, 0);
  if (a === 0) return b > 0 ? 100 : null;
  return Math.round(((b - a) / a) * 100);
}
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const supabase = await createClient();

  // P2 — filtros: ?vendedor=SETOR_* (afeta tudo) + ?mes=YYYY-MM (afeta só KPIs de volume; alertas ficam "agora")
  const sp = await searchParams;
  const vend = sp?.vendedor && /^SETOR_[A-Z_]+$/.test(sp.vendedor) ? sp.vendedor : null;
  // Default = mês corrente (abre filtrado no mês atual; usuário troca pelo seletor)
  const _hoje = new Date();
  const mesCorrente = `${_hoje.getFullYear()}-${String(_hoje.getMonth() + 1).padStart(2, "0")}`;
  const mesParam = sp?.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : mesCorrente;
  const [_my, _mm] = mesParam.split("-").map(Number);
  const mesIni = `${mesParam}-01`;
  const mesFimEx = `${_mm === 12 ? _my + 1 : _my}-${String(_mm === 12 ? 1 : _mm + 1).padStart(2, "0")}-01`;
  // KPI VOLUME — criados (mês + vendedor)
  let qTotal = supabase.from("ai_sdr_leads").select("*", { count: "exact", head: true }).eq("is_test", false).or("routing_team.is.null,routing_team.neq.fora_de_rota");  // DEBT-167 4
  if (vend) qTotal = qTotal.eq("routing_team", vend);
  if (mesIni && mesFimEx) qTotal = qTotal.gte("created_at", mesIni).lt("created_at", mesFimEx);
  // ALERTA — handoff pendente (DEBT-208: definição CANÔNICA via v_handoff_pendentes;
  // resolver por funnel_stage/confirmar/resposta remove de TODOS os detectores de uma vez)
  let qHandoff = supabase.from("v_handoff_pendentes").select("id, phone, restaurant_name, qual_stage, first_order_at, routing_team, handoff_at, handoff_confirmed, weekly_volume_kg, city, product_groups, human_active, followup_eligible, next_followup_at, horas_desde_handoff");
  if (vend) qHandoff = qHandoff.eq("routing_team", vend);
  // KPI VOLUME — qualificados (mês + vendedor)
  let qQual = supabase.from("ai_sdr_leads").select("*", { count: "exact", head: true }).eq("is_test", false).gte("qual_stage", 7).or("routing_team.is.null,routing_team.neq.fora_de_rota");  // DEBT-167 4
  if (vend) qQual = qQual.eq("routing_team", vend);
  if (mesIni && mesFimEx) qQual = qQual.gte("created_at", mesIni).lt("created_at", mesFimEx);
  // LISTA — alertas/ABC/cidades (estado "agora", só vendedor)
  let qLeads = supabase.from("ai_sdr_leads").select("id, phone, restaurant_name, qual_stage, first_order_at, routing_team, handoff_at, handoff_confirmed, weekly_volume_kg, city, product_groups, human_active, followup_eligible, next_followup_at, created_at").eq("is_test", false).or("routing_team.is.null,routing_team.neq.fora_de_rota");  // DEBT-167 4: ABC+topCities+urgentA+alertas (+created_at p/ sparklines)
  if (vend) qLeads = qLeads.eq("routing_team", vend);

  const [
    { count: totalLeads },
    { data: pendRaw },
    { count: qualifiedLeads },
    { data: allLeads },
    { data: motivosPerda },
  ] = await Promise.all([
    qTotal, qHandoff, qQual, qLeads,
    // P3: motivos de perda agregados (view Postgres — agregação server-side, asb-supabase-ops §7)
    supabase.from("v_motivos_perda").select("*"),
  ]);

  const leads = allLeads ?? [];
  const pend = pendRaw ?? [];                    // DEBT-208: pendentes canônicos
  const handoffPending = pend.length;
  const motivos = (motivosPerda ?? []) as MotivoPerda[];

  // ── Alertas operacionais ─────────────────────────────────────────────────────
  const _now        = new Date();
  const _4hAgo      = new Date(_now.getTime() - 4 * 60 * 60 * 1000);
  const _7dAgo      = new Date(_now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const _todayStart = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());

  // DEBT-208: Tier A urgente = pendente CANÔNICO (view) com vol ≥300 e >4h
  const alertTierALeads = pend.filter(l =>
    (l.weekly_volume_kg ?? 0) >= 300 &&
    new Date(l.handoff_at as string) < _4hAgo
  );
  const alertTierA = alertTierALeads.length;

  const alertMissedHandoffLeads = leads.filter(l =>
    l.qual_stage === 9 &&
    l.handoff_at === null &&
    l.human_active === false
  );
  const alertMissedHandoff = alertMissedHandoffLeads.length;

  const alertFollowupStaleLeads = leads.filter(l =>
    l.followup_eligible === true &&
    l.human_active === false &&
    l.next_followup_at !== null &&
    new Date(l.next_followup_at as string) < _7dAgo
  );
  const alertFollowupStale = alertFollowupStaleLeads.length;

  // DEBT-208: handoffs de hoje = pendentes canônicos entregues hoje
  const alertHandoffsTodayLeads = pend.filter(l =>
    new Date(l.handoff_at as string) >= _todayStart
  );
  const alertHandoffsToday = alertHandoffsTodayLeads.length;

  const totalAlerts = alertTierA + alertMissedHandoff + alertFollowupStale + alertHandoffsToday;

  // ABC
  const abcCount = { A: 0, B: 0, C: 0 };
  for (const l of leads) abcCount[abcCurve(l.weekly_volume_kg)]++;
  const urgentALeads = pend.filter(l => abcCurve(l.weekly_volume_kg) === "A");  // DEBT-208: canônico
  const urgentA = urgentALeads.length;

  // Top cidades
  const cityMap: Record<string, number> = {};
  for (const l of leads) {
    if ((l.qual_stage ?? 0) < 7 || !l.city) continue;
    cityMap[l.city] = (cityMap[l.city] ?? 0) + 1;
  }
  const topCities = Object.entries(cityMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Product groups
  const groupCount: Record<string, number> = {};
  for (const l of leads) for (const g of (l.product_groups as string[] | null) ?? []) groupCount[g] = (groupCount[g] ?? 0) + 1;
  const topGroups = Object.entries(groupCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Funnel
  const stageBuckets: Record<string, number> = { "0-2": 0, "3-4": 0, "5-6": 0, "7-8": 0, "9": 0 };
  for (const l of leads) {
    const s = l.qual_stage ?? 0;
    if (s <= 2) stageBuckets["0-2"]++;
    else if (s <= 4) stageBuckets["3-4"]++;
    else if (s <= 6) stageBuckets["5-6"]++;
    else if (s <= 8) stageBuckets["7-8"]++;
    else stageBuckets["9"]++;
  }
  const funnelData = Object.entries(stageBuckets).map(([label, count]) => ({ label, count }));

  // Weekly
  const now = new Date();
  const weekMap: Record<string, number> = {};
  for (let i = 3; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekMap[getWeekLabel(d)] = 0;
  }
  for (const l of leads) {
    if (!l.first_order_at) continue;
    const label = getWeekLabel(new Date(l.first_order_at));
    if (label in weekMap) weekMap[label]++;
  }
  const weeklyData = Object.entries(weekMap).map(([week, count]) => ({ week, count }));

  // Vendor
  const vendorMap: Record<string, { handoffs: number; confirmed: number; converted: number }> = {};
  for (const key of Object.keys(VENDOR_LABELS)) vendorMap[key] = { handoffs: 0, confirmed: 0, converted: 0 };
  for (const l of leads) {
    const v = l.routing_team;
    if (!v || !(v in vendorMap)) continue;
    if (l.handoff_at) vendorMap[v].handoffs++;
    if (l.handoff_confirmed) vendorMap[v].confirmed++;
    if (l.first_order_at) vendorMap[v].converted++;
  }
  const vendorData = Object.entries(vendorMap).map(([key, vals]) => ({ label: VENDOR_LABELS[key], ...vals }));

  const convertidos = leads.filter(l => l.first_order_at).length;

  // Sparklines — séries semanais REAIS (leads em escopo), % calculados de verdade
  const sTotal   = weeklySeries(leads, "created_at");
  const sQual    = weeklySeries(leads.filter(l => (l.qual_stage ?? 0) >= 7), "created_at");
  const sHandoff = weeklySeries(leads.filter(l => l.handoff_at), "handoff_at");
  const sConv    = weeklySeries(leads.filter(l => l.first_order_at), "first_order_at");
  const trTotal  = trendPct(sTotal);
  const qualPct  = totalLeads ? Math.round(((qualifiedLeads ?? 0) / totalLeads) * 100) : 0;
  const convPct  = leads.length ? Math.round((convertidos / leads.length) * 100) : 0;

  const kpis = [
    { label: "Total de leads", value: totalLeads ?? 0, num: "#FFFFFF", accent: "#8bb4ff", Icon: Users, href: "/dashboard/leads",
      chip: trTotal === null ? "no período" : `${trTotal >= 0 ? "+" : ""}${trTotal}%`, chipUp: trTotal === null ? null : trTotal >= 0, note: "vs. período anterior", series: sTotal },
    { label: "Qualificados", value: qualifiedLeads ?? 0, num: "#5B8DEF", accent: "#5B8DEF", Icon: BadgeCheck, href: "/dashboard/hot-leads",
      chip: `${qualPct}%`, chipUp: true, note: "do total", series: sQual },
    { label: "Handoffs pendentes", value: handoffPending ?? 0, num: "#f59e0b", accent: "#f59e0b", Icon: PhoneCall, href: "/dashboard/handoffs",
      chip: "a distribuir", chipUp: null as boolean | null, note: "SLA < 2h", series: sHandoff },
    { label: "Convertidos", value: convertidos, num: "#22c55e", accent: "#22c55e", Icon: Trophy, href: "/dashboard/leads?status=converted",
      chip: `${convPct}%`, chipUp: true, note: "taxa de conversão", series: sConv },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Dashboard"
        desc={`Visão geral do pipeline SDR${mesParam ? ` · volume de ${mesParam}` : ""}${vend ? ` · vendedor filtrado` : ""}`}
      />

      {/* P2 — filtros mês (volume) + vendedor (tudo). Alertas permanecem "agora". */}
      <div style={{ ...S.card, padding: "12px 16px" }}>
        <DashboardFilters showMonth defaultMes={mesCorrente} />
      </div>

      {/* ⚡ Alertas Operacionais */}
      <div style={{ ...S.card, padding: "20px 24px", borderTop: totalAlerts > 0 ? "2px solid #C8102E" : "2px solid #22c55e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: totalAlerts > 0 ? 14 : 0 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, fontSize: 17,
            background: totalAlerts > 0 ? "rgba(245,158,11,.16)" : "rgba(34,197,94,.16)", color: totalAlerts > 0 ? "#f59e0b" : "#22c55e" }}>⚡</span>
          <span style={{ ...S.section, marginBottom: 0 }}>Atenção Agora</span>
        </div>

        {totalAlerts === 0 ? (
          <p style={{ color: "#22c55e", fontSize: 11, fontFamily: theme.font.label }}>
            ✅ Nenhum alerta crítico no momento
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              {
                count: alertTierA,
                leads: alertTierALeads,
                label: "lead",
                desc: "Tier A sem confirmação de handoff há mais de 4h",
                level: "critical" as const,
              },
              {
                count: alertMissedHandoff,
                leads: alertMissedHandoffLeads,
                label: "lead",
                desc: "Qualificado (etapa 9) sem handoff disparado — verificar bug",
                level: "critical" as const,
              },
              {
                count: alertFollowupStale,
                leads: alertFollowupStaleLeads,
                label: "lead",
                desc: "Follow-up elegível parado há mais de 7 dias",
                level: "warn" as const,
              },
              {
                count: alertHandoffsToday,
                leads: alertHandoffsTodayLeads,
                label: "handoff",
                desc: "Pendente de confirmação hoje",
                level: "warn" as const,
              },
            ]
              .filter(a => a.count > 0)
              .map(({ count, leads: alertLeads, label, desc, level }) => {
                const color  = level === "critical" ? "#C8102E" : "#f59e0b";
                const bg     = level === "critical" ? "rgba(200,16,46,.06)" : "rgba(245,158,11,.06)";
                const border = level === "critical" ? "#C8102E" : "#f59e0b";
                return (
                  <div
                    key={desc}
                    style={{
                      borderLeft: `3px solid ${border}`,
                      background: bg,
                      padding: "10px 14px",
                      borderRadius: "0 4px 4px 0",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.label, margin: 0 }}>
                        {desc}
                      </p>
                      <span style={{
                        flexShrink: 0,
                        background: `${color}18`,
                        border: `1px solid ${color}50`,
                        color,
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: theme.font.label,
                        padding: "3px 10px",
                        borderRadius: 3,
                        whiteSpace: "nowrap",
                      }}>
                        {count} {label}{count > 1 ? "s" : ""}
                      </span>
                    </div>
                    {alertLeads.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {alertLeads.slice(0, 5).map((l: Record<string, unknown>) => (
                          <Link
                            key={String(l.phone)}
                            href={`/dashboard/leads/${l.phone}`}
                            style={{
                              fontSize: 10, fontFamily: theme.font.label,
                              color: color, opacity: 0.8, textDecoration: "underline",
                              textUnderlineOffset: "2px",
                            }}
                          >
                            {String(l.restaurant_name || l.phone || "lead")}
                          </Link>
                        ))}
                        {alertLeads.length > 5 && (
                          <span style={{ fontSize: 10, fontFamily: theme.font.label, color: "#e4e9f0" }}>
                            +{alertLeads.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* KPI cards — grandes, com trend chip + sparkline (dados reais) */}
      <div className="asb-grid-kpi">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* TOP 10 clientes do mês por receita (substitui card reconciliar) */}
      <CardTop10ClientesMes />

      {/* MOV.2b — worklist reconciliar lead↔ARES por telefone (só gestor) */}
      <CardReconciliarAres />

      {/* P3 — Motivos de perda (view v_motivos_perda) */}
      <div className="asb-card" style={{ padding: "20px 24px" }}>
        <SectionHead Icon={XCircle} color="#FF3B57" title="Motivos de perda" desc="Por que os leads não avançaram" />
        <MotivosPerdaChart data={motivos} />
      </div>

      {/* Onde Focar Agora */}
      <div className="asb-card" style={{ padding: "20px 24px" }}>
        <SectionHead Icon={Target} color="#FF3B57" title="Onde focar agora" desc="Prioridades da carteira por volume e cidade" />

        {/* ABC */}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#83879a", fontFamily: theme.font.label, marginBottom: 10 }}>Curva ABC</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          {([
            { tier: "A", count: abcCount.A, color: "#FF3B57", bg: "rgba(255,59,87,.08)",  border: "rgba(255,59,87,.28)",  tag: "urgente", desc: "≥ 300 kg/sem" },
            { tier: "B", count: abcCount.B, color: "#f59e0b", bg: "rgba(245,158,11,.08)", border: "rgba(245,158,11,.28)", tag: "médio", desc: "100–299 kg/sem" },
            { tier: "C", count: abcCount.C, color: "#8bb4ff", bg: "rgba(139,180,255,.07)", border: "rgba(139,180,255,.22)", tag: "longo prazo", desc: "< 100 kg/sem" },
          ] as const).map(({ tier, count, color, bg, border, tag, desc }) => (
            <div key={tier} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "18px 16px", textAlign: "center" }}>
              <p style={{ color, fontSize: 34, fontWeight: 850, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", lineHeight: 1, letterSpacing: "-.02em" }}>{count}</p>
              <p style={{ color, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", marginTop: 6, fontFamily: theme.font.label, fontWeight: 750 }}>Tier {tier}</p>
              <p style={{ color: "#aeb7cc", fontSize: 11, fontFamily: theme.font.label, marginTop: 3 }}>{desc}</p>
              <span style={{ display: "inline-block", marginTop: 10, padding: "3px 10px", background: color + "22", borderRadius: 999, color, fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", fontFamily: theme.font.label }}>{tag}</span>
            </div>
          ))}
        </div>

        {/* Alert urgente Tier A */}
        {urgentA > 0 && (
          <div style={{
            borderLeft: "3px solid #C8102E",
            background: "rgba(200,16,46,.06)",
            padding: "10px 14px",
            borderRadius: "0 4px 4px 0",
            marginBottom: 16,
          }}>
            <p style={{ color: "#FFFFFF", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700 }}>
              ⚡ {urgentA} lead{urgentA > 1 ? "s" : ""} Tier A aguardando confirmação de handoff
            </p>
            <p style={{ color: "#c0d0e0", fontSize: 10, fontFamily: theme.font.label, marginTop: 2 }}>
              ação imediata — alto volume, handoff não confirmado
            </p>
            {urgentALeads.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {urgentALeads.slice(0, 5).map((l: Record<string, unknown>) => (
                  <Link
                    key={String(l.phone)}
                    href={`/dashboard/leads/${l.phone}`}
                    style={{
                      fontSize: 10, fontFamily: theme.font.label,
                      color: "#C8102E", opacity: 0.8, textDecoration: "underline",
                      textUnderlineOffset: "2px",
                    }}
                  >
                    {String(l.restaurant_name || l.phone || "lead")}
                  </Link>
                ))}
                {urgentALeads.length > 5 && (
                  <span style={{ fontSize: 10, fontFamily: theme.font.label, color: "#e4e9f0" }}>
                    +{urgentALeads.length - 5}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cidades + Grupos lado a lado */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }} className="asb-grid-charts">
          {topCities.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#83879a", fontFamily: theme.font.label, marginBottom: 10 }}>Top cidades · qualificados</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {topCities.map(([city, count], i) => (
                  <div key={city} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#e6ebf5", fontSize: 13, fontFamily: theme.font.label, display: "inline-flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, background: "var(--asb-card-hi)", color: "#83879a", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", fontFamily: theme.font.num }}>{i + 1}</span>{city}
                    </span>
                    <span style={{ background: "rgba(255,59,87,.14)", color: "#FF3B57", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, fontFamily: theme.font.label }}>{count} leads</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {topGroups.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#83879a", fontFamily: theme.font.label, marginBottom: 10 }}>Grupos de produto</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {topGroups.map(([group, count]) => (
                  <div key={group} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ color: "#e6ebf5", fontSize: 13, fontFamily: theme.font.label }}>{PRODUCT_LABELS[group] ?? group}</span>
                    <span style={{ background: "var(--asb-card-hi)", color: "#c8d2e6", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts row */}
      <div className="asb-grid-charts">
        <div className="asb-card" style={{ padding: "20px 24px" }}>
          <SectionHead Icon={FilterIcon} color="#8bb4ff" title="Funil de qualificação" desc="Leads por etapa" />
          <div style={{ height: 220 }}><QualificationFunnel data={funnelData} /></div>
        </div>
        <div className="asb-card" style={{ padding: "20px 24px" }}>
          <SectionHead Icon={TrendingUp} color="#22c55e" title="Conversões por semana" desc="Primeiros pedidos" />
          <WeeklyConversions data={weeklyData} />
        </div>
      </div>

      {/* Vendor */}
      <div className="asb-card" style={{ padding: "20px 24px" }}>
        <SectionHead Icon={BarChart3} color="#f59e0b" title="Performance por vendedor" desc="Handoffs · confirmados · convertidos" />
        <VendorPerformance data={vendorData} />
      </div>

      {/* Status */}
      <div className="asb-card" style={{ padding: "14px 22px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#83879a", fontFamily: theme.font.label }}>Status do sistema</span>
        {[
          { label: "SDR Ativo",        color: "#22c55e" },
          { label: "RAG Online",       color: "#22c55e" },
          { label: "Follow-up Engine", color: "#f59e0b" },
        ].map(({ label, color }) => (
          <span key={label} style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: color + "18", color, fontSize: 12, fontWeight: 650,
            padding: "4px 11px", borderRadius: 999, fontFamily: theme.font.label,
          }} translate="no">
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />{label}
          </span>
        ))}
      </div>
    </div>
  );
}
