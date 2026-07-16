"use client";

import { useState } from "react";
import { theme } from "@/lib/theme";

// ── Cores de impacto (valores de bonus) ──────────────────────────────────────
const GREEN = "#22c55e";
const ORANGE = "#f97316";
const RED = "#ef4444";

// Faixas de crescimento do GERENTE (pct -> bonus). Cor por impacto do valor.
const GERENTE_CRESCIMENTO: { pct: string; val: string; color: string }[] = [
  { pct: ">5%",  val: "R$ 300",   color: GREEN },
  { pct: ">10%", val: "R$ 500",   color: GREEN },
  { pct: ">15%", val: "R$ 700",   color: GREEN },
  { pct: ">20%", val: "R$ 1.050", color: GREEN },
  { pct: ">25%", val: "R$ 1.200", color: GREEN },
  { pct: ">30%", val: "R$ 1.500", color: GREEN },
  { pct: ">35%", val: "R$ 1.750", color: ORANGE },
  { pct: ">40%", val: "R$ 2.000", color: ORANGE },
  { pct: ">45%", val: "R$ 2.250", color: ORANGE },
  { pct: ">50%", val: "R$ 2.500", color: ORANGE },
  { pct: ">55%", val: "R$ 2.900", color: ORANGE },
  { pct: ">60%", val: "R$ 3.300", color: ORANGE },
  { pct: ">65%", val: "R$ 3.700", color: RED },
  { pct: ">70%", val: "R$ 4.100", color: RED },
  { pct: ">75%", val: "R$ 4.500", color: RED },
  { pct: ">80%", val: "R$ 5.000", color: RED },
];

// Baldes do gerente (comissao por tipo de cliente).
const GERENTE_BALDES: { label: string; val: string; color: string }[] = [
  { label: "Carteira",    val: "0,1%", color: GREEN },
  { label: "Crescimento", val: "0,6%", color: ORANGE },
  { label: "Novo",        val: "1,0%", color: RED },
  { label: "Resgate",     val: "1,0%", color: RED },
];

// Bonus de crescimento — vendedor.
const VENDEDOR_CRESCIMENTO: { pct: string; val: string; color: string }[] = [
  { pct: ">3%",  val: "R$ 150", color: GREEN },
  { pct: ">8%",  val: "R$ 300", color: ORANGE },
  { pct: ">12%", val: "R$ 500", color: RED },
];

// ── Estilos base ─────────────────────────────────────────────────────────────
const st = {
  button: {
    fontSize: 11,
    letterSpacing: ".08em",
    textTransform: "uppercase" as const,
    fontFamily: theme.font.label,
    color: "#e4e9f0",
    background: "var(--asb-card)",
    border: `1px solid ${theme.colors.borderDefault}`,
    borderRadius: 6,
    padding: "6px 14px",
    cursor: "pointer",
  } as React.CSSProperties,
  overlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 1000,
  } as React.CSSProperties,
  card: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "85vh",
    overflowY: "auto" as const,
    background: "var(--asb-card)",
    border: `1px solid ${theme.colors.borderDefault}`,
    borderRadius: 12,
    boxShadow: "0 24px 60px rgba(0,0,0,.55)",
    display: "flex",
    flexDirection: "column" as const,
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "16px 20px",
    borderBottom: `1px solid ${theme.colors.borderDefault}`,
    position: "sticky" as const,
    top: 0,
    background: "var(--asb-card)",
    zIndex: 1,
  } as React.CSSProperties,
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 700,
    fontFamily: theme.font.label,
    letterSpacing: ".08em",
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  close: {
    background: "transparent",
    border: "none",
    color: "#c0d0e0",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    padding: 4,
  } as React.CSSProperties,
  tabBar: {
    display: "flex",
    gap: 6,
    padding: "12px 20px 0",
    flexWrap: "wrap" as const,
  } as React.CSSProperties,
  body: {
    padding: "16px 20px 22px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 18,
  } as React.CSSProperties,
  sectionLabel: {
    fontSize: 9,
    letterSpacing: ".15em",
    textTransform: "uppercase" as const,
    color: theme.colors.textPrimary,
    fontFamily: theme.font.label,
    marginBottom: 8,
  } as React.CSSProperties,
  fixoValue: {
    fontSize: 22,
    fontWeight: 700,
    color: "#FFFFFF",
    fontFamily: theme.font.num,
    fontVariantNumeric: "tabular-nums" as const,
    lineHeight: 1,
  } as React.CSSProperties,
  rowLabel: {
    fontSize: 12,
    fontFamily: theme.font.label,
    color: "#c0d0e0",
  } as React.CSSProperties,
  rowVal: {
    fontSize: 12,
    fontFamily: theme.font.num,
    fontVariantNumeric: "tabular-nums" as const,
    fontWeight: 700,
  } as React.CSSProperties,
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    letterSpacing: ".05em",
    fontFamily: theme.font.label,
    fontWeight: active ? 700 : 400,
    color: active ? "#FFFFFF" : "#7a8697",
    background: active ? "#1f1f27" : "transparent",
    border: `1px solid ${active ? theme.colors.borderDefault : "transparent"}`,
    borderBottom: active ? `2px solid ${theme.colors.accent}` : "2px solid transparent",
    borderRadius: "6px 6px 0 0",
    padding: "8px 14px",
    cursor: "pointer",
  };
}

// Linha rotulo <-> valor colorido.
function Line({ label, val, color }: { label: string; val: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 10,
        padding: "5px 0",
        borderBottom: `1px solid ${theme.colors.borderSubtle}`,
      }}
    >
      <span style={st.rowLabel}>{label}</span>
      <span style={{ ...st.rowVal, color }}>{val}</span>
    </div>
  );
}

function FixoBlock({ value }: { value: string }) {
  return (
    <div>
      <p style={st.sectionLabel}>Salário fixo</p>
      <p style={st.fixoValue}>{value}</p>
    </div>
  );
}

function GerenteTab() {
  return (
    <div style={st.body}>
      <FixoBlock value="R$ 6.000 / mês" />

      <div>
        <p style={st.sectionLabel}>Comissão por balde de cliente</p>
        {GERENTE_BALDES.map((b) => (
          <Line key={b.label} label={b.label} val={b.val} color={b.color} />
        ))}
        <p style={{ fontSize: 10, fontFamily: theme.font.label, color: "#8aa0b8", marginTop: 10, lineHeight: 1.5 }}>
          Crescimento (0,6%): cliente recorrente que expande o <b>mix</b> — SKU novo (não comprado nos últimos
          6 meses) representa ≥ 25% do faturado-itens do mês. <b>Vigência Ago/2026:</b> a 0,6% passa a incidir
          <b> só sobre o faturamento dos SKUs novos</b>; o restante (same-product, mérito do cliente) cai na
          Carteira (0,1%). Até Jul/2026: 0,6% sobre todo o faturado do cliente Crescimento (regra anterior).
        </p>
      </div>

      <div>
        <p style={st.sectionLabel}>Bônus crescimento vs META (realizado / meta − 1)</p>
        {GERENTE_CRESCIMENTO.map((b) => (
          <Line key={b.pct} label={b.pct} val={b.val} color={b.color} />
        ))}
        <p style={{ fontSize: 10, fontFamily: theme.font.label, color: "#8aa0b8", marginTop: 10, lineHeight: 1.5 }}>
          Vigência Jul/2026. Até Jun/2026: bônus por faixa de atingimento (130/150/180) + crescimento
          vs mês anterior, cumulativos (regra histórica).
        </p>
      </div>
    </div>
  );
}

function VendedorTab() {
  return (
    <div style={st.body}>
      <FixoBlock value="R$ 2.552,80 / mês" />

      <div>
        <p style={st.sectionLabel}>Comissão base</p>
        <Line label="Sobre faturado recebido" val="0,2%" color={GREEN} />
      </div>

      <div>
        <p style={st.sectionLabel}>Bônus de meta</p>
        <Line label="Bônus diário (por dia de meta batida)" val="R$ 100" color={GREEN} />
        <Line label="Bônus semanal (semana com 2 dias batidos)" val="R$ 100" color={ORANGE} />

        {/* RESGATE (compensacao semanal) — regra JA paga (asb-comissao-rules §1, matriz 4 cenarios); conteudo apenas */}
        <p style={{ fontSize: 11, fontFamily: theme.font.label, color: "#e4e9f0", fontWeight: 700, letterSpacing: ".04em", marginTop: 14, marginBottom: 4 }}>
          Bônus RESGATE (compensação semanal)
        </p>
        <p style={{ fontSize: 11, fontFamily: theme.font.label, color: "#c0d0e0", lineHeight: 1.5, marginBottom: 8 }}>
          Não bateu uma das 2 metas da semana? Se a SOMA dos 2 dias cobrir a soma das 2 metas, o dia não
          batido é RESGATADO: você recebe os 2 bônus diários (R$ 200). Só o bônus semanal exige os 2 dias
          batidos individualmente. Condição: pelo menos 1 dia batido no próprio dia — semana sem nenhum dia
          batido não tem resgate.
        </p>
        <Line label="Dia 1 bateu · Dia 2 bateu — diário 200 + semanal 100" val="R$ 300" color={GREEN} />
        <Line label="Dia 1 bateu · Dia 2 não · soma cobre — resgate 200 + semanal 0" val="R$ 200" color={GREEN} />
        <Line label="Dia 1 bateu · Dia 2 não · soma NÃO cobre — 100 + 0" val="R$ 100" color={ORANGE} />
        <Line label="Nenhum dia batido (mesmo com soma alta)" val="R$ 0" color={RED} />
        <p style={{ fontSize: 10, fontFamily: theme.font.label, color: "#8aa0b8", lineHeight: 1.5, marginTop: 8 }}>
          Ana / CUIT: a última meta da semana é COMBINADA (QUI+SEX contam como uma) — regra §9 vigente.
        </p>
      </div>

      <div>
        <p style={st.sectionLabel}>Bônus de crescimento</p>
        {VENDEDOR_CRESCIMENTO.map((b) => (
          <Line key={b.pct} label={b.pct} val={b.val} color={b.color} />
        ))}
      </div>
    </div>
  );
}

type Tab = "gerente" | "vendedor";

export function RegrasComissaoModal({ perfil }: { perfil: "ambos" | "vendedor" }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(perfil === "vendedor" ? "vendedor" : "gerente");

  return (
    <>
      <button type="button" style={st.button} onClick={() => setOpen(true)}>
        Consultar Regras
      </button>

      {open && (
        <div
          style={st.overlay}
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            style={st.card}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Regras de comissão"
          >
            <div style={st.header}>
              <span style={st.title}>Regras de Comissão</span>
              <button
                type="button"
                style={st.close}
                onClick={() => setOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div style={st.tabBar}>
              {perfil === "ambos" && (
                <button type="button" style={tabStyle(tab === "gerente")} onClick={() => setTab("gerente")}>
                  Comissão Gerente Comercial
                </button>
              )}
              <button type="button" style={tabStyle(tab === "vendedor")} onClick={() => setTab("vendedor")}>
                Comissão Vendedores
              </button>
            </div>

            {tab === "gerente" && perfil === "ambos" ? <GerenteTab /> : <VendedorTab />}
          </div>
        </div>
      )}
    </>
  );
}
