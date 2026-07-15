// app/dashboard/cadencias/page.tsx — Central de Orquestração de Cadências (Fase 1).
// Visão Mapa (cards por estado da jornada) + Fila inline (ao clicar num estado) +
// "pergunta que quebra" (qs) + Cadência Longa por MOTIVO de perda.
// Fonte ÚNICA: view v_orquestracao_leads (derivada, read-only) + v_orquestracao_mapa
// (agregada) + v_motivos_perda. Zero tabela/coluna nova. Escopo F1: gestor/manager.
import { redirect } from "next/navigation";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { VENDOR_LABELS } from "@/lib/vendor-labels";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { unstable_cache } from "next/cache";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Contagem global (sem RLS por vendedor) — mesmo padrão do /dashboard/funil.
const svc = () => createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const getMapa = unstable_cache(
  async () => (await svc().from("v_orquestracao_mapa").select("journey_state,total,atrasados,hoje,no_prazo")).data ?? [],
  ["orq-mapa"], { revalidate: 60, tags: ["orq-mapa"] },
);
const getMotivos = unstable_cache(
  async () => (await svc().from("v_motivos_perda").select("motivo,total,total_30d").order("total", { ascending: false })).data ?? [],
  ["orq-motivos"], { revalidate: 120, tags: ["orq-motivos"] },
);
// Saúde da cadência (banner) — v_cadencia_saude, linha única agregada. F3 observabilidade.
const getSaude = unstable_cache(
  async () => (await svc().from("v_cadencia_saude").select("*").maybeSingle()).data,
  ["orq-saude"], { revalidate: 60, tags: ["orq-saude"] },
);

// ── Metadados de exibição dos estados (ordem + cor + faixa) ──────────────────
type Estado = { key: string; label: string; cor: string; band: "curta" | "ganho" | "longa" };
const ESTADOS: Estado[] = [
  { key: "INBOUND_SEM_RESPOSTA",             label: "Entrada (Inbound)",             cor: "#185FA5", band: "curta" },
  { key: "QUALIFICACAO_INTERROMPIDA",        label: "Qualificação interrompida",     cor: "#6390f5", band: "curta" },
  { key: "QUALIFICADO_AGUARDANDO_VENDEDOR",  label: "Qualificado · aguard. vendedor", cor: "#f59e0b", band: "curta" },
  { key: "HANDOFF_SEM_CONTATO",              label: "Handoff sem contato",           cor: "#eab308", band: "curta" },
  { key: "EM_ANDAMENTO",                     label: "Em andamento",                  cor: "#a855f7", band: "curta" },
  { key: "NEGOCIACAO",                       label: "Negociação",                    cor: "#a855f7", band: "curta" },
  { key: "PROPOSTA",                         label: "Proposta enviada",              cor: "#8b5cf6", band: "curta" },
  { key: "PEDIDO_TESTE",                     label: "Pedido teste",                  cor: "#3b82f6", band: "curta" },
  { key: "GANHO",                            label: "Ganho (convertido)",            cor: "#22c55e", band: "ganho" },
  { key: "PERDIDO_NURTURE",                  label: "Perdido · nutrição",            cor: "#C8102E", band: "longa" },
];
const LABEL: Record<string, string> = Object.fromEntries(ESTADOS.map(e => [e.key, e.label]));

const S = {
  card:  { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label: { fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase" as const, color: "#e4e9f0", fontFamily: theme.font.label },
  value: { fontSize: 26, fontWeight: 700, color: "#fff", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", lineHeight: 1 },
  muted: { color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label } as React.CSSProperties,
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: theme.font.label, marginBottom: 12 } as React.CSSProperties,
};

type MapaRow = { journey_state: string; total: number; atrasados: number; hoje: number; no_prazo: number };
type FilaRow = {
  phone: string | null; name: string | null; restaurant_name: string | null; city: string | null;
  routing_team: string | null; funnel_stage: string | null; qual_stage: number | null;
  lead_temperature: string | null; journey_state: string; atrasado: boolean; eh_hoje: boolean; silencio_horas: number | null;
};

// ── F3: sinalizador de cadência (banner saúde + aba Revisão + degrau) ────────
type SaudeRow = {
  em_jornada: number; em_curta: number; em_longa: number; sem_cadencia: number;
  em_revisao: number; toques_prox_24h: number; atrasados: number; graduados: number;
};
type RevisaoRow = {
  phone: string | null; restaurant_name: string | null; journey_state: string;
  followup_fail_count: number | null; leak_retry_count: number | null; routing_team: string | null;
};
type CadInfo = { cadencia: string; degrau: string | null };

// Banner de saúde: verde enquanto sem_cadencia = 0 (invariante CADÊNCIA SEM EXCEÇÃO).
function HealthBanner({ s }: { s: SaudeRow | null }) {
  if (!s) return null;
  const vaza = Number(s.sem_cadencia) > 0;
  const rev = Number(s.em_revisao) > 0;
  const tone = vaza ? theme.colors.critical : rev ? theme.colors.warning : theme.colors.success;
  const label = vaza ? "Vazamento detectado" : rev ? "Revisão pendente" : "Cadência saudável";
  const Tile = ({ l, v, accent }: { l: string; v: number; accent?: string }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...S.label, color: theme.colors.textPrimary }}>{l}</span>
      <span style={{ ...S.value, fontSize: 22, color: accent ?? "#fff" }}>{v ?? 0}</span>
    </div>
  );
  return (
    <div style={{
      ...S.card, background: theme.colors.bgElevated, border: `1px solid ${theme.colors.borderSubtle}`,
      padding: "16px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(118px,1fr))", gap: 18, alignItems: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 10, height: 10, borderRadius: 5, background: tone, flexShrink: 0 }} aria-hidden />
        <span style={{ color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: theme.font.label }}>{label}</span>
      </div>
      <Tile l="Em cadência" v={s.em_jornada} />
      <Tile l="Curta" v={s.em_curta} />
      <Tile l="Longa" v={s.em_longa} />
      <Tile l="Sem cadência" v={s.sem_cadencia} accent={vaza ? theme.colors.critical : undefined} />
      <Tile l="Em revisão" v={s.em_revisao} accent={rev ? theme.colors.warning : undefined} />
      <Tile l="Toques 24h" v={s.toques_prox_24h} />
      <Tile l="Atrasados" v={s.atrasados} accent={Number(s.atrasados) > 0 ? theme.colors.warning : undefined} />
    </div>
  );
}

// Segmento Mapa · Revisão (pill).
function SegLink({ active, href, label, tone }: { active: boolean; href: string; label: string; tone?: string }) {
  return (
    <Link href={href} style={{
      textDecoration: "none", fontFamily: theme.font.label, fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase",
      padding: "6px 14px", borderRadius: 6, whiteSpace: "nowrap",
      color: active ? "#fff" : theme.colors.textPrimary,
      background: active ? theme.colors.bgElevated : "transparent",
      border: `1px solid ${active ? (tone ?? theme.colors.accentBlue) : theme.colors.borderDefault}`,
    }}>{label}</Link>
  );
}

// Badge de cadência (CURTA = accent / LONGA = neutral) — sem emoji (Lucide/text pill).
function CadenciaBadge({ cadencia }: { cadencia: string }) {
  const curta = cadencia === "CURTA";
  return (
    <span style={{
      fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".08em", padding: "1px 6px", borderRadius: 4, flexShrink: 0,
      color: curta ? theme.colors.accentBlue : theme.colors.textPrimary,
      background: curta ? "rgba(24,95,165,.16)" : "rgba(228,233,240,.06)",
      border: `1px solid ${curta ? "rgba(24,95,165,.40)" : theme.colors.borderDefault}`,
    }}>{cadencia}</span>
  );
}

// Aba Revisão: única exceção honesta — leads com dado quebrado (não silenciosos).
function RevisaoView({ rows }: { rows: RevisaoRow[] }) {
  const motivo = (r: RevisaoRow) =>
    Number(r.followup_fail_count) >= 3 ? "número quebrado"
      : Number(r.leak_retry_count) >= 3 ? "mensagem defeituosa" : "revisar dado";
  return (
    <div style={{ ...S.card, background: theme.colors.bgElevated, border: `1px solid ${theme.colors.borderSubtle}`, padding: "16px 18px" }}>
      <p style={{ ...S.section, color: theme.colors.warning }}>▸ Revisão — leads com dado a corrigir (não silenciados)</p>
      {rows.length === 0 ? (
        <p style={S.muted}>Nenhum lead em revisão — cadência sem exceção.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 10, padding: "6px 0", ...S.label, color: "#6f8299" }}>
            <span style={{ flex: 1, minWidth: 0 }}>Empresa</span>
            <span style={{ width: 150, flexShrink: 0 }}>Estado</span>
            <span style={{ width: 150, flexShrink: 0 }}>Motivo</span>
            <span style={{ width: 90, flexShrink: 0 }}>Vendedor</span>
          </div>
          {rows.map((r, i) => {
            const nome = r.restaurant_name || (r.phone ? `...${r.phone.slice(-4)}` : "?");
            const inner = (
              <>
                <span style={{ flex: 1, minWidth: 0, color: "#c8d8e8", fontFamily: theme.font.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</span>
                <span style={{ width: 150, flexShrink: 0, color: theme.colors.textPrimary, fontFamily: theme.font.label, fontSize: 11 }}>{LABEL[r.journey_state] ?? r.journey_state}</span>
                <span style={{ width: 150, flexShrink: 0 }}>
                  <span style={{ fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".06em", padding: "1px 6px", borderRadius: 4, color: theme.colors.warning, background: "rgba(212,160,23,.12)", border: "1px solid rgba(212,160,23,.35)" }}>{motivo(r)}</span>
                </span>
                <span style={{ width: 90, flexShrink: 0, color: "#6f8299", fontFamily: theme.font.label, fontSize: 11 }}>{VENDOR_LABELS[r.routing_team ?? ""] ?? "—"}</span>
              </>
            );
            const st: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 12.5, borderTop: i > 0 ? "1px solid rgba(27,42,107,.25)" : "none", textDecoration: "none" };
            return r.phone
              ? <Link key={r.phone + i} href={`/dashboard/leads/${encodeURIComponent(r.phone)}`} style={st}>{inner}</Link>
              : <div key={i} style={st}>{inner}</div>;
          })}
          <p style={{ ...S.muted, fontSize: 9, marginTop: 8 }}>fonte: v_cadencia_lead · precisa_revisao = true · número = 3+ falhas de entrega · mensagem = 3+ retries de vazamento</p>
        </div>
      )}
    </div>
  );
}

function StateCard({ e, row, active }: { e: Estado; row: MapaRow | undefined; active: boolean }) {
  const total = row?.total ?? 0;
  const atr = row?.atrasados ?? 0;
  const hoje = row?.hoje ?? 0;
  return (
    <Link href={`/dashboard/cadencias?estado=${e.key}`} style={{ textDecoration: "none", flex: "1 1 150px", minWidth: 150 }}>
      <div style={{
        background: active ? "#12233b" : "#0d1117", border: `1px solid ${active ? e.cor : "#2a2a2a"}`,
        borderTop: `3px solid ${e.cor}`, borderRadius: 8, padding: "13px 14px", height: "100%",
        boxShadow: active ? `0 0 0 1px ${e.cor}` : "none",
      }}>
        <p style={{ ...S.label, color: e.cor, minHeight: "2.2em", lineHeight: 1.2 }}>{e.label}</p>
        <p style={{ ...S.value, marginTop: 8 }}>{total}</p>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {atr > 0 && <span style={{ fontFamily: theme.font.num, fontSize: 10, color: "#e0435c", background: "rgba(224,67,92,.14)", borderRadius: 4, padding: "1px 6px" }}>{atr} atras.</span>}
          {hoje > 0 && <span style={{ fontFamily: theme.font.num, fontSize: 10, color: "#e0a92a", background: "rgba(224,169,42,.14)", borderRadius: 4, padding: "1px 6px" }}>{hoje} hoje</span>}
          {atr === 0 && hoje === 0 && total > 0 && <span style={{ fontFamily: theme.font.num, fontSize: 10, color: "#2fbf6b", background: "rgba(47,191,107,.12)", borderRadius: 4, padding: "1px 6px" }}>no prazo</span>}
        </div>
      </div>
    </Link>
  );
}

export default async function CadenciasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/cadencias")) redirect("/dashboard");

  const sp = await searchParams;
  const estadoSel = sp?.estado && LABEL[sp.estado] ? sp.estado : null;
  const viewSel: "mapa" | "revisao" = sp?.view === "revisao" ? "revisao" : "mapa";

  const [mapaRaw, motivos, saudeRaw] = await Promise.all([getMapa(), getMotivos(), getSaude()]);
  const saude = (saudeRaw ?? null) as SaudeRow | null;
  const revCount = Number(saude?.em_revisao ?? 0);
  const mapa = mapaRaw as MapaRow[];
  const byState = new Map(mapa.map(r => [r.journey_state, r]));

  // KPIs de topo (curta = faixa curta; longa = PERDIDO; exclui GANHO da "em cadência")
  const sum = (pred: (e: Estado) => boolean, f: (r: MapaRow) => number) =>
    ESTADOS.filter(pred).reduce((a, e) => a + (byState.get(e.key) ? f(byState.get(e.key)!) : 0), 0);
  const curtaTot = sum(e => e.band === "curta", r => r.total);
  const longaTot = sum(e => e.band === "longa", r => r.total);
  const atrasTot = sum(e => e.band !== "ganho", r => r.atrasados);
  const hojeTot  = sum(e => e.band !== "ganho", r => r.hoje);
  const ganho    = byState.get("GANHO")?.total ?? 0;

  // "Pergunta que quebra" — só quando existe QUALIFICACAO_INTERROMPIDA (bounded, ~dezenas)
  const { data: quebraRows } = await svc()
    .from("v_orquestracao_leads").select("qual_stage")
    .eq("journey_state", "QUALIFICACAO_INTERROMPIDA").limit(1000);
  const QS_LABEL: Record<number, string> = { 1: "Nome/empresa", 2: "Cidade", 3: "Operação", 4: "Segmento", 5: "Volume", 6: "Volume/tempo" };
  const quebra: Record<number, number> = {};
  for (const r of (quebraRows ?? []) as { qual_stage: number | null }[]) {
    const q = r.qual_stage ?? 0; if (q >= 1 && q <= 6) quebra[q] = (quebra[q] ?? 0) + 1;
  }
  const quebraMax = Math.max(1, ...Object.values(quebra));

  // Fila inline (ao selecionar um estado)
  let fila: FilaRow[] = [];
  if (estadoSel) {
    const { data } = await svc()
      .from("v_orquestracao_leads")
      .select("phone,name,restaurant_name,city,routing_team,funnel_stage,qual_stage,lead_temperature,journey_state,atrasado,eh_hoje,silencio_horas")
      .eq("journey_state", estadoSel)
      .order("atrasado", { ascending: false })
      .order("next_followup_at", { ascending: true, nullsFirst: false })
      .limit(200);
    fila = (data ?? []) as FilaRow[];
  }

  // Degrau/cadência por lead (badge + posição na cascata) — join por phone com v_cadencia_lead.
  const cadMap = new Map<string, CadInfo>();
  if (estadoSel) {
    const { data: cad } = await svc()
      .from("v_cadencia_lead").select("phone,cadencia,degrau")
      .eq("journey_state", estadoSel).limit(400);
    for (const r of (cad ?? []) as { phone: string | null; cadencia: string | null; degrau: string | null }[]) {
      if (r.phone) cadMap.set(r.phone, { cadencia: r.cadencia ?? "", degrau: r.degrau });
    }
  }

  // Aba Revisão — leads com dado quebrado (precisa_revisao). Bounded: em_revisao costuma ser 0.
  let revisao: RevisaoRow[] = [];
  if (viewSel === "revisao") {
    const { data } = await svc()
      .from("v_cadencia_lead")
      .select("phone,restaurant_name,journey_state,followup_fail_count,leak_retry_count,routing_team")
      .eq("precisa_revisao", true)
      .order("routing_team", { ascending: true, nullsFirst: false })
      .limit(300);
    revisao = (data ?? []) as RevisaoRow[];
  }

  const motLabel: Record<string, string> = {};
  const motMax = Math.max(1, ...motivos.map((m: { total: number }) => m.total));

  const band = (b: Estado["band"]) => ESTADOS.filter(e => e.band === b);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Mapa de Orquestração de Follow-ups
        </h1>
        <p style={S.muted}>Onde está cada lead na cadência agora · clique num estado para ver a fila · Fase 1 (dados reais; próxima ação/ângulo chegam nas próximas fases)</p>
      </div>

      {/* Banner de saúde da cadência (F3) */}
      <HealthBanner s={saude} />

      {/* Segmento Mapa · Revisão */}
      <div style={{ display: "flex", gap: 8 }}>
        <SegLink active={viewSel === "mapa"} href="/dashboard/cadencias" label="Mapa · Fila" />
        <SegLink active={viewSel === "revisao"} href="/dashboard/cadencias?view=revisao"
          label={`Revisão${revCount > 0 ? ` · ${revCount}` : ""}`} tone={revCount > 0 ? theme.colors.warning : undefined} />
      </div>

      {viewSel === "revisao" ? <RevisaoView rows={revisao} /> : (
      <>
      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        {[
          { l: "Leads em cadência", v: curtaTot + longaTot, c: "#185FA5", s: "curta + longa" },
          { l: "Cadência curta", v: curtaTot, c: "#2fbf6b", s: "até 30 dias" },
          { l: "Cadência longa", v: longaTot, c: "#2bb8c4", s: "acima de 30 dias" },
          { l: "Atrasados", v: atrasTot, c: atrasTot > 0 ? "#e0435c" : "#e4e9f0", s: "follow-up vencido" },
          { l: "Ação hoje", v: hojeTot, c: "#e0a92a", s: "agendadas p/ hoje" },
          { l: "Convertidos", v: ganho, c: "#22c55e", s: "ganho (mês vivo)" },
        ].map(k => (
          <div key={k.l} style={{ ...S.card, padding: "16px 16px", borderTop: `2px solid ${k.c}` }}>
            <p style={{ ...S.label, color: k.c }}>{k.l}</p>
            <p style={{ ...S.value, marginTop: 10 }}>{k.v}</p>
            <p style={{ ...S.muted, marginTop: 5, fontSize: 10 }}>{k.s}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: estadoSel ? "1.5fr 1fr" : "1fr", gap: 16, alignItems: "start" }}>
        {/* MAPA */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ ...S.card, padding: "18px 20px" }}>
            <p style={{ ...S.section, color: "#3d8bdc" }}>▸ Cadência Curta — até 30 dias</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {band("curta").map(e => <StateCard key={e.key} e={e} row={byState.get(e.key)} active={estadoSel === e.key} />)}
              {band("ganho").map(e => <StateCard key={e.key} e={e} row={byState.get(e.key)} active={estadoSel === e.key} />)}
            </div>

            {/* pergunta que quebra */}
            {Object.keys(quebra).length > 0 && (
              <div style={{ marginTop: 16, background: "#0d1117", border: "1px dashed #2a2a2a", borderRadius: 8, padding: "12px 14px" }}>
                <p style={{ ...S.label, color: "#6f8299", marginBottom: 10 }}>▾ em qual pergunta a qualificação quebra</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[1, 2, 3, 4, 5, 6].filter(q => quebra[q]).map(q => (
                    <div key={q} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                      <span style={{ width: 130, color: "#6390f5", fontFamily: theme.font.num, flexShrink: 0 }}>{q} · {QS_LABEL[q]}</span>
                      <div style={{ flex: 1, height: 8, background: "#161b22", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ width: `${(quebra[q] / quebraMax) * 100}%`, height: "100%", background: "linear-gradient(90deg,#185FA5,#a855f7)", borderRadius: 4 }} />
                      </div>
                      <span style={{ width: 26, textAlign: "right", color: "#c0d0e0", fontFamily: theme.font.num }}>{quebra[q]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ ...S.card, padding: "18px 20px", borderTop: "2px solid #C8102E" }}>
            <p style={{ ...S.section, color: "#2bb8c4" }}>▸ Cadência Longa — perdidos / nutrição · por MOTIVO</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: motivos.length ? 16 : 0 }}>
              {band("longa").map(e => <StateCard key={e.key} e={e} row={byState.get(e.key)} active={estadoSel === e.key} />)}
            </div>
            {motivos.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {motivos.map((m: { motivo: string; total: number; total_30d: number }) => (
                  <div key={m.motivo} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                    <span style={{ width: 150, color: "#c8d8e8", fontFamily: theme.font.label, flexShrink: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={m.motivo}>{motLabel[m.motivo] ?? m.motivo}</span>
                    <div style={{ flex: 1, height: 8, background: "#161b22", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${(m.total / motMax) * 100}%`, height: "100%", background: "linear-gradient(90deg,#C8102E,#e0a92a)", borderRadius: 4 }} />
                    </div>
                    <span style={{ width: 34, textAlign: "right", color: "#c0d0e0", fontFamily: theme.font.num }}>{m.total}</span>
                  </div>
                ))}
                <p style={{ ...S.muted, fontSize: 9, marginTop: 6 }}>fonte: v_motivos_perda · total histórico</p>
              </div>
            )}
          </div>
        </div>

        {/* FILA inline */}
        {estadoSel && (
          <div style={{ ...S.card, padding: "16px 18px", position: "sticky", top: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
              <p style={{ ...S.label, color: "#fff", fontSize: 11 }}>{LABEL[estadoSel]}</p>
              <Link href="/dashboard/cadencias" style={{ color: "#c0d0e0", fontSize: 16, textDecoration: "none", lineHeight: 1 }}>×</Link>
            </div>
            <p style={{ ...S.muted, marginBottom: 12 }}>{fila.length} lead(s){fila.length >= 200 ? " (200 mais urgentes)" : ""} · clique p/ abrir o lead</p>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {fila.length === 0 && <p style={S.muted}>Nenhum lead neste estado.</p>}
              {fila.map((l, i) => {
                const nome = l.restaurant_name || l.name || (l.phone ? `...${l.phone.slice(-4)}` : "?");
                const sil = l.silencio_horas == null ? "—" : l.silencio_horas >= 24 ? `${Math.floor(l.silencio_horas / 24)}d` : `${l.silencio_horas}h`;
                const cor = l.atrasado ? "#e0435c" : l.eh_hoje ? "#e0a92a" : "#2fbf6b";
                const cad = l.phone ? cadMap.get(l.phone) : undefined;
                const row = (
                  <>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        {cad?.cadencia && <CadenciaBadge cadencia={cad.cadencia} />}
                        <span style={{ color: "#c8d8e8", fontSize: 12.5, fontFamily: theme.font.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</span>
                      </div>
                      <div style={{ color: "#6f8299", fontSize: 10, fontFamily: theme.font.label }}>
                        {l.city || "—"} · {VENDOR_LABELS[l.routing_team ?? ""] ?? "—"}
                        {cad?.degrau ? <span style={{ fontFamily: theme.font.num }}> · {cad.degrau}</span> : null}
                      </div>
                    </div>
                    <span style={{ fontFamily: theme.font.num, fontSize: 11, color: "#c0d0e0", width: 40, textAlign: "right", flexShrink: 0 }}>{sil}</span>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: cor, flexShrink: 0 }} title={l.atrasado ? "atrasado" : l.eh_hoje ? "hoje" : "no prazo"} />
                  </>
                );
                return l.phone
                  ? <Link key={l.phone + i} href={`/dashboard/leads/${encodeURIComponent(l.phone)}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", textDecoration: "none", borderTop: i > 0 ? "1px solid rgba(27,42,107,.25)" : "none" }}>{row}</Link>
                  : <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: i > 0 ? "1px solid rgba(27,42,107,.25)" : "none" }}>{row}</div>;
              })}
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
