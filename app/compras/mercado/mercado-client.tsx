// app/compras/mercado/mercado-client.tsx — ASB Intelligence Hub (Camada 4: Mercado).
// Responde 1 pergunta: "devo comprar proteína agora, ou esperar?".
// Linguagem visual grafite (kit do painel: PageHead/SectionHead/StatTile) + cores semânticas.
"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Beef, LineChart as LineChartIcon, Sparkles, Newspaper } from "lucide-react";
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
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, StatTile } from "@/app/dashboard/lib/ui";

// Cores semânticas (skill elite) — ÓTICA DO COMPRADOR.
const C_CRIT = "#C8102E";   // alta de preço / EVITAR — ruim p/ comprar
const C_WARN = "#D4A017";   // AGUARDAR
const C_OK = "#22c55e";     // queda de preço / COMPRAR — bom p/ comprar
const C_MUTED = "#c0d0e0";

// Cores por proteína (linhas do gráfico — paleta de gráfico, não mexer)
const COR_PROT: Record<string, string> = {
  bovino: "#185FA5", frango: "#D4A017", suino: "#D85A30",
};
// Rótulo Title Case (label de número/bloco = sans Title Case)
const TITLE_PROT: Record<string, string> = {
  bovino: "Boi", frango: "Frango", suino: "Suíno", ovino: "Ovino", geral: "Geral",
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
  if (v == null || v === 0) return "→";
  return v > 0 ? "↗" : "↘";
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

// Chip de sinal/variação — mesma linguagem dos chips do Dashboard (pill sans).
function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 750,
      padding: "3px 9px", borderRadius: 999, background: color + "22", color, fontFamily: theme.font.label,
    }}>
      {children}
    </span>
  );
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header de página */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <PageHead
          title="Inteligência de Mercado"
          desc="Cotações de proteínas (indicador CEPEA) + notícias + análise IA · timing de compra."
        />
        <span style={{ ...S.label, marginBottom: 0, whiteSpace: "nowrap" }}>Atualizado {dataAtualizacao}</span>
      </div>

      {/* Cotações + sinal (StatTile canônico) */}
      <div>
        <SectionHead Icon={Beef} color="#185FA5" title="Cotações de Proteínas" desc="Preço atual · sinal de compra por proteína" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {ORDEM.map((prot) => {
            const c = cotacaoPorProt[prot];
            const s = sinalPorProt[prot];
            if (!c) {
              return (
                <StatTile key={prot} label={TITLE_PROT[prot]} value="—" accent={COR_PROT[prot]} sub="sem cotação" />
              );
            }
            const conf = s?.confianca != null
              ? `${"●".repeat(s.confianca)}${"○".repeat(Math.max(0, 5 - s.confianca))}`
              : null;
            return (
              <StatTile
                key={prot}
                label={TITLE_PROT[prot]}
                value={`R$ ${fmtBRL(c.valor)}`}
                accent={COR_PROT[prot]}
                sub={`${c.unidade}${conf ? ` · confiança ${conf}` : ""}`}
                badges={
                  <>
                    {s?.sinal && <Chip color={corSinal(s.sinal)}>{s.sinal}</Chip>}
                    {c.variacao_pct != null && (
                      <Chip color={corVar(c.variacao_pct)}>
                        {setaVar(c.variacao_pct)} {c.variacao_pct > 0 ? "+" : ""}{fmtBRL(c.variacao_pct)}%
                      </Chip>
                    )}
                  </>
                }
              />
            );
          })}
        </div>
      </div>

      {/* Gráfico histórico 90d (eixo duplo: boi R$/@ esq, frango/suíno R$/kg dir) */}
      <div style={cardStyle}>
        <SectionHead Icon={LineChartIcon} color="#8bb4ff" title="Histórico 90 Dias" desc="Boi R$/@ (esq) · frango/suíno R$/kg (dir)" />
        {chartData.length < 2 ? (
          <p style={{ color: C_MUTED, fontSize: 12.5, fontFamily: theme.font.label }}>
            Histórico em construção — {chartData.length} dia(s) coletado(s). A série aparece conforme o cron diário acumula pontos.
          </p>
        ) : (
          <div style={{ width: "100%", height: 280 }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        {/* Análise IA */}
        <div style={cardStyle}>
          <SectionHead Icon={Sparkles} color="#a78bfa" title="Análise IA do Dia" desc="Sinal e projeção por proteína" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ORDEM.map((prot) => {
              const s = sinalPorProt[prot];
              if (!s) return null;
              return (
                <div key={prot} style={{ borderLeft: `3px solid ${corSinal(s.sinal)}`, paddingLeft: 10 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                    <span style={{ color: COR_PROT[prot], fontSize: 12.5, fontFamily: theme.font.label, fontWeight: 700 }}>{TITLE_PROT[prot]}</span>
                    <span style={{ color: corSinal(s.sinal), fontSize: 11, fontFamily: theme.font.label, fontWeight: 700 }}>{s.sinal}</span>
                  </div>
                  {s.justificativa && (
                    <p style={{ color: "#c0c8d8", fontSize: 12, fontFamily: theme.font.label, lineHeight: 1.45 }}>{s.justificativa}</p>
                  )}
                  {(s.projecao_7d || s.projecao_30d) && (
                    <p style={{ color: C_MUTED, fontSize: 11, fontFamily: theme.font.label, marginTop: 3 }}>
                      {s.projecao_7d ? `7d: ${s.projecao_7d}` : ""}{s.projecao_7d && s.projecao_30d ? " · " : ""}{s.projecao_30d ? `30d: ${s.projecao_30d}` : ""}
                    </p>
                  )}
                </div>
              );
            })}
            {analiseGeral?.justificativa && (
              <div style={{ borderTop: "1px solid var(--asb-border)", paddingTop: 8, marginTop: 2 }}>
                <span style={{ ...S.label, marginBottom: 0 }}>Geral</span>
                <p style={{ color: "#c0c8d8", fontSize: 12, fontFamily: theme.font.label, lineHeight: 1.45, marginTop: 4 }}>{analiseGeral.justificativa}</p>
              </div>
            )}
            {sinais.length === 0 && (
              <p style={{ color: C_MUTED, fontSize: 12.5, fontFamily: theme.font.label }}>Sem análise disponível ainda.</p>
            )}
          </div>
        </div>

        {/* Notícias */}
        <div style={cardStyle}>
          <SectionHead Icon={Newspaper} color="#f59e0b" title="Notícias do Setor" desc="Manchetes classificadas por IA" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {noticias.length === 0 && (
              <p style={{ color: C_MUTED, fontSize: 12.5, fontFamily: theme.font.label }}>Sem notícias recentes.</p>
            )}
            {noticias.map((n) => {
              const sig = corSinalNoticia(n.sinal_ia);
              return (
                <div key={n.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", paddingBottom: 8, borderBottom: "1px solid var(--asb-border)" }}>
                  <span style={{
                    color: sig.cor, fontSize: 9, fontFamily: theme.font.label, fontWeight: 700, whiteSpace: "nowrap",
                    border: `1px solid ${sig.cor}`, borderRadius: 3, padding: "2px 5px", marginTop: 2, letterSpacing: ".05em",
                  }}>
                    {sig.label}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noopener noreferrer"
                        style={{ color: "#dfe6f0", fontSize: 12, fontFamily: theme.font.label, lineHeight: 1.4, textDecoration: "none" }}>
                        {n.titulo}
                      </a>
                    ) : (
                      <span style={{ color: "#dfe6f0", fontSize: 12, fontFamily: theme.font.label, lineHeight: 1.4 }}>{n.titulo}</span>
                    )}
                    <div style={{ color: C_MUTED, fontSize: 10, fontFamily: theme.font.label, marginTop: 2 }}>{n.fonte}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p style={{ color: "#83879a", fontSize: 10.5, fontFamily: theme.font.label }}>
        Fonte cotações: indicador CEPEA via Notícias Agrícolas (boi R$/@, frango/suíno R$/kg · suíno = média das praças).
        Notícias: Google News classificadas por IA. Análise: gpt-4o-mini. Atualização diária 06h BRT (workflow ASB_MERCADO_INTELIGENCIA).
      </p>

      {/* Lupa flutuante de inteligência de mercado (web search ao vivo) */}
      <MercadoChat cotacoes={cotacoes} />
    </div>
  );
}

const cardStyle: React.CSSProperties = { ...S.card, padding: "20px 24px" };
