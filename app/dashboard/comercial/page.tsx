import Link from "next/link";
import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { NAO_ATIVO_STAGES } from "@/lib/funnel/stages";
import { CADENCIA_PHASES } from "@/lib/followup/cadencia";
import { S } from "@/app/dashboard/lib/dashboard-tokens";

export const dynamic = "force-dynamic";

// HUB COMERCIAL (DEBT-290) — a JORNADA de ponta a ponta como um FLUXO (cards conectados
// por setas), claro pro vendedor: rótulo da etapa + título + subtítulo. Cada card abre a
// tela que já existe. Abaixo, os números vivos (cards KPI clonados de Clientes).

function startTodayUtc(): string {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${d}T00:00:00-03:00`).toISOString();
}
const PIPELINE_STAGES = ["handoff", "lead_em_andamento", "vendedor_assumiu", "negociacao", "proposta_enviada", "pedido_teste"];

export default async function ComercialPage() {
  const supabase = await createClient();
  const hoje = startTodayUtc();
  const since180 = new Date(Date.now() - 180 * 86400000).toISOString();
  const naoAtivo = `(${NAO_ATIVO_STAGES.join(",")})`;
  const cad = `next_followup_at.is.null,followup_phase.not.in.(${CADENCIA_PHASES.join(",")})`;

  const [cLeadsHoje, cParados, cPerdidos, cHandoff, cPipeline, cClientes, cRecompra] = await Promise.all([
    supabase.from("ai_sdr_leads").select("phone", { count: "exact", head: true })
      .eq("is_test", false).or("routing_team.is.null,routing_team.neq.fora_de_rota")
      .is("first_order_at", null).not("funnel_stage", "in", naoAtivo).or(cad).gte("created_at", hoje),
    supabase.from("v_leads_parados").select("id", { count: "exact", head: true }),
    supabase.from("ai_sdr_leads").select("phone", { count: "exact", head: true })
      .eq("is_test", false).eq("funnel_stage", "lead_perdido").gte("lost_at", since180),
    supabase.from("ai_sdr_leads").select("phone", { count: "exact", head: true })
      .eq("is_test", false).not("handoff_at", "is", null).is("handoff_confirmed", false),
    supabase.from("ai_sdr_leads").select("phone", { count: "exact", head: true })
      .eq("is_test", false).or("routing_team.is.null,routing_team.neq.fora_de_rota")
      .is("first_order_at", null).in("funnel_stage", PIPELINE_STAGES),
    supabase.from("v_carteira_360").select("ares_pessoa_id", { count: "exact", head: true })
      .in("customer_status", ["ativo", "atencao"]),
    supabase.from("v_carteira_360").select("ares_pessoa_id", { count: "exact", head: true })
      .in("customer_status", ["risco", "pre_churn"]),
  ]);
  const n = {
    leadsHoje: cLeadsHoje.count ?? 0, parados: cParados.count ?? 0, perdidos: cPerdidos.count ?? 0,
    handoff: cHandoff.count ?? 0, pipeline: cPipeline.count ?? 0, clientes: cClientes.count ?? 0, recompra: cRecompra.count ?? 0,
  };

  // O FLUXO — a jornada (idêntico ao artifact): rótulo + título + subtítulo (etapas reais).
  // Sem número no card do fluxo — os números vivem nos cards KPI abaixo.
  const FLUXO: FlowStep[] = [
    { cat: "SDR",       cor: "#6390f5", titulo: "Lead novo → Qualificado", sub: "lead_novo · atendido_sdr · qualif · lead_qualificado (qs7)", href: "/dashboard/leads" },
    { cat: "SDR→VEND",  cor: "#6390f5", titulo: "Handoff",                 sub: "passa pro vendedor (handoff_at)", href: "/dashboard/handoffs" },
    { cat: "VENDEDOR",  cor: "#e8b923", titulo: "Pipeline",                sub: "em_andamento · negociação · proposta · pedido_teste", href: "/dashboard/pipeline" },
    { cat: "FRONTEIRA", cor: "#22c55e", titulo: "Convertido",              sub: "pedido_fechado · 1º pedido ARES (first_order_at)", href: "/dashboard/clientes" },
    { cat: "CLIENTE",   cor: "#2dd4bf", titulo: "Ativo → Recorrente",      sub: "carteira real · recência + frequência", href: "/dashboard/clientes" },
    { cat: "SAÍDA",     cor: "#C8102E", titulo: "Risco → Churn",           sub: "15→21→30→60 dias sem comprar", href: "/dashboard/carteira-ativa" },
  ];

  const AQUISICAO: Kpi[] = [
    { label: "Leads SDR", n: n.leadsHoje, desc: "entraram hoje", color: "#3f7bf5", href: "/dashboard/leads" },
    { label: "Parados",   n: n.parados,   desc: "1–30 dias no funil", color: "#f59e0b", href: "/dashboard/leads?view=parados" },
    { label: "Perdidos",  n: n.perdidos,  desc: "últimos 180 dias", color: "#C8102E", href: "/dashboard/leads?view=perdidos" },
    { label: "Pipeline",  n: n.pipeline,  desc: "em aberto com o vendedor", color: "#eab308", href: "/dashboard/pipeline" },
  ];
  const CARTEIRA: Kpi[] = [
    { label: "Clientes",       n: n.clientes, desc: "carteira viva (ativo + atenção)", color: "#22c55e", href: "/dashboard/clientes" },
    { label: "Carteira Ativa", n: n.recompra, desc: "recompra devida (risco + pré-churn)", color: "#f97316", href: "/dashboard/carteira-ativa" },
  ];

  return (
    <div className="space-y-7">
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Comercial
        </h1>
        <p style={S.muted}>A jornada de ponta a ponta — clique numa etapa para abrir a tela.</p>
      </div>

      {/* O FLUXO — idêntico ao artifact */}
      <div className="space-y-3">
        <p style={S.section}>A jornada de ponta a ponta</p>
        <div style={{ display: "flex", alignItems: "stretch", width: "100%" }}>
          {FLUXO.map((s, i) => (
            <div key={s.cat} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <FlowCard step={s} />
              {i < FLUXO.length - 1 && (
                <span style={{ color: "#3a4a63", fontSize: 15, padding: "0 6px", flexShrink: 0, fontFamily: theme.font.num }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* NÚMEROS (KPI clonados de Clientes) */}
      <Secao titulo="Aquisição" cards={AQUISICAO} />
      <Secao titulo="Carteira" cards={CARTEIRA} />
    </div>
  );
}

type FlowStep = { cat: string; cor: string; titulo: string; sub: string; href: string };
type Kpi = { label: string; n: number; desc: string; color: string; href: string };

// Card do fluxo idêntico ao artifact: fundo chapado escuro, borda sutil COMPLETA (sem faixa
// no topo), rótulo mono colorido, título bold branco, subtítulo mono cinza (etapas reais).
function FlowCard({ step: s }: { step: FlowStep }) {
  return (
    <Link
      href={s.href}
      style={{
        ...S.card,
        display: "block", flex: 1, minWidth: 0, minHeight: 128, textDecoration: "none",
        padding: "14px 16px",
      }}
    >
      <div style={{ fontFamily: theme.font.num, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", fontWeight: 700, color: s.cor }}>
        {s.cat}
      </div>
      <div style={{ fontFamily: theme.font.label, fontSize: 15, fontWeight: 700, color: "#f2f5fa", marginTop: 9, lineHeight: 1.2 }}>
        {s.titulo}
      </div>
      <div style={{ fontFamily: theme.font.num, fontSize: 10.5, color: "#5f7089", marginTop: 9, lineHeight: 1.5 }}>
        {s.sub}
      </div>
    </Link>
  );
}

function Secao({ titulo, cards }: { titulo: string; cards: Kpi[] }) {
  return (
    <div className="space-y-3">
      <p style={S.section}>{titulo}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} style={{ textDecoration: "none" }}>
            <div style={{ ...S.card, padding: "20px 20px", borderTop: `2px solid ${c.color}`, cursor: "pointer", transition: "opacity .15s" }} className="asb-kpi-hover">
              <p style={{ ...S.label, color: c.color }} translate="no">{c.label}</p>
              <p style={{ ...S.value, marginTop: 12 }}>{c.n}</p>
              <p style={{ ...S.muted, marginTop: 8 }}>{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
