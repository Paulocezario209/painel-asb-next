"use client";

// Grid apresentacional do calendário de metas (mês). Extraído de
// app/dashboard/vendas/calendar-section.tsx (Feature 1 / DEBT-108) — JSX verbatim, sem
// mudança de comportamento. Reusado por /vendas (mono-mês) e /gerente (multi-mês via RPC).

export type MetaCalDay = {
  dia: string;
  is_today: boolean;
  is_futuro: boolean;
  status_dia: "weekend" | "futuro" | "batida" | "abaixo" | "sem_dado" | "nao_rota";
  meta_diaria_brl: number;
  realizado_brl: number;
  faturado_brl?: number; // ARES puro (sem CNB)
  is_dia_meta?: boolean;
  realizado_meta_brl?: number; // DEBT-132: fold §9 (meta terminal combina até sexta)
};

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function fmtBRL(v: number): string {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// FIX 3 (DEBT-132): valor compacto pra célula estreita (55785 → "56k")
function fmtK(v: number): string {
  return `${Math.round(Number(v) / 1000)}k`;
}

export function MetaCalendarGrid({
  days,
  selectedDay,
  onDayClick,
  mesLabel,
  metaMesBrl,
  corHex,
}: {
  days: MetaCalDay[];
  selectedDay: string | null;
  onDayClick: (dia: string) => void;
  mesLabel: string;
  metaMesBrl: number;
  corHex: string;
}) {
  const diasOrdenados = [...days].sort((a, b) => a.dia.localeCompare(b.dia));
  const primeiroDia = diasOrdenados[0];
  const padding = primeiroDia ? new Date(primeiroDia.dia + "T00:00:00").getDay() : 0;

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: `2px solid ${corHex}`,
        borderRadius: 4,
        padding: 20,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#c0c8d8", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", textTransform: "uppercase", letterSpacing: ".1em" }}>
          📅 Calendário — {mesLabel}
        </p>
        <span
          style={{
            background: corHex, color: "#fff",
            padding: "3px 10px", borderRadius: 3, fontSize: 10,
            fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Meta mês: <span className="priv-brl">{fmtBRL(metaMesBrl)}</span>
        </span>
      </div>

      {/* DOW header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {DOW.map(d => (
          <div key={d} style={{ fontSize: 9, color: "#e4e9f0", textAlign: "center", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", textTransform: "uppercase", letterSpacing: ".1em" }}>{d}</div>
        ))}
      </div>

      {/* Grid dias */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {Array.from({ length: padding }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {diasOrdenados.map(d => {
          const dia = new Date(d.dia + "T00:00:00").getDate();
          const dow = new Date(d.dia + "T00:00:00").getDay();
          // FIX2 (fold §9 / DEBT-132): badge quando o realizado da meta combina dias
          // (realizado_meta_brl ≠ realizado_brl) ou é a sexta terminal de meta.
          const isFold = d.realizado_meta_brl != null && Number(d.realizado_meta_brl) !== Number(d.realizado_brl);
          const showFold = !d.is_futuro && (isFold || (!!d.is_dia_meta && dow === 5));
          const selected = selectedDay === d.dia;
          const isToday = d.is_today;
          let bg = "#0a0f1f", border = "1px solid #2a2a2a", color = "#c8d8e8", marker = "", markerColor = "transparent";
          if (d.status_dia === "weekend") {
            bg = "#0a0f1f"; color = "#3a4555"; border = "1px solid #15203d";
          } else if (d.status_dia === "nao_rota") {
            bg = "#0a0f1f"; color = "#6a7a8a"; border = "1px solid #15203d";
            if (Number(d.realizado_brl) > 0) {
              marker = "+"; markerColor = "#185FA5";
            }
          } else if (d.status_dia === "futuro") {
            bg = "#0a0f1f"; color = "#e4e9f0"; border = "1px solid #2a2a2a";
            if (Number(d.realizado_brl) > 0) {
              marker = "▸"; markerColor = "#ff7b1c";
            }
          } else if (d.status_dia === "batida") {
            marker = "✓"; markerColor = "#22c55e";
          } else if (d.status_dia === "abaixo") {
            marker = "✗"; markerColor = "#C8102E";
          }
          if (isToday) {
            border = "2px solid #ff7b1c";
          }
          if (selected) {
            border = "2px solid #c0c8d8";
          }
          return (
            <button
              key={d.dia}
              onClick={() => onDayClick(d.dia)}
              style={{
                background: bg, border, borderRadius: 3,
                color, padding: "6px 4px", textAlign: "center",
                cursor: d.status_dia === "weekend" ? "default" : "pointer",
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif", fontSize: 11,
                fontWeight: 700, position: "relative", minHeight: 52,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                transition: "all .15s",
              }}
              disabled={d.status_dia === "weekend"}
            >
              {showFold && (
                <span
                  title="Fold §9 — meta terminal qui+sex combinadas (acumulado)"
                  style={{
                    position: "absolute", top: 2, right: 2,
                    background: "#D4A017", color: "#fff", fontSize: 9, fontWeight: 700,
                    lineHeight: 1, padding: "1px 3px", borderRadius: 2,
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif", letterSpacing: ".02em",
                  }}
                >▲</span>
              )}
              <span>{dia}</span>
              {marker && (
                <span style={{ color: markerColor, fontSize: 13, fontWeight: 900, lineHeight: 1 }}>
                  {marker}
                </span>
              )}
              {/* FIX 3 (DEBT-132): realizado(fold)/meta em dias-meta já decorridos */}
              {d.is_dia_meta && !d.is_futuro && Number(d.meta_diaria_brl) > 0 && (
                <span style={{ fontSize: 8, fontWeight: 700, color: "#c0d0e0", lineHeight: 1 }} className="priv-brl">
                  {fmtK(Number(d.realizado_meta_brl ?? d.realizado_brl))}/{fmtK(Number(d.meta_diaria_brl))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legenda */}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(27,42,107,.3)", display: "flex", gap: 14, fontSize: 9, color: "#c0d0e0", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", flexWrap: "wrap" }}>
        <span><span style={{ color: "#22c55e", fontWeight: 900 }}>✓</span> Meta batida</span>
        <span><span style={{ color: "#C8102E", fontWeight: 900 }}>✗</span> Abaixo</span>
        <span><span style={{ color: "#185FA5", fontWeight: 900 }}>+</span> Encaixe (fora rota)</span>
        <span style={{ color: "#6a7a8a" }}>○ Dia útil sem meta</span>
        <span style={{ color: "#3a4555" }}>■ Sáb/Dom</span>
        <span style={{ color: "#ff7b1c" }}>● Hoje</span>
      </div>
    </div>
  );
}
