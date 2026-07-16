import { createClient } from "@/lib/supabase/server";
import { theme } from "@/lib/theme";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/lib/auth/get-user-role";
import { MetasCalendarioGerente } from "@/components/dashboard/metas-calendario-gerente";
import { businessDaysInMonth, businessDaysElapsed, dateAfterNBusinessDays } from "@/lib/utils/business-days";
import { VENDOR_LABELS as VENDOR_NAMES, VENDOR_ORDER } from "@/lib/vendor-labels";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard, StatTile } from "@/app/dashboard/lib/ui";
import { Wallet, TrendingUp, AlertTriangle, HeartPulse, Flame, GitCompareArrows, LineChart, CalendarDays } from "lucide-react";

export const dynamic = "force-dynamic";

// Nomes vêm da fonte única (@/lib/vendor-labels); region é detalhe local desta tela.
const VENDOR_LABELS: Record<string, { name: string; region: string }> = {
  SETOR_SOROCABA_SAO_PAULO: { name: VENDOR_NAMES.SETOR_SOROCABA_SAO_PAULO, region: "Sorocaba / Grande SP" },
  SETOR_CAMPINAS_JUNDIAI:   { name: VENDOR_NAMES.SETOR_CAMPINAS_JUNDIAI, region: "Campinas / Jundiai" },
  SETOR_CUIT:               { name: VENDOR_NAMES.SETOR_CUIT, region: "CUIT — key accounts" },
};

const VENDOR_ACCENT: Record<string, string> = {
  SETOR_SOROCABA_SAO_PAULO: theme.colors.critical,
  SETOR_CAMPINAS_JUNDIAI: theme.colors.success,
  SETOR_CUIT: theme.colors.accent,
};

// ── Interfaces ──────────────────────────────────────────────────────────────
interface Meta {
  vendedor_routing_team: string;
  meta_valor_brl: number;
}

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function pctColor(pct: number): string {
  if (pct >= 100) return theme.colors.success;
  if (pct >= 50) return "#f59e0b";
  return theme.colors.critical;
}

function projColor(pct: number): string {
  if (pct >= 100) return theme.colors.success;
  if (pct >= 80) return "#f59e0b";
  return theme.colors.critical;
}

export default async function GerentePage() {
  const supabase = await createClient();
  // 069c: instância SSR sem getUser() não hidrata a sessão dos cookies → não anexa o
  // access token → reads RLS (tabela `metas`) saem como anon (auth.uid() null) → 0 linhas.
  await supabase.auth.getUser();

  const ctx = await getUserContext();
  if (!ctx || ctx.role !== "gestor") redirect("/dashboard");

  // ── Data boundaries ───────────────────────────────────────────────────────
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const mesAtual = `${year}-${String(month).padStart(2, "0")}`;
  const primeiroDiaMes = `${mesAtual}-01`;
  const ultimoDiaMes = new Date(year, month, 0).toISOString().slice(0, 10);

  // ── Boundaries mês anterior (comparativo) ─────────────────────────────────
  const diasDecorridos = await businessDaysElapsed(year, month, now);
  const mesAnterior = month === 1 ? 12 : month - 1;
  const anoMesAnterior = month === 1 ? year - 1 : year;
  const limiteAnteriorISO = await dateAfterNBusinessDays(anoMesAnterior, mesAnterior, diasDecorridos);
  const primeiroMesAnterior = `${anoMesAnterior}-${String(mesAnterior).padStart(2, "0")}-01`;

  // ── Queries paralelas ─────────────────────────────────────────────────────
  // OFICIAL = eixo de FATURAMENTO §5 (v_resumo_mes_vendedor pós DEBT-103 FASE C; MESMA fonte do /vendas;
  //   realizado por faturamento real NF+Recibo — DEBT-103 FASE C aplicada).
  // EMISSÃO (painel_dia_vendedor / data_emissao, 088c) = PRÉVIA em tempo real, NÃO-oficial.
  const [{ data: rawResumo }, { data: rawMetas }, { data: rawFat }, { data: rawEmissao }, { data: rawComp }] = await Promise.all([
    supabase
      .from("v_resumo_mes_vendedor")
      .select("vendedor_routing_team, realizado_mes_brl, meta_total_mes_brl, pct_atingido_mes"),
    supabase
      .from("metas")
      .select("vendedor_routing_team, meta_valor_brl")
      .eq("granularidade", "mensal").eq("ativo", true).eq("data_inicio", primeiroDiaMes),
    // Faturado real (NF+Recibo) MTD — MESMA fonte/recorte do /dashboard/vendas (paridade DEBT-088)
    supabase
      .from("faturamento_tipo_dia")
      .select("valor_brl").gte("dia", primeiroDiaMes).lte("dia", ultimoDiaMes),
    // EMISSÃO (prévia tempo real — data_emissao)
    supabase
      .from("painel_dia_vendedor")
      .select("vendedor_routing_team, realizado_parcial_brl").gte("dia", primeiroDiaMes).lte("dia", ultimoDiaMes),
    // COMPARATIVO mês anterior — eixo ENTREGA (mesmo do oficial)
    supabase
      .from("v_faturado_diario")
      .select("vendedor_routing_team, realizado_parcial_brl").gte("dia", primeiroMesAnterior).lte("dia", limiteAnteriorISO),
  ]);

  const resumo = (rawResumo ?? []) as unknown as { vendedor_routing_team: string; realizado_mes_brl: number; meta_total_mes_brl: number; pct_atingido_mes: number | null }[];
  const metas = (rawMetas ?? []) as unknown as Meta[];
  // Faturado total real do mês (NF+Recibo) — idêntico ao totalFaturadoReal do /vendas (NÃO tocar)
  const totalFaturadoReal = (rawFat ?? []).reduce(
    (s, r) => s + (Number((r as { valor_brl: number | null }).valor_brl) || 0), 0,
  );
  // DEBT-103 FASE D: realizado OFICIAL por vendedor = FATURADO §5 (v_resumo já está no eixo faturamento pós-FASE C).
  // Linha "não-atribuído" = card total − Σ faturado por vendedor. AO VIVO (encolhe c/ cobertura).
  const somaFatVendedores = resumo.reduce((s, r) => s + Number(r.realizado_mes_brl ?? 0), 0);
  const naoAtribuido = Math.max(0, totalFaturadoReal - somaFatVendedores);

  // ── Indicador Up-sell / Risco da carteira (visibilidade; sem aliquota nova) ──────
  const [{ data: upsellG }, { data: downsellG }] = await Promise.all([
    supabase.from("v_upsell_oportunidades").select("potencial_anual_brl"),
    supabase.from("v_downsell_risco_queda").select("ares_pessoa_id"),
  ]);
  const upsellN = (upsellG ?? []).length;
  const upsellPot = (upsellG ?? []).reduce((s, r) => s + Number((r as { potencial_anual_brl: number | null }).potencial_anual_brl ?? 0), 0);
  const riscoN = (downsellG ?? []).length;

  // ── Aggregate per vendor (realizado OFICIAL = faturamento §5; emissao = prévia) ───
  type VendorAgg = { realizado: number; emissao: number; meta: number };
  const agg: Record<string, VendorAgg> = {};
  for (const rt of VENDOR_ORDER) {
    const r = resumo.find(x => x.vendedor_routing_team === rt);
    const m = metas.find(x => x.vendedor_routing_team === rt);
    agg[rt] = {
      realizado: Number(r?.realizado_mes_brl ?? 0),            // FATURAMENTO §5 (oficial, = /vendas)
      emissao: 0,                                              // EMISSÃO (prévia tempo real)
      meta: m?.meta_valor_brl ?? Number(r?.meta_total_mes_brl ?? 0),
    };
  }
  for (const r of (rawEmissao ?? []) as unknown as { vendedor_routing_team: string; realizado_parcial_brl: number }[]) {
    const a = agg[r.vendedor_routing_team];
    if (a) a.emissao += Number(r.realizado_parcial_brl ?? 0);
  }

  // ── B1 Ranking (pior em cima) ─────────────────────────────────────────────
  const ranking = VENDOR_ORDER.map(rt => {
    const a = agg[rt];
    const v = VENDOR_LABELS[rt];
    const pct = a.meta > 0 ? (a.realizado / a.meta) * 100 : 0;
    const faltante = Math.max(0, a.meta - a.realizado);
    return { rt, name: v?.name ?? rt, region: v?.region ?? "", ...a, pct, faltante };
  }).sort((a, b) => a.pct - b.pct);

  // ── B2 Comparativo mes anterior (eixo ENTREGA, mesmo do oficial) ──────────
  const aggAnterior: Record<string, number> = {};
  for (const r of (rawComp ?? []) as unknown as { vendedor_routing_team: string; realizado_parcial_brl: number }[]) {
    aggAnterior[r.vendedor_routing_team] = (aggAnterior[r.vendedor_routing_team] ?? 0) + (r.realizado_parcial_brl ?? 0);
  }
  const totalRealizado = VENDOR_ORDER.reduce((s, rt) => s + agg[rt].realizado, 0);
  const totalEmissao = VENDOR_ORDER.reduce((s, rt) => s + agg[rt].emissao, 0);
  const totalAnterior = VENDOR_ORDER.reduce((s, rt) => s + (aggAnterior[rt] ?? 0), 0);

  const comparativo = VENDOR_ORDER.map(rt => {
    const atual = agg[rt].realizado;
    const anterior = aggAnterior[rt] ?? 0;
    const delta = atual - anterior;
    const deltaPct = anterior > 0 ? ((atual / anterior) - 1) * 100 : null;
    return { rt, name: VENDOR_LABELS[rt]?.name ?? rt, atual, anterior, delta, deltaPct };
  });

  const totalDeltaPct = totalAnterior > 0 ? ((totalRealizado / totalAnterior) - 1) * 100 : null;

  const MESES_LABEL = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // ── B6 Projecao (eixo ENTREGA) ────────────────────────────────────────────
  const totalDiasUteis = await businessDaysInMonth(year, month);
  const totalMeta = VENDOR_ORDER.reduce((s, rt) => s + agg[rt].meta, 0);
  const projecaoTotal = diasDecorridos > 0 ? (totalRealizado / diasDecorridos) * totalDiasUteis : 0;
  const projecaoVsMeta = totalMeta > 0 ? (projecaoTotal / totalMeta) * 100 : 0;
  const deltaTotal = projecaoTotal - totalMeta;

  const projVendedores = ranking.map(v => {
    const proj = diasDecorridos > 0 ? (v.realizado / diasDecorridos) * totalDiasUteis : 0;
    const projPct = v.meta > 0 ? (proj / v.meta) * 100 : 0;
    return { ...v, proj, projPct };
  });

  // Bonus Fase 3: KPI Retention Carteira
  const { data: retention } = await supabase.from("v_retention_metrics").select("*").maybeSingle();

  // ── E3 Sprint Fernando: worklist órfãos de atendimento (v_leads_orfaos) ────
  // Leitura via SERVICE ROLE server-side (mesmo padrão do ciclo em /vendas —
  // evita assimetria RLS de view security_invoker; página já é gestor-only pelo
  // redirect acima). View: handoff + seller_first_reply_at NULL + >48h + não-teste.
  const srkOrf = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const orfaosClient = srkOrf
    ? createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srkOrf)
    : supabase;
  const { data: rawOrfaos } = await orfaosClient
    .from("v_leads_orfaos")
    .select("phone, name, city, routing_team, handoff_at, horas_sem_atendimento")
    .order("horas_sem_atendimento", { ascending: false })
    .limit(20);
  type OrfaoRow = { phone: string; name: string | null; city: string | null; routing_team: string; handoff_at: string; horas_sem_atendimento: number };
  const orfaos = (rawOrfaos ?? []) as unknown as OrfaoRow[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <PageHead
        title="Gerente Comercial"
        desc={`Visão consolidada ${mesAtual} · ${diasDecorridos}/${totalDiasUteis} dias úteis`}
      />

      {/* Faturado total real (NF+Recibo). Σ por vendedor (§5) + não-atribuído = total. */}
      <div style={{ maxWidth: 360 }}>
        <KpiCard
          label="Faturado total (NF+Recibo)"
          value={fmtBRL(totalFaturadoReal)}
          Icon={Wallet}
          accent={theme.colors.success}
          note={`MTD · por vendedor ${fmtBRL(somaFatVendedores)}${naoAtribuido > 0 ? ` + não-atribuído ${fmtBRL(naoAtribuido)}` : ""}`}
        />
      </div>

      {/* ── Up-sell / Risco da carteira (visibilidade; resultado pago pelo balde Crescimento) ── */}
      <Link href="/dashboard/up-sell" style={{ textDecoration: "none" }}>
        <div style={{ maxWidth: 420 }}>
          <StatTile
            label="Up-sell / Risco (carteira)"
            value={`${upsellN} up-sell · ${fmtBRL(upsellPot)} · ${riscoN} risco`}
            accent="#f97316"
            sub="oportunidades da carteira · resultado pago pelo balde Crescimento (0,6%)"
          />
        </div>
      </Link>

      {/* ── E3 Sprint Fernando: Órfãos de atendimento (worklist gestor) ────── */}
      <div style={{ ...S.card, padding: "20px 24px", borderTop: orfaos.length > 0 ? "2px solid #ef4444" : `2px solid ${theme.colors.success}` }}>
        <SectionHead
          Icon={AlertTriangle}
          color={orfaos.length > 0 ? "#ef4444" : theme.colors.success}
          title={orfaos.length > 0 ? `Órfãos de atendimento (${orfaos.length})` : "Órfãos de atendimento"}
          desc="Handoff sem resposta do vendedor"
        />
        {orfaos.length === 0 ? (
          <p style={{ ...S.muted, color: theme.colors.success }}>✓ Nenhum lead órfão — todos os handoffs com resposta do vendedor.</p>
        ) : (
          <>
            <p style={{ ...S.muted, fontSize: 9, marginBottom: 12 }}>
              Handoff sem NENHUMA resposta do vendedor há +48h (IA já reativada; re-alerta automático a cada 7d). Ação: assumir, reatribuir ou marcar perdido.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Lead", "Sem resposta", "Setor", ""].map(h => (
                    <th key={h} style={{ ...S.label, textAlign: h === "Lead" ? "left" : h === "" ? "right" : "left", paddingBottom: 8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orfaos.map(o => {
                  const dias = Math.floor((o.horas_sem_atendimento ?? 0) / 24);
                  const diasColor = dias >= 14 ? "#ef4444" : dias >= 7 ? "#f59e0b" : "#c8d8e8";
                  const vendor = VENDOR_LABELS[o.routing_team]?.name ?? o.routing_team;
                  return (
                    <tr key={o.phone} style={{ borderTop: "1px solid rgba(27,42,107,.3)" }}>
                      <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.label, padding: "7px 0" }}>
                        {o.name || o.phone}
                        <span style={{ color: theme.colors.neutral, marginLeft: 6, fontSize: 9 }}>{o.city || "—"}</span>
                      </td>
                      <td style={{ color: diasColor, fontSize: 11, fontFamily: theme.font.num, padding: "7px 0", fontWeight: 700 }}>
                        {dias}d
                      </td>
                      <td style={{ color: VENDOR_ACCENT[o.routing_team] ?? "#c0d0e0", fontSize: 10, fontFamily: theme.font.label, padding: "7px 0" }}>
                        {vendor}
                      </td>
                      <td style={{ textAlign: "right", padding: "7px 0" }}>
                        <Link href={`/dashboard/leads/${encodeURIComponent(o.phone)}`}
                          style={{ color: "#3b82f6", fontSize: 10, fontFamily: theme.font.label, textDecoration: "none" }}>
                          Ver lead →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* ── Retention Carteira (Funil v2 Fase 3 — atualizado pelo worker daily) ── */}
      {retention && (
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <SectionHead Icon={HeartPulse} color="#22C55E" title="Retention da Carteira" desc="Saúde e recorrência da base de clientes" />
          <div className="asb-grid-kpi">
            <StatTile
              label="Carteira Total"
              value={retention.total_carteira ?? 0}
              accent="#22C55E"
              sub={`${retention.em_ativacao ?? 0} em ativação · ${retention.ativos ?? 0} ativos · ${retention.recorrentes ?? 0} recorrentes`}
            />
            <StatTile
              label="Retention Rate"
              value={`${retention.retention_rate_pct ?? 0}%`}
              accent={theme.colors.brandAsb}
              sub="% da carteira já recorrente"
            />
            <StatTile
              label="Activation Rate"
              value={`${retention.activation_rate_pct ?? 0}%`}
              accent="#BA7517"
              sub="% saiu de em ativação"
            />
            <StatTile
              label="Health Rate"
              value={`${retention.health_rate_pct ?? 0}%`}
              accent={theme.colors.warning}
              sub={`${retention.healthy ?? 0} healthy · ${retention.at_risk ?? 0} risco · ${retention.inactive ?? 0} inativos`}
            />
          </div>
        </div>
      )}

      {/* ── B1 PRIORIDADES DO DIA (ranking pior em cima) ──────────────────── */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={Flame} color={theme.colors.critical} title="Prioridades do Dia" desc="Ranking por % atingido \u2014 pior em cima" />
        <p style={{ ...S.muted, fontSize: 9, marginBottom: 16 }}>
          Ordenado por % atingido (pior em cima) &middot; realizado/meta OFICIAL por <b style={{ color: "#c0d0e0" }}>faturamento</b> NF+Recibo (§5, = /vendas); &ldquo;prévia emissão&rdquo; = tempo real, não-oficial
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ranking.map((v, i) => {
            const accent = VENDOR_ACCENT[v.rt] ?? theme.colors.neutral;
            const barColor = pctColor(v.pct);
            return (
              <div key={v.rt} style={{
                ...S.card,
                padding: "16px 20px",
                borderLeft: `3px solid ${accent}`,
                borderTop: i === 0 ? `1px solid ${barColor}40` : undefined,
                background: i === 0 ? `${barColor}08` : "var(--asb-card)",
              }}>
                {/* Top row: nome + % */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                  <div>
                    <span style={{ color: accent, fontSize: 12, fontWeight: 700, fontFamily: theme.font.label }}>{v.name}</span>
                    <span style={{ color: theme.colors.neutral, fontSize: 9, fontFamily: theme.font.label, marginLeft: 8 }}>{v.region}</span>
                  </div>
                  <span style={{ color: barColor, fontSize: 18, fontWeight: 700, fontFamily: theme.font.num }}>
                    {v.pct.toFixed(1)}%
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ height: 6, background: theme.colors.borderDefault, borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                  <div style={{
                    width: `${Math.min(v.pct, 100)}%`,
                    height: "100%",
                    background: barColor,
                    borderRadius: 3,
                    transition: "width .3s ease",
                  }} />
                </div>

                {/* Bottom row: realizado (entrega, oficial) / meta / faltante / pr\u00e9via (emiss\u00e3o) */}
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span style={{ ...S.muted, fontSize: 10 }}>
                    Realizado <span style={{ color: "#c8d8e8", fontWeight: 700 }}>{fmtBRL(v.realizado)}</span>
                  </span>
                  <span style={{ ...S.muted, fontSize: 10 }}>
                    Meta <span style={{ color: "#c8d8e8", fontWeight: 700 }}>{v.meta > 0 ? fmtBRL(v.meta) : "\u2014"}</span>
                  </span>
                  <span style={{ ...S.muted, fontSize: 10 }}>
                    Faltante <span style={{ color: v.faltante > 0 ? theme.colors.critical : theme.colors.success, fontWeight: 700 }}>{fmtBRL(v.faltante)}</span>
                  </span>
                  <span style={{ ...S.muted, fontSize: 10 }} title="Pr\u00e9via em tempo real por data de emiss\u00e3o (n\u00e3o-oficial). Oficial = por entrega.">
                    Pr\u00e9via emiss\u00e3o <span style={{ color: "#6a7a8a", fontWeight: 700 }}>{fmtBRL(v.emissao)}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── B2 COMPARATIVO MES ANTERIOR ──────────────────────────────────── */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={GitCompareArrows} color="#8bb4ff" title="Comparativo M\u00EAs Anterior" desc={`${MESES_LABEL[month]} (${diasDecorridos} dias \u00FAteis) vs ${MESES_LABEL[mesAnterior]} (mesmos ${diasDecorridos} dias \u00FAteis)`} />

        <div className="asb-grid-kpi">
          {[
            { label: "Total", atual: totalRealizado, anterior: totalAnterior, deltaPct: totalDeltaPct },
            ...comparativo.map(c => ({ label: c.name, atual: c.atual, anterior: c.anterior, deltaPct: c.deltaPct })),
          ].map(({ label, atual, anterior, deltaPct }) => {
            const arrow = deltaPct === null ? "" : deltaPct > 0 ? "\u2191" : deltaPct < 0 ? "\u2193" : "\u2192";
            const color = deltaPct === null ? theme.colors.neutral : deltaPct > 5 ? theme.colors.success : deltaPct < -5 ? theme.colors.critical : "#c8d8e8";
            return (
              <StatTile
                key={label}
                label={label}
                value={fmtBRL(atual)}
                accent={color}
                sub={`vs ${fmtBRL(anterior)}`}
                badges={
                  <span style={{ color, fontSize: 13, fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>
                    {deltaPct !== null ? `${arrow} ${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : "\u2014"}
                  </span>
                }
              />
            );
          })}
        </div>
      </div>

      {/* ── B6 PROJECAO FIM DE MES ────────────────────────────────────────── */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={LineChart} color="#f59e0b" title="Proje\u00E7\u00E3o Fim de M\u00EAs" desc={`Run rate: realizado \u00F7 ${diasDecorridos} dias decorridos \u00D7 ${totalDiasUteis} dias \u00FAteis no m\u00EAs`} />

        {/* KPI cards */}
        <div className="asb-grid-kpi" style={{ marginBottom: 20 }}>
          {[
            { label: "Dias Decorridos", value: `${diasDecorridos}/${totalDiasUteis}`, accent: theme.colors.brandAsb },
            { label: "Proje\u00e7\u00e3o Total", value: fmtBRL(projecaoTotal), accent: projColor(projecaoVsMeta) },
            { label: "vs Meta", value: totalMeta > 0 ? `${projecaoVsMeta.toFixed(1)}%` : "\u2014", accent: projColor(projecaoVsMeta) },
            { label: "Delta", value: totalMeta > 0 ? `${deltaTotal >= 0 ? "+" : ""}${fmtBRL(deltaTotal)}` : "\u2014", accent: deltaTotal >= 0 ? theme.colors.success : theme.colors.critical },
          ].map(({ label, value, accent }) => (
            <StatTile key={label} label={label} value={value} accent={accent} />
          ))}
        </div>

        {/* Tabela por vendedor */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Vendedor", "Realizado", "Projeção", "Meta", "vs Meta"].map(h => (
                <th key={h} style={{ ...S.label, textAlign: h === "Vendedor" ? "left" : "right", paddingBottom: 8 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projVendedores.map(v => {
              const accent = VENDOR_ACCENT[v.rt] ?? theme.colors.neutral;
              return (
                <tr key={v.rt} style={{ borderTop: "1px solid rgba(27,42,107,.3)" }}>
                  <td style={{ color: accent, fontSize: 11, fontFamily: theme.font.label, padding: "7px 0", fontWeight: 700 }}>{v.name}</td>
                  <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0" }}>{fmtBRL(v.realizado)}</td>
                  <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{fmtBRL(v.proj)}</td>
                  <td style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0" }}>{v.meta > 0 ? fmtBRL(v.meta) : "\u2014"}</td>
                  <td style={{
                    color: projColor(v.projPct),
                    fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0", fontWeight: 700,
                  }}>{v.meta > 0 ? `${v.projPct.toFixed(1)}%` : "\u2014"}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: `2px solid ${theme.colors.borderDefault}` }}>
              <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: theme.font.label, padding: "7px 0", fontWeight: 700 }}>TOTAL</td>
              <td style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0" }}>{fmtBRL(totalRealizado)}</td>
              <td style={{ color: "#FFFFFF", fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0", fontWeight: 700 }}>{fmtBRL(projecaoTotal)}</td>
              <td style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0" }}>{totalMeta > 0 ? fmtBRL(totalMeta) : "\u2014"}</td>
              <td style={{
                color: projColor(projecaoVsMeta),
                fontSize: 11, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", textAlign: "right", padding: "7px 0", fontWeight: 700,
              }}>{totalMeta > 0 ? `${projecaoVsMeta.toFixed(1)}%` : "\u2014"}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Calendário de Metas multi-mês (Feature 1 / DEBT-108) — RPC calendario_metas_mes */}
      <div style={{ marginTop: 8 }}>
        <SectionHead Icon={CalendarDays} color="#8bb4ff" title="Calendário de Metas" desc="Navegue qualquer mês · clique no dia para ver meta (e realizado, se já passou)" />
        <MetasCalendarioGerente />
      </div>
    </div>
  );
}
