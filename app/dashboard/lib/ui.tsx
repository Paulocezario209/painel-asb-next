import Link from "next/link";
import { theme } from "@/lib/theme";
import { S } from "./dashboard-tokens";

// ── Componentes canônicos de UI do Comercial ("grafite total") ────────────────
// FONTE ÚNICA da LINGUAGEM visual. Toda tela usa estes componentes para ficar
// IDÊNTICA à referência app/dashboard/page.tsx — mesma tipografia, mesmos cards,
// mesma escala. Nada de marcador ▸/▲/00, nada de MONO em label, nada de header caseiro.
// v2 (2026-07-16): + KpiCard, StatTile, Eyebrow.
//
// REGRA DE OURO DA LINGUAGEM:
//  · TÍTULO de página  → PageHead (sans, Title Case, 20px)
//  · TÍTULO de seção   → SectionHead (chip de ícone + sans Title Case 15.5px). NUNCA "00 X" nem UPPERCASE MONO.
//  · KPI herói         → KpiCard (chip + label Title Case sans + número mono grande + trend + sparkline)
//  · stat compacto     → StatTile (label Title Case sans + número mono)
//  · eyebrow pequeno    → Eyebrow / S.label (UPPERCASE SANS 11px .06em #83879a) — só sub-rótulo, nunca título
//  · NÚMERO             → sempre mono/tabular (theme.font.num) · TEXTO/label → sempre sans (theme.font.label)

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

// Eyebrow: sub-rótulo pequeno (UPPERCASE SANS, nunca mono). Use para "Curva ABC",
// "Top cidades", etc — sempre pequeno, nunca como título de seção.
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ ...S.label, marginBottom: 10, ...style }}>{children}</p>;
}

// KpiCard — KPI herói CANÔNICO (idêntico ao Dashboard). Impõe a linguagem:
// chip de ícone (accent) + label Title Case sans + número mono grande + trend chip + sparkline.
// NUNCA recrie um KPI na mão — use este. label DEVE ser Title Case ("Total de leads"), nunca "TOTAL DE LEADS".
export function KpiCard({
  label, value, Icon, accent = "#8bb4ff", num, href, chip, chipUp = null, note, series,
}: {
  label: string;
  value: React.ReactNode;
  Icon: React.ComponentType<{ size?: number }>;
  accent?: string;
  num?: string;           // cor do número (default = branco)
  href?: string;
  chip?: string;          // texto do trend chip (ex "+18%", "a distribuir")
  chipUp?: boolean | null;// true=verde↗ false=vermelho↘ null=neutro
  note?: string;          // legenda à direita (ex "vs. período anterior")
  series?: number[];      // sparkline opcional
}) {
  const body = (
    <div className="asb-kpi-hover" style={{ ...S.card, padding: 22, borderTop: `3px solid ${accent}`, cursor: href ? "pointer" : "default", overflow: "hidden", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: accent + "22", color: accent, flexShrink: 0 }}>
          <Icon size={20} />
        </span>
        <span style={{ fontSize: 13.5, fontWeight: 650, color: "#c8d2e6", fontFamily: theme.font.label }} translate="no">{label}</span>
      </div>
      <div style={{ fontSize: 42, fontWeight: 850, letterSpacing: "-.03em", lineHeight: 1, color: num ?? "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {(chip || note) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 8 }}>
          {chip ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 750, padding: "3px 9px", borderRadius: 999,
              background: chipUp === null ? "rgba(255,255,255,.08)" : (chipUp ? "rgba(34,197,94,.16)" : "rgba(200,16,46,.16)"),
              color: chipUp === null ? "#aeb7cc" : (chipUp ? "#22c55e" : "#ff5a72"), fontFamily: theme.font.label,
            }}>
              {chipUp !== null && <span style={{ fontSize: 13, lineHeight: 1 }}>{chipUp ? "↗" : "↘"}</span>}{chip}
            </span>
          ) : <span />}
          {note ? <span style={{ fontSize: 11.5, color: "#83879a", fontFamily: theme.font.label }}>{note}</span> : null}
        </div>
      )}
      {series ? <Sparkline data={series} color={accent} /> : null}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: "none" }}>{body}</Link> : body;
}

// StatTile — stat compacto CANÔNICO (grids densos: cadências, comercial, etc).
// label Title Case sans + número mono. Aceita accent (borderTop) e badges opcionais.
export function StatTile({
  label, value, accent, num, badges, sub,
}: {
  label: string;
  value: React.ReactNode;
  accent?: string;        // se passado, borda-topo de sinal
  num?: string;           // cor do número
  badges?: React.ReactNode; // chips abaixo do número (ex "3 atras." "5 hoje")
  sub?: string;           // legenda pequena
}) {
  return (
    <div style={{ ...S.card, padding: "16px 18px", borderTop: accent ? `3px solid ${accent}` : undefined, height: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 650, color: "#aeb7cc", fontFamily: theme.font.label, lineHeight: 1.3 }}>{label}</span>
      <span style={{ fontSize: 28, fontWeight: 850, letterSpacing: "-.02em", lineHeight: 1, color: num ?? "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      {badges ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>{badges}</div> : null}
      {sub ? <span style={{ fontSize: 11, color: "#83879a", fontFamily: theme.font.label }}>{sub}</span> : null}
    </div>
  );
}
