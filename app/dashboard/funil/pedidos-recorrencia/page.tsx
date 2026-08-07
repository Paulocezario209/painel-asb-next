// app/dashboard/funil/pedidos-recorrencia/page.tsx — CRI F9 (tela 7/9): Pedidos e Recorrência.
// Estava PAUSADA aguardando a Pipeline Canônica V3 (concluída e mergeada). Mostra, por
// cliente com >=1 pedido faturado: o resumo de recorrência (estágio real no pipeline,
// ticket médio, intervalo médio entre pedidos, status de cadência) e — ao selecionar um
// cliente — o drill-down pedido-a-pedido (sequência completa, faturamento acumulado,
// intervalo em dias desde o pedido anterior). Fontes: v_cri_recorrencia_resumo (agregado,
// de customer_state) + v_cri_pedidos_sequencia (detalhe, de pedidos_espelho) — DEBT-093
// documenta que o espelho é incompleto pra histórico antigo; a coluna "no espelho" ao lado
// do total divulga esse gap em vez de escondê-lo.
import { createClient } from "@/lib/supabase/server";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, SectionHead, KpiCard } from "@/app/dashboard/lib/ui";
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { VENDOR_LABELS, VENDOR_ORDER, vendorLabel } from "@/lib/vendor-labels";
import Link from "next/link";
import { Users, RefreshCw, AlertTriangle, Clock3, TrendingUp, Search, ListOrdered, Info } from "lucide-react";

export const dynamic = "force-dynamic";

interface ResumoRow {
  ares_pessoa_id: number;
  cliente_nome: string;
  cliente_cidade: string | null;
  cliente_uf: string | null;
  vendedor_routing_team: string | null;
  vendedor_nome: string | null;
  estagio_pipeline: string | null;
  total_orders: number;
  total_revenue_brl: number;
  avg_ticket_brl: number | null;
  avg_order_interval_days: number | null;
  first_order_at: string | null;
  last_order_at: string | null;
  days_since_last_order: number | null;
  status_cadencia: "no_ritmo" | "atencao" | "atrasado" | null;
  pedidos_no_espelho: number;
}

interface SequenciaRow {
  ares_cliente_id: number;
  cliente_nome: string;
  ares_pedido_id: number;
  n_pedido: string | null;
  data_emissao: string | null;
  data_faturamento: string;
  valor_faturado_brl: number;
  numero_sequencia: number;
  faturamento_acumulado_brl: number;
  dias_desde_pedido_anterior: number | null;
}

const STATUS_OPCOES = [
  { v: "no_ritmo", label: "No ritmo" },
  { v: "atencao", label: "Atenção" },
  { v: "atrasado", label: "Atrasado" },
];

const STATUS_COR: Record<string, string> = {
  no_ritmo: "#22c55e",
  atencao: "#D4A017",
  atrasado: "#C8102E",
};

const STATUS_LABEL: Record<string, string> = {
  no_ritmo: "No ritmo",
  atencao: "Atenção",
  atrasado: "Atrasado",
};

function fmtBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtData(v: string | null): string {
  if (!v) return "—";
  return new Date(v + "T00:00:00").toLocaleDateString("pt-BR");
}

function fmtDiasInt(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v)}d`;
}

const selectStyle = {
  background: "var(--asb-card-hi)",
  border: "1px solid rgba(255,255,255,.14)",
  borderRadius: 5,
  padding: "6px 10px",
  color: "#c8d8e8",
  fontSize: 12,
};

export default async function PedidosRecorrenciaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/marketing")) redirect("/dashboard/funil");

  const sp = await searchParams;
  const busca = sp?.busca?.trim() || null;
  const routingTeam = sp?.routing_team || null;
  const statusCadencia = sp?.status && STATUS_OPCOES.some((o) => o.v === sp.status) ? sp.status : null;
  const clienteSelecionado = sp?.cliente && /^\d+$/.test(sp.cliente) ? Number(sp.cliente) : null;

  const supabase = await createClient();

  let query = supabase
    .from("v_cri_recorrencia_resumo")
    .select("*")
    .order("total_orders", { ascending: false })
    .limit(1000);
  if (busca) query = query.ilike("cliente_nome", `%${busca}%`);
  if (routingTeam) query = query.eq("vendedor_routing_team", routingTeam);
  if (statusCadencia) query = query.eq("status_cadencia", statusCadencia);

  const [{ data: resumoRaw, error: resumoErr }, { data: seqRaw }] = await Promise.all([
    query,
    clienteSelecionado
      ? supabase
          .from("v_cri_pedidos_sequencia")
          .select("*")
          .eq("ares_cliente_id", clienteSelecionado)
          .order("numero_sequencia", { ascending: true })
      : Promise.resolve({ data: null as SequenciaRow[] | null }),
  ]);

  const resumo = (resumoRaw ?? []) as ResumoRow[];
  const sequencia = (seqRaw ?? []) as SequenciaRow[];
  const clienteResumo = clienteSelecionado ? resumo.find((r) => r.ares_pessoa_id === clienteSelecionado) : null;

  const totalClientes = resumo.length;
  const noRitmo = resumo.filter((r) => r.status_cadencia === "no_ritmo").length;
  const emAtencao = resumo.filter((r) => r.status_cadencia === "atencao").length;
  const atrasados = resumo.filter((r) => r.status_cadencia === "atrasado").length;

  const filtrosAtivos = [busca, routingTeam, statusCadencia].some((v) => v != null);
  const qs = new URLSearchParams();
  if (busca) qs.set("busca", busca);
  if (routingTeam) qs.set("routing_team", routingTeam);
  if (statusCadencia) qs.set("status", statusCadencia);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Pedidos e Recorrência"
        desc="Ritmo de recompra por cliente — resumo agregado (customer_state) + drill-down pedido-a-pedido (pedidos_espelho)"
      />

      <form method="get" style={{ ...S.card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ ...S.label }}>Cliente</span>
        <input type="text" name="busca" defaultValue={busca ?? ""} placeholder="buscar por nome" style={{ ...selectStyle, width: 200 }} />
        <span style={{ ...S.label }}>Responsável</span>
        <select name="routing_team" defaultValue={routingTeam ?? ""} style={selectStyle}>
          <option value="">Todos</option>
          {VENDOR_ORDER.map((v) => (
            <option key={v} value={v}>{VENDOR_LABELS[v]}</option>
          ))}
        </select>
        <span style={{ ...S.label }}>Cadência</span>
        <select name="status" defaultValue={statusCadencia ?? ""} style={selectStyle}>
          <option value="">Todas</option>
          {STATUS_OPCOES.map((o) => (
            <option key={o.v} value={o.v}>{o.label}</option>
          ))}
        </select>
        <button type="submit" style={{ background: "#185FA5", border: "none", borderRadius: 5, padding: "7px 16px", color: "#fff", fontSize: 12, fontWeight: 650, cursor: "pointer" }}>
          Aplicar
        </button>
        {filtrosAtivos && (
          <Link href="/dashboard/funil/pedidos-recorrencia" style={{ color: "#c0d0e0", fontSize: 11 }}>
            limpar filtros
          </Link>
        )}
      </form>

      {resumoErr ? (
        <div style={{ ...S.card, padding: 20, borderTop: "2px solid #C8102E" }}>
          <p style={{ color: "#C8102E" }}>Erro ao carregar dados: {resumoErr.message}</p>
        </div>
      ) : (
        <>
          <div className="asb-grid-kpi">
            <KpiCard label="Clientes com Pedido" value={String(totalClientes)} Icon={Users} accent="#185FA5" num="#FFFFFF" note="pelo menos 1 pedido faturado" />
            <KpiCard label="No Ritmo" value={String(noRitmo)} Icon={TrendingUp} accent="#22c55e" num="#22c55e" note="dentro do intervalo médio histórico" />
            <KpiCard label="Em Atenção" value={String(emAtencao)} Icon={Clock3} accent="#D4A017" num="#D4A017" note="1,3x a 2x do intervalo médio sem novo pedido" />
            <KpiCard label="Atrasados" value={String(atrasados)} Icon={AlertTriangle} accent="#C8102E" num="#C8102E" note="mais de 2x o intervalo médio sem novo pedido" />
          </div>

          <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(212,160,23,.06)", border: "1px solid rgba(212,160,23,.3)" }}>
            <Info size={16} color="#D4A017" style={{ flexShrink: 0, marginTop: 2 }} />
            <p style={{ ...S.muted, fontSize: 11.5, lineHeight: 1.5 }}>
              <b style={{ color: "#D4A017" }}>Leitura da coluna &quot;pedidos&quot;:</b> o número principal vem de <code>customer_state</code> (agregado
              confiável, backfill híbrido direto do ARES). O número entre parênteses é quantos desses pedidos aparecem no drill-down abaixo —
              <code> pedidos_espelho</code> ainda não cobre todo o histórico antigo (<b>DEBT-093</b>, aberto desde 2026-05-29). Quando os dois números
              divergem, o cliente tem pedidos reais que não dá pra listar individualmente ainda — não é erro de contagem.
            </p>
          </div>

          <div style={{ ...S.card, padding: "20px 24px" }}>
            <SectionHead Icon={ListOrdered} color="#185FA5" title="Recorrência por Cliente" desc={`${resumo.length} cliente${resumo.length === 1 ? "" : "s"} · clique no nome para ver a sequência de pedidos`} />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                    {["Cliente", "Cidade/UF", "Responsável", "Estágio", "Pedidos", "Faturamento Total", "Ticket Médio", "Intervalo Médio", "Últ. Pedido", "Cadência"].map((h) => (
                      <th key={h} style={{ ...S.label, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resumo.map((r) => (
                    <tr
                      key={r.ares_pessoa_id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,.06)",
                        background: r.ares_pessoa_id === clienteSelecionado ? "rgba(24,95,165,.10)" : undefined,
                      }}
                    >
                      <td style={{ padding: "10px 10px" }}>
                        <Link
                          href={`/dashboard/funil/pedidos-recorrencia?${qs.toString()}${qs.toString() ? "&" : ""}cliente=${r.ares_pessoa_id}#sequencia`}
                          style={{ color: "#c8d8e8", fontSize: 12, textDecoration: "none", fontWeight: 600 }}
                        >
                          {r.cliente_nome}
                        </Link>
                      </td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>
                        {r.cliente_cidade ? `${r.cliente_cidade}${r.cliente_uf ? "/" + r.cliente_uf : ""}` : "—"}
                      </td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{vendorLabel(r.vendedor_routing_team)}</td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{r.estagio_pipeline ?? "—"}</td>
                      <td style={{ ...S.value, fontSize: 13, padding: "10px 10px" }}>
                        {r.total_orders}
                        {r.pedidos_no_espelho !== r.total_orders && (
                          <span style={{ color: "#83879a", fontSize: 10.5 }}> ({r.pedidos_no_espelho} no espelho)</span>
                        )}
                      </td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>{fmtBRL(r.total_revenue_brl)}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>{fmtBRL(r.avg_ticket_brl)}</td>
                      <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>
                        {r.avg_order_interval_days != null ? `${r.avg_order_interval_days.toFixed(0)}d` : "—"}
                      </td>
                      <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>
                        {fmtData(r.last_order_at)}
                        {r.days_since_last_order != null && (
                          <span style={{ color: "#83879a", fontSize: 10.5 }}> ({fmtDiasInt(r.days_since_last_order)} atrás)</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 10px" }}>
                        {r.status_cadencia ? (
                          <span style={{ fontSize: 10, fontFamily: "var(--font-geist-sans)", padding: "2px 8px", borderRadius: 999, background: `${STATUS_COR[r.status_cadencia]}22`, color: STATUS_COR[r.status_cadencia] }}>
                            {STATUS_LABEL[r.status_cadencia]}
                          </span>
                        ) : (
                          <span style={{ ...S.muted, fontSize: 10.5 }}>1º pedido</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {resumo.length === 0 && (
                    <tr><td colSpan={10} style={{ ...S.muted, padding: 20, textAlign: "center" }}>Nenhum cliente encontrado com esses filtros.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {resumo.length >= 1000 && (
              <p style={{ ...S.muted, fontSize: 10, marginTop: 8 }}>Limite de 1000 linhas atingido — refine os filtros (busca por nome) para uma lista mais específica.</p>
            )}
          </div>

          {clienteSelecionado && (
            <div id="sequencia" style={{ ...S.card, padding: "20px 24px" }}>
              <SectionHead
                Icon={Search}
                color="#8bb4ff"
                title={`Sequência de Pedidos — ${clienteResumo?.cliente_nome ?? sequencia[0]?.cliente_nome ?? `cliente ${clienteSelecionado}`}`}
                desc={
                  clienteResumo && clienteResumo.pedidos_no_espelho !== clienteResumo.total_orders
                    ? `Mostrando ${sequencia.length} de ${clienteResumo.total_orders} pedidos totais — o restante é anterior ao alcance atual do espelho (DEBT-093)`
                    : `${sequencia.length} pedido${sequencia.length === 1 ? "" : "s"}`
                }
              />
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,.12)" }}>
                      {["#", "Pedido", "Emissão", "Faturamento", "Valor", "Acumulado", "Desde Anterior"].map((h) => (
                        <th key={h} style={{ ...S.label, textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sequencia.map((p) => (
                      <tr key={p.ares_pedido_id} style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                        <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>{p.numero_sequencia}º</td>
                        <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{p.n_pedido ?? p.ares_pedido_id}</td>
                        <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{fmtData(p.data_emissao)}</td>
                        <td style={{ ...S.value, fontSize: 11.5, padding: "10px 10px" }}>{fmtData(p.data_faturamento)}</td>
                        <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>{fmtBRL(p.valor_faturado_brl)}</td>
                        <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px", color: "#22c55e" }}>{fmtBRL(p.faturamento_acumulado_brl)}</td>
                        <td style={{ ...S.value, fontSize: 12.5, padding: "10px 10px" }}>
                          {p.dias_desde_pedido_anterior != null ? (
                            <>
                              <RefreshCw size={11} style={{ display: "inline", marginRight: 4, verticalAlign: "-1px" }} />
                              {p.dias_desde_pedido_anterior}d
                            </>
                          ) : (
                            <span style={{ ...S.muted }}>1º pedido</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {sequencia.length === 0 && (
                      <tr><td colSpan={7} style={{ ...S.muted, padding: 20, textAlign: "center" }}>Nenhum pedido no espelho pra este cliente.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
