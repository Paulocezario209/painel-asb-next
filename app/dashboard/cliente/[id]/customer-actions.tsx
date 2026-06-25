"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markClienteAtivoAction,
  markClienteRecorrenteAction,
  setCustomerHealthAction,
  markCustomerLostAction,
  reassignCustomerVendorAction,
} from "./actions";

type Vendor = { id: string; name: string; routing_team: string | null };

const HEALTH_BTNS = [
  { key: "healthy", label: "Healthy", color: "#22C55E" },
  { key: "at_risk", label: "At Risk", color: "#BA7517" },
  { key: "inactive", label: "Inactive", color: "#BA1717" },
  { key: "recovered", label: "Recovered", color: "#185FA5" },
];

export function CustomerActions({
  leadId,
  stage,
  currentHealth,
  currentOwner,
  vendors,
}: {
  leadId: string;
  stage: string;
  currentHealth: string | null;
  currentOwner: string | null;
  vendors: Vendor[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ text: string; kind: "ok" | "err" } | null>(null);
  const [newOwner, setNewOwner] = useState<string>(currentOwner ?? "");
  const [reassignMotivo, setReassignMotivo] = useState("");

  const flash = (text: string, kind: "ok" | "err") => {
    setMsg({ text, kind });
    setTimeout(() => setMsg(null), 3000);
  };

  const runAction = (fn: () => Promise<{ ok: boolean; err?: string }>, okMsg: string) => {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        flash(okMsg, "ok");
        router.refresh();
      } else {
        flash(`Erro: ${r.err ?? "?"}`, "err");
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Avançar stage */}
      {stage === "cliente_em_ativacao" && (
        <button
          disabled={pending}
          onClick={() => runAction(() => markClienteAtivoAction(leadId), "Marcado cliente ativo ✓")}
          className="w-full text-xs font-semibold uppercase tracking-wider bg-[#0F6E56] hover:bg-[#22C55E] text-white py-2 rounded-md transition disabled:opacity-50"
        >
          Marcar Cliente Ativo
        </button>
      )}
      {stage === "cliente_ativo" && (
        <button
          disabled={pending}
          onClick={() => runAction(() => markClienteRecorrenteAction(leadId), "Marcado recorrente ✓")}
          className="w-full text-xs font-semibold uppercase tracking-wider bg-[#064E3B] hover:bg-[#0F6E56] text-white py-2 rounded-md transition disabled:opacity-50"
        >
          Marcar Recorrente
        </button>
      )}

      {/* Health */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-200 font-bold mb-2">Health</div>
        <div className="grid grid-cols-2 gap-1.5">
          {HEALTH_BTNS.map((h) => {
            const active = currentHealth === h.key;
            return (
              <button
                key={h.key}
                disabled={pending || active}
                onClick={() =>
                  runAction(
                    () => setCustomerHealthAction(leadId, h.key),
                    `Health → ${h.label} ✓`
                  )
                }
                className="text-[10px] uppercase tracking-wider font-bold py-1.5 rounded transition disabled:opacity-50"
                style={{
                  background: active ? h.color : "transparent",
                  color: active ? "#fff" : h.color,
                  border: `1px solid ${h.color}`,
                }}
              >
                {h.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reassign */}
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-200 font-bold mb-2">Reassign vendor</div>
        <select
          value={newOwner}
          onChange={(e) => setNewOwner(e.target.value)}
          className="w-full text-xs bg-[#0f0f0f] border border-[#2a2a2a] text-white px-2 py-1.5 rounded mb-1.5"
        >
          <option value="">(escolha vendor)</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} — {v.routing_team ?? "(sem team)"}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Motivo (obrigatório)"
          value={reassignMotivo}
          onChange={(e) => setReassignMotivo(e.target.value)}
          className="w-full text-xs bg-[#0f0f0f] border border-[#2a2a2a] text-white px-2 py-1.5 rounded mb-1.5"
        />
        <button
          disabled={pending || !newOwner || newOwner === currentOwner || reassignMotivo.trim().length < 2}
          onClick={() =>
            runAction(
              () => reassignCustomerVendorAction(leadId, newOwner, reassignMotivo),
              "Vendor reassinado ✓"
            )
          }
          className="w-full text-[10px] uppercase tracking-wider font-bold py-1.5 rounded bg-[#185FA5] hover:bg-[#193264] text-white transition disabled:opacity-30"
        >
          Reassignar
        </button>
      </div>

      {/* Mark lost */}
      <div className="pt-2 border-t border-[#2a2a2a]">
        <button
          disabled={pending}
          onClick={() => {
            const reason = prompt("Motivo da perda do cliente?");
            if (!reason || reason.trim().length < 2) {
              flash("Motivo obrigatório", "err");
              return;
            }
            if (!confirm(`Marcar cliente como PERDIDO? Motivo: ${reason}`)) return;
            runAction(
              () => markCustomerLostAction(leadId, reason),
              "Cliente marcado como perdido ✓"
            );
          }}
          className="w-full text-[10px] uppercase tracking-wider font-bold py-1.5 rounded border border-[#BA1717] text-[#E84545] hover:bg-[#BA1717]/15 transition disabled:opacity-50"
        >
          Marcar Cliente Perdido
        </button>
      </div>

      {/* Toast */}
      {msg && (
        <div
          className="text-xs px-3 py-2 rounded font-semibold"
          style={{
            background: msg.kind === "ok" ? "rgba(34,197,94,0.15)" : "rgba(186,23,23,0.15)",
            color: msg.kind === "ok" ? "#58D67D" : "#E84545",
            borderLeft: `3px solid ${msg.kind === "ok" ? "#22C55E" : "#BA1717"}`,
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
