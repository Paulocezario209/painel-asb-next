"use client";

// Pipeline V3 Passo 11 (§12.7) — fila de aprovação de perda do Gerente Comercial.
// Mini-pipeline própria do gerente: cada card audita etapa de origem, comunicação,
// motivo e contexto já extraído da conversa, sugere se a cadência de retorno seria
// curta (ativa) ou longa (nutrição) pelo tempo de silêncio, e reusa o MESMO Estrategista
// (/api/pipeline/suggest) já usado no board — "mesma fonte de inteligência da pipeline"
// (Paulo, 2026-08-06) — em vez de criar um gerador de sugestão paralelo.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { SectionHead } from "@/app/dashboard/lib/ui";
import { stageLabel } from "@/lib/funnel/stages";
import { ShieldAlert } from "lucide-react";

const F = { label: theme.font.label, num: theme.font.num };

// Mesmas 11 etapas aceitas por mark_lead_loss_rejected (fonte: migration Passo 11) —
// vendedor não move pós-conversão manualmente, então o retorno oferece as mesmas opções.
const ETAPAS_RETORNO = [
  "agendamento", "em_andamento", "negociacao", "proposta", "cadastro_cliente",
  "aguardando_primeiro_pedido", "pedido_1", "pedido_2", "pedido_3", "pedido_4", "cliente_recorrente",
];

interface ContextoExtraido {
  resumo?: string;
  objecao?: string;
  produto?: string;
  gramatura?: string;
  recompra_dias?: string;
}

interface PerdaLead {
  id: string;
  phone: string;
  restaurant_name: string | null;
  name: string | null;
  city: string | null;
  segment: string | null;
  weekly_volume_kg: number | null;
  qual_stage: number | null;
  routing_team: string | null;
  loss_from_stage: string | null;
  loss_requested_at: string | null;
  loss_requested_by: string | null;
  lost_reason: string | null;
  lost_reason_detail: string | null;
  is_encosto: boolean | null;
  customer_exit_reason: string | null;
  last_reply_at: string | null;
  followup_phase: string | null;
  contexto_extraido: ContextoExtraido | null;
  first_order_at: string | null;
}

type Sugestao = { diagnostico: string; estrategia: string; mensagem_whatsapp: string; proximo_passo: string; suggestion_id?: string | null };

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function fmtRelativo(iso: string | null): string {
  if (!iso) return "—";
  const dias = diasDesde(iso);
  if (dias === null) return "—";
  if (dias < 1) return "hoje";
  if (dias === 1) return "1 dia atrás";
  return `${dias} dias atrás`;
}

// Mesma régua de fn_next_cadence_step (silence_days>=30 => LONGA) — só a PREVISÃO exibida
// aqui; a classificação real acontece no motor de cadência já existente após o retorno.
function previsaoCadencia(lastReplyAt: string | null): { label: string; cor: string } {
  const silencio = diasDesde(lastReplyAt);
  if (silencio === null) return { label: "sem histórico de resposta", cor: "#6b7488" };
  if (silencio >= 30) return { label: `LONGA (nutrição) — ${silencio}d de silêncio`, cor: "#8bb4ff" };
  return { label: `CURTA (ativa) — ${silencio}d de silêncio`, cor: "#22c55e" };
}

function BlocoEstrategista({ phone }: { phone: string }) {
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState<Sugestao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function gerar() {
    setAberto(true);
    if (data || carregando) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/pipeline/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }), // sem stage — cai no funnel_stage atual (perda_solicitada) no CP
      });
      const j = await res.json();
      if (!res.ok) { setErro(j?.error ?? "falha ao gerar sugestão"); return; }
      setData(j as Sugestao);
    } catch {
      setErro("falha de conexão");
    } finally {
      setCarregando(false);
    }
  }

  if (!aberto) {
    return (
      <button onClick={gerar} style={{
        background: "transparent", border: `1px solid ${theme.colors.borderDefault}`, borderRadius: 5,
        padding: "5px 12px", color: "#8bb4ff", fontSize: 10, fontFamily: F.label, fontWeight: 700, cursor: "pointer",
      }}>
        💡 Vale resgatar? Ver avaliação do Estrategista
      </button>
    );
  }

  return (
    <div style={{ background: "rgba(139,180,255,.06)", border: "1px solid rgba(139,180,255,.25)", borderRadius: 6, padding: 12, marginTop: 8 }}>
      {carregando && <p style={{ ...S.muted, fontSize: 10 }}>Avaliando se vale resgatar…</p>}
      {erro && <p style={{ color: "#f85149", fontSize: 10, fontFamily: F.label }}>{erro}</p>}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div>
            <span style={{ ...S.label, color: "#8bb4ff" }}>Diagnóstico</span>
            <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: F.label, marginTop: 2 }}>{data.diagnostico}</p>
          </div>
          <div>
            <span style={{ ...S.label, color: "#8bb4ff" }}>Estratégia</span>
            <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: F.label, marginTop: 2 }}>{data.estrategia}</p>
          </div>
          {data.mensagem_whatsapp && (
            <div>
              <span style={{ ...S.label, color: "#8bb4ff" }}>Mensagem sugerida (se decidir resgatar)</span>
              <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: F.label, marginTop: 2, whiteSpace: "pre-wrap" }}>{data.mensagem_whatsapp}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ lead, onDecidido }: { lead: PerdaLead; onDecidido: () => void }) {
  const [rejeitando, setRejeitando] = useState(false);
  const [etapaRetorno, setEtapaRetorno] = useState(lead.loss_from_stage && ETAPAS_RETORNO.includes(lead.loss_from_stage) ? lead.loss_from_stage : ETAPAS_RETORNO[0]);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const ctx = lead.contexto_extraido;
  const motivo = lead.lost_reason || lead.customer_exit_reason;
  const previsao = previsaoCadencia(lead.last_reply_at);
  const automatico = lead.loss_requested_by === "auto_mark_lost_cron";

  async function aprovar() {
    setSalvando(true); setErro(null);
    try {
      const res = await fetch("/api/lead/loss-approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      const j = await res.json();
      if (!res.ok) { setErro(j?.error ?? "falha ao aprovar"); return; }
      onDecidido();
    } catch { setErro("falha de conexão"); } finally { setSalvando(false); }
  }

  async function rejeitar() {
    if (!motivoRejeicao.trim()) { setErro("motivo da rejeição é obrigatório"); return; }
    setSalvando(true); setErro(null);
    try {
      const res = await fetch("/api/lead/loss-reject", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, return_stage: etapaRetorno, rejection_reason: motivoRejeicao }),
      });
      const j = await res.json();
      if (!res.ok) { setErro(j?.error ?? "falha ao rejeitar"); return; }
      onDecidido();
    } catch { setErro("falha de conexão"); } finally { setSalvando(false); }
  }

  return (
    <div style={{ ...S.card, padding: "14px 16px", borderLeft: `3px solid ${previsao.cor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
        <div>
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 700, fontFamily: F.label }}>
            {lead.restaurant_name || lead.name || lead.phone}
          </span>
          <span style={{ color: theme.colors.neutral, fontSize: 9, fontFamily: F.label, marginLeft: 8 }}>
            {lead.city || "—"}{lead.weekly_volume_kg ? ` · ${lead.weekly_volume_kg}kg/sem` : ""}
          </span>
        </div>
        <span style={{ ...S.label, color: previsao.cor, fontSize: 9 }}>{previsao.label}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8, fontSize: 10, fontFamily: F.label }}>
        <span style={{ ...S.muted }}>Etapa de origem: <b style={{ color: "#c8d8e8" }}>{stageLabel(lead.loss_from_stage)}</b></span>
        <span style={{ ...S.muted }}>
          Solicitado por: <b style={{ color: "#c8d8e8" }}>{automatico ? "🤖 automático (30d sem resposta)" : lead.loss_requested_by || "?"}</b>
          {lead.loss_requested_at ? ` · ${fmtRelativo(lead.loss_requested_at)}` : ""}
        </span>
        <span style={{ ...S.muted }}>Última resposta do lead: <b style={{ color: "#c8d8e8" }}>{fmtRelativo(lead.last_reply_at)}</b></span>
      </div>

      {motivo && (
        <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: F.label, marginTop: 8 }}>
          <span style={{ ...S.label, color: "#f59e0b" }}>Motivo: </span>{motivo}
          {lead.lost_reason_detail ? ` — ${lead.lost_reason_detail}` : ""}
        </p>
      )}
      {ctx?.resumo && (
        <p style={{ color: "#8b93a7", fontSize: 10, fontFamily: F.label, marginTop: 4, fontStyle: "italic" }}>
          Contexto da conversa: {ctx.resumo}{ctx.objecao ? ` · objeção: ${ctx.objecao}` : ""}
        </p>
      )}

      <BlocoEstrategista phone={lead.phone} />

      {erro && <p style={{ color: "#f85149", fontSize: 10, fontFamily: F.label, marginTop: 8 }}>{erro}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        {!rejeitando ? (
          <>
            <button onClick={aprovar} disabled={salvando} style={{
              background: theme.colors.critical, border: "none", borderRadius: 5, padding: "6px 14px",
              color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: F.label, cursor: salvando ? "wait" : "pointer",
            }}>
              Confirmar perda
            </button>
            <button onClick={() => setRejeitando(true)} disabled={salvando} style={{
              background: "transparent", border: `1px solid ${theme.colors.success}`, borderRadius: 5, padding: "6px 14px",
              color: theme.colors.success, fontSize: 10, fontWeight: 700, fontFamily: F.label, cursor: "pointer",
            }}>
              Resgatar — voltar pro funil
            </button>
          </>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ ...S.label }}>Retomar em:</span>
              <select value={etapaRetorno} onChange={e => setEtapaRetorno(e.target.value)}
                style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: "5px 10px", color: "#c8d8e8", fontSize: 11, fontFamily: F.label }}>
                {ETAPAS_RETORNO.map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}
              </select>
            </div>
            <textarea
              placeholder="Motivo da rejeição (obrigatório) — por que vale resgatar este lead?"
              value={motivoRejeicao} onChange={e => setMotivoRejeicao(e.target.value)}
              style={{ background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 5, padding: 8, color: "#c8d8e8", fontSize: 11, fontFamily: F.label, minHeight: 50, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={rejeitar} disabled={salvando} style={{
                background: theme.colors.success, border: "none", borderRadius: 5, padding: "6px 14px",
                color: "#fff", fontSize: 10, fontWeight: 700, fontFamily: F.label, cursor: salvando ? "wait" : "pointer",
              }}>
                Confirmar resgate
              </button>
              <button onClick={() => setRejeitando(false)} disabled={salvando} style={{
                background: "transparent", border: `1px solid ${theme.colors.borderDefault}`, borderRadius: 5, padding: "6px 14px",
                color: "#8b93a7", fontSize: 10, fontFamily: F.label, cursor: "pointer",
              }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PerdasPendentesGerente() {
  const router = useRouter();
  const [leads, setLeads] = useState<PerdaLead[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);

  // Efeito de montagem/refresh: dispara na montagem e sempre que `versao` muda (após
  // aprovar/rejeitar). Lógica inline (mesmo padrão de ModalSugestao em pipeline-board.tsx)
  // — evita apontar pra uma função nomeada externa dentro do efeito.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/gerente/perdas-pendentes");
        const j = await res.json();
        if (!vivo) return;
        if (!res.ok) { setErro(j?.error ?? "falha ao carregar fila"); return; }
        setLeads(j.leads ?? []);
      } catch {
        if (vivo) setErro("falha de conexão");
      }
    })();
    return () => { vivo = false; };
  }, [versao]);

  function onDecidido() {
    setVersao(v => v + 1);
    router.refresh();
  }

  return (
    <div style={{ ...S.card, padding: "20px 24px", borderTop: leads && leads.length > 0 ? "2px solid #f59e0b" : `2px solid ${theme.colors.success}` }}>
      <SectionHead
        Icon={ShieldAlert}
        color={leads && leads.length > 0 ? "#f59e0b" : theme.colors.success}
        title={leads && leads.length > 0 ? `Perdas Pendentes de Aprovação (${leads.length})` : "Perdas Pendentes de Aprovação"}
        desc="Toda perda — humana ou automática — espera aqui até você decidir"
      />
      {erro && <p style={{ color: "#f85149", fontSize: 11, fontFamily: F.label }}>{erro}</p>}
      {leads === null && !erro && <p style={{ ...S.muted, fontSize: 11 }}>Carregando…</p>}
      {leads && leads.length === 0 && (
        <p style={{ ...S.muted, color: theme.colors.success }}>✓ Nenhuma perda aguardando decisão.</p>
      )}
      {leads && leads.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {leads.map(l => <Card key={l.id} lead={l} onDecidido={onDecidido} />)}
        </div>
      )}
    </div>
  );
}
