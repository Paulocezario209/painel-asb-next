import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import {
  QualificationFunnel,
  WeeklyConversions,
  VendorPerformance,
} from "@/components/dashboard/charts";
import { CardTop10ClientesMes } from "@/components/dashboard/card-top10-clientes-mes";
import { MotivosPerdaChart, type MotivoPerda } from "@/components/dashboard/motivos-perda-chart";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";

export const dynamic = "force-dynamic";

// ── Design tokens — ASB brand ───────────────────────────────────────────────
const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#556677", fontFamily: "'Courier New', monospace" },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: "'Courier New', monospace", marginBottom: 12 } as React.CSSProperties,
  text:    { color: "#c8d8e8", fontSize: 12, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
  muted:   { color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
};

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

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const supabase = await createClient();

  // P2 — filtros: ?vendedor=SETOR_* (afeta tudo) + ?mes=YYYY-MM (afeta só KPIs de volume; alertas ficam "agora")
  const sp = await searchParams;
  const vend = sp?.vendedor && /^SETOR_[A-Z_]+$/.test(sp.vendedor) ? sp.vendedor : null;
  const mesParam = sp?.mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes) ? sp.mes : null;
  let mesIni: string | null = null, mesFimEx: string | null = null;
  if (mesParam) {
    const [y, m] = mesParam.split("-").map(Number);
    mesIni = `${mesParam}-01`;
    mesFimEx = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  }
  // KPI VOLUME — criados (mês + vendedor)
  let qTotal = supabase.from("ai_sdr_leads").select("*", { count: "exact", head: true }).eq("is_test", false);
  if (vend) qTotal = qTotal.eq("routing_team", vend);
  if (mesIni && mesFimEx) qTotal = qTotal.gte("created_at", mesIni).lt("created_at", mesFimEx);
  // ALERTA — handoff pendente (estado "agora", só vendedor)
  let qHandoff = supabase.from("ai_sdr_leads").select("*", { count: "exact", head: true }).eq("is_test", false).not("handoff_at", "is", null).eq("handoff_confirmed", false);
  if (vend) qHandoff = qHandoff.eq("routing_team", vend);
  // KPI VOLUME — qualificados (mês + vendedor)
  let qQual = supabase.from("ai_sdr_leads").select("*", { count: "exact", head: true }).eq("is_test", false).gte("qual_stage", 7);
  if (vend) qQual = qQual.eq("routing_team", vend);
  if (mesIni && mesFimEx) qQual = qQual.gte("created_at", mesIni).lt("created_at", mesFimEx);
  // LISTA — alertas/ABC/cidades (estado "agora", só vendedor)
  let qLeads = supabase.from("ai_sdr_leads").select("id, phone, restaurant_name, qual_stage, first_order_at, routing_team, handoff_at, handoff_confirmed, weekly_volume_kg, city, product_groups, human_active, followup_eligible, next_followup_at").eq("is_test", false);
  if (vend) qLeads = qLeads.eq("routing_team", vend);

  const [
    { count: totalLeads },
    { count: handoffPending },
    { count: qualifiedLeads },
    { data: allLeads },
    { data: motivosPerda },
  ] = await Promise.all([
    qTotal, qHandoff, qQual, qLeads,
    // P3: motivos de perda agregados (view Postgres — agregação server-side, asb-supabase-ops §7)
    supabase.from("v_motivos_perda").select("*"),
  ]);

  const leads = allLeads ?? [];
  const motivos = (motivosPerda ?? []) as MotivoPerda[];

  // ── Alertas operacionais ─────────────────────────────────────────────────────
  const _now        = new Date();
  const _4hAgo      = new Date(_now.getTime() - 4 * 60 * 60 * 1000);
  const _7dAgo      = new Date(_now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const _todayStart = new Date(_now.getFullYear(), _now.getMonth(), _now.getDate());

  const alertTierALeads = leads.filter(l =>
    (l.weekly_volume_kg ?? 0) >= 300 &&
    l.human_active === true &&
    l.handoff_confirmed === false &&
    l.handoff_at !== null &&
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

  const alertHandoffsTodayLeads = leads.filter(l =>
    l.handoff_confirmed === false &&
    l.human_active === true &&
    l.handoff_at !== null &&
    new Date(l.handoff_at as string) >= _todayStart
  );
  const alertHandoffsToday = alertHandoffsTodayLeads.length;

  const totalAlerts = alertTierA + alertMissedHandoff + alertFollowupStale + alertHandoffsToday;

  // ABC
  const abcCount = { A: 0, B: 0, C: 0 };
  for (const l of leads) abcCount[abcCurve(l.weekly_volume_kg)]++;
  const urgentALeads = leads.filter(l => abcCurve(l.weekly_volume_kg) === "A" && l.handoff_at && !l.handoff_confirmed);
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
  const VENDORS: Record<string, string> = { SETOR_SOROCABA_SAO_PAULO: "Ana Paula", SETOR_CAMPINAS_JUNDIAI: "Alan", SETOR_CUIT: "CUIT" };
  const vendorMap: Record<string, { handoffs: number; confirmed: number; converted: number }> = {};
  for (const key of Object.keys(VENDORS)) vendorMap[key] = { handoffs: 0, confirmed: 0, converted: 0 };
  for (const l of leads) {
    const v = l.routing_team;
    if (!v || !(v in vendorMap)) continue;
    if (l.handoff_at) vendorMap[v].handoffs++;
    if (l.handoff_confirmed) vendorMap[v].confirmed++;
    if (l.first_order_at) vendorMap[v].converted++;
  }
  const vendorData = Object.entries(vendorMap).map(([key, vals]) => ({ label: VENDORS[key], ...vals }));

  const convertidos = leads.filter(l => l.first_order_at).length;

  const kpis = [
    { label: "Total Leads",        value: totalLeads ?? 0,    accent: "#FFFFFF", href: "/dashboard/leads" },
    { label: "Qualificados",       value: qualifiedLeads ?? 0, accent: "#C8102E", href: "/dashboard/hot-leads" },
    { label: "Handoffs Pendentes", value: handoffPending ?? 0, accent: "#f59e0b", href: "/dashboard/handoffs" },
    { label: "Convertidos",        value: convertidos,          accent: "#22c55e", href: "/dashboard/leads?status=converted" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={S.muted}>
          Visão geral do pipeline SDR
          {mesParam ? ` · volume de ${mesParam}` : ""}{vend ? ` · vendedor filtrado` : ""}
        </p>
      </div>

      {/* P2 — filtros mês (volume) + vendedor (tudo). Alertas permanecem "agora". */}
      <div style={{ ...S.card, padding: "12px 16px" }}>
        <DashboardFilters showMonth />
      </div>

      {/* ⚡ Alertas Operacionais */}
      <div style={{ ...S.card, padding: "20px 24px", borderTop: totalAlerts > 0 ? "2px solid #C8102E" : "2px solid #22c55e" }}>
        <p style={{ ...S.section, marginBottom: totalAlerts > 0 ? 14 : 0 }}>
          <span style={{ marginRight: 6 }}>⚡</span>
          Atenção Agora
        </p>

        {totalAlerts === 0 ? (
          <p style={{ color: "#22c55e", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
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
                      <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", margin: 0 }}>
                        {desc}
                      </p>
                      <span style={{
                        flexShrink: 0,
                        background: `${color}18`,
                        border: `1px solid ${color}50`,
                        color,
                        fontSize: 11,
                        fontWeight: 700,
                        fontFamily: "'Courier New', monospace",
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
                              fontSize: 10, fontFamily: "'Courier New', monospace",
                              color: color, opacity: 0.8, textDecoration: "underline",
                              textUnderlineOffset: "2px",
                            }}
                          >
                            {String(l.restaurant_name || l.phone || "lead")}
                          </Link>
                        ))}
                        {alertLeads.length > 5 && (
                          <span style={{ fontSize: 10, fontFamily: "'Courier New', monospace", color: "#556677" }}>
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

      {/* KPI cards */}
      <div className="asb-grid-kpi">
        {kpis.map(({ label, value, accent, href }) => (
          <Link key={label} href={href} style={{ textDecoration: "none" }}>
            <div style={{ ...S.card, padding: "20px 20px", borderTop: `2px solid ${accent}`, cursor: "pointer", transition: "opacity .15s" }} className="asb-kpi-hover">
              <p style={{ ...S.label, color: accent }} translate="no">{label}</p>
              <p style={{ ...S.value, marginTop: 12 }}>{value}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* TOP 10 clientes do mês por receita (substitui card reconciliar) */}
      <CardTop10ClientesMes />

      {/* P3 — Motivos de perda (view v_motivos_perda) */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={{ ...S.section }}>
          <span style={{ color: "#C8102E", marginRight: 6 }}>✕</span>
          Motivos de Perda
        </p>
        <MotivosPerdaChart data={motivos} />
      </div>

      {/* Onde Focar Agora */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={{ ...S.section }}>
          <span style={{ color: "#C8102E", marginRight: 6 }}>▲</span>
          Onde Focar Agora
        </p>

        {/* ABC */}
        <p style={{ ...S.label, marginBottom: 8 }}>curva abc</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
          {([
            { tier: "A", count: abcCount.A, color: "#C8102E", bg: "rgba(200,16,46,.08)", border: "rgba(200,16,46,.3)", tag: "urgente", desc: "≥ 300 kg/sem" },
            { tier: "B", count: abcCount.B, color: "#f59e0b", bg: "rgba(245,158,11,.08)", border: "rgba(245,158,11,.3)", tag: "médio", desc: "100–299 kg/sem" },
            { tier: "C", count: abcCount.C, color: "#8899aa", bg: "rgba(136,153,170,.06)", border: "rgba(136,153,170,.2)", tag: "longo prazo", desc: "< 100 kg/sem" },
          ] as const).map(({ tier, count, color, bg, border, tag, desc }) => (
            <div key={tier} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 5, padding: "14px 16px", textAlign: "center" }}>
              <p style={{ color, fontSize: 26, fontWeight: 700, fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 }}>{count}</p>
              <p style={{ color, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", marginTop: 4, fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
                Tier {tier}
              </p>
              <p style={{ color: "#8b949e", fontSize: 9, fontFamily: "'Courier New', monospace", marginTop: 2 }}>{desc}</p>
              <span style={{
                display: "inline-block", marginTop: 8, padding: "2px 6px",
                border: `1px solid ${border}`, borderRadius: 3, color, fontSize: 9,
                letterSpacing: ".10em", textTransform: "uppercase", fontFamily: "'Courier New', monospace",
              }}>{tag}</span>
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
            <p style={{ color: "#FFFFFF", fontSize: 11, fontFamily: "'Courier New', monospace", fontWeight: 700 }}>
              ⚡ {urgentA} lead{urgentA > 1 ? "s" : ""} Tier A aguardando confirmação de handoff
            </p>
            <p style={{ color: "#8899aa", fontSize: 10, fontFamily: "'Courier New', monospace", marginTop: 2 }}>
              ação imediata — alto volume, handoff não confirmado
            </p>
            {urgentALeads.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                {urgentALeads.slice(0, 5).map((l: Record<string, unknown>) => (
                  <Link
                    key={String(l.phone)}
                    href={`/dashboard/leads/${l.phone}`}
                    style={{
                      fontSize: 10, fontFamily: "'Courier New', monospace",
                      color: "#C8102E", opacity: 0.8, textDecoration: "underline",
                      textUnderlineOffset: "2px",
                    }}
                  >
                    {String(l.restaurant_name || l.phone || "lead")}
                  </Link>
                ))}
                {urgentALeads.length > 5 && (
                  <span style={{ fontSize: 10, fontFamily: "'Courier New', monospace", color: "#556677" }}>
                    +{urgentALeads.length - 5}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Top cidades */}
        {topCities.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ ...S.label, marginBottom: 8 }}>top cidades — leads qualificados</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {topCities.map(([city, count], i) => (
                <div key={city} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#e0e0e0", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
                    <span style={{ color: "#7a9a7a", marginRight: 6 }}>#{i + 1}</span>{city}
                  </span>
                  <span style={{
                    background: "rgba(200,16,46,.08)", border: "1px solid rgba(200,16,46,.25)",
                    color: "#C8102E", fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
                    padding: "2px 7px", borderRadius: 2, fontFamily: "'Courier New', monospace",
                  }}>{count} leads</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grupos de produto */}
        {topGroups.length > 0 && (
          <div>
            <p style={{ ...S.label, marginBottom: 8 }}>grupos de produto</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {topGroups.map(([group, count]) => (
                <div key={group} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ color: "#e0e0e0", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
                    {PRODUCT_LABELS[group] ?? group}
                  </span>
                  <span style={{
                    border: "1px solid #2a2a2a", color: "#8899aa", fontSize: 9,
                    padding: "2px 7px", borderRadius: 2, fontFamily: "'Courier New', monospace",
                  }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="asb-grid-charts">
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <p style={S.section}>Funil de Qualificação</p>
          <QualificationFunnel data={funnelData} />
        </div>
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <p style={S.section}>Conversões por Semana</p>
          <WeeklyConversions data={weeklyData} />
        </div>
      </div>

      {/* Vendor */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <p style={S.section}>Performance por Vendedor</p>
        <VendorPerformance data={vendorData} />
      </div>

      {/* Status */}
      <div style={{ ...S.card, padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <p style={{ ...S.label, margin: 0 }}>status</p>
        {[
          { label: "SDR Ativo",        color: "#22c55e" },
          { label: "RAG Online",       color: "#22c55e" },
          { label: "Follow-up Engine", color: "#f59e0b" },
        ].map(({ label, color }) => (
          <span key={label} style={{
            border: `1px solid ${color}30`,
            background: `${color}10`,
            color,
            fontSize: 9,
            letterSpacing: ".10em",
            textTransform: "uppercase",
            padding: "3px 8px",
            borderRadius: 3,
            fontFamily: "'Courier New', monospace",
          }} translate="no">● {label}</span>
        ))}
      </div>
    </div>
  );
}
