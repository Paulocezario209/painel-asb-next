import { createClient } from "@/lib/supabase/server";
import { FollowupsTable } from "@/components/followups/followups-table";
import { CadenciaBoard, type CadenciaLead } from "@/components/followups/cadencia-board";
import { S } from "../lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "../lib/ui";
import { Send, MessageCircle, Trophy, Crosshair, History } from "lucide-react";

export const dynamic = "force-dynamic";

const ANGLE_LABELS: Record<string, string> = {
  retomada:       "Retomada",
  dor:            "Dor",
  prova_social:   "Prova Social",
  valor:          "Valor",
  reposicionamento: "Reposicionamento",
};

const PHASE_LABELS: Record<string, string> = {
  active:    "Active",
  monthly:   "Monthly",
  semestral: "Semestral",
};

export default async function FollowupsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: followups }, { data: leads }, { count: vencidos }, { count: semData }, { data: cadencia }] = await Promise.all([
    supabase
      .from("followup_history")
      .select("phone, followup_sequence, phase, angle, message_sent, sent_at, responded, converted_after")
      .order("sent_at", { ascending: false }),
    supabase
      .from("ai_sdr_leads")
      .select("phone, name, city, routing_team, weekly_volume_kg, next_followup_at")
      .eq("is_test", false),
    // Alerta: vencidos não disparados (next_followup_at <= NOW).
    // DEBT-146 (fix 2026-07-10): contadores agora espelham os GUARDS do Engine —
    // human_active=false (lead com humano não recebe follow-up) e sem fora_de_rota
    // (a lista abaixo já excluía; contador divergia = falso-positivo no alerta).
    supabase
      .from("ai_sdr_leads")
      .select("id", { count: "exact", head: true })
      .eq("is_test", false)
      .eq("followup_eligible", true)
      .eq("human_active", false)
      .or("routing_team.is.null,routing_team.neq.fora_de_rota")
      .lte("next_followup_at", new Date().toISOString()),
    // Alerta: elegíveis sem data (mesmos guards)
    supabase
      .from("ai_sdr_leads")
      .select("id", { count: "exact", head: true })
      .eq("is_test", false)
      .eq("followup_eligible", true)
      .eq("human_active", false)
      .or("routing_team.is.null,routing_team.neq.fora_de_rota")
      .is("next_followup_at", null),
    // DEBT-288: board de cadência — leads que a automação nutre (mesmo conjunto que Ativos exclui).
    supabase
      .from("v_leads_cadencia")
      .select("phone, name, city, segment, weekly_volume_kg, routing_team, qual_stage, lead_temperature, followup_phase, followup_count, next_followup_at, vencido")
      .order("next_followup_at", { ascending: true, nullsFirst: false }),
  ]);
  const cadenciaLeads = (cadencia ?? []) as CadenciaLead[];

  const leadsMap = Object.fromEntries((leads ?? []).map(l => [l.phone, l]));
  // DEBT-167 4: fora_de_rota não aparece em follow-ups (NULL-safe — mantém em-rota + NULL).
  // followup_history não tem routing_team → filtra client-side via leadsMap.
  const rows = (followups ?? []).filter(r => {
    const rt = leadsMap[r.phone]?.routing_team;
    return rt == null || rt !== "fora_de_rota";
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  // responded é gravado em produção pelo node "Mark Follow-up Responded" do Orchestrator
  // (validado 2026-06-09: 99/357 = 27.7%). KPIs reais restaurados (revert do FIX3 errado).
  const total     = rows.length;
  const responded = rows.filter(r => r.responded).length;
  const converted = rows.filter(r => r.converted_after).length;
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;

  // Ângulo com mais resposta (absolute count)
  const angleResponded: Record<string, number> = {};
  for (const r of rows) {
    if (r.responded && r.angle) {
      angleResponded[r.angle] = (angleResponded[r.angle] ?? 0) + 1;
    }
  }
  const topAngle = Object.entries(angleResponded).sort((a, b) => b[1] - a[1])[0];
  const topAngleLabel = topAngle ? (ANGLE_LABELS[topAngle[0]] ?? topAngle[0]) : "—";
  const topAngleKey = topAngle ? topAngle[0] : "";

  const kpis = [
    { label: "Total enviados",   value: `${total}`,          Icon: Send,          accent: "#8bb4ff", href: "/dashboard/followups" },
    { label: "Taxa de resposta", value: `${responseRate}%`,  Icon: MessageCircle, accent: "#22c55e", href: "/dashboard/followups?resposta=sim" },
    { label: "Convertidos após", value: `${converted}`,      Icon: Trophy,        accent: "#f59e0b", href: "/dashboard/followups?convertido=true" },
    { label: "Ângulo top",       value: topAngleLabel,       Icon: Crosshair,     accent: "#C8102E", href: topAngleKey ? `/dashboard/followups?angulo=${topAngleKey}` : "/dashboard/followups" },
  ];

  // Enrich rows with lead data for the table
  const enriched = rows.map(r => ({
    ...r,
    name:         leadsMap[r.phone]?.name ?? null,
    city:         leadsMap[r.phone]?.city ?? null,
    routing_team: leadsMap[r.phone]?.routing_team ?? null,
    weekly_volume_kg: leadsMap[r.phone]?.weekly_volume_kg ?? null,
    next_followup_at: leadsMap[r.phone]?.next_followup_at ?? null,  // FIX2
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead title="Follow-ups" desc="Histórico de follow-ups automáticos" />

      {/* Alertas de saúde do sistema (se houver problema) */}
      {((vencidos ?? 0) > 0 || (semData ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(vencidos ?? 0) > 0 && (
            <div style={{ ...S.card, padding: 16, borderLeft: "3px solid #f59e0b" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ ...S.label, color: "#f59e0b" }}>
                    Vencidos não disparados
                  </p>
                  <p style={{ ...S.muted, marginTop: 4 }}>
                    leads com next_followup_at no passado aguardando envio
                  </p>
                </div>
                <span style={{ ...S.value, color: "#f59e0b" }}>{vencidos}</span>
              </div>
              <p style={{ ...S.muted, fontSize: 10, color: "#8b949e", marginTop: 8 }}>
                Backlog esvazia ~2-3 dias úteis (cooldown 23h por lead). Sem ação necessária.
              </p>
            </div>
          )}
          {(semData ?? 0) > 0 && (
            <div style={{ ...S.card, padding: 16, borderLeft: "3px solid #C8102E" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ ...S.label, color: "#C8102E" }}>
                    Elegíveis sem data
                  </p>
                  <p style={{ ...S.muted, marginTop: 4 }}>
                    leads marcados elegíveis mas sem next_followup_at — não disparam
                  </p>
                </div>
                <span style={{ ...S.value, color: "#C8102E" }}>{semData}</span>
              </div>
              <p style={{ ...S.muted, fontSize: 10, color: "#8b949e", marginTop: 8 }}>
                Bug em writer upstream. Investigar qual workflow setou followup_eligible=true sem agendar.
              </p>
            </div>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="asb-grid-kpi">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* DEBT-288: board de cadência — leads em nutrição automática, por fase.
          Fica ACIMA do log (histórico). Estes leads saem da aba Ativos. */}
      <CadenciaBoard leads={cadenciaLeads} />

      {/* Histórico de disparos (log — não mexer) */}
      <SectionHead Icon={History} color="#8bb4ff" title="Histórico de disparos" desc="Log de cada follow-up automático enviado" />
      <FollowupsTable
        rows={enriched}
        angleLabels={ANGLE_LABELS}
        phaseLabels={PHASE_LABELS}
        initialAngle={sp.angulo ?? "all"}
        initialRespond={sp.resposta === "sim" ? "yes" : sp.resposta === "nao" ? "no" : "all"}
        initialConvertido={sp.convertido === "true" ? "yes" : "all"}
      />
    </div>
  );
}
