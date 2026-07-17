// app/dashboard/pipeline/pipeline-board.tsx — P1: Kanban interativo (drag-drop HTML5, sem lib).
// asb-painel-design-system: tokens, cores semânticas por stage, cards, modais backdrop-blur.
// Move ESCREVE em produção via /api/pipeline/move. Otimista com rollback de card se a RPC falhar.
"use client";

import { useEffect, useState } from "react";
import { MOVIVEIS, LOST_REASONS, STAGE_COLORS } from "@/lib/funnel/stages";
import { fichaCadastro, fichaOrcamento, pesoTotalKg, type OrcamentoItem } from "@/lib/fichas";
import { theme } from "@/lib/theme";
import { StatTile } from "@/app/dashboard/lib/ui";
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
  // Funil v3 Onda 2 (badges de sugestão): sinais que a IA usa p/ SUGERIR etapa
  // (nunca move — só nudge no card; o vendedor decide).
  cnpj: string | null;
  ares_pessoa_id: string | number | null;
};
export type PipelineCtx = { isGestor: boolean; routing_team: string | null; canMoveAll: boolean };
export type TopProduto = { routing_team: string | null; descricao_produto: string | null; rank: number };

// Gramatura = número final do nome do produto (100–220 g; siglas 100/110/…/220). Heurística leve.
function parseGramatura(nome: string): number | null {
  const nums = (nome.match(/\d{2,3}/g) ?? []).map(Number).filter((n) => n >= 50 && n <= 300);
  return nums.length ? nums[nums.length - 1] : null;
}


// Cores semânticas por etapa (asb-dashboard-elite — cor com propósito, não decorativa).
// Rótulos de COLUNA (view do board — "Convertido" é projeção, ver lib/funnel/stages).
// Cores: fonte única STAGE_COLORS (DEBT-157).
const COL_LABEL: Record<string, string> = {
  handoff: "Agendamento", lead_em_andamento: "Em Andamento", negociacao: "Negociação",
  proposta_enviada: "Proposta", cadastro_cliente: "Cadastro do Cliente",
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
  | { tipo: "ficha"; lead: PipelineLead }
  | { tipo: "orcamento"; lead: PipelineLead }
  | null;

export function PipelineBoard({
  byStage, stages, ctx, topProdutos = [],
}: { byStage: Record<string, PipelineLead[]>; stages: string[]; ctx: PipelineCtx; topProdutos?: TopProduto[] }) {
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
                background: isOver ? `${col.cor}14` : "var(--asb-card)",
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
                <span style={{ color: col.cor, fontSize: 11, fontFamily: theme.font.num, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{leads.length}</span>
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
                  // Onda 2 — badge de SUGESTÃO (a IA sinaliza pela etapa-alvo, NUNCA move):
                  //  · Agendamento + vendedor já respondeu → sugere Em Andamento
                  //  · Proposta + CNPJ/cadastro ARES capturado → sugere Cadastro do Cliente
                  const sugestao =
                    stage === "handoff" && lead.seller_first_reply_at
                      ? { txt: "respondeu → Em Andamento", cor: "#eab308" }
                      : stage === "proposta_enviada" && (lead.cnpj || lead.ares_pessoa_id)
                      ? { txt: "cadastro captado → Cadastro", cor: "#3b82f6" }
                      : null;
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
                        background: dragId === lead.id ? "var(--asb-card)" : "#1c1c1c",
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
                        {/* Onda 3 — botão "Enviar ficha" só na etapa Cadastro do Cliente */}
                        {stage === "cadastro_cliente" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setModal({ tipo: "ficha", lead }); }}
                            title="Enviar a ficha de cadastro ao lead (pelo seu WhatsApp)"
                            style={{ background: "transparent", border: "1px solid #2e2e2e", borderRadius: 4, cursor: "pointer", fontSize: 10, lineHeight: 1, padding: "3px 5px", color: "#e4e9f0" }}
                          >📋</button>
                        )}
                        {/* Onda 4b — botão "Orçamento" só na etapa Em Negociação */}
                        {stage === "negociacao" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setModal({ tipo: "orcamento", lead }); }}
                            title="Montar e enviar o orçamento ao lead (pelo seu WhatsApp)"
                            style={{ background: "transparent", border: "1px solid #2e2e2e", borderRadius: 4, cursor: "pointer", fontSize: 10, lineHeight: 1, padding: "3px 5px", color: "#e4e9f0" }}
                          >🧾</button>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, flexWrap: "wrap" }}>
                        {lead.weekly_volume_kg ? <span>{lead.weekly_volume_kg}kg</span> : null}
                        {lead.city ? <span>· {lead.city}</span> : null}
                        {dias != null ? <span style={{ color: dias > 7 ? "#f59e0b" : "#e4e9f0" }}>· {dias}d</span> : null}
                      </div>
                      {/* Onda 2 — nudge de sugestão de etapa (a IA sinaliza; só o vendedor move) */}
                      {sugestao && (
                        <div style={{ marginTop: 5 }}>
                          <span title="Sugestão da IA — os dados indicam esta etapa. Arraste o card se concordar (a IA nunca move sozinha)."
                            style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 8, fontFamily: theme.font.label, fontWeight: 600, color: sugestao.cor, border: `1px dashed ${sugestao.cor}`, background: `${sugestao.cor}14`, borderRadius: 3, padding: "1px 5px" }}>
                            💡 {sugestao.txt}
                          </span>
                        </div>
                      )}
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
      {modal?.tipo === "ficha" && (
        <ModalFicha lead={modal.lead} onClose={() => setModal(null)} />
      )}
      {modal?.tipo === "orcamento" && (
        <ModalOrcamento lead={modal.lead} onClose={() => setModal(null)}
          sugestoes={topProdutos.filter(p => p.routing_team === modal.lead.routing_team)} />
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
      <div style={{ width: "min(420px, calc(100vw - 32px))", background: "var(--asb-card)", border: "1px solid #2e2e2e", borderRadius: 10, padding: 20, boxShadow: "0 24px 48px rgba(0,0,0,.5)" }}>
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
      <p style={{ color: "#fff", fontSize: 14, fontFamily: theme.font.label, fontWeight: 750, letterSpacing: "-.01em", marginBottom: 4 }}>Registrar Proposta</p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, marginBottom: 14 }}>{lead.restaurant_name || "Lead"} → Proposta Enviada</p>
      <label style={{ color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>Valor da proposta (R$)</label>
      <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus
        style={{ width: "100%", marginTop: 4, marginBottom: 12, background: "var(--asb-card)", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: theme.font.label, outline: "none" }} />
      <label style={{ color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>Notas (opcional)</label>
      <input value={notas} onChange={(e) => setNotas(e.target.value)}
        style={{ width: "100%", marginTop: 4, marginBottom: 16, background: "var(--asb-card)", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: theme.font.label, outline: "none" }} />
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
      <p style={{ color: "#C8102E", fontSize: 14, fontFamily: theme.font.label, fontWeight: 750, letterSpacing: "-.01em", marginBottom: 4 }}>Marcar como Perdido</p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, marginBottom: 6 }}>{lead.restaurant_name || "Lead"} → Perdido</p>
      <p style={{ color: "#f59e0b", fontSize: 10, fontFamily: theme.font.label, marginBottom: 14, lineHeight: 1.5 }}>
        ⚠ Ação destrutiva: encerra o atendimento (human_active=false, lost_at). Confirme o motivo.
      </p>
      <label style={{ color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>Motivo</label>
      <select value={reason} onChange={(e) => setReason(e.target.value)} autoFocus
        style={{ width: "100%", marginTop: 4, marginBottom: 12, background: "var(--asb-card)", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: theme.font.label, outline: "none" }}>
        <option value="">Selecione…</option>
        {LOST_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <label style={{ color: "#c0d0e0", fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" }}>Detalhe (opcional)</label>
      <input value={detail} onChange={(e) => setDetail(e.target.value)}
        style={{ width: "100%", marginTop: 4, marginBottom: 16, background: "var(--asb-card)", border: "1px solid #2e2e2e", borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 12, fontFamily: theme.font.label, outline: "none" }} />
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
      <p style={{ color: "#22c55e", fontSize: 14, fontFamily: theme.font.label, fontWeight: 750, letterSpacing: "-.01em", marginBottom: 4 }}>Confirmar Conversão</p>
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
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {kpis.map((k, i) => (
          <div
            key={k.label}
            onClick={() => k.leads && setOpen(i)}
            style={{ cursor: k.leads ? "pointer" : "default", height: "100%" }}
          >
            <StatTile
              label={k.label}
              value={k.value}
              accent={k.accent}
              sub={`${k.sub}${k.leads ? " · clique p/ ver a lista" : ""}`}
            />
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
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(580px, calc(100vw - 32px))", maxHeight: "80vh", display: "flex", flexDirection: "column", background: "var(--asb-card)", border: `1px solid ${col.cor}`, borderRadius: 10, boxShadow: "0 24px 48px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid #262626" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: col.cor }} />
            <span style={{ color: "#fff", fontSize: 14, fontFamily: theme.font.label, fontWeight: 750, letterSpacing: "-.01em" }}>{col.label}</span>
            <span style={{ color: col.cor, fontSize: 12, fontFamily: theme.font.num, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{leads.length}</span>
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
      <p style={{ color: "#fff", fontSize: 14, fontFamily: theme.font.label, fontWeight: 750, letterSpacing: "-.01em", marginBottom: 4 }}>
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
          <div style={{ marginBottom: 10, background: "var(--asb-card)", border: "1px solid #2e2e2e", borderRadius: 6, padding: "10px 12px" }}>
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

// Onda 3 — preview + envio da ficha de cadastro ao lead (pela Evolution do vendedor).
// O texto vem de lib/fichas.ts (mesma fonte que o servidor usa → preview == enviado).
function ModalFicha({ lead, onClose }: { lead: PipelineLead; onClose: () => void }) {
  const [enviando, setEnviando] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const texto = fichaCadastro({ restaurant_name: lead.restaurant_name, city: lead.city });

  const enviar = async () => {
    setEnviando(true); setResult(null);
    try {
      const res = await fetch("/api/pipeline/send-ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      });
      const j = await res.json();
      if (!res.ok) { setResult({ ok: false, msg: j?.error ?? "falha ao enviar" }); return; }
      if (j.sent && j.sent_to === "lead") setResult({ ok: true, msg: "Ficha enviada ao lead ✓" });
      else if (j.sent && j.sent_to === "test") setResult({ ok: true, msg: "Modo teste: enviada ao número de teste (não ao lead) ✓" });
      else if (j.reason === "modo_teste_sem_FICHA_TEST_PHONE") setResult({ ok: false, msg: "Modo teste sem número configurado — avise o gestor." });
      else setResult({ ok: false, msg: `não enviada (${j.reason ?? "erro"})` });
    } catch {
      setResult({ ok: false, msg: "falha de conexão" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Backdrop>
      <p style={{ color: "#fff", fontSize: 14, fontFamily: theme.font.label, fontWeight: 750, letterSpacing: "-.01em", marginBottom: 4 }}>
        📋 Enviar ficha de cadastro
      </p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, marginBottom: 12 }}>
        {lead.restaurant_name || "Lead"}{lead.city ? ` · ${lead.city}` : ""} · sai pelo SEU WhatsApp (o lead recebe como se você tivesse digitado)
      </p>
      <div style={{ maxHeight: "45vh", overflowY: "auto", background: "var(--asb-card)", border: "1px solid #2e2e2e", borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
        <p style={{ color: "#fff", fontSize: 11, fontFamily: theme.font.label, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{texto}</p>
      </div>
      {result && (
        <p style={{ color: result.ok ? "#2fbf6b" : "#f85149", fontSize: 11, fontFamily: theme.font.label, marginBottom: 8 }}>{result.msg}</p>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <BtnCancel onClick={onClose} />
        <button onClick={enviar} disabled={enviando || result?.ok}
          style={{ background: result?.ok ? "#238636" : "#185FA5", border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, cursor: enviando || result?.ok ? "default" : "pointer", opacity: enviando ? 0.6 : 1 }}>
          {enviando ? "Enviando…" : result?.ok ? "✓ Enviada" : "Enviar pelo meu WhatsApp"}
        </button>
      </div>
    </Backdrop>
  );
}

// Onda 4b — montar + enviar a ficha de ORÇAMENTO ao lead (pela Evolution do vendedor).
// Produtos: sugestões do setor (v_produtos_top) + digitação livre. Gramatura auto do nome
// (editável). Unidades/caixa e preço = MANUAIS. Peso total = unidades × gramatura. O preview
// é montado com a MESMA lib do server (fichaOrcamento) → preview == enviado. Preço nunca sai do ARES.
type OrcRow = { nome: string; gramatura: string; unidades: string; vunit: string; vcaixa: string };
const ROW_VAZIA: OrcRow = { nome: "", gramatura: "", unidades: "", vunit: "", vcaixa: "" };
function parseNum(s: string): number | null {
  const v = Number((s || "").replace(",", "."));
  return s.trim() !== "" && isFinite(v) && v >= 0 ? v : null;
}
function rowToItem(r: OrcRow): OrcamentoItem {
  return {
    nome: r.nome.trim(),
    gramatura_g: parseNum(r.gramatura),
    unidades_caixa: parseNum(r.unidades),
    peso_kg: null,
    valor_unitario: parseNum(r.vunit),
    valor_caixa: parseNum(r.vcaixa),
  };
}
function ModalOrcamento({ lead, onClose, sugestoes }:
  { lead: PipelineLead; onClose: () => void; sugestoes: TopProduto[] }) {
  const [rows, setRows] = useState<OrcRow[]>([{ ...ROW_VAZIA }]);
  const [enviando, setEnviando] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const listId = "orc-sug-" + lead.id;

  const set = (i: number, patch: Partial<OrcRow>) =>
    setRows(prev => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // Ao digitar/escolher o nome, preenche a gramatura pelo número do nome se ainda estiver vazia.
  const setNome = (i: number, nome: string) =>
    setRows(prev => prev.map((r, j) => {
      if (j !== i) return r;
      const g = r.gramatura.trim() === "" ? parseGramatura(nome) : null;
      return { ...r, nome, gramatura: g != null ? String(g) : r.gramatura };
    }));
  const addRow = () => setRows(prev => [...prev, { ...ROW_VAZIA }]);
  const rmRow = (i: number) => setRows(prev => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev));

  const itens: OrcamentoItem[] = rows.filter(r => r.nome.trim()).map(rowToItem);
  const podeEnviar = itens.length > 0 && itens.every(it => it.valor_unitario != null || it.valor_caixa != null);
  const texto = fichaOrcamento(itens);

  const enviar = async () => {
    setEnviando(true); setResult(null);
    try {
      const res = await fetch("/api/pipeline/send-orcamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id, itens }),
      });
      const j = await res.json();
      if (!res.ok) { setResult({ ok: false, msg: j?.error ?? "falha ao enviar" }); return; }
      if (j.sent && j.sent_to === "lead") setResult({ ok: true, msg: "Orçamento enviado ao lead ✓" });
      else if (j.sent && j.sent_to === "test") setResult({ ok: true, msg: "Modo teste: enviado ao número de teste (não ao lead) ✓" });
      else if (j.reason === "modo_teste_sem_FICHA_TEST_PHONE") setResult({ ok: false, msg: "Modo teste sem número configurado — avise o gestor." });
      else setResult({ ok: false, msg: `não enviado (${j.reason ?? "erro"})` });
    } catch {
      setResult({ ok: false, msg: "falha de conexão" });
    } finally {
      setEnviando(false);
    }
  };

  const inp = (val: string, on: (v: string) => void, ph: string, w: number | string, mono = false) => (
    <input value={val} placeholder={ph} onChange={e => on(e.target.value)} inputMode={mono ? "decimal" : "text"}
      style={{ width: w, minWidth: 0, background: "#0e0e0e", border: "1px solid #2e2e2e", borderRadius: 4, padding: "5px 7px", color: "#fff", fontSize: 11, fontFamily: mono ? theme.font.num : theme.font.label }} />
  );

  return (
    <Backdrop>
      <p style={{ color: "#fff", fontSize: 14, fontFamily: theme.font.label, fontWeight: 750, letterSpacing: "-.01em", marginBottom: 4 }}>
        🧾 Montar orçamento
      </p>
      <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label, marginBottom: 12 }}>
        {lead.restaurant_name || "Lead"}{lead.city ? ` · ${lead.city}` : ""} · preço é você quem digita · sai pelo SEU WhatsApp
      </p>

      {/* Sugestões do setor (top movimentados) — vira datalist do campo nome */}
      <datalist id={listId}>
        {sugestoes.map((s, i) => <option key={i} value={(s.descricao_produto ?? "").trim()} />)}
      </datalist>

      <div style={{ maxHeight: "34vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {rows.map((r, i) => {
          const peso = pesoTotalKg(rowToItem(r));
          return (
            <div key={i} style={{ border: "1px solid #242424", borderRadius: 6, padding: "8px 9px", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input list={listId} value={r.nome} placeholder="Produto (busque ou digite)" onChange={e => setNome(i, e.target.value)}
                  style={{ flex: 1, minWidth: 0, background: "#0e0e0e", border: "1px solid #2e2e2e", borderRadius: 4, padding: "5px 7px", color: "#fff", fontSize: 11, fontFamily: theme.font.label }} />
                <button onClick={() => rmRow(i)} title="Remover produto" disabled={rows.length <= 1}
                  style={{ background: "transparent", border: "1px solid #2e2e2e", borderRadius: 4, color: "#c0d0e0", fontSize: 12, lineHeight: 1, padding: "4px 7px", cursor: rows.length <= 1 ? "default" : "pointer", opacity: rows.length <= 1 ? 0.4 : 1 }}>✕</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {inp(r.gramatura, v => set(i, { gramatura: v }), "g", 58, true)}
                {inp(r.unidades, v => set(i, { unidades: v }), "un/cx", 66, true)}
                {inp(r.vunit, v => set(i, { vunit: v }), "R$ un", 78, true)}
                {inp(r.vcaixa, v => set(i, { vcaixa: v }), "R$ caixa", 88, true)}
                <span style={{ color: "#8a93a5", fontSize: 10, fontFamily: theme.font.label }}>
                  {peso != null ? `peso ${peso.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg` : "peso —"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={addRow} style={{ alignSelf: "flex-start", background: "transparent", border: "1px dashed #2e2e2e", borderRadius: 6, color: "#e4e9f0", fontSize: 11, fontFamily: theme.font.label, padding: "5px 10px", cursor: "pointer", marginBottom: 10 }}>＋ adicionar produto</button>

      {/* Preview do texto (== enviado) */}
      {texto && (
        <div style={{ maxHeight: "26vh", overflowY: "auto", background: "var(--asb-card)", border: "1px solid #2e2e2e", borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
          <p style={{ color: "#fff", fontSize: 11, fontFamily: theme.font.label, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{texto}</p>
        </div>
      )}
      {result && (
        <p style={{ color: result.ok ? "#2fbf6b" : "#f85149", fontSize: 11, fontFamily: theme.font.label, marginBottom: 8 }}>{result.msg}</p>
      )}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
        {!podeEnviar && itens.length > 0 && <span style={{ color: "#8a93a5", fontSize: 10, fontFamily: theme.font.label }}>preencha o preço (unitário ou caixa)</span>}
        <BtnCancel onClick={onClose} />
        <button onClick={enviar} disabled={enviando || result?.ok || !podeEnviar}
          style={{ background: result?.ok ? "#238636" : "#185FA5", border: "none", borderRadius: 6, padding: "8px 16px", color: "#fff", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, cursor: enviando || result?.ok || !podeEnviar ? "default" : "pointer", opacity: enviando || !podeEnviar ? 0.6 : 1 }}>
          {enviando ? "Enviando…" : result?.ok ? "✓ Enviado" : "Enviar pelo meu WhatsApp"}
        </button>
      </div>
    </Backdrop>
  );
}
