const STAGE_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  lead_novo:              { label: "Lead Novo",          color: "#8899aa", bg: "rgba(136,153,170,.08)", border: "rgba(136,153,170,.25)" },
  atendido_sdr:           { label: "Atendido SDR",      color: "#8899aa", bg: "rgba(136,153,170,.08)", border: "rgba(136,153,170,.25)" },
  qualificacao_inicial:   { label: "Qualif. Inicial",   color: "#6390f5", bg: "rgba(99,144,245,.08)",  border: "rgba(99,144,245,.25)" },
  cobertura_validada:     { label: "Cobertura Valid.",   color: "#6390f5", bg: "rgba(99,144,245,.08)",  border: "rgba(99,144,245,.25)" },
  produto_definido:       { label: "Produto Definido",  color: "#6390f5", bg: "rgba(99,144,245,.08)",  border: "rgba(99,144,245,.25)" },
  volume_definido:        { label: "Volume Definido",   color: "#6390f5", bg: "rgba(99,144,245,.08)",  border: "rgba(99,144,245,.25)" },
  lead_qualificado:       { label: "Lead Qualificado",  color: "#f59e0b", bg: "rgba(245,158,11,.08)",  border: "rgba(245,158,11,.25)" },
  handoff:                { label: "Handoff",           color: "#f59e0b", bg: "rgba(245,158,11,.08)",  border: "rgba(245,158,11,.25)" },
  vendedor_assumiu:       { label: "Vendedor Assumiu",  color: "#eab308", bg: "rgba(234,179,8,.08)",   border: "rgba(234,179,8,.25)" },
  diagnostico_comercial:  { label: "Diag. Comercial",   color: "#eab308", bg: "rgba(234,179,8,.08)",   border: "rgba(234,179,8,.25)" },
  proposta_enviada:       { label: "Proposta Enviada",  color: "#a855f7", bg: "rgba(168,85,247,.08)",  border: "rgba(168,85,247,.25)" },
  negociacao:             { label: "Negociacao",        color: "#a855f7", bg: "rgba(168,85,247,.08)",  border: "rgba(168,85,247,.25)" },
  pedido_fechado:         { label: "Pedido Fechado",    color: "#22c55e", bg: "rgba(34,197,94,.08)",   border: "rgba(34,197,94,.25)" },
  cliente_ativo:          { label: "Cliente Ativo",     color: "#22c55e", bg: "rgba(34,197,94,.08)",   border: "rgba(34,197,94,.25)" },
  cliente_recorrente:     { label: "Recorrente",        color: "#22c55e", bg: "rgba(34,197,94,.08)",   border: "rgba(34,197,94,.25)" },
  lead_perdido:           { label: "Perdido",           color: "#C8102E", bg: "rgba(200,16,46,.08)",   border: "rgba(200,16,46,.25)" },
};

export function FunnelStageBadge({ stage }: { stage: string | null }) {
  const cfg = STAGE_CFG[stage ?? ""] ?? { label: stage ?? "?", color: "#8899aa", bg: "rgba(136,153,170,.06)", border: "rgba(136,153,170,.2)" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 3,
      fontSize: 9, letterSpacing: ".10em", textTransform: "uppercase",
      fontFamily: "'Courier New', monospace", fontWeight: 700,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  );
}
