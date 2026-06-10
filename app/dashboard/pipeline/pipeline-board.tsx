// app/dashboard/pipeline/pipeline-board.tsx — P1: Kanban interativo (drag-drop HTML5, sem lib).
// asb-painel-design-system: tokens, cores semânticas por stage, cards, modais backdrop-blur.
// Move ESCREVE em produção via /api/pipeline/move. Otimista com rollback de card se a RPC falhar.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PipelineLead = {
  id: string;
  phone: string | null;
  restaurant_name: string | null;
  city: string | null;
  weekly_volume_kg: number | null;
  funnel_stage: string | null;
  routing_team: string | null;
  handoff_at: string | null;
  seller_first_reply_at: string | null;
  created_at: string;
};
export type PipelineCtx = { isGestor: boolean; routing_team: string | null; canMoveAll: boolean };

const mono = "'Courier New', monospace";

// Cores semânticas por etapa (asb-dashboard-elite — cor com propósito, não decorativa).
const STAGE_COL: Record<string, { label: string; cor: string }> = {
  handoff:           { label: "Handoff",      cor: "#f59e0b" },
  lead_em_andamento: { label: "Em Andamento", cor: "#eab308" },
  negociacao:        { label: "Negociação",   cor: "#a855f7" },
  proposta_enviada:  { label: "Proposta",     cor: "#8b5cf6" },
  pedido_teste:      { label: "Pedido Teste",  cor: "#3b82f6" },
  pedido_fechado:    { label: "Fechado",      cor: "#22c55e" },
  lead_perdido:      { label: "Perdido",      cor: "#C8102E" },
};

// handoff = origem (sem RPC). Demais são destinos de drag.
const MOVIVEIS = new Set(["lead_em_andamento", "negociacao", "proposta_enviada", "pedido_teste", "pedido_fechado", "lead_perdido"]);
const LOST_REASONS = ["Sem orcamento", "Comprou concorrente", "Sem interesse", "Sem retorno", "Outro"];

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms > 0 ? Math.floor(ms / 86400000) : 0;
}

type ModalState =
  | { tipo: "proposta"; lead: PipelineLead; from: string }
  | { tipo: "perdido"; lead: PipelineLead; from: string }
  | { tipo: "fechar"; lead: PipelineLead; from: string }
  | { tipo: "lista"; stage: string }
  | null;

export function PipelineBoard({
  byStage, stages, ctx,
}: { byStage: Record<string, PipelineLead[]>; stages: string[]; ctx: PipelineCtx }) {
  const router = useRouter();
  const [board, setBoard] = useState(byStage);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [erro, setErro] = useState("");
  const [moving, setMoving] = useState(false);

  function podeMover(lead: PipelineLead): boolean {
    return ctx.canMoveAll || ctx.routing_team === lead.routing_team;
  }

  async function persistir(lead: PipelineLead, from: string, to: string, extras: Record<string, unknown>) {
    setMoving(true); setErro("");
    const prev = board;
    // Otimista: move o card no board local
    setBoard((b) => {
      const nb: Record<string, PipelineLead[]> = { ...b };
      nb[from] = (nb[from] ?? []).filter((l) => l.id !== lead.id);
      nb[to] = [{ ...lead, funnel_stage: to }, ...(nb[to] ?? [])];
      return nb;
    });
    try {
      const res = await fetch("/api/pipeline/move", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, to_stage: to, ...extras }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      router.refresh(); // re-sincroniza do servidor (fonte de verdade)
    } catch (e) {
      setBoard(prev); // rollback do card
      setErro(`Falha ao mover ${lead.restaurant_name || "lead"}: ${(e as Error).message}`);
    } finally {
      setMoving(false); setModal(null); setDragId(null); setDragFrom(null); setOverCol(null);
    }
  }

  function onDrop(to: string) {
    const from = dragFrom;
    const id = dragId;
    setOverCol(null);
    if (!from || !id || from === to || !MOVIVEIS.has(to)) { setDragId(null); setDragFrom(null); return; }
    const lead = (board[from] ?? []).find((l) => l.id === id);
    if (!lead || !podeMover(lead)) { setErro("Sem permissão para mover este lead."); setDragId(null); setDragFrom(null); return; }
    // Transições com input → modal; demais → direto
    if (to === "proposta_enviada") { setModal({ tipo: "proposta", lead, from }); return; }
    if (to === "lead_perdido") { setModal({ tipo: "perdido", lead, from }); return; }
    if (to === "pedido_fechado") { setModal({ tipo: "fechar", lead, from }); return; } // confirma (seta first_order_at)
    persistir(lead, from, to, {});
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
      {erro && (
        <div style={{ border: "1px solid #C8102E", background: "rgba(200,16,46,.08)", borderRadius: 6, padding: "8px 12px", color: "#ff6b6b", fontSize: 11, fontFamily: mono }}>
          {erro} <button onClick={() => setErro("")} style={{ background: "none", border: "none", color: "#8899aa", cursor: "pointer", marginLeft: 8 }}>×</button>
        </div>
      )}

      {/* Board horizontal */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, flex: 1, minHeight: 0 }}>
        {stages.map((stage) => {
          const col = STAGE_COL[stage] ?? { label: stage, cor: "#8899aa" };
          const leads = board[stage] ?? [];
          const isDest = MOVIVEIS.has(stage);
          const isOver = overCol === stage;
          return (
            <div
              key={stage}
              onDragOver={(e) => { if (isDest && dragFrom && dragFrom !== stage) { e.preventDefault(); setOverCol(stage); } }}
              onDragLeave={() => setOverCol((c) => (c === stage ? null : c))}
              onDrop={() => onDrop(stage)}
              style={{
                width: 220, flexShrink: 0, display: "flex", flexDirection: "column",
                background: isOver ? `${col.cor}14` : "#141414",
                border: `1px solid ${isOver ? col.cor : "#262626"}`,
                borderRadius: 8, transition: "background .12s, border-color .12s",
              }}
            >
              {/* Header da coluna — clicável: abre modal com a lista da etapa */}
              <div
                onClick={() => { if (leads.length) setModal({ tipo: "lista", stage }); }}
                title={leads.length ? "Ver lista da etapa" : undefined}
                style={{ padding: "10px 12px", borderBottom: "1px solid #262626", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: leads.length ? "pointer" : "default" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: col.cor, flexShrink: 0 }} />
                  <span style={{ color: "#e0e6ef", fontSize: 10, fontFamily: mono, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{col.label}</span>
                </div>
                <span style={{ color: col.cor, fontSize: 11, fontFamily: mono, fontWeight: 700 }}>{leads.length}</span>
              </div>

              {/* Cards (área droppable) */}
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", flex: 1, minHeight: 80 }}>
                {leads.length === 0 && (
                  <span style={{ color: "#3a4452", fontSize: 9, fontFamily: mono, textAlign: "center", padding: "16px 0" }}>
                    {isOver ? "soltar aqui" : "—"}
                  </span>
                )}
                {leads.map((lead) => {
                  const movable = podeMover(lead);
                  const dias = diasDesde(lead.handoff_at);
                  return (
                    <div
                      key={lead.id}
                      draggable={movable && !moving}
                      onDragStart={() => { setDragId(lead.id); setDragFrom(stage); }}
                      onDragEnd={() => { setDragId(null); setDragFrom(null); setOverCol(null); }}
                      // Clique abre o lead (navegador suprime click após drag → não conflita). Param da rota = phone.
                      onClick={() => { if (!moving && lead.phone) router.push(`/dashboard/leads/${encodeURIComponent(lead.phone)}`); }}
                      title="Clique para abrir · arraste para mover de etapa"
                      style={{
                        background: dragId === lead.id ? "#0d1117" : "#1c1c1c",
                        border: `1px solid ${dragId === lead.id ? col.cor : "#2e2e2e"}`,
                        borderLeft: `3px solid ${col.cor}`,
                        borderRadius: 5, padding: "8px 10px",
                        cursor: movable ? "grab" : "not-allowed",
                        opacity: dragId === lead.id ? 0.5 : 1,
                      }}
                    >
                      <div style={{ color: "#fff", fontSize: 11, fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {lead.restaurant_name || "Lead sem nome"}
                      </div>
                      <div style={{ display: "flex", gap: 8, color: "#8899aa", fontSize: 9, fontFamily: mono, flexWrap: "wrap" }}>
                        {lead.weekly_volume_kg ? <span>{lead.weekly_volume_kg}kg</span> : null}
                        {lead.city ? <span>· {lead.city}</span> : null}
                        {dias != null ? <span style={{ color: dias > 7 ? "#f59e0b" : "#556677" }}>· {dias}d</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {moving && <div style={{ color: "#2ea043", fontSize: 10, fontFamily: mono }}>movendo…</div>}

      {/* Modal proposta (valor) */}
      {modal?.tipo === "proposta" && (
        <ModalProposta lead={modal.lead} onCancel={() => setModal(null)}
          onConfirm={(value, notes) => persistir(modal.lead, modal.from, "proposta_enviada", { proposal_value: value, proposal_notes: notes })} />
      )}
      {/* Modal perdido (motivo + confirmação destrutiva) */}
      {modal?.tipo === "perdido" && (
        <ModalPerdido lead={modal.lead} onCancel={() => setModal(null)}
          onConfirm={(reason, detail) => persistir(modal.lead, modal.from, "lead_perdido", { reason, detail })} />
      )}
      {/* Modal fechar (confirmação simples — seta first_order_at) */}
      {modal?.tipo === "fechar" && (
        <ModalFechar lead={modal.lead} onCancel={() => setModal(null)}
          onConfirm={() => persistir(modal.lead, modal.from, "pedido_fechado", {})} />
      )}
      {/* Modal lista da etapa (só leitura; linhas abrem o lead) */}
      {modal?.tipo === "lista" && (
        <ModalLista stage={modal.stage} leads={board[modal.stage] ?? []}
          onClose={() => setModal(null)}
          onOpenLead={(phone) => { setModal(null); router.push(`/dashboard/leads/${encodeURIComponent(phone)}`); }} />
      )}
    </div>
  );
}

// ── Modal: backdrop blur + card (asb-painel-design-system §3.6) ──────────────
function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(3px)" }}>
      <div style={{ width: "min(420px, calc(100vw - 32px))", background: "#141414", border: "1px solid #2e2e2e", borderRadius: 10, padding: 20, boxShadow: "0 24px 48px rgba(0,0,0,.5)" }}>
        {children}
      </div>
    </div>
  );
}

function ModalProposta({ lead, onConfirm, onCancel }: { lead: PipelineLead; onConfirm: (v: number, n: string | null) => void; onCancel: () => void }) {
  const [valor, setValor] = useState("");
  const [notas, setNotas] = useState("");
  const v = parseFloat(valor.replace(",", "."));
  const valido = !isNaN(v) && v > 0;
  return (
    <Backdrop>
      <p style={{ color: "#fff", fontSize: 12, fontFamily: mono, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Registrar Proposta</p>
      <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono, marginBottom: 14 }}>{lead.restaurant_name || "Lead"} → Proposta Enviada</p>
      <label style={{ color: "#8899aa", fontSize: 9, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" }}>Valor da proposta (R$)</label>
      <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus
        style={{ width: "100%", marginTop: 4, marginBottom: 12, background: "#0d1117", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: mono, outline: "none" }} />
      <label style={{ color: "#8899aa", fontSize: 9, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" }}>Notas (opcional)</label>
      <input value={notas} onChange={(e) => setNotas(e.target.value)}
        style={{ width: "100%", marginTop: 4, marginBottom: 16, background: "#0d1117", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: mono, outline: "none" }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <BtnCancel onClick={onCancel} />
        <button disabled={!valido} onClick={() => onConfirm(v, notas.trim() || null)}
          style={{ background: valido ? "#8b5cf6" : "#2e2e2e", border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontSize: 11, fontFamily: mono, fontWeight: 700, cursor: valido ? "pointer" : "default" }}>
          Registrar
        </button>
      </div>
    </Backdrop>
  );
}

function ModalPerdido({ lead, onConfirm, onCancel }: { lead: PipelineLead; onConfirm: (reason: string, detail: string | null) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  return (
    <Backdrop>
      <p style={{ color: "#C8102E", fontSize: 12, fontFamily: mono, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Marcar como Perdido</p>
      <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono, marginBottom: 6 }}>{lead.restaurant_name || "Lead"} → Perdido</p>
      <p style={{ color: "#f59e0b", fontSize: 10, fontFamily: mono, marginBottom: 14, lineHeight: 1.5 }}>
        ⚠ Ação destrutiva: encerra o atendimento (human_active=false, lost_at). Confirme o motivo.
      </p>
      <label style={{ color: "#8899aa", fontSize: 9, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" }}>Motivo</label>
      <select value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
        style={{ width: "100%", marginTop: 4, marginBottom: 12, background: "#0d1117", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: mono, outline: "none" }}>
        <option value="">Selecione…</option>
        {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <label style={{ color: "#8899aa", fontSize: 9, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" }}>Detalhe (opcional)</label>
      <input value={detail} onChange={(e) => setDetail(e.target.value)}
        style={{ width: "100%", marginTop: 4, marginBottom: 16, background: "#0d1117", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: mono, outline: "none" }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <BtnCancel onClick={onCancel} />
        <button disabled={!reason} onClick={() => onConfirm(reason, detail.trim() || null)}
          style={{ background: reason ? "#C8102E" : "#2e2e2e", border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontSize: 11, fontFamily: mono, fontWeight: 700, cursor: reason ? "pointer" : "default" }}>
          Confirmar perda
        </button>
      </div>
    </Backdrop>
  );
}

function ModalFechar({ lead, onConfirm, onCancel }: { lead: PipelineLead; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Backdrop>
      <p style={{ color: "#22c55e", fontSize: 12, fontFamily: mono, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Fechar Pedido</p>
      <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono, marginBottom: 14 }}>{lead.restaurant_name || "Lead"} → Fechado</p>
      <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: mono, marginBottom: 18, lineHeight: 1.5 }}>
        Marca o lead como convertido (grava <span style={{ color: "#22c55e" }}>first_order_at</span>). Confirma o fechamento do pedido?
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <BtnCancel onClick={onCancel} />
        <button onClick={onConfirm}
          style={{ background: "#22c55e", border: "none", borderRadius: 6, padding: "8px 16px", color: "#04210f", fontSize: 11, fontFamily: mono, fontWeight: 700, cursor: "pointer" }}>
          Confirmar fechamento
        </button>
      </div>
    </Backdrop>
  );
}

// Modal de lista expandida da etapa — só leitura; cada linha abre o lead.
function ModalLista({ stage, leads, onClose, onOpenLead }: { stage: string; leads: PipelineLead[]; onClose: () => void; onOpenLead: (phone: string) => void }) {
  const col = STAGE_COL[stage] ?? { label: stage, cor: "#8899aa" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(3px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(580px, calc(100vw - 32px))", maxHeight: "80vh", display: "flex", flexDirection: "column", background: "#141414", border: `1px solid ${col.cor}`, borderRadius: 10, boxShadow: "0 24px 48px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #262626" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: col.cor }} />
            <span style={{ color: "#fff", fontSize: 12, fontFamily: mono, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{col.label}</span>
            <span style={{ color: col.cor, fontSize: 12, fontFamily: mono, fontWeight: 700 }}>{leads.length}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8899aa", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: 6 }}>
          {leads.map((l) => {
            const dias = diasDesde(l.handoff_at);
            return (
              <div key={l.id} onClick={() => l.phone && onOpenLead(l.phone)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 6, cursor: l.phone ? "pointer" : "default", borderBottom: "1px solid #1c1c1c" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#fff", fontSize: 12, fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.restaurant_name || "Lead sem nome"}</div>
                  <div style={{ color: "#8899aa", fontSize: 10, fontFamily: mono, marginTop: 2 }}>
                    {l.weekly_volume_kg ? `${l.weekly_volume_kg}kg` : "—"}{l.city ? ` · ${l.city}` : ""}
                  </div>
                </div>
                <span style={{ color: dias != null && dias > 7 ? "#f59e0b" : "#556677", fontSize: 10, fontFamily: mono, flexShrink: 0 }}>{dias != null ? `${dias}d` : ""}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BtnCancel({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: "transparent", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 16px", color: "#8899aa", fontSize: 11, fontFamily: mono, cursor: "pointer" }}>
      Cancelar
    </button>
  );
}
