// app/compras/inventario/page.tsx — Fase 4 (cru): saúde da contagem por grupo + produtos a contar.
// Fonte: v_inventario_grupo + v_inventario_mapa. Inventário = contagem física (estoque_ancora) OU acerto 16/17.
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { Boxes, ClipboardCheck, AlertTriangle, Layers, ListChecks } from "lucide-react";

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
  if (pct == null) return "#aeb7cc";
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
  const divergencias = mapa.filter((m) => (m.divergencia_ultimo_acerto ?? 0) !== 0).length;

  // ── estilos de tabela (linguagem grafite) ──────────────────────────────────
  // Cabeçalho de coluna = eyebrow UPPERCASE SANS pequeno (nunca mono, nunca título).
  const th: React.CSSProperties = { fontSize: 10, color: "#83879a", fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--asb-border)" };
  // Célula NÚMERO = mono/tabular.
  const td: React.CSSProperties = { padding: "8px 12px", color: "#c8d2e6", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontSize: 12.5, textAlign: "right" };
  // Célula TEXTO = sans.
  const tdText: React.CSSProperties = { padding: "8px 12px", color: "#c8d2e6", fontFamily: theme.font.label, fontSize: 12.5, textAlign: "left" };
  const tableCard: React.CSSProperties = { ...S.card, overflowX: "auto" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Mapa do Inventário"
        desc="Saúde da contagem: última contagem (física ou acerto 16/17), há quantos dias, cobertura por grupo, divergências."
      />

      {/* KPIs — herói: cobertura da contagem física */}
      <div className="asb-grid-kpi">
        <KpiCard label="Produtos Mapeados" value={n0(mapa.length)} Icon={Boxes} accent="#8bb4ff" num="#FFFFFF" note="no catálogo de inventário" />
        <KpiCard label="Com Contagem Física" value={n0(comFisica)} Icon={ClipboardCheck} accent="#2ea043" num="#2ea043" note="estoque âncora registrado" />
        <KpiCard label="Em Revisão" value={n0(emRevisao)} Icon={AlertTriangle} accent="#d29922" num="#d29922" note="ambíguos da transcrição" />
        <KpiCard label="Divergências" value={n0(divergencias)} Icon={ListChecks} accent="#f85149" num={divergencias > 0 ? "#f85149" : "#FFFFFF"} note="acerto ≠ físico no último ciclo" />
      </div>

      {/* Aviso operacional — janela de 90 dias do espelho (âmbar = atenção) */}
      <div style={{ ...S.card, borderTop: "3px solid #d29922", padding: "14px 18px" }}>
        <p style={{ color: "#d29922", fontSize: 12.5, fontFamily: theme.font.label, lineHeight: 1.5, margin: 0 }}>
          {comFisica} produto(s) com contagem física · {emRevisao} em revisão (ambíguos da transcrição).
          Atenção: a janela do espelho é de 90 dias — contagens e acertos anteriores a isso não aparecem aqui,
          então &quot;dias desde contagem&quot; pode subestimar o tempo real (DEBT-072). Ambíguos: aba Estoque.
        </p>
      </div>

      {/* Cobertura por grupo */}
      <div className="asb-card" style={{ padding: "20px 24px" }}>
        <SectionHead Icon={Layers} color="#8bb4ff" title="Cobertura por Grupo" desc="Quantos produtos de cada grupo já foram contados" />
        <div style={tableCard}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "left" }}>Grupo</th><th style={th}>Produtos</th><th style={th}>Cobertura</th>
              <th style={th}>Dias Médio</th><th style={th}>Em Revisão</th><th style={th}>Diverg. Grande</th>
            </tr></thead>
            <tbody>
              {grupos.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#83879a", fontFamily: theme.font.label, padding: 20 }}>aguardando dados (aplicar migrations)</td></tr>
              ) : grupos.map((g) => (
                <tr key={`${g.id_grupo}`} style={{ borderBottom: "1px solid var(--asb-border)" }}>
                  <td style={{ ...tdText, color: "#FFFFFF", fontWeight: 600 }}>{g.grupo_nome || "—"}</td>
                  <td style={td}>{g.n_contados_fisico}/{g.n_produtos}</td>
                  <td style={{ ...td, color: corCobertura(g.cobertura_pct), fontWeight: 700 }}>{g.cobertura_pct == null ? "—" : `${g.cobertura_pct}%`}</td>
                  <td style={td}>{n0(g.dias_medio_desde_contagem)}</td>
                  <td style={{ ...td, color: g.n_em_revisao > 0 ? "#d29922" : "#c8d2e6" }}>{g.n_em_revisao}</td>
                  <td style={{ ...td, color: g.n_divergencia_grande > 0 ? "#f85149" : "#c8d2e6" }}>{g.n_divergencia_grande}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Produtos que precisam de contagem */}
      <div className="asb-card" style={{ padding: "20px 24px" }}>
        <SectionHead Icon={AlertTriangle} color="#d29922" title="Precisam de Contagem" desc="Mais velhos ou nunca contados — top 40" />
        <div style={tableCard}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "left" }}>Produto</th><th style={{ ...th, textAlign: "left" }}>Grupo</th>
              <th style={th}>Última Contagem</th><th style={th}>Dias</th><th style={{ ...th, textAlign: "center" }}>Física?</th>
            </tr></thead>
            <tbody>
              {aContar.length === 0 ? (
                <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#83879a", fontFamily: theme.font.label, padding: 20 }}>—</td></tr>
              ) : aContar.map((m) => (
                <tr key={m.id_produto} style={{ borderBottom: "1px solid var(--asb-border)" }}>
                  <td style={{ ...tdText, color: "#FFFFFF", fontWeight: 600, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.descricao || `#${m.id_produto}`}</td>
                  <td style={{ ...tdText, color: "#aeb7cc" }}>{m.grupo_nome || "—"}</td>
                  <td style={td}>{m.ultima_contagem ? m.ultima_contagem.slice(0, 10).split("-").reverse().join("/") : "(sem acerto ≤90d)"}</td>
                  <td style={{ ...td, color: m.dias_desde_contagem == null ? "#f85149" : "#c8d2e6" }}>{m.dias_desde_contagem == null ? "—" : n0(m.dias_desde_contagem)}</td>
                  <td style={{ ...td, textAlign: "center" }}>{m.tem_contagem_fisica ? "✓" : "❌"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
