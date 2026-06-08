"use client";

import type { EstrategiasResponse } from "./actions";
import { theme } from "@/lib/theme";

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
const EMOJI_HORA = (h: number) => (h < 6 ? "🌙" : h < 12 ? "🌅" : h < 18 ? "☀️" : "🌆");

// Frases motivacionais rotativas (pelo dia do ano)
const FRASES = [
  '"Resultados vêm com consistência + tempo. Boas vendas e sucesso!"',
  '"Desconto NÃO é a solução. Venda é processo: técnica, criatividade e disciplina."',
  '"Cliente recorrente é seu maior ativo. Cuide dele todos os dias."',
  '"Ticket médio sobe quando você sugere mix, não quando dá desconto."',
  '"Lance pedido em tempo real. Não acumule. Não esqueça. Não erre."',
  '"O abandonado de hoje é a venda perdida de amanhã. Reative."',
  '"Disciplina diária constrói meses incríveis."',
];

const VENDOR_LABELS: Record<string, string> = {
  SETOR_CUIT: "Paulo Cezario",
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula",
  SETOR_CAMPINAS_JUNDIAI: "Alan",
};

type Props = {
  data: EstrategiasResponse;
  vendor: string; // "all" | SETOR_*
};

export function MissaoDoDia({ data, vendor }: Props) {
  const agora = new Date();
  const hora = agora.getHours();
  const saudacao = SAUDACAO(hora);
  const emoji = EMOJI_HORA(hora);
  const diaSemana = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"][agora.getDay()];
  const dataLabel = `${diaSemana} ${String(agora.getDate()).padStart(2, "0")}/${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const fraseDoDia = FRASES[Math.floor(agora.getTime() / 86400000) % FRASES.length];

  const nomeAlvo = vendor === "all" ? "Time" : (VENDOR_LABELS[vendor] ?? vendor);

  // Filtrar dados pelo vendedor selecionado (NUNCA misturar)
  const baterMetaFiltrado = vendor === "all"
    ? data.baterMeta
    : data.baterMeta.filter(b => b.vendedor === vendor);

  const dormentesFiltrado = vendor === "all"
    ? data.reativarDormentes
    : data.reativarDormentes.filter(d => d.vendedor === vendor);

  const pendentesFiltrado = vendor === "all"
    ? data.fecharPendentes
    : data.fecharPendentes.filter(p => p.vendedor === vendor);

  // Status pessoal (próxima meta)
  const meu = baterMetaFiltrado[0];
  const statusCor =
    !meu ? theme.colors.neutral :
    meu.pct >= 100 ? theme.colors.success :
    meu.pct >= 80 ? theme.colors.warning :
    meu.pct >= 50 ? "#BA7517" :
    theme.colors.critical;
  const statusEmoji =
    !meu ? "" :
    meu.pct >= 100 ? "💪🔥" :
    meu.pct >= 80 ? "🚀" :
    meu.pct >= 50 ? "⚡" :
    "📈";

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: `1px solid ${theme.colors.borderDefault}`,
        borderRadius: 8,
        padding: 20,
        maxHeight: 600,
        overflowY: "auto",
      }}
    >
      {/* Cabeçalho com saudação */}
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${theme.colors.borderDefault}` }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: "'Inter', system-ui, sans-serif",
            lineHeight: 1.3,
            marginBottom: 4,
          }}
        >
          {emoji} {saudacao}, {nomeAlvo}!
        </p>
        <p style={{ fontSize: 10, color: "#8899aa", fontFamily: "'Courier New', monospace", letterSpacing: ".05em" }}>
          {dataLabel} · Pronto pra mais um desafio?
        </p>
      </div>

      {/* Status pessoal */}
      {meu && (
        <div
          style={{
            background: `${statusCor}15`,
            borderLeft: `3px solid ${statusCor}`,
            borderRadius: 4,
            padding: "10px 12px",
            marginBottom: 14,
          }}
        >
          <p style={{ fontSize: 9, color: statusCor, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", marginBottom: 4, textTransform: "uppercase" }}>
            ▸ STATUS DA PRÓXIMA META {statusEmoji}
          </p>
          <p style={{ fontSize: 11, color: "#FFFFFF", lineHeight: 1.4 }}>
            <strong>{fmtDate(meu.proxima_meta)}</strong> · <span className="priv-brl">{fmtBRL(meu.realizado)}</span> / <span className="priv-brl">{fmtBRL(meu.meta)}</span> · <span className="priv-pct">{meu.pct}%</span>
          </p>
          <p style={{ fontSize: 10, color: "#c8d8e8", marginTop: 4, lineHeight: 1.4 }}>
            {meu.sugestao}
          </p>
        </div>
      )}

      {/* Checklist do dia */}
      <p style={{ fontSize: 9, fontWeight: 700, color: theme.colors.accent, fontFamily: "'Courier New', monospace", letterSpacing: ".15em", marginBottom: 8, textTransform: "uppercase" }}>
        ✓ CHECKLIST DO DIA
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0", display: "flex", flexDirection: "column", gap: 6 }}>
        {[
          { icon: "⏰", text: "08:00 — Mensagem pra lista de recorrência" },
          { icon: "📝", text: "Lançar pedidos em TEMPO REAL (não acumule)" },
          { icon: "🍞", text: "Pedido de pães no ato → grupo correto" },
          { icon: "⏰", text: "11:00 — Reenviar pra clientes recorrentes" },
          { icon: "📋", text: "Acompanhar lista de recorrência" },
          { icon: "💼", text: "Enviar proposta de MIX semanal (expandir ticket)" },
          { icon: "📊", text: "Analisar resultados 4-5x ao longo do dia" },
          { icon: "📞", text: "Buscar clientes top abandonados (ver lista abaixo)" },
          { icon: "🚫", text: "ZERO desconto como muleta. Venda é processo." },
        ].map((c, i) => (
          <li key={i} style={{ fontSize: 10, color: "#c8d8e8", display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.4 }}>
            <span>{c.icon}</span>
            <span>{c.text}</span>
          </li>
        ))}
      </ul>

      {/* Top dormentes do vendedor (lista personalizada — NUNCA misturar entre vendedores) */}
      {dormentesFiltrado.length > 0 && (
        <>
          <p style={{ fontSize: 9, fontWeight: 700, color: theme.colors.brandAsb, fontFamily: "'Courier New', monospace", letterSpacing: ".15em", marginBottom: 8, textTransform: "uppercase" }}>
            📞 REATIVAR HOJE ({nomeAlvo})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
            {dormentesFiltrado.slice(0, 5).map((d, i) => {
              const cor = d.prioridade === "alta" ? theme.colors.critical : d.prioridade === "media" ? "#BA7517" : "#8899aa";
              return (
                <div
                  key={`${d.cliente}-${i}`}
                  style={{
                    background: "#0a0f1f",
                    borderLeft: `3px solid ${cor}`,
                    borderRadius: 3,
                    padding: "6px 9px",
                  }}
                >
                  <div style={{ fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: "'Courier New', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.cliente}>
                    {d.cliente}
                  </div>
                  <div style={{ fontSize: 9, color: "#8899aa", fontFamily: "'Courier New', monospace", marginTop: 1 }}>
                    {d.dias_sem_comprar}d ausente · hist. <span className="priv-brl">{fmtBRL(d.valor_historico)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pendentes do escritório (vendedor específico) */}
      {pendentesFiltrado.length > 0 && (
        <>
          <p style={{ fontSize: 9, fontWeight: 700, color: theme.colors.warning, fontFamily: "'Courier New', monospace", letterSpacing: ".15em", marginBottom: 8, textTransform: "uppercase" }}>
            ⏰ COBRAR ESCRITÓRIO
          </p>
          {pendentesFiltrado.map((p) => (
            <div
              key={p.vendedor}
              style={{
                background: "rgba(212,160,23,.08)",
                borderLeft: `3px solid ${theme.colors.warning}`,
                borderRadius: 3,
                padding: "6px 9px",
                marginBottom: 14,
                fontSize: 10,
                color: "#c8d8e8",
                fontFamily: "'Courier New', monospace",
              }}
            >
              {p.qty} pedido(s) <span className="priv-brl">{fmtBRL(p.valor)}</span> aguardando NF/recibo
              {p.mais_antigo_dias > 5 && <span style={{ color: theme.colors.critical, marginLeft: 4 }}>⚠ +{p.mais_antigo_dias}d</span>}
            </div>
          ))}
        </>
      )}

      {/* Filosofia / Frase do dia */}
      <div
        style={{
          background: "#0a0f1f",
          borderLeft: `3px solid ${theme.colors.accent}`,
          borderRadius: 4,
          padding: "10px 12px",
          marginBottom: 14,
        }}
      >
        <p style={{ fontSize: 9, color: theme.colors.accent, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", marginBottom: 4, textTransform: "uppercase" }}>
          💭 FILOSOFIA DO DIA
        </p>
        <p style={{ fontSize: 11, color: "#c8d8e8", fontStyle: "italic", lineHeight: 1.5 }}>
          {fraseDoDia}
        </p>
      </div>

      {/* Programa C/M/L */}
      <div style={{ paddingTop: 10, borderTop: `1px solid ${theme.colors.borderDefault}` }}>
        <p style={{ fontSize: 9, fontWeight: 700, color: theme.colors.textPrimary, fontFamily: "'Courier New', monospace", letterSpacing: ".15em", marginBottom: 8, textTransform: "uppercase" }}>
          🎯 PROGRAMA
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4, fontSize: 10, color: "#8899aa", fontFamily: "'Courier New', monospace" }}>
          <li>▸ <strong style={{ color: theme.colors.success }}>CURTO:</strong> bater a próxima meta de entrega</li>
          <li>▸ <strong style={{ color: theme.colors.warning }}>MÉDIO:</strong> +10% ticket médio no mês</li>
          <li>▸ <strong style={{ color: theme.colors.brandAsb }}>LONGO:</strong> dobrar recorrentes em 90 dias</li>
        </ul>
      </div>

      <p style={{ fontSize: 9, color: theme.colors.neutral, textAlign: "center", marginTop: 14, fontStyle: "italic" }}>
        Boas vendas e sucesso! 🚀
      </p>
    </div>
  );
}
