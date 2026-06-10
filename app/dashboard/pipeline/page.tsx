// app/dashboard/pipeline/page.tsx — P1: Pipeline Kanban por vendedor (Server Component).
// asb-crm: role-based — vendedor vê só o seu routing_team; gestor vê todos (+ filtro opcional).
// asb-dashboard-elite: 1 pergunta — "onde está cada lead do vendedor agora?".
// Fonte: query direta (LISTA de leads pós-handoff, não agregação numérica — cada lead 1x, limit explícito).
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { createClient } from "@/lib/supabase/server";
import { PipelineBoard, type PipelineLead, type PipelineCtx } from "./pipeline-board";

export const dynamic = "force-dynamic";

// Etapas-coluna do pipeline do VENDEDOR (pós-handoff). Ordem = fluxo. handoff = origem (não-destino).
export const PIPELINE_STAGES = [
  "handoff",
  "lead_em_andamento",
  "negociacao",
  "proposta_enviada",
  "pedido_teste",
  "pedido_fechado",
  "lead_perdido",
] as const;

const VENDOR_LABELS: Record<string, string> = {
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula", SETOR_CAMPINAS_JUNDIAI: "Alan", SETOR_CUIT: "CUIT",
};

const S = {
  card: { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  muted: { color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
};

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/pipeline")) redirect("/dashboard");

  const supabase = await createClient();
  const sp = await searchParams;

  // Role-based: vendedor é travado no seu routing_team; gestor escolhe via ?vendedor= (default: todos).
  const spVend = sp?.vendedor && /^SETOR_[A-Z_]+$/.test(sp.vendedor) ? sp.vendedor : null;
  const vendFiltro = ctx.isVendedor ? ctx.routing_team : spVend;

  let q = supabase
    .from("ai_sdr_leads")
    .select("id, phone, restaurant_name, city, weekly_volume_kg, funnel_stage, routing_team, handoff_at, seller_first_reply_at, created_at")
    .eq("is_test", false)
    .in("funnel_stage", PIPELINE_STAGES as unknown as string[])
    .order("handoff_at", { ascending: false, nullsFirst: false })
    .limit(500);
  if (vendFiltro) q = q.eq("routing_team", vendFiltro);

  const { data: rawLeads } = await q;
  const leads = (rawLeads ?? []) as PipelineLead[];

  // Agrupa por etapa (server-side, sobre a lista já filtrada)
  const byStage: Record<string, PipelineLead[]> = {};
  for (const s of PIPELINE_STAGES) byStage[s] = [];
  for (const l of leads) (byStage[l.funnel_stage ?? "handoff"] ??= []).push(l);

  const boardCtx: PipelineCtx = {
    isGestor: ctx.isGestor,
    routing_team: ctx.routing_team,
    canMoveAll: ctx.isGestor,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* Header — asb-dashboard-elite: contexto claro + role */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
            Pipeline {ctx.isVendedor && ctx.routing_team ? `· ${VENDOR_LABELS[ctx.routing_team] ?? ctx.routing_team}` : ""}
          </h1>
          <p style={S.muted}>
            {leads.length} lead(s) no pipeline do vendedor · arraste o card para mover de etapa
          </p>
        </div>
      </div>

      {/* Filtro de vendedor — só gestor (vendedor é travado no seu) */}
      {ctx.isGestor && (
        <div style={{ ...S.card, padding: "12px 16px" }}>
          <VendorPills active={spVend} />
        </div>
      )}

      <PipelineBoard byStage={byStage} stages={PIPELINE_STAGES as unknown as string[]} ctx={boardCtx} />
    </div>
  );
}

// Pills de vendedor (server-rendered, navegação por <a> — sem client). asb-painel-design-system.
function VendorPills({ active }: { active: string | null }) {
  const mono = "'Courier New', monospace";
  const opts = [
    { v: "", label: "Todos" },
    { v: "SETOR_SOROCABA_SAO_PAULO", label: "Ana" },
    { v: "SETOR_CAMPINAS_JUNDIAI", label: "Alan" },
    { v: "SETOR_CUIT", label: "CUIT" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "#556677", fontSize: 9, fontFamily: mono, letterSpacing: ".12em", textTransform: "uppercase", marginRight: 2 }}>Vendedor</span>
      {opts.map(({ v, label }) => {
        const isActive = active === v || (!active && v === "");
        return (
          <a key={v || "todos"} href={v ? `/dashboard/pipeline?vendedor=${v}` : "/dashboard/pipeline"}
            style={{
              background: isActive ? "rgba(46,160,67,.16)" : "transparent",
              border: `1px solid ${isActive ? "#2ea043" : "#2a2a2a"}`,
              borderRadius: 5, padding: "5px 11px",
              color: isActive ? "#fff" : "#8899aa",
              fontSize: 10, fontFamily: mono, letterSpacing: ".06em", textDecoration: "none",
              fontWeight: isActive ? 700 : 400,
            }}>
            {label}
          </a>
        );
      })}
    </div>
  );
}
