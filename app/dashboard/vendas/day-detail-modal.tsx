"use client";

import { useEffect } from "react";
import type { DayPedido } from "./actions";

const STATUS_COLOR: Record<string, { bg: string; fg: string; label: string }> = {
  entregue:     { bg: "#0F6E56", fg: "#fff",     label: "Entregue" },
  fat_liberado: { bg: "#185FA5", fg: "#fff",     label: "Fat. liberado" },
  faturado:     { bg: "#22C55E", fg: "#fff",     label: "Faturado" },
  aprovado:     { bg: "#BA7517", fg: "#fff",     label: "Aprovado" },
  pendente:     { bg: "#2a2a2a", fg: "#c8d8e8",  label: "Pendente" },
  cancelado:    { bg: "#BA1717", fg: "#fff",     label: "Cancelado" },
  aberto:       { bg: "#2a2a2a", fg: "#c8d8e8",  label: "Aberto" },
};

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function fmtBRL(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DayDetailModal({
  dia,
  vendorLabel,
  pedidos,
  onClose,
}: {
  dia: string;
  vendorLabel: string;
  pedidos: DayPedido[];
  onClose: () => void;
}) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const dt = new Date(dia + "T00:00:00");
  const diaLabel = `${DOW[dt.getDay()]} ${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;

  const validos = pedidos.filter(p => (p.status_pedido ?? "") !== "cancelado");
  const totalValido = validos.reduce((s, p) => s + Number(p.valor_total_brl ?? 0), 0);
  const totalCancelado = pedidos.filter(p => p.status_pedido === "cancelado")
    .reduce((s, p) => s + Number(p.valor_total_brl ?? 0), 0);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg"
        style={{
          width: "100%", maxWidth: 800, maxHeight: "85vh",
          overflowY: "auto", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          className="border-b border-[#2a2a2a]"
          style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-500">
              {vendorLabel}
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Pedidos {diaLabel}
            </h2>
            <div className="text-xs text-gray-400 mt-1">
              {validos.length} pedido(s) válido(s) · <span className="font-semibold text-white">{fmtBRL(totalValido)}</span>
              {totalCancelado > 0 && (
                <span className="text-gray-500"> · {pedidos.length - validos.length} cancelado(s) {fmtBRL(totalCancelado)}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            style={{ background: "transparent", border: "none", fontSize: 24, cursor: "pointer", padding: 4, lineHeight: 1 }}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Lista */}
        <div style={{ padding: "12px 20px" }}>
          {pedidos.length === 0 ? (
            <div className="text-sm text-gray-500 italic py-8 text-center">
              Nenhum pedido neste dia.
            </div>
          ) : (
            <div className="space-y-2">
              {pedidos.map((p) => {
                const s = STATUS_COLOR[p.status_pedido ?? ""] ?? STATUS_COLOR["aberto"];
                return (
                  <div
                    key={p.ares_pedido_id ?? p.n_pedido ?? Math.random()}
                    className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-md"
                    style={{ padding: "12px 14px" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-gray-500">#{p.n_pedido ?? "—"}</span>
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                            style={{ background: s.bg, color: s.fg }}
                          >
                            {s.label}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-white truncate">
                          {p.cliente_nome ?? "(sem nome)"}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          Emissão {fmtDate(p.data_emissao)} · Prev. entrega {fmtDate(p.previsao_entrega)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-white">
                          {fmtBRL(p.valor_total_brl)}
                        </div>
                        {Number(p.valor_faturado_brl ?? 0) > 0 && (
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            NF: {fmtBRL(p.valor_faturado_brl)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="border-t border-[#2a2a2a]"
          style={{ padding: "10px 20px", textAlign: "center" }}
        >
          <p className="text-[10px] text-gray-600">
            Fonte: <code>pedidos_espelho</code> sincronizado via cron 15min · Esc fecha modal
          </p>
        </div>
      </div>
    </div>
  );
}
