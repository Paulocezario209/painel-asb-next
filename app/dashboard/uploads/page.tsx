import { MetasUpload } from "@/components/uploads/metas-upload";
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
            fontSize: 18,
            fontWeight: 700,
            fontFamily: "'Courier New', monospace",
            letterSpacing: ".08em",
            marginBottom: 6,
          }}
        >
          Upload de Metas (XLSX)
        </h1>
        <p style={{ color: "#556677", fontSize: 11, fontFamily: "'Courier New', monospace", letterSpacing: ".1em" }}>
          Metas mensais por vendedor · Preview antes de aplicar · UPSERT por vendedor+mês
        </p>
      </div>

      {/* Formato esperado */}
      <div
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg"
        style={{ padding: 16, marginBottom: 20 }}
      >
        <p style={{ fontSize: 10, color: "#ff7b1c", fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 8 }}>
          📋 Formato esperado do XLSX
        </p>
        <div style={{ background: "#0a0f1f", padding: 12, borderRadius: 4, fontFamily: "'Courier New', monospace", fontSize: 11, color: "#c8d8e8", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
                <th style={{ padding: "4px 12px", textAlign: "left", color: "#ff7b1c" }}>Vendedor</th>
                <th style={{ padding: "4px 12px", textAlign: "left", color: "#ff7b1c" }}>Mes</th>
                <th style={{ padding: "4px 12px", textAlign: "left", color: "#ff7b1c" }}>Ano</th>
                <th style={{ padding: "4px 12px", textAlign: "left", color: "#ff7b1c" }}>MetaMensal</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: "4px 12px" }}>Ana Paula</td><td style={{ padding: "4px 12px" }}>5</td><td style={{ padding: "4px 12px" }}>2026</td><td style={{ padding: "4px 12px" }}>513000</td></tr>
              <tr><td style={{ padding: "4px 12px" }}>Alan</td><td style={{ padding: "4px 12px" }}>5</td><td style={{ padding: "4px 12px" }}>2026</td><td style={{ padding: "4px 12px" }}>240000</td></tr>
              <tr><td style={{ padding: "4px 12px" }}>Paulo Cezario</td><td style={{ padding: "4px 12px" }}>5</td><td style={{ padding: "4px 12px" }}>2026</td><td style={{ padding: "4px 12px" }}>55682.17</td></tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 9, color: "#556677", marginTop: 8, fontFamily: "'Courier New', monospace" }}>
          Aliases aceitos: vendedor/nome · mes/mês · ano/year · meta/valor/meta_mensal
        </p>
      </div>

      <MetasUpload />
    </div>
  );
}
