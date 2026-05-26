// app/compras/estoque/page.tsx — Fase 2 M1 (cru): tabela saldo + cobertura por produto.
// Fonte: v_estoque_cobertura (16 KG ancorados). Banner mostra cobertura parcial até inventário ARES 30/05.
import { createClient } from "@/lib/supabase/server";
import { AncoraUpload } from "@/components/uploads/ancora-upload";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

type CoberturaRow = {
  id_produto: number;
  descricao: string | null;
  grupo: string | null;
  unidade: string | null;
  saldo_atual: number | null;
  ancora_data: string | null;
  cmd_dia: number | null;
  cobertura_dias: number | null;
  semaforo: "vermelho" | "amarelo" | "verde" | "sem_cmd";
};

const SEM: Record<string, { cor: string; label: string }> = {
  vermelho: { cor: "#f85149", label: "CRÍTICO" },
  amarelo: { cor: "#d29922", label: "ALERTA" },
  verde: { cor: "#2ea043", label: "OK" },
  sem_cmd: { cor: "#556677", label: "SEM CMD" },
};
const num = (n: number | null, d = 1) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

export default async function EstoquePage() {
  const supabase = await createClient();
  const [covRes, totalRes] = await Promise.all([
    supabase.from("v_estoque_cobertura").select("*"),
    supabase.from("estoque_saldo").select("*", { count: "exact", head: true }),
  ]);
  const rows = (covRes.data ?? []) as CoberturaRow[];
  const totalProdutos = totalRes.count ?? 0;

  const th: React.CSSProperties = {
    fontSize: 9, color: "#556677", fontFamily: mono, letterSpacing: ".1em",
    textTransform: "uppercase", padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #1B2A6B",
  };
  const td: React.CSSProperties = { padding: "7px 10px", color: "#c8d8e8", fontFamily: mono, fontSize: 12, textAlign: "right" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Estoque Atual
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Saldo por produto (âncora + Σ movimento) · cobertura em dias (saldo ÷ consumo/dia) · semáforo de ruptura.
        </p>
      </div>

      {/* Banner cobertura parcial */}
      <div style={{ border: "1px solid #d29922", background: "rgba(210,153,34,.08)", borderRadius: 6, padding: "10px 14px" }}>
        <p style={{ color: "#d29922", fontSize: 11, fontFamily: mono }}>
          {rows.length} produto(s) ancorado(s) de {totalProdutos} totais. Os demais aguardam o inventário ARES de 30/05,
          que o sync espelha automaticamente e expande esta cobertura.
        </p>
      </div>

      {/* Tabela M1 (cru) */}
      <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Produto</th>
              <th style={{ ...th, textAlign: "left" }}>Grupo</th>
              <th style={th}>Un</th>
              <th style={th}>Saldo</th>
              <th style={th}>CMD/dia</th>
              <th style={th}>Cobertura (dias)</th>
              <th style={{ ...th, textAlign: "center" }}>Semáforo</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#556677", padding: 20 }}>sem produtos ancorados</td></tr>
            ) : (
              rows.map((r) => {
                const s = SEM[r.semaforo] ?? SEM.sem_cmd;
                return (
                  <tr key={r.id_produto} style={{ borderBottom: "1px solid #0b0f1d" }}>
                    <td style={{ ...td, textAlign: "left", color: "#FFFFFF", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.descricao || `#${r.id_produto}`}
                    </td>
                    <td style={{ ...td, textAlign: "left", color: "#8899aa" }}>{r.grupo || "—"}</td>
                    <td style={td}>{r.unidade || "—"}</td>
                    <td style={{ ...td, color: (r.saldo_atual ?? 0) < 0 ? "#f85149" : "#c8d8e8" }}>{num(r.saldo_atual, 3)}</td>
                    <td style={td}>{num(r.cmd_dia, 3)}</td>
                    <td style={{ ...td, color: s.cor, fontWeight: 700 }}>{num(r.cobertura_dias)}</td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <span style={{ color: s.cor, fontSize: 10, fontWeight: 700, fontFamily: mono, border: `1px solid ${s.cor}`, borderRadius: 3, padding: "2px 6px" }}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p style={{ color: "#556677", fontSize: 9, fontFamily: mono }}>
        CMD = saídas (venda + consumo produção), |qtd|, média 30d úteis. &quot;SEM CMD&quot; = matéria-prima sem saída
        capturada (DEBT-069: transformação interna). Ordenado por menor cobertura.
      </p>

      {/* Carregar âncora manual (fallback — fonte de produção é o ARES) */}
      <details style={{ marginTop: 8 }}>
        <summary style={{ color: "#556677", fontSize: 10, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer" }}>
          Carregar âncora manual (fallback XLSX)
        </summary>
        <div style={{ marginTop: 10 }}><AncoraUpload /></div>
      </details>
    </div>
  );
}
