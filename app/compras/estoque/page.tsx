// app/compras/estoque/page.tsx — Fase 2 M1 (cru): tabela saldo + cobertura por produto.
// Fonte: v_estoque_cobertura (16 KG ancorados). Banner mostra cobertura parcial até inventário ARES 30/05.
import { createClient } from "@/lib/supabase/server";
import { AncoraUpload } from "@/components/uploads/ancora-upload";
import EstoqueClient, { type CoberturaRow } from "./estoque-client";

export const dynamic = "force-dynamic";

import { theme } from "@/lib/theme";

export default async function EstoquePage() {
  const supabase = await createClient();
  const [covRes, totalRes] = await Promise.all([
    supabase.from("v_estoque_cobertura").select("*"),
    supabase.from("estoque_saldo").select("*", { count: "exact", head: true }),
  ]);
  const rows = (covRes.data ?? []) as CoberturaRow[];
  const totalProdutos = totalRes.count ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Estoque Atual
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: theme.font.label }}>
          Saldo por produto (âncora + Σ movimento) · cobertura em dias (saldo ÷ consumo/dia) · semáforo de ruptura.
        </p>
      </div>

      {/* Banner cobertura parcial */}
      <div style={{ border: "1px solid #d29922", background: "rgba(210,153,34,.08)", borderRadius: 6, padding: "10px 14px" }}>
        <p style={{ color: "#d29922", fontSize: 11, fontFamily: theme.font.label }}>
          {rows.length} produto(s) ancorado(s) de {totalProdutos} totais. Os demais aguardam o inventário ARES de 30/05,
          que o sync espelha automaticamente e expande esta cobertura.
        </p>
      </div>

      {/* Tabela M1 + busca (client) */}
      <EstoqueClient rows={rows} />
      <p style={{ color: "#556677", fontSize: 9, fontFamily: theme.font.label }}>
        CMD = saídas (venda + consumo produção), |qtd|, média 30d úteis. &quot;SEM CMD&quot; = matéria-prima sem saída
        capturada (DEBT-069: transformação interna). Ordenado por menor cobertura.
      </p>

      {/* Carregar âncora manual (fallback — fonte de produção é o ARES) */}
      <details style={{ marginTop: 8 }}>
        <summary style={{ color: "#556677", fontSize: 10, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer" }}>
          Carregar âncora manual (fallback XLSX)
        </summary>
        <div style={{ marginTop: 10 }}><AncoraUpload /></div>
      </details>
    </div>
  );
}
