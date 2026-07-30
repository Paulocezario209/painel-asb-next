"use client";

// app/compras/inventario/inventario-client.tsx — KPIs clicáveis + tabela de produtos do Mapa do Inventário.
// Os 4 KPIs e a lista usam a MESMA base (mapa, vinda de v_inventario_mapa) — o número do card
// e o total da lista aberta vêm sempre da mesma contagem, nunca podem divergir.
import { useState } from "react";
import { X } from "lucide-react";
import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { KpiCard, SectionHead } from "@/app/dashboard/lib/ui";
import { Boxes, ClipboardCheck, AlertTriangle, ListChecks } from "lucide-react";

export type MapaRow = {
  id_produto: number; descricao: string | null; grupo_nome: string | null;
  ultima_contagem: string | null; dias_desde_contagem: number | null;
  tem_contagem_fisica: boolean; contagem_em_revisao: boolean; divergencia_ultimo_acerto: number | null;
};

type Filtro = "mapeados" | "sem_fisica" | "em_revisao" | "divergencia" | null;

const FILTRO_LABEL: Record<Exclude<Filtro, null>, string> = {
  mapeados: "Produtos Mapeados",
  sem_fisica: "Sem Contagem Física",
  em_revisao: "Em Revisão",
  divergencia: "Divergência",
};

const n0 = (n: number) => Math.round(n).toLocaleString("pt-BR");

// mais antigos / nunca contados primeiro — mesma ordenação em qualquer recorte (com ou sem filtro)
function sortPorUrgencia(rows: MapaRow[]): MapaRow[] {
  return [...rows].sort((a, b) => {
    const da = a.dias_desde_contagem, db = b.dias_desde_contagem;
    if (da == null && db == null) return 0;
    if (da == null) return -1;
    if (db == null) return 1;
    return db - da;
  });
}

export default function InventarioClient({ mapa }: { mapa: MapaRow[] }) {
  const [filtro, setFiltro] = useState<Filtro>(null);

  const semFisica = mapa.filter((m) => !m.tem_contagem_fisica);
  const emRevisaoRows = mapa.filter((m) => m.contagem_em_revisao);
  const divergenciaRows = mapa.filter((m) => (m.divergencia_ultimo_acerto ?? 0) !== 0);

  const contagens = {
    mapeados: mapa.length,
    sem_fisica: semFisica.length,
    em_revisao: emRevisaoRows.length,
    divergencia: divergenciaRows.length,
  } as const;

  const toggle = (f: Exclude<Filtro, null>) => setFiltro((cur) => (cur === f ? null : f));

  const baseFiltrada: MapaRow[] =
    filtro === "mapeados" ? mapa
    : filtro === "sem_fisica" ? semFisica
    : filtro === "em_revisao" ? emRevisaoRows
    : filtro === "divergencia" ? divergenciaRows
    : mapa;

  const ordenada = sortPorUrgencia(baseFiltrada);
  // sem filtro: mantém o recorte original (top 40 mais urgentes). Com filtro: lista TODOS — o
  // total exibido tem que bater exatamente com o número do card que abriu a lista.
  const lista = filtro === null ? ordenada.slice(0, 40) : ordenada;

  const th: React.CSSProperties = { fontSize: 10, color: "#83879a", fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", padding: "10px 12px", textAlign: "right", borderBottom: "1px solid var(--asb-border)" };
  const td: React.CSSProperties = { padding: "8px 12px", color: "#c8d2e6", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontSize: 12.5, textAlign: "right" };
  const tdText: React.CSSProperties = { padding: "8px 12px", color: "#c8d2e6", fontFamily: theme.font.label, fontSize: 12.5, textAlign: "left" };
  const tableCard: React.CSSProperties = { ...S.card, overflowX: "auto" };

  return (
    <>
      <div className="asb-grid-kpi">
        <KpiCard
          label="Produtos Mapeados" value={n0(contagens.mapeados)} Icon={Boxes} accent="#8bb4ff" num="#FFFFFF"
          note="no catálogo de inventário" onClick={() => toggle("mapeados")} active={filtro === "mapeados"}
        />
        <KpiCard
          label="Sem Contagem Física" value={n0(contagens.sem_fisica)} Icon={ClipboardCheck} accent="#f85149" num="#f85149"
          note="sem estoque âncora registrado" onClick={() => toggle("sem_fisica")} active={filtro === "sem_fisica"}
        />
        <KpiCard
          label="Em Revisão" value={n0(contagens.em_revisao)} Icon={AlertTriangle} accent="#d29922" num="#d29922"
          note="ambíguos da transcrição" onClick={() => toggle("em_revisao")} active={filtro === "em_revisao"}
        />
        <KpiCard
          label="Divergência" value={n0(contagens.divergencia)} Icon={ListChecks} accent="#f85149" num={contagens.divergencia > 0 ? "#f85149" : "#FFFFFF"}
          note="acerto ≠ físico no último ciclo" onClick={() => toggle("divergencia")} active={filtro === "divergencia"}
        />
      </div>

      <div className="asb-card" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <SectionHead
            Icon={AlertTriangle}
            color="#d29922"
            title={filtro ? `Produtos: ${FILTRO_LABEL[filtro]}` : "Precisam de Contagem"}
            desc={filtro ? `${n0(lista.length)} produto(s) — filtro aplicado a partir do card acima` : "Mais velhos ou nunca contados — top 40"}
          />
          {filtro ? (
            <button
              onClick={() => setFiltro(null)}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)",
                borderRadius: 8, padding: "7px 12px", color: "#c8d2e6", fontFamily: theme.font.label, fontSize: 12, fontWeight: 650, cursor: "pointer",
              }}
            >
              <X size={13} /> Limpar filtro / Voltar para todos
            </button>
          ) : null}
        </div>
        <div style={tableCard}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "left" }}>Produto</th><th style={{ ...th, textAlign: "left" }}>Grupo</th>
              <th style={th}>Última Contagem</th><th style={th}>Dias</th><th style={{ ...th, textAlign: "center" }}>Física?</th>
            </tr></thead>
            <tbody>
              {lista.length === 0 ? (
                <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "#83879a", fontFamily: theme.font.label, padding: 20 }}>—</td></tr>
              ) : lista.map((m) => (
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
    </>
  );
}
