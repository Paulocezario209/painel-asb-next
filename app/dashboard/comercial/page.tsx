import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NAO_ATIVO_STAGES } from "@/lib/funnel/stages";
import { CADENCIA_PHASES } from "@/lib/followup/cadencia";

export const dynamic = "force-dynamic";

// HUB COMERCIAL (DEBT-290) — uma porta só pra camada comercial. Cards clonam o KPI da tela
// Clientes (bg #16161c · borderTop 3px colorido · glow · label 10px uppercase · número 3xl branco).
// Cada card abre a função que JÁ existe (drill-down). Sem lógica nova — só navegação + contagem.

// mesma régua de "entrou hoje" da aba Leads SDR (BRT)
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

  const [cLeadsHoje, cParados, cPerdidos, cPipeline, cClientes, cRecompra] = await Promise.all([
    supabase.from("ai_sdr_leads").select("phone", { count: "exact", head: true })
      .eq("is_test", false).or("routing_team.is.null,routing_team.neq.fora_de_rota")
      .is("first_order_at", null).not("funnel_stage", "in", naoAtivo).or(cad).gte("created_at", hoje),
    supabase.from("v_leads_parados").select("id", { count: "exact", head: true }),
    supabase.from("ai_sdr_leads").select("phone", { count: "exact", head: true })
      .eq("is_test", false).eq("funnel_stage", "lead_perdido").gte("lost_at", since180),
    supabase.from("ai_sdr_leads").select("phone", { count: "exact", head: true })
      .eq("is_test", false).or("routing_team.is.null,routing_team.neq.fora_de_rota")
      .is("first_order_at", null).in("funnel_stage", PIPELINE_STAGES),
    supabase.from("v_carteira_360").select("ares_pessoa_id", { count: "exact", head: true })
      .in("customer_status", ["ativo", "atencao"]),
    supabase.from("v_carteira_360").select("ares_pessoa_id", { count: "exact", head: true })
      .in("customer_status", ["risco", "pre_churn"]),
  ]);

  const AQUISICAO = [
    { label: "Leads SDR", n: cLeadsHoje.count ?? 0, desc: "entraram hoje", color: "#3f7bf5", href: "/dashboard/leads" },
    { label: "Parados", n: cParados.count ?? 0, desc: "1–30 dias no funil", color: "#f59e0b", href: "/dashboard/leads?view=parados" },
    { label: "Perdidos", n: cPerdidos.count ?? 0, desc: "últimos 180 dias", color: "#C8102E", href: "/dashboard/leads?view=perdidos" },
    { label: "Pipeline", n: cPipeline.count ?? 0, desc: "em aberto com o vendedor", color: "#eab308", href: "/dashboard/pipeline" },
  ];
  const CARTEIRA = [
    { label: "Clientes", n: cClientes.count ?? 0, desc: "carteira viva (ativo + atenção)", color: "#22c55e", href: "/dashboard/clientes" },
    { label: "Carteira Ativa", n: cRecompra.count ?? 0, desc: "recompra devida (risco + pré-churn)", color: "#f97316", href: "/dashboard/carteira-ativa" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Comercial</h1>
        <p className="text-sm text-slate-300 mt-1">A jornada de ponta a ponta — clique num card para abrir a tela.</p>
      </div>

      <Secao titulo="Aquisição" sub="Lead → Handoff → Pipeline" cards={AQUISICAO} />
      <Secao titulo="Carteira" sub="Cliente → Recorrente → Recompra" cards={CARTEIRA} />
    </div>
  );
}

type Card = { label: string; n: number; desc: string; color: string; href: string };

function Secao({ titulo, sub, cards }: { titulo: string; sub: string; cards: Card[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span className="text-[11px] uppercase tracking-wider font-bold text-[#c0c8d8]">{titulo}</span>
        <span className="text-[10px] text-slate-500">{sub}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="bg-[#16161c] border rounded-lg p-4 transition-all block w-full text-left"
            style={{
              borderColor: "#2a2a35",
              borderTop: `3px solid ${c.color}`,
              boxShadow: "0 0 24px -8px rgba(79,125,240,0.45)",
            }}
          >
            <div className="text-[10px] uppercase tracking-wider font-bold truncate" style={{ color: c.color }}>{c.label}</div>
            <div className="text-3xl font-bold text-white mt-2">{c.n}</div>
            <div className="text-[10px] text-slate-200 mt-2 leading-tight">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
