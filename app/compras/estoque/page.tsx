// app/compras/estoque/page.tsx — Fase 2 (Estoque). M1: upload da âncora 01/05.
// A tabela saldo/cobertura (v_estoque_cobertura) entra após a âncora carregada (etapa 8-9).
import { AncoraUpload } from "@/components/uploads/ancora-upload";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default function EstoquePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Estoque Atual
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Saldo por produto (âncora 01/05) + consumo/dia + cobertura em dias, agrupado por grupo.
        </p>
      </div>

      <div>
        <div style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#556677", fontFamily: mono, marginBottom: 8 }}>
          Passo 1 — carregar a âncora física (inventário 01/05)
        </div>
        <AncoraUpload />
      </div>

      <div style={{ border: "1px dashed #1B2A6B", borderRadius: 6, padding: 24, textAlign: "center", background: "rgba(27,42,107,.06)" }}>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          A tabela de saldo + cobertura por produto aparece aqui após a âncora ser carregada (M1: 16 produtos KG limpos).
        </p>
      </div>
    </div>
  );
}
