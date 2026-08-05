// components/dashboard/card-jornada-alertas.tsx — os 2 cards de alerta da Jornada
// na Visão Geral. Server Component: o filtro de permissão é aplicado AQUI (servidor),
// nunca no cliente.
//
//   Card 1 "Jornada até recorrência vencida" → estado vencido | acao_registrada
//   Card 2 "Jornada crítica"                 → estado critico (vermelho pulsante)

import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { theme } from "@/lib/theme";
import { SLA_PULSE_CSS, SLA_COLORS } from "@/components/ui/sla-badge";
import { rotuloAtraso, referenciaContador, type EstadoAlerta } from "@/lib/jornada/alertas";
import { AlertTriangle, Flame } from "lucide-react";
import type { UserContext } from "@/lib/auth/get-user-role";

const ETAPA_LABEL: Record<string, string> = {
  aguardando_2: "aguardando 2º pedido",
  aguardando_3: "aguardando 3º pedido",
  aguardando_4: "aguardando 4º pedido",
  aguardando_recorrencia: "aguardando recorrência",
};

export interface AlertaVM {
  id: string; ares_pessoa_id: number; etapa: string; estado: EstadoAlerta;
  faturado_em: string; vence_em: string; critico_em: string;
  vendor_nome_no_venc: string | null; routing_team_no_venc: string | null;
  acao_em: string | null;
}

/** Busca os alertas ABERTOS já filtrados pela permissão do usuário (server-side). */
export async function getAlertasAbertos(ctx: UserContext): Promise<AlertaVM[]> {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  let q = sb.from("jornada_alertas")
    .select("id, ares_pessoa_id, etapa, estado, faturado_em, vence_em, critico_em, vendor_nome_no_venc, routing_team_no_venc, acao_em")
    .in("estado", ["vencido", "critico", "acao_registrada"])
    .order("vence_em", { ascending: true });

  // PERMISSÃO NO SERVIDOR (nunca client-side): vendedor enxerga só o próprio setor,
  // pelo routing_team CONGELADO no vencimento — mesmo padrão de /dashboard/cadencias.
  // gestor e manager veem tudo. Sem routing_team, o vendedor não vê nada (fail-closed).
  if (ctx.role === "vendedor") {
    if (!ctx.routing_team) return [];
    q = q.eq("routing_team_no_venc", ctx.routing_team);
  }

  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as AlertaVM[];
}

export function CardsJornadaAlertas({ alertas, agora }: { alertas: AlertaVM[]; agora: Date }) {
  const criticos = alertas.filter((a) => a.estado === "critico");
  const vencidos = alertas.filter((a) => a.estado !== "critico");

  const hoje = agora.toISOString().slice(0, 10);
  const vencidosHoje = vencidos.filter((a) => a.vence_em.slice(0, 10) === hoje).length;

  const porVendedor = (rs: AlertaVM[]) => {
    const m = new Map<string, number>();
    for (const a of rs) m.set(a.vendor_nome_no_venc ?? "sem responsável", (m.get(a.vendor_nome_no_venc ?? "sem responsável") ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const porEtapa = (rs: AlertaVM[]) => {
    const m = new Map<string, number>();
    for (const a of rs) m.set(a.etapa, (m.get(a.etapa) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const maiorAtraso = (rs: AlertaVM[]) => {
    if (rs.length === 0) return "—";
    const mais = rs.reduce((acc, a) =>
      referenciaContador(a).getTime() < referenciaContador(acc).getTime() ? a : acc);
    return rotuloAtraso(referenciaContador(mais), agora);
  };

  return (
    <>
      <style>{SLA_PULSE_CSS}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>

        {/* Card 1 — vencidos */}
        <Link href="/dashboard/jornada/alertas?estado=vencido" style={{ textDecoration: "none" }}>
          <div style={{ ...S.card, padding: "16px 18px", borderTop: `3px solid ${SLA_COLORS.amber}`, height: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={15} color={SLA_COLORS.amber} />
              <span style={{ fontSize: 12.5, fontWeight: 650, color: "#aeb7cc", fontFamily: theme.font.label }}>
                Jornada até recorrência vencida
              </span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 850, lineHeight: 1, color: SLA_COLORS.amber, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>
              {vencidos.length}
            </div>
            <div style={{ fontSize: 10.5, color: "#83879a", fontFamily: theme.font.num, marginTop: 6 }}>
              {vencidosHoje} venceram hoje · maior atraso: {maiorAtraso(vencidos)}
            </div>
            <Distribuicao titulo="Por vendedor" itens={porVendedor(vencidos)} />
            <Distribuicao titulo="Por etapa" itens={porEtapa(vencidos).map(([k, v]) => [ETAPA_LABEL[k] ?? k, v])} />
          </div>
        </Link>

        {/* Card 2 — críticos (vermelho pulsante) */}
        <Link href="/dashboard/jornada/alertas?estado=critico" style={{ textDecoration: "none" }}>
          <div
            className={criticos.length > 0 ? "asb-pulse-sla" : undefined}
            style={{ ...S.card, padding: "16px 18px", borderTop: `3px solid ${SLA_COLORS.red}`, height: "100%", ...(criticos.length > 0 ? { boxShadow: `0 0 0 1px ${SLA_COLORS.red}55` } : {}) }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Flame size={15} color={SLA_COLORS.red} />
              <span style={{ fontSize: 12.5, fontWeight: 650, color: "#e8b4bc", fontFamily: theme.font.label }}>
                Jornada crítica
              </span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 850, lineHeight: 1, color: SLA_COLORS.red, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" }}>
              {criticos.length}
            </div>
            <div style={{ fontSize: 10.5, color: "#83879a", fontFamily: theme.font.num, marginTop: 6 }}>
              sem ação do vendedor · maior atraso: {maiorAtraso(criticos)}
            </div>
            <Distribuicao titulo="Por vendedor" itens={porVendedor(criticos)} />
            <Distribuicao titulo="Por etapa" itens={porEtapa(criticos).map(([k, v]) => [ETAPA_LABEL[k] ?? k, v])} />
          </div>
        </Link>
      </div>
    </>
  );
}

function Distribuicao({ titulo, itens }: { titulo: string; itens: [string, number][] }) {
  if (itens.length === 0) return null;
  return (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,.06)" }}>
      <div style={{ fontSize: 9.5, color: "#6b7280", fontFamily: theme.font.label, marginBottom: 4 }}>{titulo}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {itens.slice(0, 4).map(([k, v]) => (
          <span key={k} style={{ fontSize: 10, color: "#aeb7cc", fontFamily: theme.font.label, background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 999, padding: "1px 7px" }}>
            {k} <b style={{ fontFamily: theme.font.num }}>{v}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
