// app/compras/previsao/page.tsx — Fase 3 (cru): lista de compra (CMD + demanda - saldo - carteira).
// Fonte: v_previsao_compra + compras_config (read-only no M1). saldo_confiavel só p/ produtos ancorados.
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

type PrevRow = {
  id_produto: number; descricao: string | null; grupo_nome: string | null;
  cmd: number; demanda_horizonte: number; saldo_atual: number | null; saldo_confiavel: boolean;
  em_pedido: number; fornecedor_provavel: string | null; lead_time_dias: number;
  ponto_reposicao: number; a_comprar: number; repor_agora: boolean;
};
type Config = { horizonte_dias: number; dias_seguranca: number; ciclo_revisao_dias: number; lead_time_default: number };

const n3 = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }));

export default async function PrevisaoPage() {
  const supabase = await createClient();
  const [prevRes, cfgRes] = await Promise.all([
    supabase.from("v_previsao_compra").select("*"),
    supabase.from("compras_config").select("*").eq("id", 1).maybeSingle(),
  ]);
  const rows = (prevRes.data ?? []) as PrevRow[];
  const cfg = (cfgRes.data ?? null) as Config | null;

  const repor = rows.filter((r) => r.repor_agora);
  const ok = rows.filter((r) => !r.repor_agora);

  const th: React.CSSProperties = { fontSize: 9, color: "#556677", fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #1B2A6B" };
  const td: React.CSSProperties = { padding: "7px 10px", color: "#c8d8e8", fontFamily: mono, fontSize: 12, textAlign: "right" };
  const card: React.CSSProperties = { background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, overflowX: "auto" };

  const linha = (r: PrevRow) => (
    <tr key={r.id_produto} style={{ borderBottom: "1px solid #0b0f1d" }}>
      <td style={{ ...td, textAlign: "left", color: "#FFFFFF", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.descricao || `#${r.id_produto}`}</td>
      <td style={td}>{n3(r.cmd)}</td>
      <td style={{ ...td, color: r.saldo_confiavel ? "#c8d8e8" : "#556677" }}>{r.saldo_confiavel ? n3(r.saldo_atual) : "s/ âncora"}</td>
      <td style={td}>{n3(r.em_pedido)}</td>
      <td style={{ ...td, color: r.a_comprar > 0 ? "#f0a04b" : "#556677", fontWeight: 700 }}>{n3(r.a_comprar)}</td>
      <td style={{ ...td, textAlign: "left", color: "#8899aa" }}>{r.fornecedor_provavel || "—"}{r.lead_time_dias ? ` (${r.lead_time_dias}d)` : ""}</td>
    </tr>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Previsão de Compras</h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          O que comprar e quanto: CMD (venda+produção) × horizonte − saldo − carteira aberta, por fornecedor.
        </p>
      </div>

      {cfg && (
        <div style={{ ...th, textAlign: "left", border: "none", paddingLeft: 0, color: "#8899aa" }}>
          ⚙ config: horizonte {cfg.horizonte_dias}d · segurança {cfg.dias_seguranca}d · ciclo {cfg.ciclo_revisao_dias}d · lead default {cfg.lead_time_default}d
          <span style={{ color: "#556677" }}> (editável via SQL no M1)</span>
        </div>
      )}

      <div style={{ border: "1px solid #f85149", background: "rgba(248,81,73,.07)", borderRadius: 6, padding: "10px 14px" }}>
        <p style={{ color: "#f85149", fontSize: 11, fontFamily: mono }}>
          🔴 REPOR AGORA: {repor.length} insumo(s) abaixo do ponto de reposição.
          <span style={{ color: "#556677" }}> &quot;s/ âncora&quot; = saldo não confiável até inventário 30/05 (assume 0).</span>
        </p>
      </div>

      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...th, textAlign: "left" }}>Insumo</th><th style={th}>CMD/dia</th><th style={th}>Saldo</th>
            <th style={th}>Em pedido</th><th style={th}>Comprar</th><th style={{ ...th, textAlign: "left" }}>Fornecedor (LT)</th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#556677", padding: 20 }}>aguardando dados (aplicar migrations)</td></tr>
            ) : (
              <>
                {repor.length > 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "left", color: "#f85149", fontWeight: 700, background: "#0b0f1d" }}>🔴 REPOR AGORA</td></tr>}
                {repor.map(linha)}
                {ok.length > 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "left", color: "#2ea043", fontWeight: 700, background: "#0b0f1d" }}>✓ cobertura ok</td></tr>}
                {ok.map(linha)}
              </>
            )}
          </tbody>
        </table>
      </div>
      <p style={{ color: "#556677", fontSize: 9, fontFamily: mono }}>
        Comprável = produto com histórico de compra. CMD tipos 1+4 (90d). Fornecedor = mais frequente no histórico.
        Edição de config + sort interativo = ciclo 2. CMD de MP transformada: DEBT-069.
      </p>
    </div>
  );
}
