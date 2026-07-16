interface VendorMsg {
  direction: string;
  content: string | null;
  media_type: string | null;
  sent_at: string;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function VendorConversation({ messages, total }: { messages: VendorMsg[]; total: number }) {
  if (messages.length === 0) {
    return <p style={{ color: "#c0d0e0", fontSize: 11, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>Nenhuma mensagem vendedor capturada.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {messages.map((m, i) => {
        const isVendor = m.direction === "outbound";
        return (
          <div key={i} style={{
            display: "flex",
            justifyContent: isVendor ? "flex-end" : "flex-start",
          }}>
            <div style={{
              maxWidth: "75%",
              padding: "8px 12px",
              borderRadius: isVendor ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              background: isVendor ? "rgba(34,197,94,.08)" : "rgba(136,153,170,.06)",
              border: `1px solid ${isVendor ? "rgba(34,197,94,.2)" : "rgba(136,153,170,.15)"}`,
            }}>
              <p style={{
                color: "#c8d8e8", fontSize: 11,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                wordBreak: "break-word", whiteSpace: "pre-wrap",
              }}>
                {m.content || (m.media_type ? `[${m.media_type}]` : "[sem conteudo]")}
              </p>
              <p style={{ color: "#e4e9f0", fontSize: 8, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", marginTop: 4, textAlign: "right" }}>
                {isVendor ? "vendedor" : "lead"} · {fmtTime(m.sent_at)}
              </p>
            </div>
          </div>
        );
      })}
      {total > messages.length && (
        <p style={{ color: "#e4e9f0", fontSize: 9, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", textAlign: "center", padding: "8px 0" }}>
          Mostrando {messages.length} de {total} mensagens
        </p>
      )}
    </div>
  );
}
