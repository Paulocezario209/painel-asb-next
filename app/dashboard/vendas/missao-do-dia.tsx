"use client";

import type { EstrategiasResponse } from "./actions";
import { theme } from "@/lib/theme";
import { VENDOR_LABELS } from "@/lib/vendor-labels";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { SectionHead } from "@/app/dashboard/lib/ui";
import { Target, ListChecks, PhoneCall, Clock, Quote, Flag } from "lucide-react";

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
        ...S.card,
        padding: 20,
        maxHeight: 600,
        overflowY: "auto",
      }}
    >
      {/* Cabeçalho com saudação */}
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--asb-border)" }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#FFFFFF",
            fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums",
            lineHeight: 1.3,
            marginBottom: 4,
          }}
        >
          {emoji} {saudacao}, {nomeAlvo}!
        </p>
        <p style={{ fontSize: 10, color: "#c0d0e0", fontFamily: theme.font.label, letterSpacing: ".05em" }}>
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
          <SectionHead Icon={Target} color={statusCor} title="Status da próxima meta" desc={statusEmoji || undefined} />
          <p style={{ fontSize: 11, color: "#FFFFFF", lineHeight: 1.4 }}>
            <strong>{fmtDate(meu.proxima_meta)}</strong> · <span className="priv-brl">{fmtBRL(meu.realizado)}</span> / <span className="priv-brl">{fmtBRL(meu.meta)}</span> · <span className="priv-pct">{meu.pct}%</span>
          </p>
          <p style={{ fontSize: 10, color: "#c8d8e8", marginTop: 4, lineHeight: 1.4 }}>
            {meu.sugestao}
          </p>
        </div>
      )}

      {/* Checklist do dia */}
      <SectionHead Icon={ListChecks} color={theme.colors.accent} title="Checklist do dia" />
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
          <SectionHead Icon={PhoneCall} color={theme.colors.brandAsb} title="Reativar hoje" desc={nomeAlvo} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
            {dormentesFiltrado.slice(0, 5).map((d, i) => {
              const cor = d.prioridade === "alta" ? theme.colors.critical : d.prioridade === "media" ? "#BA7517" : "#c0d0e0";
              return (
                <div
                  key={`${d.cliente}-${i}`}
                  style={{
                    background: "var(--asb-card-hi)",
                    borderLeft: `3px solid ${cor}`,
                    borderRadius: 8,
                    padding: "6px 9px",
                  }}
                >
                  <div style={{ fontSize: 10, color: "#fff", fontWeight: 700, fontFamily: theme.font.label, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.cliente}>
                    {d.cliente}
                  </div>
                  <div style={{ fontSize: 9, color: "#c0d0e0", fontFamily: theme.font.label, marginTop: 1 }}>
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
          <SectionHead Icon={Clock} color={theme.colors.warning} title="Cobrar escritório" />
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
                fontFamily: theme.font.label,
              }}
            >
              {p.qty} pedido(s) <span className="priv-brl">{fmtBRL(p.valor)}</span> represado (faturamento vencido)
              {p.mais_antigo_dias > 5 && <span style={{ color: theme.colors.critical, marginLeft: 4 }}>⚠ +{p.mais_antigo_dias}d</span>}
            </div>
          ))}
        </>
      )}

      {/* Filosofia / Frase do dia */}
      <div
        style={{
          background: "var(--asb-card-hi)",
          borderLeft: `3px solid ${theme.colors.accent}`,
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 14,
        }}
      >
        <SectionHead Icon={Quote} color={theme.colors.accent} title="Filosofia do dia" />
        <p style={{ fontSize: 11, color: "#c8d8e8", fontStyle: "italic", lineHeight: 1.5 }}>
          {fraseDoDia}
        </p>
      </div>

      {/* Programa C/M/L */}
      <div style={{ paddingTop: 10, borderTop: "1px solid var(--asb-border)" }}>
        <SectionHead Icon={Flag} color={theme.colors.textPrimary} title="Programa" />
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6, fontSize: 10, color: "#c0d0e0", fontFamily: theme.font.label }}>
          <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: theme.colors.success, flexShrink: 0 }} />
            <span><strong style={{ color: theme.colors.success }}>CURTO:</strong> bater a próxima meta de entrega</span>
          </li>
          <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: theme.colors.warning, flexShrink: 0 }} />
            <span><strong style={{ color: theme.colors.warning }}>MÉDIO:</strong> +10% ticket médio no mês</span>
          </li>
          <li style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: theme.colors.brandAsb, flexShrink: 0 }} />
            <span><strong style={{ color: theme.colors.brandAsb }}>LONGO:</strong> dobrar recorrentes em 90 dias</span>
          </li>
        </ul>
      </div>

      <p style={{ fontSize: 9, color: theme.colors.neutral, textAlign: "center", marginTop: 14, fontStyle: "italic" }}>
        Boas vendas e sucesso! 🚀
      </p>
    </div>
  );
}
