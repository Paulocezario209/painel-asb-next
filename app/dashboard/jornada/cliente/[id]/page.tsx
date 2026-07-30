// app/dashboard/jornada/cliente/[id]/page.tsx — DOSSIÊ do cliente na Jornada.
// Linha do tempo pedido-a-pedido (datas, valores, intervalos), acumulado, ticket, tempo total
// até recorrência + o Score V1 aberto por componente. Gestor-only. Fonte: getJornadaData.

import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { statusLabel, statusColor } from "@/lib/customer-status";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { getJornadaData } from "@/lib/funnel/jornada-data";
import { isViva, type JornadaView } from "@/lib/funnel/jornada";
import { daysBetween, type ScoreFaixa } from "@/lib/funnel/jornada-metrics";
import { ArrowLeft, History } from "lucide-react";

export const dynamic = "force-dynamic";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const brl0 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDia = (d: string | null) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "—");
const FAIXA: Record<ScoreFaixa, { cor: string; label: string }> = {
  verde: { cor: "#22c55e", label: "No prazo" }, amarelo: { cor: "#eab308", label: "Atenção" },
  laranja: { cor: "#f59e0b", label: "Alto risco" }, vermelho: { cor: "#ef4444", label: "Crítico" },
};

export default async function DossiePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/funil")) redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;
  const view: JornadaView = sp.view === "geral" ? "geral" : "viva";
  const aresId = Number(id);
  if (!Number.isFinite(aresId)) return notFound();

  const { clientes } = await getJornadaData();
  const c = clientes.find((x) => x.ares_pessoa_id === aresId);
  if (!c) return notFound();

  const peds = c.pedidos;
  const tempoTotal = peds.length >= 2 ? daysBetween(peds[0].data, peds[peds.length - 1].data) : null;
  const f = FAIXA[c.score.faixa];
  const vivo = isViva(c.customer_status);
  const comp = c.score.componentes;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 980 }}>
      <Link href={`/dashboard/jornada?view=${view}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#c8d8e8", fontSize: 12, fontFamily: theme.font.label, textDecoration: "none" }}>
        <ArrowLeft size={14} /> Voltar à lista
      </Link>

      <PageHead
        title={c.name || `Cliente ${c.ares_pessoa_id}`}
        desc={[`ID ARES ${c.ares_pessoa_id}`, [c.city, c.uf].filter(Boolean).join("/"), c.vendedor_nome ?? "sem vendedor"].filter(Boolean).join(" · ")}
      />

      {/* Resumo + Score */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <div style={{ ...S.card, padding: "18px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <StatTile label="Pedidos faturados" value={c.total_orders} />
            <StatTile label="Faturamento acumulado" value={brl0(c.total_revenue_brl)} />
            <StatTile label="Ticket médio" value={brl0(c.avg_ticket_brl)} />
            <StatTile label="Último pedido" value={fmtDia(c.last_order_at)} sub={`${c.dias_sem_compra ?? "—"}d atrás`} />
            <StatTile label="Tempo total (1º→último)" value={tempoTotal != null ? `${tempoTotal}d` : "—"} />
            <StatTile label="Situação" value={statusLabel(c.customer_status)} num={statusColor(c.customer_status)} />
          </div>
        </div>
        {/* Score V1 aberto */}
        <div style={{ ...S.card, padding: "18px 20px", borderTop: `3px solid ${f.cor}` }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 40, fontWeight: 850, color: f.cor, fontFamily: theme.font.num, lineHeight: 1 }}>{c.score.score}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: f.cor, fontFamily: theme.font.label }}>{f.label}</span>
          </div>
          <p style={{ fontSize: 10, color: "#83879a", fontFamily: theme.font.label, margin: "8px 0 10px" }}>Score de evolução (0–100) · só variáveis auditáveis</p>
          {[
            { l: "Atraso vs mediana da etapa", v: comp.atraso, p: "40%" },
            { l: "Dias desde último pedido", v: comp.recencia, p: "25%" },
            { l: "Queda de frequência", v: comp.frequencia, p: "20%" },
            { l: "Redução de faturamento", v: comp.faturamento, p: "15%" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <span style={{ flex: 1, fontSize: 10.5, color: "#aeb7cc", fontFamily: theme.font.label }}>{x.l} <span style={{ color: "#6b7280" }}>({x.p})</span></span>
              <div style={{ width: 60, height: 6, background: "var(--asb-card-hi)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${x.v}%`, height: "100%", background: f.cor, opacity: .8 }} />
              </div>
              <span style={{ width: 26, textAlign: "right", fontSize: 10, color: "#c8d2e6", fontFamily: theme.font.num }}>{x.v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Motivo (só confirmado) + carteira viva */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", padding: "3px 9px", borderRadius: 999, background: vivo ? "rgba(34,197,94,.14)" : "rgba(255,255,255,.06)", color: vivo ? "#22c55e" : "#83879a", fontFamily: theme.font.label }}>
          {vivo ? "Carteira viva" : "Fora da carteira viva"}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: "rgba(255,255,255,.05)", color: c.motivo ? "#c8d2e6" : "#6b7280", fontStyle: c.motivo ? "normal" : "italic", fontFamily: theme.font.label }}>
          Motivo: {c.motivo ?? "não identificado"}
        </span>
      </div>

      {/* Linha do tempo pedido-a-pedido */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={History} color={f.cor} title="Linha do tempo dos pedidos" desc={`${peds.length} pedidos faturados (status 4/13) · intervalo entre cada`} />
        {peds.length === 0 ? (
          <p style={S.muted}>Sem pedidos faturados registrados.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {peds.map((p, i) => {
              const prev = i > 0 ? peds[i - 1] : null;
              const gap = prev ? daysBetween(prev.data, p.data) : null;
              const acum = peds.slice(0, i + 1).reduce((a, x) => a + x.valor, 0);
              return (
                <div key={p.ares_pedido_id ?? i}>
                  {gap != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0 2px 16px", color: "#6b7280", fontSize: 10, fontFamily: theme.font.label }}>
                      <span style={{ width: 2, height: 18, background: "rgba(255,255,255,.12)", display: "inline-block" }} />
                      ↓ {gap} dias
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)", borderRadius: 8 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 999, background: f.cor + "22", color: f.cor, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, fontFamily: theme.font.num, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: 12, color: "#aeb7cc", fontFamily: theme.font.num, width: 90 }}>{fmtDia(p.data)}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#fff", fontFamily: theme.font.num, width: 120 }}>{brl(p.valor)}</span>
                    <span style={{ fontSize: 10.5, color: "#83879a", fontFamily: theme.font.num, marginLeft: "auto" }}>acumulado {brl0(acum)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
