// app/compras/estoque/page.tsx — Fase 2 M1: tabela saldo + cobertura por produto.
// Fonte: v_estoque_cobertura. Desde OPT-B (30/05) saldo_atual = Σ consumo_movimento (espelho ARES)
// para TODOS os produtos com movimentação; a âncora XLSX virou auditoria/fallback, não base do saldo.
import { createClient } from "@/lib/supabase/server";
import { AncoraUpload } from "@/components/uploads/ancora-upload";
import EstoqueClient, { type CoberturaRow } from "./estoque-client";
import { PageHead, SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { Boxes } from "lucide-react";
import { theme } from "@/lib/theme";

export const dynamic = "force-dynamic";

export default async function EstoquePage() {
  const supabase = await createClient();
  const [covRes, totalRes] = await Promise.all([
    supabase.from("v_estoque_cobertura").select("*"),
    supabase.from("estoque_saldo").select("*", { count: "exact", head: true }),
  ]);
  const rows = (covRes.data ?? []) as CoberturaRow[];
  const totalProdutos = totalRes.count ?? 0;

  // Distribuição por semáforo (para os StatTiles de topo) — mantém cores de sinal de compras.
  const cnt = { vermelho: 0, amarelo: 0, verde: 0, sem_cmd: 0 } as Record<CoberturaRow["semaforo"], number>;
  for (const r of rows) cnt[r.semaforo] = (cnt[r.semaforo] ?? 0) + 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Estoque Atual"
        desc="Saldo por produto (Σ movimentação ARES espelhada — OPT-B) · cobertura em dias (saldo ÷ consumo/dia) · semáforo de ruptura."
      />

      {/* Resumo — distribuição de cobertura por semáforo (cores de sinal de compras) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <StatTile label="Com Saldo Calculado" value={rows.length} sub={`de ${totalProdutos} produtos totais`} />
        <StatTile label="Crítico" value={cnt.vermelho} accent="#f85149" num="#f85149" sub="ruptura iminente" />
        <StatTile label="Alerta" value={cnt.amarelo} accent="#d29922" num="#d29922" sub="cobertura curta" />
        <StatTile label="Cobertura OK" value={cnt.verde} accent="#2ea043" num="#2ea043" sub="folga de estoque" />
        <StatTile label="Sem CMD" value={cnt.sem_cmd} sub="sem saída capturada" />
      </div>

      {/* Banner cobertura parcial (sinal de aviso — cor âmbar preservada) */}
      <div style={{ border: "1px solid #d29922", background: "rgba(210,153,34,.08)", borderRadius: 8, padding: "10px 14px" }}>
        <p style={{ color: "#d29922", fontSize: 12, fontFamily: theme.font.label }}>
          {rows.length} produto(s) com saldo calculado de {totalProdutos} totais. Saldo = Σ movimentação ARES espelhada
          (OPT-B 30/05); contagem física é auditoria. Os demais não têm movimentação capturada na janela do espelho.
        </p>
      </div>

      {/* Tabela M1 + busca (client) */}
      <div>
        <SectionHead
          Icon={Boxes}
          color="#d29922"
          title="Cobertura por Produto"
          desc="Saldo ÷ consumo/dia · ordenado por menor cobertura · semáforo de ruptura"
        />
        <EstoqueClient rows={rows} />
      </div>

      <p style={{ color: "var(--asb-page-ink3)", fontSize: 11, fontFamily: theme.font.label }}>
        CMD-30 = saídas (venda + consumo produção), |qtd|, média 30d úteis — janela curta p/ reagir a ruptura
        (a Previsão usa CMD-90, planejamento). &quot;SEM CMD&quot; = matéria-prima sem saída
        capturada (DEBT-069: transformação interna). Ordenado por menor cobertura.
      </p>

      {/* Carregar âncora manual (fallback — fonte de produção é o ARES) */}
      <details style={{ marginTop: 4 }}>
        <summary style={{ ...S_summary }}>
          Carregar âncora manual (fallback XLSX)
        </summary>
        <div style={{ marginTop: 10 }}><AncoraUpload /></div>
      </details>
    </div>
  );
}

// Eyebrow-style para o disclosure (UPPERCASE SANS pequeno — sub-rótulo, nunca título).
const S_summary: React.CSSProperties = {
  color: "var(--asb-page-ink3)", fontSize: 11, fontFamily: theme.font.label,
  letterSpacing: ".06em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
};
