"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface NoteEvent {
  payload: { author?: string; content?: string };
  created_at: string;
}

export function LeadNotes({ leadId, notes }: { leadId: string; notes: NoteEvent[] }) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/lead/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId, content: content.trim() }),
      });
      setContent("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Adicionar observacao..."
          style={{
            flex: 1, minHeight: 60, padding: "8px 10px", borderRadius: 4,
            background: "#0d1117", border: "1px solid #30363d", color: "#c9d1d9",
            fontSize: 11, fontFamily: "'Courier New', monospace", resize: "vertical",
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          style={{
            alignSelf: "flex-end", padding: "6px 14px", borderRadius: 4,
            background: saving ? "#30363d" : "#2a2a2a", border: "1px solid #2a2a2a",
            color: "#FFFFFF", fontSize: 10, letterSpacing: ".10em", textTransform: "uppercase",
            fontFamily: "'Courier New', monospace", cursor: saving ? "wait" : "pointer",
            opacity: !content.trim() ? 0.4 : 1,
          }}
        >
          {saving ? "..." : "Salvar"}
        </button>
      </div>

      {notes.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {notes.map((n, i) => (
            <div key={i} style={{
              padding: "8px 10px", borderRadius: 4,
              background: "rgba(168,85,247,.04)", border: "1px solid rgba(168,85,247,.15)",
            }}>
              <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", whiteSpace: "pre-wrap" }}>
                {String(n.payload?.content ?? "")}
              </p>
              <p style={{ color: "#e4e9f0", fontSize: 8, fontFamily: "'Courier New', monospace", marginTop: 4 }}>
                {n.payload?.author ?? "?"} · {new Date(n.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
