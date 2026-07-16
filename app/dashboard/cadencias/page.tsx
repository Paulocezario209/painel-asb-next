// app/dashboard/cadencias/page.tsx — Central de Orquestração de Cadências.
// Seções (As três visões · Mapa · Fila · Dossiê · Contrato · Plano) com DADOS REAIS, na LINGUAGEM
// canônica do Dashboard: PageHead/SectionHead, número=mono, texto/label=sans (zero mono em label).
// Fontes (todas read-only, já em produção): v_orquestracao_mapa · v_orquestracao_leads ·
// v_cadencia_saude · v_cadencia_lead · v_lead_proxima_acao · v_motivos_perda. Service-role + cache 60s.
// Zero tabela/coluna nova; a tela só CONSOME. Cor de situação = tokens centralizados em TOK (sem hex solto).
import { redirect } from "next/navigation";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { VENDOR_LABELS } from "@/lib/vendor-labels";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead } from "@/app/dashboard/lib/ui";
import { Layers, Map as MapIcon, ListOrdered, FileText, FileCheck2, GitBranch } from "lucide-react";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const svc = () => createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

// ── SERIGRAFIA (tokens centralizados — fonte única, zero hex solto no JSX) ───
const TOK = {
  // superfícies: CSS vars canônicas do "grafite total" (fonte única no globals.css) — sem hex solto
  bg: "#0a0a0a", card: "var(--asb-card)", cardAlt: "var(--asb-card-hi)", border: "var(--asb-border)", borderSoft: "var(--asb-border)",
  // situação operacional (borda-topo do card / ponto de status)
  noPrazo: "#34d399", hoje: "#fbbf24", atrasado: "#f6707a", respondeu: "#60a5fa",
  humano: "#a78bfa", negocia: "#2dd4bf", pausado: "#8b93a7",
  // texto
  fg: "#e8ecf3", fgMuted: "#9aa6bd", fgDim: "#6b7488",
  // fases
  f1: "#34d399", f2: "#fbbf24", f3: "#a78bfa",
  // barras
  barFrom: "#3b82f6", barTo: "#a855f7",
} as const;
const GRAD = `linear-gradient(90deg,${TOK.barFrom},${TOK.barTo})`;
const MONO = theme.font.num;    // Geist Mono — SÓ para NÚMERO (tabular)
const SANS = theme.font.label;  // Geist Sans — todo TEXTO/label

// eyebrow canônico da linguagem (sans uppercase pequeno, igual S.label do Dashboard).
// NOME histórico "mono" mantido p/ minimizar diff — mas o corpo é SANS: ZERO mono em label.
const mono = (size: number, extra?: React.CSSProperties): React.CSSProperties =>
  ({ fontFamily: SANS, fontSize: size, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", ...extra });
// label de KPI/tile — Title Case sans (igual KpiCard do Dashboard, sem uppercase).
const tc = (size: number, extra?: React.CSSProperties): React.CSSProperties =>
  ({ fontFamily: SANS, fontSize: size, fontWeight: 650, letterSpacing: 0, ...extra });
const cardStyle = (top?: string): React.CSSProperties => ({
  ...S.card,                                  // superfície grafite canônica (var(--asb-card), radius 14, float)
  padding: "14px 16px",
  ...(top ? { borderTop: `3px solid ${top}` } : {}),
});

// ── Situação operacional (não estágio) ───────────────────────────────────────
type Situ = "noPrazo" | "hoje" | "atrasado" | "respondeu" | "humano" | "negocia" | "pausado";
const SITU_COR: Record<Situ, string> = {
  noPrazo: TOK.noPrazo, hoje: TOK.hoje, atrasado: TOK.atrasado, respondeu: TOK.respondeu,
  humano: TOK.humano, negocia: TOK.negocia, pausado: TOK.pausado,
};
const SITU_LABEL: Record<Situ, string> = {
  noPrazo: "no prazo", hoje: "hoje", atrasado: "atrasado", respondeu: "respondeu",
  humano: "precisa humano", negocia: "negociação", pausado: "pausado",
};
const HUMANO_ST = ["HANDOFF_SEM_CONTATO", "QUALIFICADO_AGUARDANDO_VENDEDOR"];
const NEGOCIA_ST = ["NEGOCIACAO", "PROPOSTA", "PEDIDO_TESTE"];
function situacaoEstado(state: string, atrasados: number, hoje: number): Situ {
  if (NEGOCIA_ST.includes(state)) return "negocia";
  if (HUMANO_ST.includes(state)) return "humano";
  if (state === "PERDIDO_NURTURE") return "pausado";
  if (state === "GANHO") return "noPrazo";
  return atrasados > 0 ? "atrasado" : hoje > 0 ? "hoje" : "noPrazo";
}
function situacaoLead(l: { journey_state: string; atrasado: boolean; eh_hoje: boolean }): Situ {
  if (NEGOCIA_ST.includes(l.journey_state)) return "negocia";
  if (HUMANO_ST.includes(l.journey_state)) return "humano";
  if (l.journey_state === "PERDIDO_NURTURE") return "pausado";
  if (l.atrasado) return "atrasado";
  if (l.eh_hoje) return "hoje";
  return "noPrazo";
}

// ── Metadados de estado (ordem + label + faixa) ──────────────────────────────
type Estado = { key: string; label: string; band: "curta" | "ganho" | "longa" };
const ESTADOS: Estado[] = [
  { key: "INBOUND_SEM_RESPOSTA", label: "Entrada (Inbound)", band: "curta" },
  { key: "QUALIFICACAO_INTERROMPIDA", label: "Qualificação interrompida", band: "curta" },
  { key: "QUALIFICADO_AGUARDANDO_VENDEDOR", label: "Qualificado · aguard. vendedor", band: "curta" },
  { key: "HANDOFF_SEM_CONTATO", label: "Handoff sem contato", band: "curta" },
  { key: "EM_ANDAMENTO", label: "Em andamento", band: "curta" },
  { key: "NEGOCIACAO", label: "Negociação", band: "curta" },
  { key: "PROPOSTA", label: "Proposta enviada", band: "curta" },
  { key: "PEDIDO_TESTE", label: "Pedido teste", band: "curta" },
  { key: "GANHO", label: "Ganho (convertido)", band: "ganho" },
  { key: "PERDIDO_NURTURE", label: "Perdido · nutrição", band: "longa" },
];
const LABEL: Record<string, string> = Object.fromEntries(ESTADOS.map(e => [e.key, e.label]));

const QS_LABEL: Record<number, string> = { 1: "Nome/empresa", 2: "Cidade", 3: "Operação", 4: "Segmento", 5: "Volume", 6: "Volume/tempo" };
const TEMPO_BUCKETS = ["D+30", "D+60", "D+90", "D+180", "D+360"];

// ── Tipos ────────────────────────────────────────────────────────────────────
type MapaRow = { journey_state: string; total: number; atrasados: number; hoje: number; no_prazo: number };
type SaudeRow = { em_jornada: number; em_curta: number; em_longa: number; sem_cadencia: number; em_revisao: number; toques_prox_24h: number; atrasados: number; graduados: number };
type FilaRow = {
  id: string | null; phone: string | null; restaurant_name: string | null; city: string | null;
  routing_team: string | null; journey_state: string; cadencia: string | null; degrau: string | null;
  silencio_horas: number | null; atrasado: boolean; eh_hoje: boolean;
};
type AcaoRow = { phone: string | null; proxima_acao: string | null; proximo_angulo: string | null; angulos_usados: string[] | null };
type CtxRow = { contexto_resumo: string | null; contexto_objecao: string | null; contexto_produto: string | null; contexto_gramatura: string | null; contexto_recompra_dias: number | null; contexto_extraido_em: string | null };
type TLItem = { at: string; kind: "lead" | "bot" | "vendor" | "stage"; text: string };

// Data BR fixa -03:00 (São Paulo, sem DST desde 2019) — evita dependência de ICU/locale.
function fmtBR(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const sp = new Date(d.getTime() - 3 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(sp.getUTCDate())}/${p(sp.getUTCMonth() + 1)}/${sp.getUTCFullYear()} ${p(sp.getUTCHours())}:${p(sp.getUTCMinutes())}`;
}

// ── Caches (padrão do funil) ─────────────────────────────────────────────────
const getMapa = unstable_cache(
  async () => (await svc().from("v_orquestracao_mapa").select("journey_state,total,atrasados,hoje,no_prazo")).data ?? [],
  ["orq-mapa"], { revalidate: 60, tags: ["orq-mapa"] });
const getMotivos = unstable_cache(
  async () => (await svc().from("v_motivos_perda").select("motivo,total,total_30d").order("total", { ascending: false })).data ?? [],
  ["orq-motivos"], { revalidate: 120, tags: ["orq-motivos"] });
const getSaude = unstable_cache(
  async () => (await svc().from("v_cadencia_saude").select("*").maybeSingle()).data,
  ["orq-saude"], { revalidate: 60, tags: ["orq-saude"] });
const getTempoBuckets = unstable_cache(
  async () => (await svc().from("v_cadencia_lead").select("degrau").eq("cadencia", "LONGA").limit(2000)).data ?? [],
  ["orq-tempo"], { revalidate: 120, tags: ["orq-tempo"] });

// ── Componentes ──────────────────────────────────────────────────────────────
function FaseBadge({ f }: { f: "F1" | "F2" | "F3" }) {
  const c = f === "F1" ? TOK.f1 : f === "F2" ? TOK.f2 : TOK.f3;
  return <span style={{ ...mono(9, { letterSpacing: ".18em" }), color: c, border: `1px solid ${c}55`, background: `${c}14`, borderRadius: 4, padding: "1px 6px" }}>{f}</span>;
}
function CadBadge({ cadencia }: { cadencia: string }) {
  const curta = cadencia === "CURTA";
  const c = curta ? TOK.respondeu : TOK.pausado;
  return <span style={{ ...mono(9, { letterSpacing: ".16em" }), color: c, border: `1px solid ${c}55`, background: `${c}14`, borderRadius: 4, padding: "1px 6px", flexShrink: 0 }}>{cadencia}</span>;
}
function SituDot({ s, title }: { s: Situ; title?: string }) {
  return <span style={{ width: 8, height: 8, borderRadius: 4, background: SITU_COR[s], flexShrink: 0 }} title={title ?? SITU_LABEL[s]} aria-hidden />;
}
// Título de SEÇÃO = <SectionHead> canônico (chip de ícone + sans Title Case).
// Sem marcador "00"/"01", sem título mono uppercase.
function Section({ Icon, color, title, sub, id, children }: { Icon: React.ComponentType<{ size?: number }>; color?: string; title: string; sub?: string; id?: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 16 }}>
      <SectionHead Icon={Icon} color={color} title={title} desc={sub} />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </section>
  );
}
function Bar({ frac, w = 34, value }: { frac: number; w?: number; value: number | string }) {
  return (
    <>
      <div style={{ flex: 1, height: 8, background: TOK.borderSoft, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, frac * 100)}%`, height: "100%", background: GRAD, borderRadius: 4 }} />
      </div>
      <span style={{ width: w, textAlign: "right", color: TOK.fgMuted, fontFamily: MONO, fontSize: 11 }}>{value}</span>
    </>
  );
}

function StateCard({ e, row, active, carry }: { e: Estado; row: MapaRow | undefined; active: boolean; carry: Record<string, string> }) {
  const total = row?.total ?? 0, atr = row?.atrasados ?? 0, hj = row?.hoje ?? 0;
  const situ = situacaoEstado(e.key, atr, hj);
  const cor = SITU_COR[situ];
  const href = `/dashboard/cadencias?${new URLSearchParams({ ...carry, estado: e.key }).toString()}#fila`;
  return (
    <Link href={href} style={{ textDecoration: "none", flex: "1 1 150px", minWidth: 150 }}>
      <div style={{ ...cardStyle(cor), background: active ? TOK.card : TOK.cardAlt, borderColor: active ? cor : TOK.border, boxShadow: active ? `0 0 0 1px ${cor}` : "none", height: "100%" }}>
        <p style={{ ...tc(12, { color: cor, minHeight: "2.2em", lineHeight: 1.25 }) }}>{e.label}</p>
        <p style={{ fontFamily: MONO, fontSize: 26, fontWeight: 700, color: TOK.fg, lineHeight: 1, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{total}</p>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {atr > 0 && <span style={{ ...mono(9), color: TOK.atrasado, background: `${TOK.atrasado}22`, borderRadius: 4, padding: "1px 6px" }}>{atr} atras.</span>}
          {hj > 0 && <span style={{ ...mono(9), color: TOK.hoje, background: `${TOK.hoje}22`, borderRadius: 4, padding: "1px 6px" }}>{hj} hoje</span>}
          {atr === 0 && hj === 0 && total > 0 && <span style={{ ...mono(9), color: TOK.noPrazo, background: `${TOK.noPrazo}1e`, borderRadius: 4, padding: "1px 6px" }}>{SITU_LABEL[situ]}</span>}
        </div>
      </div>
    </Link>
  );
}

// Contexto extraído pela IA (v_orquestracao_leads) — real quando contexto_extraido_em ≠ null.
function CtxChip({ label, value, color }: { label: string; value: string; color: string }) {
  return <span style={{ ...mono(9, { letterSpacing: ".1em" }), color, border: `1px solid ${color}55`, background: `${color}14`, borderRadius: 4, padding: "2px 7px" }}>{label}: {value}</span>;
}
function ContextoExtraido({ ctx }: { ctx: CtxRow | null }) {
  const analisado = !!ctx?.contexto_extraido_em;
  const chips: React.ReactNode[] = [];
  if (analisado && ctx) {
    if (ctx.contexto_objecao) chips.push(<CtxChip key="o" label="objeção" value={ctx.contexto_objecao} color={TOK.atrasado} />);
    if (ctx.contexto_produto) chips.push(<CtxChip key="p" label="produto" value={ctx.contexto_produto} color={TOK.negocia} />);
    if (ctx.contexto_gramatura) chips.push(<CtxChip key="g" label="gramatura" value={ctx.contexto_gramatura} color={TOK.respondeu} />);
    if (ctx.contexto_recompra_dias != null) chips.push(<CtxChip key="r" label="recompra" value={`${ctx.contexto_recompra_dias}d`} color={TOK.f2} />);
  }
  return (
    <div style={{ ...cardStyle(analisado ? TOK.f3 : undefined) }}>
      <p style={{ ...mono(9, { letterSpacing: ".15em" }), color: analisado ? TOK.f3 : TOK.fgDim, marginBottom: 8 }}>Contexto extraído</p>
      {!analisado ? (
        <p style={{ fontFamily: SANS, fontSize: 11.5, color: TOK.fgDim, lineHeight: 1.6 }}>Ainda não analisado pela IA.</p>
      ) : (
        <>
          {ctx!.contexto_resumo && <p style={{ fontFamily: SANS, fontSize: 12, color: TOK.fgMuted, lineHeight: 1.6 }}>{ctx!.contexto_resumo}</p>}
          {chips.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: ctx!.contexto_resumo ? 10 : 0 }}>{chips}</div>}
          <p style={{ fontFamily: SANS, fontSize: 10, color: TOK.fgDim, marginTop: 10 }}>analisado por IA em {fmtBR(ctx!.contexto_extraido_em)}</p>
        </>
      )}
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default async function CadenciasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/cadencias")) redirect("/dashboard");

  const sp = await searchParams;
  const estadoSel = sp?.estado && LABEL[sp.estado] ? sp.estado : null;
  const FILTROS = ["todos", "atrasado", "hoje", "humano", "negociacao"] as const;
  const filtroSel = (FILTROS as readonly string[]).includes(sp?.filtro ?? "") ? (sp!.filtro as string) : "todos";

  // Escopo por SETOR — SEGURANÇA (crítico): as views são lidas via SERVICE-ROLE (bypassa RLS), então
  // o filtro do vendedor é aplicado AQUI, no servidor, a partir do usuário autenticado. O vendedor é
  // TRAVADO no seu routing_team (`ctx.routing_team`) e a página NUNCA confia no ?vendedor= (senão ele
  // trocaria o param e veria outro setor). Gestor/manager/financeiro escolhem via ?vendedor=.
  const canPickSector = !ctx.isVendedor;
  const rawVend = sp?.vendedor ?? "";
  const effVend = ctx.isVendedor
    ? (ctx.routing_team && /^SETOR_[A-Z_]+$/.test(ctx.routing_team) ? ctx.routing_team : "__nada__")
    : (/^SETOR_[A-Z_]+$/.test(rawVend) ? rawVend : rawVend === "none" ? "none" : "");
  const isSetor = /^SETOR_[A-Z_]+$/.test(effVend);
  const isNone = effVend === "none";
  const isNada = effVend === "__nada__";  // vendedor sem setor válido → fail-closed (não vê nada)
  const carry: Record<string, string> = canPickSector && (isSetor || isNone) ? { vendedor: effVend } : {};
  // Busca (lupa): qSafe neutraliza metachars do .or() (mesmo padrão do Pipeline).
  const qSafe = (sp?.q ?? "").trim().slice(0, 60).replace(/[,()%*\\]/g, " ").trim();

  const [mapaRaw, motivos, saudeRaw, tempoRaw] = await Promise.all([getMapa(), getMotivos(), getSaude(), getTempoBuckets()]);

  // Mapa: sem filtro → agregada (cache). Com filtro de setor → deriva os contadores de
  // v_orquestracao_leads já filtrado (a agregada não tem breakdown por time) — SEM view nova.
  let mapa = mapaRaw as MapaRow[];
  if (isSetor || isNone || isNada) {
    let mq = svc().from("v_orquestracao_leads").select("journey_state,atrasado,eh_hoje").limit(5000);
    if (isSetor) mq = mq.eq("routing_team", effVend);
    else if (isNone) mq = mq.or("routing_team.is.null,routing_team.eq.");
    else mq = mq.eq("routing_team", "__no_match__");  // isNada → 0 linhas
    const agg = new Map<string, { total: number; atrasados: number; hoje: number }>();
    for (const r of ((await mq).data ?? []) as { journey_state: string; atrasado: boolean; eh_hoje: boolean }[]) {
      const a = agg.get(r.journey_state) ?? { total: 0, atrasados: 0, hoje: 0 };
      a.total++; if (r.atrasado) a.atrasados++; if (r.eh_hoje) a.hoje++;
      agg.set(r.journey_state, a);
    }
    mapa = [...agg.entries()].map(([journey_state, a]) => ({ journey_state, total: a.total, atrasados: a.atrasados, hoje: a.hoje, no_prazo: a.total - a.atrasados - a.hoje }));
  }
  const byState = new Map(mapa.map(r => [r.journey_state, r]));

  // KPIs de faixa sobre o Mapa (scoped): curta = journey_state ativo · longa = PERDIDO_NURTURE · ganho = GANHO.
  const sumBand = (b: (e: Estado) => boolean, f: (r: MapaRow) => number) =>
    ESTADOS.filter(b).reduce((a, e) => a + (byState.get(e.key) ? f(byState.get(e.key)!) : 0), 0);
  const curtaTot = sumBand(e => e.band === "curta", r => r.total);
  const longaTot = sumBand(e => e.band === "longa", r => r.total);
  const ganho = byState.get("GANHO")?.total ?? 0;

  // Banner de saúde: sem escopo (gestor Todos) → v_cadencia_saude global (já exclui graduados). COM escopo
  // de setor → curta/longa/em-cadência seguem a MESMA régua do Mapa (journey_state, EXCLUINDO GANHO) p/ bater
  // exato; sem_cadência/em_revisão/toques/atrasados vêm de v_cadencia_lead filtrado (o setor). Zero view nova.
  let saude: SaudeRow | null;
  if (isSetor || isNone || isNada) {
    let sq = svc().from("v_cadencia_lead").select("sem_cadencia,precisa_revisao,atrasado,next_followup_at").limit(5000);
    if (isSetor) sq = sq.eq("routing_team", effVend);
    else if (isNone) sq = sq.or("routing_team.is.null,routing_team.eq.");
    else sq = sq.eq("routing_team", "__no_match__");
    const srows = ((await sq).data ?? []) as { sem_cadencia: boolean; precisa_revisao: boolean; atrasado: boolean; next_followup_at: string | null }[];
    const now = Date.now(), h24 = now + 24 * 3600 * 1000;
    let semc = 0, rev = 0, atr = 0, toques = 0;
    for (const r of srows) {
      if (r.sem_cadencia) semc++;
      if (r.precisa_revisao) rev++;
      if (r.atrasado) atr++;
      if (r.next_followup_at) { const t = Date.parse(r.next_followup_at); if (t >= now && t <= h24) toques++; }
    }
    // curta/longa/em-cadência = régua do Mapa (journey_state), EXCLUINDO GANHO → bate exato com o Mapa.
    saude = { em_jornada: curtaTot + longaTot, em_curta: curtaTot, em_longa: longaTot, sem_cadencia: semc, em_revisao: rev, toques_prox_24h: toques, atrasados: atr, graduados: ganho };
  } else {
    saude = (saudeRaw ?? null) as SaudeRow | null;
  }

  // Longa por TEMPO (buckets de degrau)
  const tempoCount: Record<string, number> = {};
  for (const r of tempoRaw as { degrau: string | null }[]) {
    const d = (r.degrau ?? "").trim();
    if (TEMPO_BUCKETS.includes(d)) tempoCount[d] = (tempoCount[d] ?? 0) + 1;
    else if (d) tempoCount["recorrência"] = (tempoCount["recorrência"] ?? 0) + 1;
  }
  const tempoMax = Math.max(1, ...Object.values(tempoCount));

  // "Pergunta que quebra" (qual_stage dos QUALIFICACAO_INTERROMPIDA) — scoped ao setor
  let quebraQ = svc().from("v_orquestracao_leads").select("qual_stage").eq("journey_state", "QUALIFICACAO_INTERROMPIDA").limit(1000);
  if (isSetor) quebraQ = quebraQ.eq("routing_team", effVend);
  else if (isNone) quebraQ = quebraQ.or("routing_team.is.null,routing_team.eq.");
  else if (isNada) quebraQ = quebraQ.eq("routing_team", "__no_match__");
  const { data: quebraRows } = await quebraQ;
  const quebra: Record<number, number> = {};
  for (const r of (quebraRows ?? []) as { qual_stage: number | null }[]) {
    const q = r.qual_stage ?? 0; if (q >= 1 && q <= 6) quebra[q] = (quebra[q] ?? 0) + 1;
  }
  const quebraMax = Math.max(1, ...Object.values(quebra));
  const motMax = Math.max(1, ...motivos.map((m: { total: number }) => m.total));

  // ── FILA (v_cadencia_lead + próxima ação de v_lead_proxima_acao) ──
  let filaQ = svc().from("v_cadencia_lead")
    .select("id,phone,restaurant_name,city,routing_team,journey_state,cadencia,degrau,silencio_horas,atrasado,eh_hoje,next_followup_at")
    .order("atrasado", { ascending: false })
    .order("next_followup_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (estadoSel) filaQ = filaQ.eq("journey_state", estadoSel);
  if (filtroSel === "atrasado") filaQ = filaQ.eq("atrasado", true);
  else if (filtroSel === "hoje") filaQ = filaQ.eq("eh_hoje", true);
  else if (filtroSel === "humano") filaQ = filaQ.in("journey_state", HUMANO_ST);
  else if (filtroSel === "negociacao") filaQ = filaQ.in("journey_state", NEGOCIA_ST);
  if (isSetor) filaQ = filaQ.eq("routing_team", effVend);
  else if (isNone) filaQ = filaQ.or("routing_team.is.null,routing_team.eq.");
  else if (isNada) filaQ = filaQ.eq("routing_team", "__no_match__");
  const { data: filaData } = await filaQ;
  const fila = (filaData ?? []) as FilaRow[];

  const phones = fila.map(f => f.phone).filter(Boolean) as string[];
  const acaoMap = new Map<string, AcaoRow>();
  if (phones.length) {
    const { data: acoes } = await svc().from("v_lead_proxima_acao")
      .select("phone,proxima_acao,proximo_angulo,angulos_usados").in("phone", phones);
    for (const a of (acoes ?? []) as AcaoRow[]) if (a.phone) acaoMap.set(a.phone, a);
  }

  // Busca (lupa) — ilike em empresa/nome/cidade/telefone; clicar abre o Dossiê direto.
  type SearchRow = { phone: string | null; restaurant_name: string | null; name: string | null; city: string | null; routing_team: string | null; journey_state: string };
  let busca: SearchRow[] = [];
  if (qSafe) {
    let bq = svc().from("v_orquestracao_leads")
      .select("phone,restaurant_name,name,city,routing_team,journey_state")
      .or(`restaurant_name.ilike.%${qSafe}%,name.ilike.%${qSafe}%,city.ilike.%${qSafe}%,phone.ilike.%${qSafe}%`)
      .limit(30);
    if (isSetor) bq = bq.eq("routing_team", effVend);
    else if (isNada) bq = bq.eq("routing_team", "__no_match__");
    let rows = ((await bq).data ?? []) as SearchRow[];
    if (isNone) rows = rows.filter(r => !r.routing_team);
    busca = rows;
  }

  // ── DOSSIÊ (lead selecionado — default = topo da fila) ──
  const leadSel = sp?.lead || fila[0]?.phone || null;
  let dossie: (FilaRow & AcaoRow) | null = null;
  let timeline: TLItem[] = [];
  let leadCtx: CtxRow | null = null;
  if (leadSel) {
    // SEGURANÇA: o Dossiê é filtrado pelo MESMO escopo de setor. Um lead fora do setor do vendedor
    // não é encontrado (dRow = null → "não encontrado"), mesmo que ele injete ?lead= na URL.
    let dq = svc().from("v_lead_proxima_acao")
      .select("id,phone,restaurant_name,city,routing_team,journey_state,cadencia,degrau,silencio_horas,proxima_acao,proximo_angulo,angulos_usados")
      .eq("phone", leadSel);
    if (isSetor) dq = dq.eq("routing_team", effVend);
    else if (isNone) dq = dq.or("routing_team.is.null,routing_team.eq.");
    else if (isNada) dq = dq.eq("routing_team", "__no_match__");
    const { data: dRow } = await dq.maybeSingle();
    if (dRow) {
      const d = dRow as Record<string, unknown>;
      dossie = { ...(d as unknown as FilaRow & AcaoRow), atrasado: false, eh_hoje: false };
      const leadId = (d.id as string) ?? null;
      const [conv, vmsg, evt, cx] = await Promise.all([
        svc().from("conversas_sdr").select("message_text,response,created_at").eq("phone", leadSel).order("created_at", { ascending: false }).limit(5),
        svc().from("vendor_messages").select("content,direction,created_at").eq("lead_phone", leadSel).order("created_at", { ascending: false }).limit(5),
        leadId ? svc().from("funnel_stage_events").select("from_stage,to_stage,created_at").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(5) : Promise.resolve({ data: [] }),
        svc().from("v_orquestracao_leads").select("contexto_resumo,contexto_objecao,contexto_produto,contexto_gramatura,contexto_recompra_dias,contexto_extraido_em").eq("phone", leadSel).maybeSingle(),
      ]);
      leadCtx = ((cx as { data: CtxRow | null }).data ?? null);
      for (const c of (conv.data ?? []) as { message_text: string | null; response: string | null; created_at: string }[]) {
        if (c.message_text) timeline.push({ at: c.created_at, kind: "lead", text: c.message_text });
        if (c.response) timeline.push({ at: c.created_at, kind: "bot", text: c.response });
      }
      for (const v of (vmsg.data ?? []) as { content: string | null; direction: string | null; created_at: string }[])
        if (v.content) timeline.push({ at: v.created_at, kind: "vendor", text: `${v.direction === "outbound" ? "→" : "←"} ${v.content}` });
      for (const s of (evt.data ?? []) as { from_stage: string | null; to_stage: string | null; created_at: string }[])
        timeline.push({ at: s.created_at, kind: "stage", text: `${s.from_stage ?? "—"} → ${s.to_stage ?? "—"}` });
      timeline = timeline.filter(t => t.at).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8);
    }
  }

  const sil = (h: number | null) => h == null ? "—" : h >= 24 ? `${Math.floor(h / 24)}d` : `${h}h`;
  const TL_META: Record<TLItem["kind"], { c: string; l: string }> = {
    lead: { c: TOK.respondeu, l: "lead" }, bot: { c: TOK.noPrazo, l: "sdr" },
    vendor: { c: TOK.negocia, l: "vendedor" }, stage: { c: TOK.humano, l: "etapa" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {/* Cabeçalho + linha de saúde */}
      <PageHead
        title="Central de Orquestração de Cadências"
        desc="Onde cada lead está na cadência agora · CURTA (até 30d) e LONGA (perdidos/nutrição) · o motor F3 já calcula a próxima ação"
      />

      {/* Busca (lupa) + filtro por setor — reusa DashboardFilters (padrão das outras telas).
          Seletor de setor só p/ quem pode escolher (gestor/manager/financeiro); vendedor fica travado. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <DashboardFilters showSearch showMonth={false} showVendedor={canPickSector} showSemTime={canPickSector} searchPlaceholder="buscar empresa, cidade ou telefone" />
        {ctx.isVendedor && (
          <span style={{ ...mono(9, { letterSpacing: ".12em" }), color: TOK.fgMuted, border: `1px solid ${TOK.border}`, borderRadius: 6, padding: "5px 11px" }}>
            seu setor: {VENDOR_LABELS[effVend] ?? (isNada ? "sem setor" : effVend)}
          </span>
        )}
      </div>

      {/* Resultados da busca — clicar abre o Dossiê direto */}
      {qSafe && (
        <div style={{ ...cardStyle(TOK.respondeu) }}>
          <p style={{ ...mono(9, { letterSpacing: ".15em" }), color: TOK.respondeu, marginBottom: 10 }}>Busca — {busca.length} resultado(s){busca.length >= 30 ? " (30 primeiros)" : ""}</p>
          {busca.length === 0 ? (
            <p style={{ fontFamily: SANS, fontSize: 12, color: TOK.fgDim }}>Nenhum lead encontrado.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {busca.map((b, i) => (
                b.phone ? (
                  <Link key={b.phone + i} href={`/dashboard/cadencias?${new URLSearchParams({ ...carry, lead: b.phone }).toString()}#dossie`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", textDecoration: "none", borderTop: i > 0 ? `1px solid ${TOK.borderSoft}` : "none" }}>
                    <span style={{ flex: 1, minWidth: 0, color: TOK.fg, fontSize: 12.5, fontFamily: SANS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.restaurant_name || b.name || `...${b.phone.slice(-4)}`}</span>
                    <span style={{ width: 130, flexShrink: 0, color: TOK.fgMuted, fontFamily: SANS, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.city || "—"}</span>
                    <span style={{ width: 90, flexShrink: 0, color: TOK.fgDim, fontFamily: SANS, fontSize: 10.5 }}>{VENDOR_LABELS[b.routing_team ?? ""] ?? "sem time"}</span>
                    <span style={{ width: 120, flexShrink: 0, color: TOK.fgMuted, fontFamily: SANS, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{LABEL[b.journey_state] ?? b.journey_state}</span>
                  </Link>
                ) : null
              ))}
            </div>
          )}
        </div>
      )}

      {saude && (
        <div style={{ ...cardStyle(), display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 16, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SituDot s={Number(saude.sem_cadencia) > 0 ? "atrasado" : Number(saude.em_revisao) > 0 ? "hoje" : "noPrazo"} title="saúde" />
            <span style={{ fontFamily: SANS, fontSize: 12.5, fontWeight: 600, color: TOK.fg }}>{Number(saude.sem_cadencia) > 0 ? "Vazamento detectado" : "Cadência saudável"}</span>
          </div>
          {[
            { l: "Em cadência", v: saude.em_jornada, c: TOK.fg },
            { l: "Curta", v: saude.em_curta, c: TOK.respondeu },
            { l: "Longa", v: saude.em_longa, c: TOK.pausado },
            { l: "Sem cadência", v: saude.sem_cadencia, c: Number(saude.sem_cadencia) > 0 ? TOK.atrasado : TOK.fg },
            { l: "Em revisão", v: saude.em_revisao, c: Number(saude.em_revisao) > 0 ? TOK.hoje : TOK.fg },
            { l: "Toques 24h", v: saude.toques_prox_24h, c: TOK.fg },
            { l: "Atrasados", v: saude.atrasados, c: Number(saude.atrasados) > 0 ? TOK.hoje : TOK.fg },
          ].map(k => (
            <div key={k.l} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <span style={{ ...tc(11.5, { color: TOK.fgMuted }) }}>{k.l}</span>
              <span style={{ fontFamily: MONO, fontSize: 20, color: k.c, fontVariantNumeric: "tabular-nums" }}>{k.v ?? 0}</span>
            </div>
          ))}
        </div>
      )}

      {/* AS TRÊS VISÕES */}
      <Section Icon={Layers} color={TOK.respondeu} title="As três visões" sub="uma tela, três lentes sobre a mesma cadência">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {[
            { a: "#mapa", t: "Mapa", f: "F1" as const, d: "onde cada lead está — por estado da jornada, com atrasados e ação de hoje." },
            { a: "#fila", t: "Fila", f: "F3" as const, d: "a lista priorizada — silêncio, degrau e a PRÓXIMA AÇÃO real do motor." },
            { a: "#dossie", t: "Dossiê", f: "F3" as const, d: "o lead por dentro — timeline + próxima melhor ação e ângulo, sem repetir." },
          ].map(c => (
            <a key={c.t} href={c.a} style={{ textDecoration: "none" }}>
              <div style={{ ...cardStyle(), height: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ ...tc(14, { fontWeight: 750, color: TOK.fg }) }}>{c.t}</span>
                  <FaseBadge f={c.f} />
                </div>
                <p style={{ fontFamily: SANS, fontSize: 11.5, color: TOK.fgMuted, marginTop: 8, lineHeight: 1.5 }}>{c.d}</p>
              </div>
            </a>
          ))}
        </div>
      </Section>

      {/* MAPA */}
      <Section Icon={MapIcon} color={TOK.f1} title="Mapa" id="mapa" sub={`curta ${curtaTot} · longa ${longaTot} · ganho ${ganho} · borda-topo = situação operacional`}>
        <div style={{ ...cardStyle() }}>
          <p style={{ ...mono(9, { letterSpacing: ".15em" }), color: TOK.respondeu, marginBottom: 10 }}>Cadência Curta — até 30 dias</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ESTADOS.filter(e => e.band === "curta" || e.band === "ganho").map(e => <StateCard key={e.key} e={e} row={byState.get(e.key)} active={estadoSel === e.key} carry={carry} />)}
          </div>
          {Object.keys(quebra).length > 0 && (
            <div style={{ marginTop: 16, background: TOK.cardAlt, border: `1px dashed ${TOK.border}`, borderRadius: 8, padding: "12px 14px" }}>
              <p style={{ ...mono(9), color: TOK.fgDim, marginBottom: 10 }}>em qual pergunta a qualificação quebra</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[1, 2, 3, 4, 5, 6].filter(q => quebra[q]).map(q => (
                  <div key={q} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                    <span style={{ width: 130, color: TOK.fgMuted, fontFamily: SANS, fontSize: 11, flexShrink: 0 }}>{q} · {QS_LABEL[q]}</span>
                    <Bar frac={quebra[q] / quebraMax} w={26} value={quebra[q]} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...cardStyle(TOK.pausado) }}>
            <p style={{ ...mono(9, { letterSpacing: ".15em" }), color: TOK.pausado, marginBottom: 12 }}>Longa — por TEMPO (cascata de nutrição)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {[...TEMPO_BUCKETS, "recorrência"].filter(b => tempoCount[b]).map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                  <span style={{ width: 96, color: TOK.fgMuted, fontFamily: SANS, fontSize: 11, flexShrink: 0 }}>{b}</span>
                  <Bar frac={tempoCount[b] / tempoMax} value={tempoCount[b]} />
                </div>
              ))}
              {Object.keys(tempoCount).length === 0 && <p style={{ fontFamily: SANS, fontSize: 11, color: TOK.fgDim }}>Sem leads em cadência longa.</p>}
            </div>
          </div>
          <div style={{ ...cardStyle(TOK.atrasado) }}>
            <p style={{ ...mono(9, { letterSpacing: ".15em" }), color: TOK.atrasado, marginBottom: 12 }}>Longa — por MOTIVO de perda</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {motivos.slice(0, 8).map((m: { motivo: string; total: number }) => (
                <div key={m.motivo} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                  <span style={{ width: 150, color: TOK.fgMuted, fontFamily: SANS, fontSize: 11, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.motivo}>{m.motivo}</span>
                  <Bar frac={m.total / motMax} value={m.total} />
                </div>
              ))}
              {motivos.length === 0 && <p style={{ fontFamily: SANS, fontSize: 11, color: TOK.fgDim }}>Sem motivos registrados.</p>}
            </div>
          </div>
        </div>
      </Section>

      {/* FILA */}
      <Section Icon={ListOrdered} color={TOK.f2} title="Fila" id="fila" sub={`${fila.length} lead(s)${fila.length >= 200 ? " (200 mais urgentes)" : ""}${estadoSel ? ` · ${LABEL[estadoSel]}` : ""} · Próxima ação = motor F3`}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {FILTROS.map(f => {
            const on = filtroSel === f;
            const href = `/dashboard/cadencias?${new URLSearchParams({ ...carry, ...(estadoSel ? { estado: estadoSel } : {}), ...(f !== "todos" ? { filtro: f } : {}) }).toString()}#fila`;
            return <Link key={f} href={href} style={{ ...mono(9, { letterSpacing: ".12em" }), textDecoration: "none", padding: "5px 11px", borderRadius: 6, color: on ? TOK.fg : TOK.fgMuted, background: on ? TOK.card : "transparent", border: `1px solid ${on ? TOK.humano : TOK.border}` }}>{f === "negociacao" ? "negociação" : f}</Link>;
          })}
          {estadoSel && <Link href={`/dashboard/cadencias?${new URLSearchParams({ ...carry }).toString()}#fila`} style={{ ...mono(9), textDecoration: "none", color: TOK.fgDim, marginLeft: 4 }}>× limpar estado</Link>}
        </div>

        <div style={{ ...cardStyle(), padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${TOK.border}`, ...mono(8.5), color: TOK.fgDim }}>
            <span style={{ flex: 1, minWidth: 0 }}>Empresa</span>
            <span style={{ width: 120, flexShrink: 0 }}>Estado</span>
            <span style={{ width: 132, flexShrink: 0 }}>Degrau</span>
            <span style={{ width: 46, flexShrink: 0, textAlign: "right" }}>Silêncio</span>
            <span style={{ flex: 1.2, minWidth: 0 }}>Próxima ação</span>
            <span style={{ width: 10, flexShrink: 0 }} />
          </div>
          {fila.length === 0 && <p style={{ fontFamily: SANS, fontSize: 12, color: TOK.fgDim, padding: "16px" }}>Nenhum lead nesse recorte.</p>}
          {fila.map((l, i) => {
            const situ = situacaoLead(l);
            const acao = l.phone ? acaoMap.get(l.phone) : undefined;
            const sel = l.phone === leadSel;
            const href = `/dashboard/cadencias?${new URLSearchParams({ ...carry, ...(estadoSel ? { estado: estadoSel } : {}), ...(filtroSel !== "todos" ? { filtro: filtroSel } : {}), ...(l.phone ? { lead: l.phone } : {}) }).toString()}#dossie`;
            return (
              <Link key={(l.phone ?? "x") + i} href={href} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 16px", textDecoration: "none", borderTop: i > 0 ? `1px solid ${TOK.borderSoft}` : "none", background: sel ? `${TOK.humano}12` : "transparent" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    {l.cadencia && <CadBadge cadencia={l.cadencia} />}
                    <span style={{ color: TOK.fg, fontSize: 12.5, fontFamily: SANS, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.restaurant_name || (l.phone ? `...${l.phone.slice(-4)}` : "?")}</span>
                  </div>
                  <div style={{ color: TOK.fgDim, fontSize: 10, fontFamily: SANS }}>{l.city || "—"} · {VENDOR_LABELS[l.routing_team ?? ""] ?? "—"}</div>
                </div>
                <span style={{ width: 120, flexShrink: 0, color: TOK.fgMuted, fontFamily: SANS, fontSize: 10.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{LABEL[l.journey_state] ?? l.journey_state}</span>
                <span style={{ width: 132, flexShrink: 0, color: TOK.fgMuted, fontFamily: MONO, fontSize: 11 }}>{l.degrau ?? "—"}</span>
                <span style={{ width: 46, flexShrink: 0, textAlign: "right", color: TOK.fgMuted, fontFamily: MONO, fontSize: 11 }}>{sil(l.silencio_horas)}</span>
                <span style={{ flex: 1.2, minWidth: 0, color: TOK.fgMuted, fontFamily: SANS, fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={acao?.proxima_acao ?? ""}>{acao?.proxima_acao ?? "—"}</span>
                <SituDot s={situ} />
              </Link>
            );
          })}
        </div>
      </Section>

      {/* DOSSIÊ */}
      <Section Icon={FileText} color={TOK.f3} title="Dossiê" id="dossie" sub={dossie ? "próxima melhor ação + timeline (clique num lead da fila para trocar)" : "selecione um lead na Fila"}>
        {!dossie ? (
          <div style={{ ...cardStyle() }}><p style={{ fontFamily: SANS, fontSize: 12, color: TOK.fgDim }}>Sem lead selecionado.</p></div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, alignItems: "start" }}>
            {/* Cabeçalho + próxima melhor ação + contexto extraído (F2) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ ...cardStyle(SITU_COR[situacaoLead({ journey_state: dossie.journey_state, atrasado: false, eh_hoje: false })]) }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {dossie.cadencia && <CadBadge cadencia={dossie.cadencia} />}
                  <span style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, color: TOK.fg }}>{dossie.restaurant_name || (dossie.phone ? `...${dossie.phone.slice(-4)}` : "?")}</span>
                </div>
                <p style={{ fontFamily: SANS, fontSize: 11.5, color: TOK.fgMuted, marginTop: 6 }}>{dossie.city || "—"} · {VENDOR_LABELS[dossie.routing_team ?? ""] ?? "sem rota"} · {LABEL[dossie.journey_state] ?? dossie.journey_state}</p>
                <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                  <div><span style={{ ...mono(8.5), color: TOK.fgDim }}>Degrau</span><p style={{ fontFamily: MONO, fontSize: 13, color: TOK.fg, marginTop: 2 }}>{dossie.degrau ?? "—"}</p></div>
                  <div><span style={{ ...mono(8.5), color: TOK.fgDim }}>Silêncio</span><p style={{ fontFamily: MONO, fontSize: 13, color: TOK.fg, marginTop: 2 }}>{sil(dossie.silencio_horas)}</p></div>
                </div>
                {dossie.phone && <Link href={`/dashboard/leads/${encodeURIComponent(dossie.phone)}`} style={{ ...mono(9), color: TOK.respondeu, textDecoration: "none", display: "inline-block", marginTop: 12 }}>abrir dossiê completo →</Link>}
              </div>

              <div style={{ ...cardStyle(TOK.f3) }}>
                <p style={{ ...mono(9, { letterSpacing: ".15em" }), color: TOK.f3, marginBottom: 10 }}>Próxima melhor ação <FaseBadge f="F3" /></p>
                <p style={{ fontFamily: SANS, fontSize: 14, color: TOK.fg, fontWeight: 600 }}>{dossie.proxima_acao ?? "—"}</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  {dossie.proximo_angulo && <span style={{ ...mono(9), color: TOK.negocia, border: `1px solid ${TOK.negocia}55`, background: `${TOK.negocia}14`, borderRadius: 4, padding: "1px 6px" }}>ângulo: {dossie.proximo_angulo}</span>}
                </div>
                {dossie.angulos_usados && dossie.angulos_usados.length > 0 && (
                  <p style={{ fontFamily: SANS, fontSize: 10.5, color: TOK.fgDim, marginTop: 10 }}>não repetir: {dossie.angulos_usados.join(" · ")}</p>
                )}
              </div>

              <ContextoExtraido ctx={leadCtx} />
            </div>

            {/* Timeline */}
            <div style={{ ...cardStyle() }}>
              <p style={{ ...mono(9, { letterSpacing: ".15em" }), color: TOK.fgMuted, marginBottom: 12 }}>Timeline <FaseBadge f="F1" /></p>
              {timeline.length === 0 ? (
                <p style={{ fontFamily: SANS, fontSize: 11, color: TOK.fgDim }}>Sem toques registrados.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {timeline.map((t, i) => {
                    const m = TL_META[t.kind];
                    return (
                      <div key={i} style={{ display: "flex", gap: 10 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 4, background: m.c, flexShrink: 0, marginTop: 5 }} aria-hidden />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ ...mono(8), color: m.c }}>{m.l}</span>
                          <p style={{ fontFamily: SANS, fontSize: 11.5, color: TOK.fgMuted, lineHeight: 1.5, marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{t.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* CONTRATO DE DADOS */}
      <Section Icon={FileCheck2} color={TOK.respondeu} title="Contrato de dados" sub="verde = já existe (reusa) · roxo = novo (Fase 2)">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ ...cardStyle(TOK.f1) }}>
            <p style={{ ...mono(9, { letterSpacing: ".15em" }), color: TOK.f1, marginBottom: 10 }}>Real hoje — F1/F3 ✓</p>
            <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 5 }}>
              {["Mapa por estado (v_orquestracao_mapa)", "Pergunta que quebra (qual_stage)", "Longa por motivo (v_motivos_perda)", "Fila: silêncio + degrau (v_cadencia_lead)", "PRÓXIMA AÇÃO + ângulo (v_lead_proxima_acao)", "Não-repetição (angulos_usados)", "Dossiê: cabeçalho + timeline", "Contexto extraído: objeção (v_orquestracao_leads)", "Contexto extraído: gramatura (v_orquestracao_leads)", "Contexto extraído: produto (v_orquestracao_leads)"].map(x =>
                <li key={x} style={{ fontFamily: SANS, fontSize: 11.5, color: TOK.fgMuted, lineHeight: 1.5 }}>{x}</li>)}
            </ul>
          </div>
          <div style={{ ...cardStyle(TOK.f2) }}>
            <p style={{ ...mono(9, { letterSpacing: ".15em" }), color: TOK.f2, marginBottom: 10 }}>Fase 2 — placeholder (sem dado)</p>
            <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 5 }}>
              {["last_lead_signal_at (último sinal) — DEBT-291, ainda não existe"].map(x =>
                <li key={x} style={{ fontFamily: SANS, fontSize: 11.5, color: TOK.fgDim, lineHeight: 1.5 }}>{x}</li>)}
            </ul>
            <p style={{ fontFamily: SANS, fontSize: 10, color: TOK.fgDim, marginTop: 12 }}>views consumidas: v_orquestracao_mapa · v_orquestracao_leads · v_cadencia_saude · v_cadencia_lead · v_lead_proxima_acao · v_motivos_perda</p>
          </div>
        </div>
      </Section>

      {/* PLANO POR FASES */}
      <Section Icon={GitBranch} color={TOK.negocia} title="Plano por fases">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {[
            { f: "F1" as const, t: "Mapa & Fila no ar", d: "estados, atrasados, silêncio, degrau, motivo de perda — tudo lendo as views de orquestração." },
            { f: "F2" as const, t: "Contexto extraído (schema)", d: "objeção, gramagem, produto-alvo e último sinal — campos a serem escritos pelo motor de extração." },
            { f: "F3" as const, t: "Motor de cadência no ar", d: "próxima ação, próximo ângulo e não-repetição já calculados por lead (v_lead_proxima_acao)." },
          ].map(p => (
            <div key={p.f} style={{ ...cardStyle(p.f === "F1" ? TOK.f1 : p.f === "F2" ? TOK.f2 : TOK.f3) }}>
              <FaseBadge f={p.f} />
              <p style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: TOK.fg, marginTop: 8 }}>{p.t}</p>
              <p style={{ fontFamily: SANS, fontSize: 11, color: TOK.fgMuted, marginTop: 6, lineHeight: 1.55 }}>{p.d}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
