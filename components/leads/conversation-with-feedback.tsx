"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";

type ConvRow = {
  id: string;
  source: string | null;
  message_text: string | null;
  response: string | null;
  rag_domain: string | null;
  request_id: string | null;
  created_at: string | null;
};

type FeedbackState = "idle" | "loading" | "positive" | "negative";

const C = {
  bg2: "#0d1117", border: "#21262d", border2: "#30363d",
  text: "#c9d1d9", blue: "#58a6ff", muted: "#8b949e",
  green: "#3fb950", red: "#f85149",
};

function fmt(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function FeedbackButtons({
  phone,
  requestId,
  ragDomain,
  responsePreview,
}: {
  phone: string;
  requestId: string;
  ragDomain: string;
  responsePreview: string;
}) {
  const [state, setState] = useState<FeedbackState>("idle");

  async function submit(feedback: "positive" | "negative") {
    setState("loading");
    try {
      await fetch("/api/rag/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, request_id: requestId, rag_domain: ragDomain, feedback, response_preview: responsePreview }),
      });
      setState(feedback);
    } catch {
      setState("idle");
    }
  }

  // Após avaliação: mostra só o ícone marcado
  if (state === "positive") {
    return (
      <span style={{ color: C.green, fontSize: 10, fontFamily: "'Courier New', monospace" }}>
        <ThumbsUp size={10} style={{ display: "inline", marginRight: 3 }} />útil
      </span>
    );
  }
  if (state === "negative") {
    return (
      <span style={{ color: C.red, fontSize: 10, fontFamily: "'Courier New', monospace" }}>
        <ThumbsDown size={10} style={{ display: "inline", marginRight: 3 }} />ruim
      </span>
    );
  }

  const btn: React.CSSProperties = {
    background: "transparent", border: "none", cursor: "pointer",
    padding: "2px 4px", borderRadius: 3, lineHeight: 1,
    opacity: state === "loading" ? 0.4 : 1,
  };

  return (
    <span style={{ display: "inline-flex", gap: 2, alignItems: "center" }}>
      <button style={btn} title="Boa resposta" disabled={state === "loading"} onClick={() => submit("positive")}>
        <ThumbsUp size={10} color={C.muted} />
      </button>
      <button style={btn} title="Resposta ruim" disabled={state === "loading"} onClick={() => submit("negative")}>
        <ThumbsDown size={10} color={C.muted} />
      </button>
    </span>
  );
}

export function ConversationWithFeedback({ rows, phone }: { rows: ConvRow[]; phone: string }) {
  if (!rows || rows.length === 0) {
    return (
      <p style={{ color: C.muted, fontSize: 11, fontFamily: "'Courier New', monospace" }}>
        Nenhuma mensagem registrada.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 480, overflowY: "auto", paddingRight: 4 }}>
      {rows.map((row) => {
        const isSdr = row.source === "orchestrator";

        // Mensagem do cliente — sempre que houver message_text
        const customerBubble = row.message_text ? (
          <div key={`${row.id}-customer`} style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              maxWidth: "85%", borderRadius: 8, padding: "8px 12px",
              background: C.bg2, border: `1px solid ${C.border}`,
            }}>
              <p style={{ color: C.text, fontSize: 11, fontFamily: "'Courier New', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {row.message_text}
              </p>
              {!isSdr && (
                <p style={{ color: C.muted, fontSize: 9, fontFamily: "'Courier New', monospace", marginTop: 4, letterSpacing: ".08em" }}>
                  {fmt(row.created_at)}
                </p>
              )}
            </div>
          </div>
        ) : null;

        // Resposta do SDR — apenas para rows do orchestrator
        const sdrBubble = isSdr && row.response ? (
          <div key={`${row.id}-sdr`} style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{
              maxWidth: "85%", borderRadius: 8, padding: "8px 12px",
              background: "rgba(88,166,255,.15)", border: `1px solid rgba(88,166,255,.3)`,
            }}>
              <p style={{ color: C.blue, fontSize: 11, fontFamily: "'Courier New', monospace", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {row.response}
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                <p style={{ color: C.muted, fontSize: 9, fontFamily: "'Courier New', monospace", letterSpacing: ".08em" }}>
                  {fmt(row.created_at)}{row.rag_domain ? ` · ${row.rag_domain.replace("_rag", "")}` : ""}
                </p>
                {row.request_id && (
                  <FeedbackButtons
                    phone={phone}
                    requestId={row.request_id}
                    ragDomain={row.rag_domain ?? ""}
                    responsePreview={row.response.slice(0, 200)}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null;

        return (
          <div key={row.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {customerBubble}
            {sdrBubble}
          </div>
        );
      })}
    </div>
  );
}
