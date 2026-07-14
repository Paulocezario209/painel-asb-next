import Link from "next/link";
import { theme } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";
import { FollowupsTable } from "@/components/followups/followups-table";
import { CadenciaBoard, type CadenciaLead } from "@/components/followups/cadencia-board";

export const dynamic = "force-dynamic";

// ── Design tokens ────────────────────────────────────────────────────────────
const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#e4e9f0", fontFamily: theme.font.label },
  value:   { fontSize: 22, fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", lineHeight: 1 } as React.CSSProperties,
  muted:   { color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label } as React.CSSProperties,
};

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
    { label: "Total Enviados",     value: total,          accent: "#FFFFFF",  suffix: "",  href: "/dashboard/followups" },
    { label: "Taxa de Resposta",   value: responseRate,   accent: "#22c55e",  suffix: "%", href: "/dashboard/followups?resposta=sim" },
    { label: "Convertidos Após",   value: converted,      accent: "#f59e0b",  suffix: "",  href: "/dashboard/followups?convertido=true" },
    { label: "Ângulo Top",         value: topAngleLabel,  accent: "#C8102E",  suffix: "",  href: topAngleKey ? `/dashboard/followups?angulo=${topAngleKey}` : "/dashboard/followups" },
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
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Follow-ups
        </h1>
        <p style={S.muted}>Histórico de follow-ups automáticos</p>
      </div>

      {/* Alertas de saúde do sistema (se houver problema) */}
      {((vencidos ?? 0) > 0 || (semData ?? 0) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(vencidos ?? 0) > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4" style={{ borderLeft: "3px solid #BA7517" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#BA7517]">
                    🟠 Vencidos não disparados
                  </p>
                  <p className="text-xs text-slate-200 mt-1">
                    leads com `next_followup_at` no passado aguardando envio
                  </p>
                </div>
                <span className="text-3xl font-bold text-[#E0993A] font-mono">{vencidos}</span>
              </div>
              <p className="text-[10px] text-gray-600 mt-2">
                Backlog esvazia ~2-3 dias úteis (cooldown 23h por lead). Sem ação necessária.
              </p>
            </div>
          )}
          {(semData ?? 0) > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-4" style={{ borderLeft: "3px solid #BA1717" }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#BA1717]">
                    🔴 Elegíveis sem data
                  </p>
                  <p className="text-xs text-slate-200 mt-1">
                    leads marcados elegíveis mas sem `next_followup_at` — não disparam
                  </p>
                </div>
                <span className="text-3xl font-bold text-[#E84545] font-mono">{semData}</span>
              </div>
              <p className="text-[10px] text-gray-600 mt-2">
                Bug em writer upstream. Investigar qual workflow setou `followup_eligible=true` sem agendar.
              </p>
            </div>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="asb-grid-kpi">
        {kpis.map(({ label, value, accent, suffix, href }) => (
          <Link key={label} href={href} style={{ textDecoration: "none" }}>
            <div style={{ ...S.card, padding: "20px 20px", minHeight: 100, borderTop: `2px solid ${accent}`, cursor: "pointer", transition: "opacity .15s", display: "flex", flexDirection: "column", justifyContent: "space-between" }} className="asb-kpi-hover">
              <p style={{ ...S.label, color: accent }}>{label}</p>
              <p style={{ ...S.value, color: accent, marginTop: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {value}{suffix}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* DEBT-288: board de cadência — leads em nutrição automática, por fase.
          Fica ACIMA do log (histórico). Estes leads saem da aba Ativos. */}
      <CadenciaBoard leads={cadenciaLeads} />

      {/* Histórico de disparos (log — não mexer) */}
      <div>
        <p style={{ ...S.label, marginBottom: 8 }}>Histórico de disparos</p>
      </div>
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
