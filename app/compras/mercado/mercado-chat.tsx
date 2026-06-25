// app/compras/mercado/mercado-chat.tsx — Lupa flutuante de inteligência de mercado (F5).
// Botão fixo (canto inferior-direito) → painel de chat. Consome /api/compras/mercado/chat (stream NDJSON).
"use client";

import { useRef, useState } from "react";
import { Search, X, Send, Loader2 } from "lucide-react";

import { theme } from "@/lib/theme";
const GREEN = "#2ea043";
const BG = "#0d1117";
const BORDER = "#1e2a35";
const MUTED = "#8899aa";

type Cotacao = { proteina: string; valor: number; unidade: string; variacao_pct: number | null };

export default function MercadoChat({ cotacoes }: { cotacoes: Cotacao[] }) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  async function ask(e?: React.FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || loading) return;
    setLoading(true);
    setAnswer("");
    setError("");
    setStatus("analisando…");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/compras/mercado/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, cotacoes }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: { type: string; text?: string; error?: string };
          try {
            ev = JSON.parse(line);
          } catch {
            continue;
          }
          if (ev.type === "text") {
            setStatus("");
            setAnswer((a) => a + (ev.text ?? ""));
          } else if (ev.type === "search") {
            setStatus("🔍 pesquisando na web…");
          } else if (ev.type === "thinking") {
            setStatus("analisando…");
          } else if (ev.type === "error") {
            setError(ev.error ?? "erro");
          } else if (ev.type === "done") {
            setStatus("");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || "falha na consulta");
      }
    } finally {
      setLoading(false);
      setStatus("");
      abortRef.current = null;
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir inteligência de mercado"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 50,
            width: 52, height: 52, borderRadius: "50%",
            background: GREEN, border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(46,160,67,.4)",
          }}
        >
          <Search style={{ width: 22, height: 22, color: "#fff" }} />
        </button>
      )}

      {/* Painel */}
      {open && (
        <div
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 50,
            width: "min(440px, calc(100vw - 32px))", height: "min(560px, calc(100vh - 48px))",
            background: BG, border: `1px solid ${GREEN}`, borderRadius: 10,
            display: "flex", flexDirection: "column",
            boxShadow: "0 12px 48px rgba(0,0,0,.6)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Search style={{ width: 14, height: 14, color: GREEN }} />
              <span style={{ color: "#fff", fontSize: 11, fontFamily: theme.font.label, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
                Inteligência de Mercado
              </span>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: MUTED, display: "flex" }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>

          {/* Corpo */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            {!answer && !loading && !error && (
              <div style={{ color: MUTED, fontSize: 11, fontFamily: theme.font.label, lineHeight: 1.6 }}>
                Pergunte sobre o mercado de proteínas — preço do boi/suíno/frango, tendências, melhor momento de compra. A IA pesquisa na web em tempo real.
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    "Qual a tendência do boi gordo para a próxima semana?",
                    "Compensa comprar suíno agora ou esperar?",
                    "Tem notícia recente que pressione o preço do frango?",
                  ].map((ex) => (
                    <button key={ex} onClick={() => setQuestion(ex)}
                      style={{ textAlign: "left", background: "rgba(46,160,67,.08)", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "7px 10px", color: "#c0c8d8", fontSize: 10.5, fontFamily: theme.font.label, cursor: "pointer" }}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {status && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: GREEN, fontSize: 11, fontFamily: theme.font.label, marginBottom: 10 }}>
                <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
                {status}
              </div>
            )}

            {answer && (
              <div style={{ color: "#dfe6f0", fontSize: 12, fontFamily: theme.font.label, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {answer}
              </div>
            )}

            {error && (
              <div style={{ color: "#C8102E", fontSize: 11, fontFamily: theme.font.label, marginTop: 8 }}>
                Erro: {error}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={ask} style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${BORDER}` }}>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Pergunte sobre o mercado…"
              disabled={loading}
              style={{ flex: 1, background: "#080b14", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "8px 10px", color: "#fff", fontSize: 11.5, fontFamily: theme.font.label, outline: "none" }}
            />
            <button type="submit" disabled={loading || !question.trim()} aria-label="Enviar"
              style={{ width: 38, background: question.trim() && !loading ? GREEN : BORDER, border: "none", borderRadius: 6, cursor: loading || !question.trim() ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {loading ? <Loader2 style={{ width: 15, height: 15, color: "#fff", animation: "spin 1s linear infinite" }} /> : <Send style={{ width: 15, height: 15, color: "#fff" }} />}
            </button>
          </form>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
