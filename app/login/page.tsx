"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/dashboard");
    router.refresh();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#0a0f0a", border: "1px solid #1a2e1a", borderRadius: 3,
    color: "#F5F5F5", fontSize: 12, padding: "9px 12px",
    fontFamily: "'Courier New', monospace", outline: "none", boxSizing: "border-box", transition: "border-color .15s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase",
    color: "#4a6a4a", fontFamily: "'Courier New', monospace", display: "block", marginBottom: 6,
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0f0a" }}>
      {/* Green glow */}
      <div style={{
        position: "fixed", top: "40%", left: "50%", transform: "translate(-50%, -50%)",
        width: 500, height: 500,
        background: "radial-gradient(circle, rgba(0,200,83,.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        background: "#111f11", border: "1px solid #1a2e1a", borderRadius: 6,
        padding: "36px 32px", width: "100%", maxWidth: 380,
        position: "relative", zIndex: 1,
      }}>
        {/* Top green accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#00C853", borderRadius: "6px 6px 0 0" }} />

        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/asb_logo.png" alt="American Steak Brasil" style={{ width: 160, height: "auto", margin: "0 auto 12px" }} />
          <p style={{ color: "#4a6a4a", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>
            Painel de Vendas — acesso restrito
          </p>
        </div>

        <div style={{ borderTop: "1px solid #1a2e1a", marginBottom: 24 }} />

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="email" style={labelStyle}>e-mail</label>
            <input id="email" type="email" placeholder="seu@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#00C853")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2e1a")} />
          </div>
          <div>
            <label htmlFor="password" style={labelStyle}>senha</label>
            <input id="password" type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#00C853")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1a2e1a")} />
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)",
              borderRadius: 3, padding: "8px 12px", color: "#ef4444",
              fontSize: 11, fontFamily: "'Courier New', monospace",
            }}>{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              background: loading ? "#1a2e1a" : "#1B5E20",
              border: `1px solid ${loading ? "#1a2e1a" : "#00C853"}`,
              borderRadius: 3, color: loading ? "#4a6a4a" : "#00E676",
              fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase",
              padding: "11px 0", cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'Courier New', monospace", fontWeight: 700, marginTop: 4, transition: "all .15s",
            }}
            onMouseEnter={(e) => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = "#2E7D32"; (e.currentTarget as HTMLButtonElement).style.color = "#00E676"; } }}
            onMouseLeave={(e) => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.background = "#1B5E20"; (e.currentTarget as HTMLButtonElement).style.color = "#00E676"; } }}
          >
            {loading ? "aguarde..." : "entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
