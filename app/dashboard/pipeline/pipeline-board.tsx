// app/dashboard/pipeline/pipeline-board.tsx — P1: Kanban interativo (drag-drop HTML5, sem lib).
// asb-painel-design-system: tokens, cores semânticas por stage, cards, modais backdrop-blur.
// Move ESCREVE em produção via /api/pipeline/move. Otimista com rollback de card se a RPC falhar.
"use client";

import { useEffect, useState } from "react";
import { MOVIVEIS, LOST_REASONS, STAGE_COLORS } from "@/lib/funnel/stages";
import { theme } from "@/lib/theme";
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
  // Reconciliação 2026-07-08 (G1-G3 da qualificação → contexto do vendedor)
  motivo_handoff: string | null;
  interesse_preco: boolean | null;
  pediu_catalogo: boolean | null;
  // Redesenho 2026-07-09: true = lead faturou no ARES (v_carteira_360.lead_id) —
  // conversão CONFIRMADA, independe do arraste manual do vendedor.
  ares_confirmado?: boolean;
};
export type PipelineCtx = { isGestor: boolean; routing_team: string | null; canMoveAll: boolean };


// Cores semânticas por etapa (asb-dashboard-elite — cor com propósito, não decorativa).
// Rótulos de COLUNA (view do board — "Convertido" é projeção, ver lib/funnel/stages).
// Cores: fonte única STAGE_COLORS (DEBT-157).
const COL_LABEL: Record<string, string> = {
  handoff: "Handoff", lead_em_andamento: "Em Andamento", negociacao: "Negociação",
  proposta_enviada: "Proposta", pedido_teste: "Pedido Teste",
  pedido_fechado: "Convertido", lead_perdido: "Perdido",
};
const STAGE_COL: Record<string, { label: string; cor: string }> = Object.fromEntries(
  Object.entries(COL_LABEL).map(([k, label]) => [k, { label, cor: STAGE_COLORS[k] ?? "#c0d0e0" }]),
);

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
  | { tipo: "sugestao"; lead: PipelineLead; stage: string }
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
        <div style={{ border: "1px solid #C8102E", background: "rgba(200,16,46,.08)", borderRadius: 6, padding: "8px 12px", color: "#ff6b6b", fontSize: 11, fontFamily: theme.font.label }}>
          {erro} <button onClick={() => setErro("")} style={{ background: "none", border: "none", color: "#c0d0e0", cursor: "pointer", marginLeft: 8 }}>×</button>
        </div>
      )}

      {/* Board horizontal */}
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8, flex: 1, minHeight: 0 }}>
        {stages.map((stage) => {
          const col = STAGE_COL[stage] ?? { label: stage, cor: "#c0d0e0" };
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
                  <span style={{ color: "#e0e6ef", fontSize: 10, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{col.label}</span>
                </div>
                <span style={{ color: col.cor, fontSize: 11, fontFamily: theme.font.num, fontWeight: 700 }}>{leads.length}</span>
              </div>

              {/* Cards (área droppable) */}
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 7, overflowY: "auto", flex: 1, minHeight: 80 }}>
                {leads.length === 0 && (
                  <span style={{ color: "#3a4452", fontSize: 9, fontFamily: theme.font.label, textAlign: "center", padding: "16px 0" }}>
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
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 3 }}>
                        <div style={{ flex: 1, color: "#fff", fontSize: 11, fontFamily: theme.font.label, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {lead.restaurant_name || "Lead sem nome"}
                        </div>
                        {/* 💡 Estrategista (asb-deal-strategies, Fase A): sugestão por etapa p/ copiar */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setModal({ tipo: "sugestao", lead, stage }); }}
                          title="Sugestão do estrategista para esta etapa"
                          style={{ background: "transparent", border: "1px solid #2e2e2e", borderRadius: 4, cursor: "pointer", fontSize: 10, lineHeight: 1, padding: "3px 5px", color: "#e4e9f0" }}
                        >💡</button>
                      </div>
                      <div style={{ display: "flex", gap: 8, color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, flexWrap: "wrap" }}>
                        {lead.weekly_volume_kg ? <span>{lead.weekly_volume_kg}kg</span> : null}
                        {lead.city ? <span>· {lead.city}</span> : null}
                        {dias != null ? <span style={{ color: dias > 7 ? "#f59e0b" : "#e4e9f0" }}>· {dias}d</span> : null}
                      </div>
                      {/* Chips de contexto da qualificação (G1-G3) — mudam a abordagem do vendedor */}
                      {(lead.ares_confirmado || lead.motivo_handoff === "insistencia_preco" || lead.interesse_preco || lead.pediu_catalogo) && (
                        <div style={{ display: "flex", gap: 4, marginTop: 5, flexWrap: "wrap" }}>
                          {lead.ares_confirmado && (
                            <span title="Conversão confirmada — este lead já faturou no ARES"
                              style={{ fontSize: 8, fontFamily: theme.font.label, color: "#22c55e", border: "1px solid rgba(34,197,94,.4)", borderRadius: 3, padding: "1px 5px" }}>✓ ARES</span>
                          )}
                          {lead.motivo_handoff === "insistencia_preco" && (
                            <span title="Veio por insistência de preço — NÃO abrir com preço; ancorar valor"
                              style={{ fontSize: 8, fontFamily: theme.font.label, color: "#f59e0b", border: "1px solid rgba(245,158,11,.4)", borderRadius: 3, padding: "1px 5px" }}>⚡ PREÇO</span>
                          )}
                          {lead.motivo_handoff !== "insistencia_preco" && lead.interesse_preco && (
                            <span title="Perguntou preço durante a qualificação"
                              style={{ fontSize: 8, fontFamily: theme.font.label, color: "#e4e9f0", border: "1px solid #2e2e2e", borderRadius: 3, padding: "1px 5px" }}>perguntou preço</span>
                          )}
                          {lead.pediu_catalogo && (
                            <span title="Pediu catálogo/portfólio"
                              style={{ fontSize: 8, fontFamily: theme.font.label, color: "#e4e9f0", border: "1px solid #2e2e2e", borderRadius: 3, padding: "1px 5px" }}>📋 catálogo</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {moving && <div style={{ color: "#2ea043", fontSize: 10, fontFamily: theme.font.label }}>movendo…</div>}

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
      {/* Modal sugestão do estrategista (Fase A: gerar + copiar) */}
      {modal?.tipo === "sugestao" && (
        <ModalSugestao lead={modal.lead} stage={modal.stage} onClose={() => setModal(null)} />
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
      <p style={{ color: "#fff", fontSize: 12, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Registrar Proposta</p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, marginBottom: 14 }}>{lead.restaurant_name || "Lead"} → Proposta Enviada</p>
      <label style={{ color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>Valor da proposta (R$)</label>
      <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus
        style={{ width: "100%", marginTop: 4, marginBottom: 12, background: "#0d1117", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: theme.font.label, outline: "none" }} />
      <label style={{ color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>Notas (opcional)</label>
      <input value={notas} onChange={(e) => setNotas(e.target.value)}
        style={{ width: "100%", marginTop: 4, marginBottom: 16, background: "#0d1117", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: theme.font.label, outline: "none" }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <BtnCancel onClick={onCancel} />
        <button disabled={!valido} onClick={() => onConfirm(v, notas.trim() || null)}
          style={{ background: valido ? "#8b5cf6" : "#2e2e2e", border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, cursor: valido ? "pointer" : "default" }}>
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
      <p style={{ color: "#C8102E", fontSize: 12, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Marcar como Perdido</p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, marginBottom: 6 }}>{lead.restaurant_name || "Lead"} → Perdido</p>
      <p style={{ color: "#f59e0b", fontSize: 10, fontFamily: theme.font.label, marginBottom: 14, lineHeight: 1.5 }}>
        ⚠ Ação destrutiva: encerra o atendimento (human_active=false, lost_at). Confirme o motivo.
      </p>
      <label style={{ color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>Motivo</label>
      <select value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
        style={{ width: "100%", marginTop: 4, marginBottom: 12, background: "#0d1117", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: theme.font.label, outline: "none" }}>
        <option value="">Selecione…</option>
        {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <label style={{ color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>Detalhe (opcional)</label>
      <input value={detail} onChange={(e) => setDetail(e.target.value)}
        style={{ width: "100%", marginTop: 4, marginBottom: 16, background: "#0d1117", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: theme.font.label, outline: "none" }} />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <BtnCancel onClick={onCancel} />
        <button disabled={!reason} onClick={() => onConfirm(reason, detail.trim() || null)}
          style={{ background: reason ? "#C8102E" : "#2e2e2e", border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, cursor: reason ? "pointer" : "default" }}>
          Confirmar perda
        </button>
      </div>
    </Backdrop>
  );
}

function ModalFechar({ lead, onConfirm, onCancel }: { lead: PipelineLead; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Backdrop>
      <p style={{ color: "#22c55e", fontSize: 12, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>Confirmar Conversão</p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, marginBottom: 14 }}>{lead.restaurant_name || "Lead"} → Convertido (1ª compra) · o ARES confirma quando faturar</p>
      <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: theme.font.label, marginBottom: 18, lineHeight: 1.5 }}>
        Marca o lead como convertido (grava <span style={{ color: "#22c55e" }}>first_order_at</span>). Confirma o fechamento do pedido?
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <BtnCancel onClick={onCancel} />
        <button onClick={onConfirm}
          style={{ background: "#22c55e", border: "none", borderRadius: 6, padding: "8px 16px", color: "#04210f", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, cursor: "pointer" }}>
          Confirmar fechamento
        </button>
      </div>
    </Backdrop>
  );
}

// Modal de lista expandida da etapa — só leitura; cada linha abre o lead.
// Cards clicáveis fase 2 (pedido Paulo): KPI abre a lista correspondente no
// mesmo ModalLista das colunas. leads=undefined → card estático.
export function PipelineKpis({ kpis }: {
  kpis: { label: string; value: string; accent: string; sub: string; leads?: PipelineLead[] }[];
}) {
  const [open, setOpen] = useState<number | null>(null);
  const router = useRouter();
  const card: React.CSSProperties = { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8 };
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {kpis.map((k, i) => (
          <div
            key={k.label}
            onClick={() => k.leads && setOpen(i)}
            style={{ ...card, padding: "16px 18px", borderTop: `2px solid ${k.accent}`, cursor: k.leads ? "pointer" : "default" }}
          >
            <p style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#e4e9f0", fontFamily: theme.font.label, marginBottom: 8 }}>{k.label}</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{k.value}</p>
            <p style={{ color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, marginTop: 6 }}>{k.sub}{k.leads ? " · clique p/ ver a lista" : ""}</p>
          </div>
        ))}
      </div>
      {open !== null && kpis[open]?.leads && (
        <ModalLista
          stage={kpis[open].label}
          leads={kpis[open].leads!}
          onClose={() => setOpen(null)}
          onOpenLead={(phone) => router.push(`/dashboard/leads/${phone}`)}
        />
      )}
    </>
  );
}

function ModalLista({ stage, leads, onClose, onOpenLead }: { stage: string; leads: PipelineLead[]; onClose: () => void; onOpenLead: (phone: string) => void }) {
  const col = STAGE_COL[stage] ?? { label: stage, cor: "#c0d0e0" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.6)", backdropFilter: "blur(3px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(580px, calc(100vw - 32px))", maxHeight: "80vh", display: "flex", flexDirection: "column", background: "#141414", border: `1px solid ${col.cor}`, borderRadius: 10, boxShadow: "0 24px 48px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #262626" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: col.cor }} />
            <span style={{ color: "#fff", fontSize: 12, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{col.label}</span>
            <span style={{ color: col.cor, fontSize: 12, fontFamily: theme.font.num, fontWeight: 700 }}>{leads.length}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#c0d0e0", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: "auto", padding: 6 }}>
          {leads.map((l) => {
            const dias = diasDesde(l.handoff_at);
            return (
              <div key={l.id} onClick={() => l.phone && onOpenLead(l.phone)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", borderRadius: 6, cursor: l.phone ? "pointer" : "default", borderBottom: "1px solid #1c1c1c" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#fff", fontSize: 12, fontFamily: theme.font.label, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.restaurant_name || "Lead sem nome"}</div>
                  <div style={{ color: "#c0d0e0", fontSize: 10, fontFamily: theme.font.label, marginTop: 2 }}>
                    {l.weekly_volume_kg ? `${l.weekly_volume_kg}kg` : "—"}{l.city ? ` · ${l.city}` : ""}
                  </div>
                </div>
                <span style={{ color: dias != null && dias > 7 ? "#f59e0b" : "#e4e9f0", fontSize: 10, fontFamily: theme.font.label, flexShrink: 0 }}>{dias != null ? `${dias}d` : ""}</span>
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
    <button onClick={onClick} style={{ background: "transparent", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 16px", color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, cursor: "pointer" }}>
      Cancelar
    </button>
  );
}

// ── Modal Sugestão do Estrategista (asb-deal-strategies, Fase A) ─────────────
// Gera on-demand via /api/pipeline/suggest (CP /internal/deal/suggest → GPT com
// as regras da skill: nunca inventa preço, protege margem, mensagem curta).
// Fase A = COPIAR (o clique do vendedor no WhatsApp é a ação humana).
type Sugestao = { diagnostico: string; estrategia: string; mensagem_whatsapp: string; proximo_passo: string };

function ModalSugestao({ lead, stage, onClose }: { lead: PipelineLead; stage: string; onClose: () => void }) {
  const [data, setData] = useState<Sugestao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const res = await fetch("/api/pipeline/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: lead.phone, stage }),
        });
        const j = await res.json();
        if (!vivo) return;
        if (!res.ok) { setErro(j?.error ?? "falha ao gerar sugestão"); return; }
        setData(j as Sugestao);
      } catch {
        if (vivo) setErro("falha de conexão");
      }
    })();
    return () => { vivo = false; };
  }, [lead.phone, stage]);

  const copiar = async () => {
    if (!data?.mensagem_whatsapp) return;
    try {
      await navigator.clipboard.writeText(data.mensagem_whatsapp);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* clipboard bloqueado — usuário seleciona manualmente */ }
  };

  const bloco = (titulo: string, texto: string) => (
    <div style={{ marginBottom: 10 }}>
      <p style={{ color: "#e4e9f0", fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 3 }}>{titulo}</p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{texto}</p>
    </div>
  );

  return (
    <Backdrop>
      <p style={{ color: "#fff", fontSize: 12, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>
        💡 Estrategista · {STAGE_COL[stage]?.label ?? stage}
      </p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, marginBottom: 14 }}>
        {lead.restaurant_name || "Lead"}{lead.city ? ` · ${lead.city}` : ""}
      </p>

      {!data && !erro && (
        <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, padding: "12px 0" }}>gerando sugestão…</p>
      )}
      {erro && (
        <p style={{ color: "#f85149", fontSize: 11, fontFamily: theme.font.label, padding: "8px 0" }}>{erro}</p>
      )}
      {data && (
        <div style={{ maxHeight: "50vh", overflowY: "auto", paddingRight: 4 }}>
          {bloco("Diagnóstico", data.diagnostico)}
          {bloco("Estratégia", data.estrategia)}
          <div style={{ marginBottom: 10, background: "#0d1117", border: "1px solid #2e2e2e", borderRadius: 6, padding: "10px 12px" }}>
            <p style={{ color: "#e4e9f0", fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 4 }}>Mensagem sugerida (edite ao colar)</p>
            <p style={{ color: "#fff", fontSize: 11, fontFamily: theme.font.label, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{data.mensagem_whatsapp}</p>
          </div>
          {bloco("Próximo passo", data.proximo_passo)}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
        <BtnCancel onClick={onClose} />
        <button onClick={copiar} disabled={!data?.mensagem_whatsapp}
          style={{ background: copiado ? "#238636" : "#185FA5", border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, cursor: data?.mensagem_whatsapp ? "pointer" : "not-allowed", opacity: data?.mensagem_whatsapp ? 1 : 0.5 }}>
          {copiado ? "✓ Copiado" : "Copiar mensagem"}
        </button>
      </div>
    </Backdrop>
  );
}
