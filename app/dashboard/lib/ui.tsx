import { theme } from "@/lib/theme";

// ── Componentes canônicos de UI do Comercial ("grafite total") ────────────────
// FONTE ÚNICA de cabeçalho de página e de seção. Toda tela usa PageHead + SectionHead
// para ficar na MESMA camada visual — nada de marcador ▸/▲/00 ou header caseiro.
// v1 (2026-07-16). Extraído da referência app/dashboard/page.tsx.

// Cabeçalho de PÁGINA (topo da tela): título grande + subtítulo.
export function PageHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <h1 style={{ color: "var(--asb-page-ink)", fontSize: 20, fontWeight: 800, fontFamily: theme.font.label, letterSpacing: "-.01em", marginBottom: 4 }}>
        {title}
      </h1>
      {desc ? (
        <p style={{ color: "var(--asb-page-ink2)", fontSize: 13, fontFamily: theme.font.label }}>{desc}</p>
      ) : null}
    </div>
  );
}

// Cabeçalho de SEÇÃO (dentro de um card): chip de ícone + título + descrição.
// Substitui QUALQUER marcador terminal (▸ ▲ 00 //) por este padrão único.
export function SectionHead({
  Icon, color = "#FF3B57", title, desc,
}: {
  Icon: React.ComponentType<{ size?: number }>;
  color?: string;
  title: string;
  desc?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 18 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: color + "22", color, flexShrink: 0 }}>
        <Icon size={17} />
      </span>
      <div>
        <div style={{ fontSize: 15.5, fontWeight: 750, color: "#fff", fontFamily: theme.font.label, letterSpacing: "-.01em" }}>{title}</div>
        {desc ? <div style={{ fontSize: 12.5, color: "#aeb7cc", fontFamily: theme.font.label, marginTop: 1 }}>{desc}</div> : null}
      </div>
    </div>
  );
}

// Sparkline (série → linha). Mesma da referência.
export function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * 120},${28 - ((v - min) / range) * 24}`).join(" ");
  return (
    <svg viewBox="0 0 120 30" preserveAspectRatio="none" style={{ width: "100%", height: 30, display: "block", marginTop: 14 }}>
      <polyline fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}
