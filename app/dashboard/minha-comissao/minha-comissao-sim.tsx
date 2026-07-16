"use client";

import { useState } from "react";
import { theme } from "@/lib/theme";
import { SectionHead } from "@/app/dashboard/lib/ui";
import { SlidersHorizontal } from "lucide-react";

// Regua VENDEDOR (asb-comissao-rules v1.9.0)
const COMISSAO_RATE = 0.002;
function bonusCrescimento(crescPct: number): number {
  if (crescPct > 12) return 500;
  if (crescPct > 8) return 300;
  if (crescPct > 3) return 150;
  return 0;
}
function fmtBRL(v: number): string {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pctColor(p: number): string {
  if (p >= 100) return theme.colors.success;
  if (p >= 50) return "#f59e0b";
  return theme.colors.critical;
}

const lbl: React.CSSProperties = { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: theme.colors.neutral, fontFamily: theme.font.label };
const num = (size: number, color = "#FFFFFF", bold = false): React.CSSProperties => ({ fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", color, fontSize: size, fontWeight: bold ? 700 : 400 });

export function MinhaComissaoSimulador({
  fixo, meta, faturadoAtual, bonusDiario, bonusSemanal,
}: {
  fixo: number; meta: number; faturadoAtual: number; bonusDiario: number; bonusSemanal: number;
}) {
  // teto do slider: 150% da meta ou 150% do faturado atual (o maior), minimo 10k
  const maxSlider = Math.max(Math.round(meta * 1.5), Math.round(faturadoAtual * 1.5), 10000);
  const [faturado, setFaturado] = useState<number>(Math.round(faturadoAtual));

  const comissao = faturado * COMISSAO_RATE;
  const crescPct = meta > 0 ? ((faturado - meta) / meta) * 100 : 0;
  const bonusCresc = bonusCrescimento(crescPct);
  const atingimento = meta > 0 ? (faturado / meta) * 100 : 0;
  // bonus diario/semanal NAO mudam com faturado (dependem dos dias batidos) -> mantidos
  const total = fixo + comissao + bonusDiario + bonusSemanal + bonusCresc;
  const totalAtualReceber = fixo + (faturadoAtual * COMISSAO_RATE) + bonusDiario + bonusSemanal + bonusCrescimento(meta > 0 ? ((faturadoAtual - meta) / meta) * 100 : 0);
  const delta = total - totalAtualReceber;

  return (
    <div className="asb-card" style={{ padding: "20px 22px", borderTop: `2px solid ${theme.colors.accent}`, display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <SectionHead Icon={SlidersHorizontal} color={theme.colors.accent} title="Simulador" desc="Se eu fechar o mês em..." />
        <p style={{ ...num(26) }}>{fmtBRL(faturado)}</p>
        <p style={{ fontSize: 11, fontFamily: theme.font.label, color: pctColor(atingimento), marginTop: 4 }}>
          {atingimento.toFixed(1)}% da minha meta ({fmtBRL(meta)})
        </p>
      </div>

      <input
        type="range" min={0} max={maxSlider} step={500}
        value={faturado}
        onChange={(e) => setFaturado(Number(e.target.value))}
        style={{ width: "100%", accentColor: theme.colors.accent }}
        aria-label="Faturado projetado"
      />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ ...lbl, fontSize: 8, color: "#8aa0b8" }}>R$ 0</span>
        <span style={{ ...lbl, fontSize: 8, color: "#8aa0b8" }}>{fmtBRL(maxSlider)}</span>
      </div>

      <div style={{ borderTop: `1px solid ${theme.colors.borderDefault}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <SimRow label="Salario fixo" val={fixo} />
        <SimRow label="Comissao 0,2% (sobre o projetado)" val={comissao} />
        <SimRow label="Bonus diario + semanal (mantidos)" val={bonusDiario + bonusSemanal} sub />
        <SimRow label={`Bonus crescimento ${crescPct > 3 ? `(${crescPct.toFixed(1)}% acima da meta)` : "(meta nao superada)"}`} val={bonusCresc} sub />
        <div style={{ borderTop: `1px dashed ${theme.colors.borderDefault}`, marginTop: 4, paddingTop: 6 }}>
          <SimRow label="Total simulado" val={total} bold />
        </div>
      </div>

      <p style={{ fontSize: 10, fontFamily: theme.font.label, color: delta >= 0 ? theme.colors.success : "#8aa0b8" }}>
        {delta >= 0 ? "+" : ""}{fmtBRL(delta)} vs. o que voce receberia fechando hoje ({fmtBRL(faturadoAtual)}).
      </p>
      <p style={{ fontSize: 9, fontFamily: theme.font.label, color: "#8aa0b8" }}>
        Bonus diario/semanal dependem dos dias de meta batidos &mdash; nao mudam com o faturado projetado (mostrados como ja conquistados no mes).
      </p>
    </div>
  );
}

function SimRow({ label, val, bold, sub }: { label: string; val: number; bold?: boolean; sub?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontSize: sub ? 10 : 11, fontFamily: theme.font.label, color: sub ? "#8aa0b8" : (bold ? "#FFFFFF" : "#c0d0e0"), paddingLeft: sub ? 10 : 0 }}>{label}</span>
      <span style={num(bold ? 14 : 12, bold ? "#FFFFFF" : "#e4e9f0", bold)}>{fmtBRL(val)}</span>
    </div>
  );
}
