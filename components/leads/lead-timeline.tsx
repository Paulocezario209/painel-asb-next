"use client";

const ACTOR_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  system:   { color: "#6390f5", bg: "rgba(99,144,245,.08)",  border: "rgba(99,144,245,.3)" },
  sdr:      { color: "#f59e0b", bg: "rgba(245,158,11,.08)",  border: "rgba(245,158,11,.3)" },
  vendedor: { color: "#22c55e", bg: "rgba(34,197,94,.08)",   border: "rgba(34,197,94,.3)" },
  gerente:  { color: "#a855f7", bg: "rgba(168,85,247,.08)",  border: "rgba(168,85,247,.3)" },
};

const EVENT_LABELS: Record<string, string> = {
  lead_created: "Lead criado",
  qualification_completed: "Qualificacao completa",
  handoff_sent: "Agendamento enviado",
  seller_first_response: "Vendedor respondeu",
  escalation_fired: "Escalacao disparada",
  lead_lost: "Marcado como perdido",
  note_added: "Nota adicionada",
  first_order_placed: "Primeiro pedido",
};

const STAGE_LABELS: Record<string, string> = {
  lead_novo: "Lead Novo", atendido_sdr: "Atendido SDR",
  qualificacao_inicial: "Qualif. Inicial", lead_qualificado: "Qualificado",
  handoff: "Agendamento", vendedor_assumiu: "Vendedor Assumiu",
  diagnostico_comercial: "Diag. Comercial", proposta_enviada: "Proposta",
  negociacao: "Negociacao", pedido_fechado: "Pedido Fechado",
  lead_perdido: "Perdido",
};

interface TimelineEvent {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
  _source: "event" | "transition";
  _actor?: string;
  _from_stage?: string | null;
  _to_stage?: string;
}

function fmtRelative(iso: string): string {
  const delta = (Date.now() - new Date(iso).getTime()) / 60000;
  if (delta < 1) return "agora";
  if (delta < 60) return `${Math.round(delta)}min`;
  if (delta < 1440) return `${(delta / 60).toFixed(0)}h`;
  return `${(delta / 1440).toFixed(0)}d`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function LeadTimeline({
  events,
  transitions,
}: {
  events: { id: string; event_type: string; payload: Record<string, unknown>; created_at: string }[];
  transitions: { id: string; from_stage: string | null; to_stage: string; actor: string; metadata: Record<string, unknown>; created_at: string }[];
}) {
  const merged: TimelineEvent[] = [
    ...events.map(e => ({
      ...e,
      _source: "event" as const,
      _actor: (e.payload?.actor as string) || "system",
    })),
    ...transitions.map(t => ({
      id: t.id,
      event_type: "stage_transition",
      payload: t.metadata ?? {},
      created_at: t.created_at,
      _source: "transition" as const,
      _actor: t.actor,
      _from_stage: t.from_stage,
      _to_stage: t.to_stage,
    })),
  ];

  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const display = merged.slice(0, 50);

  if (display.length === 0) {
    return <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Sem eventos registrados.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {display.map((item, i) => {
        const actorCfg = ACTOR_COLORS[item._actor ?? "system"] ?? ACTOR_COLORS.system;
        let title: string;
        let detail: string | null = null;

        if (item._source === "transition") {
          const from = STAGE_LABELS[item._from_stage ?? ""] ?? item._from_stage;
          const to = STAGE_LABELS[item._to_stage ?? ""] ?? item._to_stage;
          title = from ? `${from} \u2192 ${to}` : `\u2192 ${to}`;
        } else if (item.event_type === "note_added") {
          title = "Nota";
          detail = String(item.payload?.content ?? "");
        } else {
          title = EVENT_LABELS[item.event_type] ?? item.event_type;
          if (item.event_type === "escalation_fired") {
            detail = `Nivel ${item.payload?.level ?? "?"}`;
          }
          if (item.event_type === "lead_lost") {
            detail = String(item.payload?.reason ?? "");
          }
        }

        return (
          <div key={item.id + i} style={{
            display: "flex", gap: 10, padding: "8px 0",
            borderTop: i > 0 ? "1px solid rgba(27,42,107,.15)" : "none",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0,
              background: actorCfg.color,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontWeight: 600 }}>
                  {title}
                </span>
                <span style={{ color: "#e4e9f0", fontSize: 9, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", flexShrink: 0, marginLeft: 8 }}>
                  {fmtRelative(item.created_at)}
                </span>
              </div>
              {detail && (
                <p style={{ color: "#c0d0e0", fontSize: 10, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", marginTop: 2, wordBreak: "break-word" }}>
                  {detail}
                </p>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                <span style={{
                  fontSize: 8, padding: "1px 4px", borderRadius: 2,
                  color: actorCfg.color, background: actorCfg.bg, border: `1px solid ${actorCfg.border}`,
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif", letterSpacing: ".08em",
                }}>{item._actor}</span>
                <span style={{ color: "#444", fontSize: 8, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  {fmtDate(item.created_at)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {merged.length > 50 && (
        <p style={{ color: "#e4e9f0", fontSize: 9, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", textAlign: "center", padding: "8px 0" }}>
          +{merged.length - 50} eventos anteriores
        </p>
      )}
    </div>
  );
}
