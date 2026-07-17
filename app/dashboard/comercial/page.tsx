import Link from "next/link";
import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { NAO_ATIVO_STAGES } from "@/lib/funnel/stages";
import { CADENCIA_PHASES } from "@/lib/followup/cadencia";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { Workflow, UserPlus, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

// HUB COMERCIAL (DEBT-290) — a JORNADA de ponta a ponta como um FLUXO (cards conectados
// por setas), claro pro vendedor: rótulo da etapa + título + subtítulo. Cada card abre a
// tela que já existe. Abaixo, os números vivos (StatTiles clonados de Clientes).

function startTodayUtc(): string {
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return new Date(`${d}T00:00:00-03:00`).toISOString();
}
const PIPELINE_STAGES = ["handoff", "lead_em_andamento", "vendedor_assumiu", "negociacao", "proposta_enviada", "cadastro_cliente", "pedido_teste"];

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

  // O FLUXO — a jornada de ponta a ponta: rótulo de etapa + título + subtítulo (etapas reais).
  // Sem número no card do fluxo — os números vivem nos StatTiles abaixo.
  const FLUXO: FlowStep[] = [
    { cat: "SDR",       cor: "#6390f5", titulo: "Lead novo → Qualificado", sub: "lead_novo · atendido_sdr · qualif · lead_qualificado (qs7)", href: "/dashboard/leads" },
    { cat: "SDR→VEND",  cor: "#6390f5", titulo: "Agendamento",                 sub: "passa pro vendedor (handoff_at)", href: "/dashboard/handoffs" },
    { cat: "VENDEDOR",  cor: "#e8b923", titulo: "Pipeline",                sub: "em_andamento · negociação · proposta · cadastro", href: "/dashboard/pipeline" },
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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHead title="Comercial" desc="A jornada de ponta a ponta — clique numa etapa para abrir a tela." />

      {/* O FLUXO — a jornada como cards conectados por setas */}
      <div>
        <SectionHead Icon={Workflow} color="#8bb4ff" title="A jornada de ponta a ponta" desc="Do lead novo ao cliente recorrente" />
        <div style={{ display: "flex", alignItems: "stretch", width: "100%" }}>
          {FLUXO.map((s, i) => (
            <div key={s.cat} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
              <FlowCard step={s} />
              {i < FLUXO.length - 1 && (
                <span style={{ color: "#3a4a63", fontSize: 15, padding: "0 6px", flexShrink: 0, fontFamily: theme.font.label }}>→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* NÚMEROS (StatTiles) */}
      <Secao titulo="Aquisição" desc="Entrada de leads e pipeline em aberto" Icon={UserPlus} cor="#6390f5" cards={AQUISICAO} />
      <Secao titulo="Carteira" desc="Clientes vivos e recompra devida" Icon={Wallet} cor="#22c55e" cards={CARTEIRA} />
    </div>
  );
}

type FlowStep = { cat: string; cor: string; titulo: string; sub: string; href: string };
type Kpi = { label: string; n: number; desc: string; color: string; href: string };

// Card do fluxo: fundo grafite, borda sutil completa. Rótulo de etapa (eyebrow sans colorido),
// título bold branco, subtítulo sans cinza (etapas reais). Zero mono em texto.
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
      <div style={{ fontFamily: theme.font.label, fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 750, color: s.cor }}>
        {s.cat}
      </div>
      <div style={{ fontFamily: theme.font.label, fontSize: 15, fontWeight: 700, color: "#f2f5fa", marginTop: 9, lineHeight: 1.2 }}>
        {s.titulo}
      </div>
      <div style={{ fontFamily: theme.font.label, fontSize: 11.5, color: "#83879a", marginTop: 9, lineHeight: 1.5 }}>
        {s.sub}
      </div>
    </Link>
  );
}

function Secao({ titulo, desc, Icon, cor, cards }: { titulo: string; desc: string; Icon: React.ComponentType<{ size?: number }>; cor: string; cards: Kpi[] }) {
  return (
    <div>
      <SectionHead Icon={Icon} color={cor} title={titulo} desc={desc} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} style={{ textDecoration: "none" }} className="asb-kpi-hover">
            <StatTile label={c.label} value={c.n} accent={c.color} sub={c.desc} />
          </Link>
        ))}
      </div>
    </div>
  );
}
