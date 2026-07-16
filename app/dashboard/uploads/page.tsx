import { MetasUpload } from "@/components/uploads/metas-upload";
import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, Eyebrow } from "@/app/dashboard/lib/ui";
import { VendasCnbUpload } from "@/components/uploads/vendas-cnb-upload";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { Target, Receipt } from "lucide-react";

// Célula numérica → mono/tabular · Célula de texto → sans (REGRA DE OURO).
const numCell = { padding: "4px 12px", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const } as React.CSSProperties;
const txtCell = { padding: "4px 12px", fontFamily: theme.font.label } as React.CSSProperties;
// Label de coluna → UPPERCASE pequeno SANS (info blue preservado).
const thCol = { padding: "4px 12px", textAlign: "left" as const, color: "#8bb4ff", fontFamily: theme.font.label, fontSize: 11, fontWeight: 700, letterSpacing: ".04em" } as React.CSSProperties;
const sampleBox = { background: "#0a0f1f", padding: 12, borderRadius: 8, fontSize: 11, color: "#c8d8e8", overflowX: "auto" as const } as React.CSSProperties;
const aliasNote = { fontSize: 11, color: "#83879a", marginTop: 8, fontFamily: theme.font.label } as React.CSSProperties;

export default async function UploadsPage() {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/uploads")) redirect("/dashboard");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "32px 24px", maxWidth: 900 }}>
      <PageHead
        title="Uploads"
        desc="Importação de planilhas · Preview antes de aplicar"
      />

      {/* ── Bloco 1: Upload de Metas ─────────────────────────────────────── */}
      <div>
        <SectionHead
          Icon={Target}
          color="#8bb4ff"
          title="Upload de Metas (XLSX)"
          desc="Metas mensais por vendedor · Preview antes de aplicar · UPSERT por vendedor+mês"
        />
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <Eyebrow>Formato esperado do XLSX</Eyebrow>
          <div style={sampleBox}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--asb-border)" }}>
                  <th style={thCol}>Vendedor</th>
                  <th style={thCol}>Mes</th>
                  <th style={thCol}>Ano</th>
                  <th style={thCol}>MetaMensal</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={txtCell}>Ana Paula</td><td style={numCell}>5</td><td style={numCell}>2026</td><td style={numCell}>513000</td></tr>
                <tr><td style={txtCell}>Alan</td><td style={numCell}>5</td><td style={numCell}>2026</td><td style={numCell}>240000</td></tr>
                <tr><td style={txtCell}>Paulo Cezario</td><td style={numCell}>5</td><td style={numCell}>2026</td><td style={numCell}>55682.17</td></tr>
              </tbody>
            </table>
          </div>
          <p style={aliasNote}>
            Aliases aceitos: vendedor/nome · mes/mês · ano/year · meta/valor/meta_mensal
          </p>
        </div>
      </div>

      <MetasUpload />

      {/* ── Bloco 2: Upload de Vendas CNB (DEBT-087) ─────────────────────── */}
      <div>
        <SectionHead
          Icon={Receipt}
          color="#8bb4ff"
          title="Upload de Vendas CNB (XLSX)"
          desc="Vendas Carnes Nobres Boutique · Preview antes de aplicar · UPSERT por número+data+documento"
        />
        <div style={{ ...S.card, padding: "20px 24px" }}>
          <Eyebrow>Formato esperado do XLSX</Eyebrow>
          <div style={sampleBox}>
            <table style={{ width: "100%", borderCollapse: "collapse", whiteSpace: "nowrap" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--asb-border)" }}>
                  {["numero", "data", "cliente_cnpj_cpf", "cliente_nome", "valor_total", "forma_pagamento", "vendedor"].map((c) => (
                    <th key={c} style={thCol}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={numCell}>2965</td>
                  <td style={numCell}>27/05/2026</td>
                  <td style={numCell}>21439554000160</td>
                  <td style={txtCell}>BENNE LANCHES</td>
                  <td style={numCell}>296,10</td>
                  <td style={txtCell}>BOLETO BANCARIO SICRED</td>
                  <td style={txtCell}>Alan</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={aliasNote}>
            Aliases: numero/cupom · data · cnpj/cpf/cliente_cnpj_cpf · cliente_nome/nome · valor/valor_total · pagamento · vendedor · (CPF=11 díg, CNPJ=14)
          </p>
        </div>
      </div>

      <VendasCnbUpload />
    </div>
  );
}
