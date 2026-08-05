"use client";

// components/dashboard/registrar-contato-btn.tsx — "Registrar contato" (fallback manual).
// Só grava via POST explícito com canal + observação. Abrir a tela não registra nada.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { theme } from "@/lib/theme";

const CANAIS = [
  { v: "ligacao", l: "Ligação" },
  { v: "visita", l: "Visita" },
  { v: "whatsapp_pessoal", l: "WhatsApp pessoal" },
  { v: "email", l: "E-mail" },
  { v: "outro", l: "Outro" },
];

export function RegistrarContatoBtn({ alertaId, jaRegistrado }: { alertaId: string; jaRegistrado: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [canal, setCanal] = useState("ligacao");
  const [obs, setObs] = useState("");
  const [prox, setProx] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (jaRegistrado) {
    return <span style={{ fontSize: 10, color: "#22c55e", fontFamily: theme.font.label }}>contato registrado</span>;
  }

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const r = await fetch("/api/jornada/alertas/registrar-contato", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alerta_id: alertaId, canal, observacao: obs, proxima_acao: prox || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) { setErro(j.error ?? "falha ao registrar"); return; }
      setAberto(false); router.refresh();
    } catch {
      setErro("erro de rede");
    } finally { setSalvando(false); }
  }

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} style={btn}>Registrar contato</button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 210 }}>
      <select value={canal} onChange={(e) => setCanal(e.target.value)} style={inp}>
        {CANAIS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
      </select>
      <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="O que foi tratado (obrigatório)" style={inp} />
      <input value={prox} onChange={(e) => setProx(e.target.value)} placeholder="Próxima ação (opcional)" style={inp} />
      {erro && <span style={{ fontSize: 9.5, color: "#C8102E" }}>{erro}</span>}
      <div style={{ display: "flex", gap: 5 }}>
        <button onClick={salvar} disabled={salvando || obs.trim().length < 3} style={{ ...btn, opacity: salvando || obs.trim().length < 3 ? .5 : 1 }}>
          {salvando ? "salvando…" : "Salvar"}
        </button>
        <button onClick={() => { setAberto(false); setErro(null); }} style={{ ...btn, background: "transparent" }}>Cancelar</button>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  fontSize: 10, fontFamily: theme.font.label, color: "#e4e9f0", cursor: "pointer",
  background: "rgba(255,255,255,.09)", border: "1px solid rgba(255,255,255,.2)",
  borderRadius: 5, padding: "3px 9px", whiteSpace: "nowrap",
};
const inp: React.CSSProperties = {
  fontSize: 10.5, fontFamily: theme.font.label, color: "#e4e9f0",
  background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.18)",
  borderRadius: 5, padding: "3px 7px", outline: "none",
};
