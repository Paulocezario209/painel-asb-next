import { MetasUpload } from "@/components/uploads/metas-upload";
import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { VendasCnbUpload } from "@/components/uploads/vendas-cnb-upload";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";

export default async function UploadsPage() {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/uploads")) redirect("/dashboard");

  return (
    <div style={{ padding: "32px 24px", maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: 700,
            fontFamily: theme.font.label,
            letterSpacing: ".1em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Upload de Metas (XLSX)
        </h1>
        <p style={S.muted}>
          Metas mensais por vendedor · Preview antes de aplicar · UPSERT por vendedor+mês
        </p>
      </div>

      {/* Formato esperado */}
      <div style={{ ...S.card, padding: "20px 24px", marginBottom: 20 }}>
        <p style={{ ...S.section, marginBottom: 8 }}>
          <span style={{ marginRight: 6 }}>📋</span>
          Formato esperado do XLSX
        </p>
        <div style={{ background: "#0a0f1f", padding: 12, borderRadius: 4, fontFamily: theme.font.num, fontSize: 11, color: "#c8d8e8", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--asb-border)" }}>
                <th style={{ padding: "4px 12px", textAlign: "left", color: "#8bb4ff" }}>Vendedor</th>
                <th style={{ padding: "4px 12px", textAlign: "left", color: "#8bb4ff" }}>Mes</th>
                <th style={{ padding: "4px 12px", textAlign: "left", color: "#8bb4ff" }}>Ano</th>
                <th style={{ padding: "4px 12px", textAlign: "left", color: "#8bb4ff" }}>MetaMensal</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: "4px 12px" }}>Ana Paula</td><td style={{ padding: "4px 12px" }}>5</td><td style={{ padding: "4px 12px" }}>2026</td><td style={{ padding: "4px 12px" }}>513000</td></tr>
              <tr><td style={{ padding: "4px 12px" }}>Alan</td><td style={{ padding: "4px 12px" }}>5</td><td style={{ padding: "4px 12px" }}>2026</td><td style={{ padding: "4px 12px" }}>240000</td></tr>
              <tr><td style={{ padding: "4px 12px" }}>Paulo Cezario</td><td style={{ padding: "4px 12px" }}>5</td><td style={{ padding: "4px 12px" }}>2026</td><td style={{ padding: "4px 12px" }}>55682.17</td></tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 9, color: "#e4e9f0", marginTop: 8, fontFamily: theme.font.label }}>
          Aliases aceitos: vendedor/nome · mes/mês · ano/year · meta/valor/meta_mensal
        </p>
      </div>

      <MetasUpload />

      {/* ── Bloco 2: Upload de Vendas CNB (DEBT-087) ─────────────────────── */}
      <div style={{ marginTop: 44, marginBottom: 28 }}>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Upload de Vendas CNB (XLSX)
        </h1>
        <p style={S.muted}>
          Vendas Carnes Nobres Boutique · Preview antes de aplicar · UPSERT por número+data+documento
        </p>
      </div>

      <div style={{ ...S.card, padding: "20px 24px", marginBottom: 20 }}>
        <p style={{ ...S.section, marginBottom: 8 }}>
          <span style={{ marginRight: 6 }}>📋</span>
          Formato esperado do XLSX
        </p>
        <div style={{ background: "#0a0f1f", padding: 12, borderRadius: 4, fontFamily: theme.font.num, fontSize: 11, color: "#c8d8e8", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--asb-border)" }}>
                {["numero", "data", "cliente_cnpj_cpf", "cliente_nome", "valor_total", "forma_pagamento", "vendedor"].map((c) => (
                  <th key={c} style={{ padding: "4px 12px", textAlign: "left", color: "#8bb4ff" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "4px 12px" }}>2965</td>
                <td style={{ padding: "4px 12px" }}>27/05/2026</td>
                <td style={{ padding: "4px 12px" }}>21439554000160</td>
                <td style={{ padding: "4px 12px" }}>BENNE LANCHES</td>
                <td style={{ padding: "4px 12px" }}>296,10</td>
                <td style={{ padding: "4px 12px" }}>BOLETO BANCARIO SICRED</td>
                <td style={{ padding: "4px 12px" }}>Alan</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 9, color: "#e4e9f0", marginTop: 8, fontFamily: theme.font.label }}>
          Aliases: numero/cupom · data · cnpj/cpf/cliente_cnpj_cpf · cliente_nome/nome · valor/valor_total · pagamento · vendedor · (CPF=11 díg, CNPJ=14)
        </p>
      </div>

      <VendasCnbUpload />
    </div>
  );
}
