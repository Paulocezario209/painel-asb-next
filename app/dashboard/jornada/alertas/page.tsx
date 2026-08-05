// app/dashboard/jornada/alertas/page.tsx — lista detalhada dos alertas da Jornada.
// Aberta pelos cards da Visão Geral. Permissão aplicada no SERVIDOR (getAlertasAbertos):
// vendedor enxerga só o próprio setor; gestor/manager veem tudo.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead } from "@/app/dashboard/lib/ui";
import { getUserContext } from "@/lib/auth/get-user-role";
import { getAlertasAbertos } from "@/components/dashboard/card-jornada-alertas";
import { rotuloAtraso, referenciaContador } from "@/lib/jornada/alertas";
import { SLA_PULSE_CSS, SLA_COLORS } from "@/components/ui/sla-badge";
import { RegistrarContatoBtn } from "@/components/dashboard/registrar-contato-btn";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

const dt = (s: string | null) => (s ? new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const ETAPA: Record<string, string> = {
  aguardando_2: "aguardando 2º pedido", aguardando_3: "aguardando 3º pedido",
  aguardando_4: "aguardando 4º pedido", aguardando_recorrencia: "aguardando recorrência",
};
const PROX: Record<string, string> = {
  aguardando_2: "2º pedido", aguardando_3: "3º pedido",
  aguardando_4: "4º pedido", aguardando_recorrencia: "5º pedido (recorrência)",
};

export default async function JornadaAlertasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/dashboard");

  const sp = await searchParams;
  const alertas = await getAlertasAbertos(ctx);          // já filtrado por permissão
  const agora = new Date();

  // ── filtros (client-side sobre o conjunto JÁ autorizado no servidor) ──────
  const fEstado = sp.estado, fVend = sp.vendedor, fEtapa = sp.etapa, fCliente = sp.cliente?.toLowerCase();
  let rows = alertas.filter((a) => {
    if (fEstado === "critico" && a.estado !== "critico") return false;
    if (fEstado === "vencido" && a.estado === "critico") return false;
    if (fVend && (a.vendor_nome_no_venc ?? "") !== fVend) return false;
    if (fEtapa && a.etapa !== fEtapa) return false;
    return true;
  });

  // dados do cliente (nome + último pedido) — uma consulta em lote, sem N+1
  const ids = [...new Set(rows.map((r) => r.ares_pessoa_id))];
  const info = new Map<number, { name: string | null; valor: number; total_orders: number }>();
  if (ids.length > 0) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data } = await sb.from("v_carteira_360")
      .select("ares_pessoa_id, name, avg_ticket_brl, total_orders").in("ares_pessoa_id", ids);
    for (const c of (data ?? []) as { ares_pessoa_id: number; name: string | null; avg_ticket_brl: number | null; total_orders: number | null }[]) {
      if (!info.has(c.ares_pessoa_id)) info.set(c.ares_pessoa_id, { name: c.name, valor: Number(c.avg_ticket_brl ?? 0), total_orders: c.total_orders ?? 0 });
    }
  }
  if (fCliente) rows = rows.filter((a) => (info.get(a.ares_pessoa_id)?.name ?? "").toLowerCase().includes(fCliente));

  // ── ordenação ────────────────────────────────────────────────────────────
  const ord = sp.ord ?? "atraso";
  rows = [...rows].sort((a, b) => {
    if (ord === "vencimento") return a.vence_em.localeCompare(b.vence_em);
    if (ord === "valor") return (info.get(b.ares_pessoa_id)?.valor ?? 0) - (info.get(a.ares_pessoa_id)?.valor ?? 0);
    if (ord === "vendedor") return (a.vendor_nome_no_venc ?? "").localeCompare(b.vendor_nome_no_venc ?? "");
    if (ord === "etapa") return a.etapa.localeCompare(b.etapa);
    return referenciaContador(a).getTime() - referenciaContador(b).getTime(); // maior atraso primeiro
  });

  const vendedores = [...new Set(alertas.map((a) => a.vendor_nome_no_venc).filter(Boolean))] as string[];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{SLA_PULSE_CSS}</style>
      <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#c8d8e8", fontSize: 12, fontFamily: theme.font.label, textDecoration: "none" }}>
        <ArrowLeft size={14} /> Visão Geral
      </Link>

      <PageHead
        title={fEstado === "critico" ? "Jornada crítica" : "Jornada até recorrência vencida"}
        desc={`${rows.length} cliente(s) · ${ctx.role === "vendedor" ? `escopo: ${ctx.routing_team ?? "—"}` : "todos os vendedores"} · contagem em horas corridas desde o último faturamento`}
      />

      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={AlertTriangle} title="Alertas abertos" desc="48h sem o próximo pedido = vencido · +24h sem ação outbound do vendedor = crítico" />

        {/* filtros */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0 16px" }}>
          <FiltroLink label="Todos" href={qs(sp, { estado: undefined })} ativo={!fEstado} />
          <FiltroLink label="Vencidos" href={qs(sp, { estado: "vencido" })} ativo={fEstado === "vencido"} />
          <FiltroLink label="Críticos" href={qs(sp, { estado: "critico" })} ativo={fEstado === "critico"} />
          {vendedores.map((v) => (
            <FiltroLink key={v} label={v} href={qs(sp, { vendedor: fVend === v ? undefined : v })} ativo={fVend === v} />
          ))}
          {Object.entries(ETAPA).map(([k, l]) => (
            <FiltroLink key={k} label={l} href={qs(sp, { etapa: fEtapa === k ? undefined : k })} ativo={fEtapa === k} />
          ))}
        </div>

        {rows.length === 0 ? (
          <p style={{ fontSize: 12, color: "#83879a", fontFamily: theme.font.label }}>
            Nenhum alerta aberto neste recorte. {alertas.length === 0 ? "Se a tabela jornada_alertas ainda não foi criada, rode a migration e o cron." : ""}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, fontFamily: theme.font.label }}>
              <thead>
                <tr style={{ color: "#83879a", textAlign: "left" }}>
                  {["Cliente", "Vendedor", "Setor", "Etapa", "Faturado em", "Vence em", "Crítico em", "Atraso", "Ação", "Estado", "Próximo", "Registrar"].map((h) => (
                    <th key={h} style={{ padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,.1)", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const c = info.get(a.ares_pessoa_id);
                  const crit = a.estado === "critico";
                  return (
                    <tr key={a.id} style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                      <td style={{ padding: "7px 8px" }}>
                        <Link href={`/dashboard/jornada/cliente/${a.ares_pessoa_id}`} style={{ color: "#c8d8e8", textDecoration: "none" }}>
                          {c?.name ?? `Cliente ${a.ares_pessoa_id}`}
                        </Link>
                      </td>
                      <td style={{ padding: "7px 8px", color: "#aeb7cc" }}>{a.vendor_nome_no_venc ?? "—"}</td>
                      <td style={{ padding: "7px 8px", color: "#83879a", fontSize: 10.5 }}>{a.routing_team_no_venc ?? "—"}</td>
                      <td style={{ padding: "7px 8px", color: "#aeb7cc" }}>{ETAPA[a.etapa] ?? a.etapa}</td>
                      <td style={{ padding: "7px 8px", color: "#83879a", fontFamily: theme.font.num, whiteSpace: "nowrap" }}>{dt(a.faturado_em)}</td>
                      <td style={{ padding: "7px 8px", color: "#83879a", fontFamily: theme.font.num, whiteSpace: "nowrap" }}>{dt(a.vence_em)}</td>
                      <td style={{ padding: "7px 8px", color: "#83879a", fontFamily: theme.font.num, whiteSpace: "nowrap" }}>{dt(a.critico_em)}</td>
                      <td className={crit ? "asb-pulse-sla" : undefined} style={{ padding: "7px 8px", color: crit ? SLA_COLORS.red : SLA_COLORS.amber, fontWeight: 700, fontFamily: theme.font.num, whiteSpace: "nowrap" }}>
                        {rotuloAtraso(referenciaContador(a), agora)}
                      </td>
                      <td style={{ padding: "7px 8px", color: a.acao_em ? SLA_COLORS.green : "#6b7280", fontSize: 10.5, whiteSpace: "nowrap" }}>
                        {a.acao_em ? `sim · ${dt(a.acao_em)}` : "sem ação"}
                      </td>
                      <td style={{ padding: "7px 8px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: crit ? SLA_COLORS.red : SLA_COLORS.amber, background: "rgba(255,255,255,.06)", borderRadius: 999, padding: "1px 7px" }}>{a.estado}</span>
                      </td>
                      <td style={{ padding: "7px 8px", color: "#83879a", fontSize: 10.5 }}>{PROX[a.etapa] ?? "—"}</td>
                      <td style={{ padding: "7px 8px" }}><RegistrarContatoBtn alertaId={a.id} jaRegistrado={!!a.acao_em} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function qs(sp: Record<string, string | undefined>, patch: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return `/dashboard/jornada/alertas${s ? `?${s}` : ""}`;
}

function FiltroLink({ label, href, ativo }: { label: string; href: string; ativo: boolean }) {
  return (
    <Link href={href} style={{
      fontSize: 10.5, fontFamily: theme.font.label, textDecoration: "none",
      color: ativo ? "#fff" : "#aeb7cc",
      background: ativo ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.05)",
      border: `1px solid rgba(255,255,255,${ativo ? ".3" : ".1"})`,
      borderRadius: 999, padding: "3px 10px",
    }}>{label}</Link>
  );
}
