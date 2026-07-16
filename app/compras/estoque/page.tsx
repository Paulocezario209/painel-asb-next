// app/compras/estoque/page.tsx — Fase 2 M1 (cru): tabela saldo + cobertura por produto.
// Fonte: v_estoque_cobertura. Desde OPT-B (30/05) saldo_atual = Σ consumo_movimento (espelho ARES)
// para TODOS os produtos com movimentação; a âncora XLSX virou auditoria/fallback, não base do saldo.
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
        <h1 style={{ color: "var(--asb-page-ink)", fontSize: 20, fontWeight: 800, fontFamily: theme.font.label, letterSpacing: "-.01em", textTransform: "none", marginBottom: 4 }}>
          Estoque Atual
        </h1>
        <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label }}>
          Saldo por produto (Σ movimentação ARES espelhada — OPT-B) · cobertura em dias (saldo ÷ consumo/dia) · semáforo de ruptura.
        </p>
      </div>

      {/* Banner cobertura parcial */}
      <div style={{ border: "1px solid #d29922", background: "rgba(210,153,34,.08)", borderRadius: 6, padding: "10px 14px" }}>
        <p style={{ color: "#d29922", fontSize: 11, fontFamily: theme.font.label }}>
          {rows.length} produto(s) com saldo calculado de {totalProdutos} totais. Saldo = Σ movimentação ARES espelhada
          (OPT-B 30/05); contagem física é auditoria. Os demais não têm movimentação capturada na janela do espelho.
        </p>
      </div>

      {/* Tabela M1 + busca (client) */}
      <EstoqueClient rows={rows} />
      <p style={{ color: "#e4e9f0", fontSize: 9, fontFamily: theme.font.label }}>
        CMD-30 = saídas (venda + consumo produção), |qtd|, média 30d úteis — janela curta p/ reagir a ruptura
        (a Previsão usa CMD-90, planejamento). &quot;SEM CMD&quot; = matéria-prima sem saída
        capturada (DEBT-069: transformação interna). Ordenado por menor cobertura.
      </p>

      {/* Carregar âncora manual (fallback — fonte de produção é o ARES) */}
      <details style={{ marginTop: 8 }}>
        <summary style={{ color: "#e4e9f0", fontSize: 10, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer" }}>
          Carregar âncora manual (fallback XLSX)
        </summary>
        <div style={{ marginTop: 10 }}><AncoraUpload /></div>
      </details>
    </div>
  );
}
