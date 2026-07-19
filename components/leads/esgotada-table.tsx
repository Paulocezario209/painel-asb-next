"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search } from "lucide-react";

// CADÊNCIA ESGOTADA — DEBT-318: leads que a cadência desistiu (envio falhou 3× ou placeholder leak 3×).
// O reconciliador os exclui de propósito (não retenta quem não recebe); esta aba os torna VISÍVEIS
// pro gestor triar (telefone errado? reabrir? marcar perdido?). Fonte: view v_cadencia_esgotada.

export type EsgotadaLead = {
  phone: string;
  name: string | null;
  restaurant_name: string | null;
  city: string | null;
  routing_team: string | null;
  funnel_stage: string | null;
  followup_fail_count: number | null;
  leak_retry_count: number | null;
  last_followup_at: string | null;
  contexto_resumo: string | null;
  motivo_esgotamento: string | null;
};

const C = {
  bg: "#080b14", border: "#2a2a2a",
  text: "#FFFFFF", muted: "#c0d0e0", label: "#e4e9f0", red: "#C8102E", amber: "#f59e0b",
};
const MONO: React.CSSProperties = { fontFamily: "var(--font-geist-sans), system-ui, sans-serif" };

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `há ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}
function maskPhone(p: string): string {
  if (p.length >= 13) return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ****-${p.slice(-4)}`;
  return p.slice(0, 6) + "****" + p.slice(-4);
}
const MOTIVO_LABEL: Record<string, string> = {
  falha_envio: "Falha de envio (3×)",
  placeholder_leak: "Placeholder leak (3×)",
  outro: "Esgotada",
};

export function EsgotadaTable({ leads }: { leads: EsgotadaLead[] }) {
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.trim().toLowerCase();
    return leads.filter(l =>
      l.phone.includes(q) ||
      (l.restaurant_name ?? "").toLowerCase().includes(q) ||
      (l.name ?? "").toLowerCase().includes(q) ||
      (l.city ?? "").toLowerCase().includes(q)
    );
  }, [leads, search]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 320 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.muted }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, cidade…"
            style={{ width: "100%", padding: "7px 10px 7px 30px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 12, ...MONO }}
          />
        </div>
        <span style={{ color: C.muted, fontSize: 11, ...MONO }}>
          {filtered.length} lead{filtered.length === 1 ? "" : "s"} · a cadência desistiu — o gestor decide o destino
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: C.muted, fontSize: 12, border: `1px dashed ${C.border}`, borderRadius: 6, ...MONO }}>
          Nenhum lead com cadência esgotada. 👌
        </div>
      ) : (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", ...MONO }}>
            <thead>
              <tr style={{ background: "#0f1826", textAlign: "left" }}>
                {["Lead", "Cidade", "Motivo", "Tentativas", "Último follow-up", "Contexto"].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: C.label, fontWeight: 700, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr
                  key={l.phone}
                  onClick={() => router.push(`/dashboard/leads/${encodeURIComponent(l.phone)}`)}
                  style={{ cursor: "pointer", borderBottom: `1px solid #16202e` }}
                >
                  <td style={{ padding: "9px 12px", fontSize: 12, color: C.text }}>
                    <div style={{ fontWeight: 600 }}>{l.restaurant_name || l.name || "—"}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{maskPhone(l.phone)}</div>
                  </td>
                  <td style={{ padding: "9px 12px", fontSize: 12, color: C.muted }}>{l.city || "—"}</td>
                  <td style={{ padding: "9px 12px", fontSize: 11 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: C.amber, fontWeight: 600 }}>
                      <AlertTriangle size={12} /> {MOTIVO_LABEL[l.motivo_esgotamento ?? "outro"] ?? "Esgotada"}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", fontSize: 12, color: C.text }}>
                    {Math.max(l.followup_fail_count ?? 0, l.leak_retry_count ?? 0)}
                  </td>
                  <td style={{ padding: "9px 12px", fontSize: 12, color: C.muted }}>{relativeTime(l.last_followup_at)}</td>
                  <td style={{ padding: "9px 12px", fontSize: 11, color: C.muted, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {l.contexto_resumo || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
