import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FollowupsTable } from "@/components/followups/followups-table";
import { theme } from "@/lib/theme";

export const dynamic = "force-dynamic";

// ── Design tokens ────────────────────────────────────────────────────────────
const S = {
  card:    { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#556677", fontFamily: "'Courier New', monospace" },
  value:   { fontSize: 22, fontWeight: 700, fontFamily: "'Inter', system-ui, sans-serif", lineHeight: 1 } as React.CSSProperties,
  muted:   { color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
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

  const [{ data: followups }, { data: leads }, { count: vencidos }, { count: semData }] = await Promise.all([
    supabase
      .from("followup_history")
      .select("phone, followup_sequence, phase, angle, message_sent, sent_at, responded, converted_after")
      .order("sent_at", { ascending: false }),
    supabase
      .from("ai_sdr_leads")
      .select("phone, name, city, routing_team, weekly_volume_kg, next_followup_at")
      .eq("is_test", false),
    // Alerta: vencidos não disparados (next_followup_at <= NOW)
    supabase
      .from("ai_sdr_leads")
      .select("id", { count: "exact", head: true })
      .eq("is_test", false)
      .eq("followup_eligible", true)
      .lte("next_followup_at", new Date().toISOString()),
    // Alerta: elegíveis sem data
    supabase
      .from("ai_sdr_leads")
      .select("id", { count: "exact", head: true })
      .eq("is_test", false)
      .eq("followup_eligible", true)
      .is("next_followup_at", null),
  ]);

  const rows = followups ?? [];
  const leadsMap = Object.fromEntries((leads ?? []).map(l => [l.phone, l]));

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const total = rows.length;
  // FIX3: responded/converted_after NÃO têm writer no pipeline (auditoria 2026-06-09)
  // → KPIs de efetividade são honestamente "—" até a instrumentação do webhook de resposta.
  const kpis = [
    { label: "Total Enviados",   display: String(total), accent: "#FFFFFF",          href: "/dashboard/followups", tooltip: undefined as string | undefined, note: "" },
    { label: "Taxa de Resposta", display: "—",           accent: theme.colors.neutral, href: "/dashboard/followups", tooltip: "Aguardando instrumentação de resposta", note: "" },
    { label: "Convertidos Após", display: "—",           accent: theme.colors.neutral, href: "/dashboard/followups", tooltip: "Aguardando instrumentação de resposta", note: "" },
    { label: "Ângulo Top",       display: "—",           accent: theme.colors.neutral, href: "/dashboard/followups", tooltip: "Aguardando instrumentação de resposta", note: "(em breve)" },
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
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
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
                  <p className="text-xs text-gray-500 mt-1">
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
                  <p className="text-xs text-gray-500 mt-1">
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
        {kpis.map(({ label, display, accent, href, tooltip, note }) => (
          <Link key={label} href={href} style={{ textDecoration: "none" }}>
            <div title={tooltip} style={{ ...S.card, padding: "20px 20px", minHeight: 100, borderTop: `2px solid ${accent}`, cursor: "pointer", transition: "opacity .15s", display: "flex", flexDirection: "column", justifyContent: "space-between" }} className="asb-kpi-hover">
              <p style={{ ...S.label, color: accent }}>
                {label}{note ? <span style={{ color: theme.colors.neutral, marginLeft: 6 }}>{note}</span> : null}
              </p>
              <p style={{ ...S.value, color: accent, marginTop: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {display}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* FIX3: banner honesto sobre métricas de resposta não instrumentadas */}
      <div style={{ background: theme.colors.bgElevated, border: `1px solid ${theme.colors.warning}`, borderRadius: 6, padding: "8px 12px", color: theme.colors.neutral, fontSize: 11, fontFamily: theme.font.mono }}>
        ℹ️ Métricas de resposta disponíveis após instrumentação do webhook de resposta
      </div>

      {/* Table (client component — handles filters) */}
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
