// app/compras/inventario/page.tsx — Fase 4 (cru): saúde da contagem por grupo + produtos a contar.
// Fonte: v_inventario_grupo + v_inventario_mapa. Inventário = contagem física (estoque_ancora) OU acerto 16/17.
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

import { theme } from "@/lib/theme";

type GrupoRow = {
  id_grupo: number | null; grupo_nome: string | null;
  n_produtos: number; n_contados_fisico: number; cobertura_pct: number | null;
  dias_medio_desde_contagem: number | null; n_em_revisao: number; n_divergencia_grande: number;
};
type MapaRow = {
  id_produto: number; descricao: string | null; grupo_nome: string | null;
  ultima_contagem: string | null; dias_desde_contagem: number | null;
  tem_contagem_fisica: boolean; contagem_em_revisao: boolean; divergencia_ultimo_acerto: number | null;
};

function corCobertura(pct: number | null): string {
  if (pct == null) return "#e4e9f0";
  if (pct >= 70) return "#2ea043";
  if (pct >= 30) return "#d29922";
  return "#f85149";
}
const n0 = (n: number | null) => (n == null ? "—" : Math.round(n).toLocaleString("pt-BR"));

export default async function InventarioPage() {
  const supabase = await createClient();
  const [grpRes, mapaRes] = await Promise.all([
    supabase.from("v_inventario_grupo").select("*"),
    supabase.from("v_inventario_mapa").select("id_produto,descricao,grupo_nome,ultima_contagem,dias_desde_contagem,tem_contagem_fisica,contagem_em_revisao,divergencia_ultimo_acerto"),
  ]);
  const grupos = (grpRes.data ?? []) as GrupoRow[];
  const mapa = (mapaRes.data ?? []) as MapaRow[];

  const aContar = [...mapa]
    .sort((a, b) => {
      const da = a.dias_desde_contagem, db = b.dias_desde_contagem;
      if (da == null && db == null) return 0;
      if (da == null) return -1; // nunca contado primeiro
      if (db == null) return 1;
      return db - da;
    })
    .slice(0, 40);
  const emRevisao = mapa.filter((m) => m.contagem_em_revisao).length;
  const comFisica = mapa.filter((m) => m.tem_contagem_fisica).length;

  const th: React.CSSProperties = { fontSize: 9, color: "#e4e9f0", fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #1B2A6B" };
  const td: React.CSSProperties = { padding: "7px 10px", color: "#c8d8e8", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontSize: 12, textAlign: "right" };
  const card: React.CSSProperties = { background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, overflowX: "auto" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ color: "var(--asb-page-ink)", fontSize: 20, fontWeight: 800, fontFamily: theme.font.label, letterSpacing: "-.01em", textTransform: "none", marginBottom: 4 }}>Mapa do Inventário</h1>
        <p style={{ color: "var(--asb-page-ink2)", fontSize: 11, fontFamily: theme.font.label }}>
          Saúde da contagem: última contagem (física ou acerto 16/17), há quantos dias, cobertura por grupo, divergências.
        </p>
      </div>

      <div style={{ border: "1px solid #d29922", background: "rgba(210,153,34,.08)", borderRadius: 6, padding: "10px 14px" }}>
        <p style={{ color: "#d29922", fontSize: 11, fontFamily: theme.font.label }}>
          {comFisica} produto(s) com contagem física · {emRevisao} em revisão (ambíguos da transcrição).
          Atenção: a janela do espelho é de 90 dias — contagens e acertos anteriores a isso não aparecem aqui,
          então &quot;dias desde contagem&quot; pode subestimar o tempo real (DEBT-072). Ambíguos: aba Estoque.
        </p>
      </div>

      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...th, textAlign: "left" }}>Grupo</th><th style={th}>Produtos</th><th style={th}>Cobertura</th>
            <th style={th}>Dias médio</th><th style={th}>Em revisão</th><th style={th}>Diverg. grande</th>
          </tr></thead>
          <tbody>
            {grupos.length === 0 ? (
              <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#e4e9f0", padding: 20 }}>aguardando dados (aplicar migrations)</td></tr>
            ) : grupos.map((g) => (
              <tr key={`${g.id_grupo}`} style={{ borderBottom: "1px solid #0b0f1d" }}>
                <td style={{ ...td, textAlign: "left", color: "#FFFFFF" }}>{g.grupo_nome || "—"}</td>
                <td style={td}>{g.n_contados_fisico}/{g.n_produtos}</td>
                <td style={{ ...td, color: corCobertura(g.cobertura_pct), fontWeight: 700 }}>{g.cobertura_pct == null ? "—" : `${g.cobertura_pct}%`}</td>
                <td style={td}>{n0(g.dias_medio_desde_contagem)}</td>
                <td style={{ ...td, color: g.n_em_revisao > 0 ? "#d29922" : "#e4e9f0" }}>{g.n_em_revisao}</td>
                <td style={{ ...td, color: g.n_divergencia_grande > 0 ? "#f85149" : "#e4e9f0" }}>{g.n_divergencia_grande}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ ...th, textAlign: "left", border: "none", paddingLeft: 0 }}>⚠️ Precisam de contagem (mais velhos / nunca contados — top 40)</div>
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={{ ...th, textAlign: "left" }}>Produto</th><th style={{ ...th, textAlign: "left" }}>Grupo</th>
            <th style={th}>Última contagem</th><th style={th}>Dias</th><th style={{ ...th, textAlign: "center" }}>Física?</th>
          </tr></thead>
          <tbody>
            {aContar.length === 0 ? (
              <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#e4e9f0", padding: 20 }}>—</td></tr>
            ) : aContar.map((m) => (
              <tr key={m.id_produto} style={{ borderBottom: "1px solid #0b0f1d" }}>
                <td style={{ ...td, textAlign: "left", color: "#FFFFFF", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.descricao || `#${m.id_produto}`}</td>
                <td style={{ ...td, textAlign: "left", color: "#c0d0e0" }}>{m.grupo_nome || "—"}</td>
                <td style={td}>{m.ultima_contagem ? m.ultima_contagem.slice(0, 10).split("-").reverse().join("/") : "(sem acerto ≤90d)"}</td>
                <td style={{ ...td, color: m.dias_desde_contagem == null ? "#f85149" : "#c8d8e8" }}>{m.dias_desde_contagem == null ? "—" : n0(m.dias_desde_contagem)}</td>
                <td style={{ ...td, textAlign: "center" }}>{m.tem_contagem_fisica ? "✓" : "❌"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
