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

  const [mapaRaw, motivos] = await Promise.all([getMapa(), getMotivos()]);
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
                const row = (
                  <>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: "#c8d8e8", fontSize: 12.5, fontFamily: theme.font.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{nome}</div>
                      <div style={{ color: "#6f8299", fontSize: 10, fontFamily: theme.font.label }}>{l.city || "—"} · {VENDOR_LABELS[l.routing_team ?? ""] ?? "—"}</div>
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
    </div>
  );
}
