// app/compras/mercado/mercado-client.tsx — ASB Intelligence Hub (Camada 4: Mercado).
// Responde 1 pergunta: "devo comprar proteína agora, ou esperar?".
// Estilo do workspace compras (inline + Courier New + dark) + cores semânticas (skill elite).
"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import MercadoChat from "./mercado-chat";

export type Cotacao = {
  proteina: string; data_cotacao: string; valor: number;
  unidade: string; variacao_pct: number | null; fonte: string;
};
export type Historico = {
  proteina: string; data_cotacao: string; valor: number;
  unidade: string; variacao_pct: number | null;
};
export type Sinal = {
  proteina: string; data_analise: string; sinal: string | null;
  confianca: number | null; justificativa: string | null;
  projecao_7d: string | null; projecao_30d: string | null;
};
export type Noticia = {
  id: number; data_coleta: string; titulo: string; fonte: string;
  url: string | null; proteinas: string[] | null;
  sinal_ia: string | null; resumo_ia: string | null;
};

import { theme } from "@/lib/theme";
const GREEN = "#2ea043";

// Cores semânticas (skill elite) — ÓTICA DO COMPRADOR.
const C_CRIT = "#C8102E";   // alta de preço / EVITAR — ruim p/ comprar
const C_WARN = "#D4A017";   // AGUARDAR
const C_OK = "#22c55e";     // queda de preço / COMPRAR — bom p/ comprar
const C_MUTED = "#c0d0e0";

// Cores por proteína (linhas do gráfico)
const COR_PROT: Record<string, string> = {
  bovino: "#185FA5", frango: "#D4A017", suino: "#D85A30",
};
const LABEL_PROT: Record<string, string> = {
  bovino: "BOI", frango: "FRANGO", suino: "SUÍNO", ovino: "OVINO", geral: "GERAL",
};
const ORDEM = ["bovino", "frango", "suino"];

function fmtBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function corVar(v: number | null): string {
  if (v == null || v === 0) return C_MUTED;
  return v > 0 ? C_CRIT : C_OK; // preço subindo = ruim p/ comprar
}
function setaVar(v: number | null): string {
  if (v == null || v === 0) return "–";
  return v > 0 ? "▲" : "▼";
}
function corSinal(s: string | null): string {
  if (s === "COMPRAR") return C_OK;
  if (s === "EVITAR") return C_CRIT;
  if (s === "AGUARDAR") return C_WARN;
  return C_MUTED;
}
function corSinalNoticia(s: string | null): { cor: string; label: string } {
  // Ótica do comprador: negativo = pressão de alta (risco), positivo = pressão de baixa (oportunidade)
  if (s === "negativo") return { cor: C_CRIT, label: "PRESSÃO ALTA" };
  if (s === "positivo") return { cor: C_OK, label: "PRESSÃO BAIXA" };
  return { cor: C_MUTED, label: "NEUTRO" };
}
function fmtData(iso: string): string {
  const m = iso?.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : iso;
}

export default function MercadoClient({
  cotacoes, historico, sinais, noticias,
}: {
  cotacoes: Cotacao[]; historico: Historico[]; sinais: Sinal[]; noticias: Noticia[];
}) {
  const sinalPorProt = useMemo(() => {
    const m: Record<string, Sinal> = {};
    for (const s of sinais) m[s.proteina] = s;
    return m;
  }, [sinais]);

  const cotacaoPorProt = useMemo(() => {
    const m: Record<string, Cotacao> = {};
    for (const c of cotacoes) m[c.proteina] = c;
    return m;
  }, [cotacoes]);

  // Histórico wide por data: [{ data, bovino, frango, suino }]
  const chartData = useMemo(() => {
    const byDate: Record<string, Record<string, number | string>> = {};
    for (const h of historico) {
      const k = h.data_cotacao;
      byDate[k] = byDate[k] || { data: fmtData(k) };
      byDate[k][h.proteina] = h.valor;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [historico]);

  // Data mais RECENTE do conjunto (a view ordena por proteína — [0] seria sempre a do boi).
  const dataAtualizacao = cotacoes.length
    ? fmtData(cotacoes.reduce((max, c) => (c.data_cotacao > max ? c.data_cotacao : max), cotacoes[0].data_cotacao))
    : "—";
  const analiseGeral = sinalPorProt["geral"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
            Inteligência de Mercado
          </h1>
          <p style={{ color: C_MUTED, fontSize: 11, fontFamily: theme.font.label }}>
            Cotações de proteínas (indicador CEPEA) + notícias + análise IA · timing de compra.
          </p>
        </div>
        <span style={{ color: C_MUTED, fontSize: 10, fontFamily: theme.font.label, letterSpacing: ".08em" }}>
          ATUALIZADO {dataAtualizacao}
        </span>
      </div>

      {/* Cards de cotação + sinal */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        {ORDEM.map((prot) => {
          const c = cotacaoPorProt[prot];
          const s = sinalPorProt[prot];
          if (!c) {
            return (
              <div key={prot} style={cardStyle}>
                <span style={{ color: C_MUTED, fontSize: 11, fontFamily: theme.font.label }}>{LABEL_PROT[prot]} — sem cotação</span>
              </div>
            );
          }
          return (
            <div key={prot} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ color: COR_PROT[prot], fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".12em" }}>
                  {LABEL_PROT[prot]}
                </span>
                {s?.sinal && (
                  <span style={{
                    color: corSinal(s.sinal), fontSize: 10, fontFamily: theme.font.label, fontWeight: 700,
                    border: `1px solid ${corSinal(s.sinal)}`, borderRadius: 3, padding: "2px 6px",
                    letterSpacing: ".1em",
                  }}>
                    {s.sinal}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ color: "#FFFFFF", fontSize: 24, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>
                  R$ {fmtBRL(c.valor)}
                </span>
                <span style={{ color: C_MUTED, fontSize: 11, fontFamily: theme.font.label }}>{c.unidade}</span>
              </div>
              <div style={{ marginTop: 4, color: corVar(c.variacao_pct), fontSize: 12, fontFamily: theme.font.num }}>
                {setaVar(c.variacao_pct)} {c.variacao_pct == null ? "—" : `${c.variacao_pct > 0 ? "+" : ""}${fmtBRL(c.variacao_pct)}%`}
              </div>
              {s?.confianca != null && (
                <div style={{ marginTop: 6, color: C_MUTED, fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em" }}>
                  CONFIANÇA {"●".repeat(s.confianca)}{"○".repeat(Math.max(0, 5 - s.confianca))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Gráfico histórico 90d (eixo duplo: boi R$/@ esq, frango/suíno R$/kg dir) */}
      <div style={cardStyle}>
        <span style={titleStyle}>Histórico 90 dias</span>
        {chartData.length < 2 ? (
          <p style={{ color: C_MUTED, fontSize: 11, fontFamily: theme.font.label, marginTop: 10 }}>
            Histórico em construção — {chartData.length} dia(s) coletado(s). A série aparece conforme o cron diário acumula pontos.
          </p>
        ) : (
          <div style={{ marginTop: 10, width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2a35" />
                <XAxis dataKey="data" tick={{ fill: C_MUTED, fontSize: 10, fontFamily: theme.font.num }} stroke="#2a3a45" />
                <YAxis yAxisId="left" tick={{ fill: COR_PROT.bovino, fontSize: 10, fontFamily: theme.font.num }} stroke="#2a3a45"
                  label={{ value: "R$/@", angle: -90, position: "insideLeft", fill: COR_PROT.bovino, fontSize: 9 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: C_MUTED, fontSize: 10, fontFamily: theme.font.num }} stroke="#2a3a45"
                  label={{ value: "R$/kg", angle: 90, position: "insideRight", fill: C_MUTED, fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: "#0d1117", border: "1px solid #2a3a45", borderRadius: 4, fontFamily: theme.font.num, fontSize: 11 }}
                  labelStyle={{ color: "#FFFFFF" }}
                />
                <Legend wrapperStyle={{ fontFamily: theme.font.label, fontSize: 10 }} />
                <Line yAxisId="left" type="monotone" dataKey="bovino" name="Boi (R$/@)" stroke={COR_PROT.bovino} strokeWidth={2} dot={false} connectNulls />
                <Line yAxisId="right" type="monotone" dataKey="frango" name="Frango (R$/kg)" stroke={COR_PROT.frango} strokeWidth={2} dot={false} connectNulls />
                <Line yAxisId="right" type="monotone" dataKey="suino" name="Suíno (R$/kg)" stroke={COR_PROT.suino} strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Análise IA + Notícias */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12 }}>
        {/* Análise IA */}
        <div style={cardStyle}>
          <span style={titleStyle}>Análise IA do dia</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {ORDEM.map((prot) => {
              const s = sinalPorProt[prot];
              if (!s) return null;
              return (
                <div key={prot} style={{ borderLeft: `3px solid ${corSinal(s.sinal)}`, paddingLeft: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                    <span style={{ color: COR_PROT[prot], fontSize: 11, fontFamily: theme.font.label, fontWeight: 700 }}>{LABEL_PROT[prot]}</span>
                    <span style={{ color: corSinal(s.sinal), fontSize: 10, fontFamily: theme.font.label, fontWeight: 700 }}>{s.sinal}</span>
                  </div>
                  {s.justificativa && (
                    <p style={{ color: "#c0c8d8", fontSize: 11, fontFamily: theme.font.label, lineHeight: 1.45 }}>{s.justificativa}</p>
                  )}
                  {(s.projecao_7d || s.projecao_30d) && (
                    <p style={{ color: C_MUTED, fontSize: 10, fontFamily: theme.font.label, marginTop: 3 }}>
                      {s.projecao_7d ? `7d: ${s.projecao_7d}` : ""}{s.projecao_7d && s.projecao_30d ? " · " : ""}{s.projecao_30d ? `30d: ${s.projecao_30d}` : ""}
                    </p>
                  )}
                </div>
              );
            })}
            {analiseGeral?.justificativa && (
              <div style={{ borderTop: "1px solid #1e2a35", paddingTop: 8, marginTop: 2 }}>
                <span style={{ color: C_MUTED, fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em" }}>GERAL</span>
                <p style={{ color: "#c0c8d8", fontSize: 11, fontFamily: theme.font.label, lineHeight: 1.45, marginTop: 2 }}>{analiseGeral.justificativa}</p>
              </div>
            )}
            {sinais.length === 0 && (
              <p style={{ color: C_MUTED, fontSize: 11, fontFamily: theme.font.label }}>Sem análise disponível ainda.</p>
            )}
          </div>
        </div>

        {/* Notícias */}
        <div style={cardStyle}>
          <span style={titleStyle}>Notícias do setor</span>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {noticias.length === 0 && (
              <p style={{ color: C_MUTED, fontSize: 11, fontFamily: theme.font.label }}>Sem notícias recentes.</p>
            )}
            {noticias.map((n) => {
              const sig = corSinalNoticia(n.sinal_ia);
              return (
                <div key={n.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", paddingBottom: 8, borderBottom: "1px solid #161e28" }}>
                  <span style={{
                    color: sig.cor, fontSize: 8, fontFamily: theme.font.label, fontWeight: 700, whiteSpace: "nowrap",
                    border: `1px solid ${sig.cor}`, borderRadius: 3, padding: "2px 4px", marginTop: 2, letterSpacing: ".05em",
                  }}>
                    {sig.label}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#dfe6f0", fontSize: 11, fontFamily: theme.font.label, lineHeight: 1.4, textDecoration: "none" }}>
                        {n.titulo}
                      </a>
                    ) : (
                      <span style={{ color: "#dfe6f0", fontSize: 11, fontFamily: theme.font.label, lineHeight: 1.4 }}>{n.titulo}</span>
                    )}
                    <div style={{ color: C_MUTED, fontSize: 9, fontFamily: theme.font.label, marginTop: 2 }}>{n.fonte}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p style={{ color: "#e4e9f0", fontSize: 9, fontFamily: theme.font.label }}>
        Fonte cotações: indicador CEPEA via Notícias Agrícolas (boi R$/@, frango/suíno R$/kg · suíno = média das praças).
        Notícias: Google News classificadas por IA. Análise: gpt-4o-mini. Atualização diária 06h BRT (workflow ASB_MERCADO_INTELIGENCIA).
      </p>

      {/* Lupa flutuante de inteligência de mercado (web search ao vivo) */}
      <MercadoChat cotacoes={cotacoes} />
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid #1e2a35",
  borderRadius: 6,
  padding: 16,
};
const titleStyle: React.CSSProperties = {
  color: "#FFFFFF", fontSize: 12, fontWeight: 700, fontFamily: theme.font.label,
  letterSpacing: ".1em", textTransform: "uppercase",
};
