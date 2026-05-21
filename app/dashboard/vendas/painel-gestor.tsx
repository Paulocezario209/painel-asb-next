"use client";

import type { EstrategiasResponse } from "./actions";

function fmtBRL(v: number, frac = 0): string {
  return Number(v).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  });
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const SAUDACAO = (h: number) => (h < 6 ? "Boa madrugada" : h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite");

type Props = {
  data: EstrategiasResponse;
  onVendorClick?: (vendor: string) => void;
};

export function PainelGestor({ data, onVendorClick }: Props) {
  const agora = new Date();
  const hora = agora.getHours();
  const diaSemana = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"][agora.getDay()];

  // Métricas consolidadas
  const totalRealizadoCiclo = data.baterMeta.reduce((s, b) => s + b.realizado, 0);
  const totalMetaCiclo = data.baterMeta.reduce((s, b) => s + b.meta, 0);
  const pctTime = totalMetaCiclo > 0 ? Math.round((totalRealizadoCiclo / totalMetaCiclo) * 100) : 0;

  const totalPendenteValor = data.fecharPendentes.reduce((s, p) => s + p.valor, 0);
  const totalPendenteQty = data.fecharPendentes.reduce((s, p) => s + p.qty, 0);

  const totalDormentes = data.reativarDormentes.length;
  const valorDormentes = data.reativarDormentes.reduce((s, d) => s + d.valor_historico, 0);
  const dormentesAlta = data.reativarDormentes.filter(d => d.prioridade === "alta").length;

  // Ranking pelo pct
  const ranked = [...data.baterMeta].sort((a, b) => b.pct - a.pct);

  const corTime =
    pctTime >= 100 ? "#22c55e" :
    pctTime >= 80 ? "#D4A017" :
    pctTime >= 50 ? "#BA7517" :
    "#C8102E";

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: 8,
        padding: 20,
        maxHeight: 600,
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #2a2a2a" }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Inter', system-ui, sans-serif" }}>
          📊 Painel Gestor
        </p>
        <p style={{ fontSize: 10, color: "#8899aa", fontFamily: "'Courier New', monospace" }}>
          {SAUDACAO(hora)} · {diaSemana} {String(agora.getDate()).padStart(2, "0")}/{String(agora.getMonth() + 1).padStart(2, "0")}
        </p>
      </div>

      {/* KPI consolidado time */}
      <div
        style={{
          background: `${corTime}12`,
          borderLeft: `3px solid ${corTime}`,
          borderRadius: 4,
          padding: "12px 14px",
          marginBottom: 14,
        }}
      >
        <p style={{ fontSize: 9, color: corTime, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>
          ▸ STATUS DO TIME (PRÓXIMO CICLO)
        </p>
        <p style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, marginBottom: 4 }}>
          <span className="priv-brl">{fmtBRL(totalRealizadoCiclo)}</span> / <span className="priv-brl">{fmtBRL(totalMetaCiclo)}</span>
        </p>
        <p style={{ fontSize: 11, color: "#c8d8e8" }}>
          <span className="priv-pct">{pctTime}%</span> da meta consolidada · {data.baterMeta.length} vendedor(es)
        </p>
      </div>

      {/* Ranking — clicável pra ver a Missão do vendedor */}
      <p style={{ fontSize: 9, fontWeight: 700, color: "#ff7b1c", fontFamily: "'Courier New', monospace", letterSpacing: ".15em", marginBottom: 4, textTransform: "uppercase" }}>
        🏆 RANKING DO CICLO
      </p>
      <p style={{ fontSize: 9, color: "#556677", marginBottom: 8, fontStyle: "italic" }}>
        💬 Clique no vendedor pra ver a missão que ele recebe
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
        {ranked.map((b, i) => {
          const medalha = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "▸";
          const cor =
            b.status === "bater" ? "#22c55e" :
            b.status === "no_alvo" ? "#D4A017" : "#C8102E";
          return (
            <button
              key={b.vendedor}
              onClick={() => onVendorClick?.(b.vendedor)}
              style={{
                background: "#0a0f1f",
                borderLeft: `3px solid ${cor}`,
                border: "1px solid #2a2a2a",
                borderRadius: 3,
                padding: "8px 10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: onVendorClick ? "pointer" : "default",
                transition: "all .15s",
                textAlign: "left",
                width: "100%",
              }}
              onMouseEnter={(e) => {
                if (onVendorClick) e.currentTarget.style.background = "#15203d";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#0a0f1f";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14 }}>{medalha}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", fontFamily: "'Courier New', monospace" }}>
                    {b.nome}
                  </div>
                  <div style={{ fontSize: 9, color: "#8899aa", fontFamily: "'Courier New', monospace", marginTop: 1 }}>
                    {fmtDate(b.proxima_meta)} · <span className="priv-brl">{fmtBRL(b.realizado)}</span> / <span className="priv-brl">{fmtBRL(b.meta)}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: cor, fontFamily: "'Courier New', monospace" }}>
                  <span className="priv-pct">{b.pct}%</span>
                </span>
                {onVendorClick && (
                  <span style={{ fontSize: 11, color: "#556677" }}>👁</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Alertas operacionais agregados */}
      <p style={{ fontSize: 9, fontWeight: 700, color: "#D4A017", fontFamily: "'Courier New', monospace", letterSpacing: ".15em", marginBottom: 8, textTransform: "uppercase" }}>
        ⚠ AÇÕES DE GESTOR
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {/* Pendentes */}
        <div
          style={{
            background: totalPendenteValor > 0 ? "rgba(212,160,23,.12)" : "rgba(85,102,119,.08)",
            borderLeft: `3px solid ${totalPendenteValor > 0 ? "#D4A017" : "#556677"}`,
            borderRadius: 4,
            padding: "10px",
          }}
        >
          <p style={{ fontSize: 9, color: "#D4A017", fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
            📋 PENDENTES
          </p>
          <p style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, marginBottom: 2 }}>
            {totalPendenteQty} ped
          </p>
          <p style={{ fontSize: 10, color: "#c8d8e8" }}>
            <span className="priv-brl">{fmtBRL(totalPendenteValor)}</span> aguardando NF
          </p>
        </div>

        {/* Dormentes */}
        <div
          style={{
            background: dormentesAlta > 0 ? "rgba(200,16,46,.12)" : "rgba(85,102,119,.08)",
            borderLeft: `3px solid ${dormentesAlta > 0 ? "#C8102E" : "#185FA5"}`,
            borderRadius: 4,
            padding: "10px",
          }}
        >
          <p style={{ fontSize: 9, color: dormentesAlta > 0 ? "#C8102E" : "#185FA5", fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
            💤 DORMENTES
          </p>
          <p style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, marginBottom: 2 }}>
            {totalDormentes} clientes
          </p>
          <p style={{ fontSize: 10, color: "#c8d8e8" }}>
            <span className="priv-brl">{fmtBRL(valorDormentes)}</span> em risco{dormentesAlta > 0 ? ` · ${dormentesAlta} alta` : ""}
          </p>
        </div>
      </div>

      {/* Insights de gestor */}
      <p style={{ fontSize: 9, fontWeight: 700, color: "#185FA5", fontFamily: "'Courier New', monospace", letterSpacing: ".15em", marginBottom: 8, textTransform: "uppercase" }}>
        💡 INSIGHTS PARA GESTOR
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px 0", display: "flex", flexDirection: "column", gap: 6 }}>
        {ranked.find(b => b.status === "abaixo") && (
          <li style={{ fontSize: 10, color: "#c8d8e8", lineHeight: 1.4 }}>
            🎯 <strong style={{ color: "#C8102E" }}>{ranked.find(b => b.status === "abaixo")!.nome}</strong> está abaixo do ritmo. Reunião 1:1 hoje?
          </li>
        )}
        {dormentesAlta > 2 && (
          <li style={{ fontSize: 10, color: "#c8d8e8", lineHeight: 1.4 }}>
            📞 {dormentesAlta} clientes alta prioridade dormentes — ative blitz comercial
          </li>
        )}
        {totalPendenteValor > 5000 && (
          <li style={{ fontSize: 10, color: "#c8d8e8", lineHeight: 1.4 }}>
            ⏰ Escritório com <span className="priv-brl">{fmtBRL(totalPendenteValor)}</span> represados — cobrar fechamento
          </li>
        )}
        {ranked.filter(b => b.status === "bater").length === ranked.length && (
          <li style={{ fontSize: 10, color: "#22c55e", lineHeight: 1.4, fontWeight: 700 }}>
            🔥 Time inteiro acima da meta — momento de premiar
          </li>
        )}
        <li style={{ fontSize: 10, color: "#8899aa", lineHeight: 1.4, fontStyle: "italic", paddingTop: 4, borderTop: "1px dashed #2a2a2a", marginTop: 4 }}>
          💭 Disciplina diária + ZERO desconto como muleta = margem saudável.
        </li>
      </ul>

      {/* Visão estratégica */}
      <div style={{ paddingTop: 10, borderTop: "1px solid #2a2a2a" }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: "#c0c8d8", fontFamily: "'Courier New', monospace", letterSpacing: ".15em", marginBottom: 6, textTransform: "uppercase" }}>
          🎯 FOCO ESTRATÉGICO
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4, fontSize: 10, color: "#8899aa", fontFamily: "'Courier New', monospace" }}>
          <li>▸ <strong style={{ color: "#22c55e" }}>CICLO:</strong> garantir fechamento da próxima meta</li>
          <li>▸ <strong style={{ color: "#D4A017" }}>SEMANA:</strong> reduzir pendentes &gt;5d e reativar dormentes alta</li>
          <li>▸ <strong style={{ color: "#185FA5" }}>MÊS:</strong> ticket médio +10% via mix, não desconto</li>
        </ul>
      </div>
    </div>
  );
}
