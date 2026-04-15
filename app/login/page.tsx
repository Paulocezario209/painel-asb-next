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
    width: "100%", background: "#0a0d1a", border: "1px solid #1B2A6B", borderRadius: 3,
    color: "#FFFFFF", fontSize: 12, padding: "9px 12px",
    fontFamily: "'Courier New', monospace", outline: "none", boxSizing: "border-box", transition: "border-color .15s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase",
    color: "#556677", fontFamily: "'Courier New', monospace", display: "block", marginBottom: 6,
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0d1a" }}>
      {/* Blue glow */}
      <div style={{
        position: "fixed", top: "40%", left: "50%", transform: "translate(-50%, -50%)",
        width: 500, height: 500,
        background: "radial-gradient(circle, rgba(27,42,107,.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      {/* Red glow subtle */}
      <div style={{
        position: "fixed", top: "60%", left: "50%", transform: "translate(-50%, -50%)",
        width: 300, height: 300,
        background: "radial-gradient(circle, rgba(200,16,46,.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6,
        padding: "36px 32px", width: "100%", maxWidth: 380,
        position: "relative", zIndex: 1,
      }}>
        {/* Top red accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#C8102E", borderRadius: "6px 6px 0 0" }} />

        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/asb_logo.png" alt="American Steak Brasil" style={{ height: 80, width: "auto", margin: "0 auto 12px" }} />
          <p style={{ color: "#556677", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>
            Painel de Vendas — acesso restrito
          </p>
        </div>

        <div style={{ borderTop: "1px solid #1B2A6B", marginBottom: 24 }} />

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="email" style={labelStyle}>e-mail</label>
            <input id="email" type="email" placeholder="seu@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#C8102E")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1B2A6B")} />
          </div>
          <div>
            <label htmlFor="password" style={labelStyle}>senha</label>
            <input id="password" type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#C8102E")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1B2A6B")} />
          </div>

          {error && (
            <div style={{
              background: "rgba(200,16,46,.08)", border: "1px solid rgba(200,16,46,.3)",
              borderRadius: 3, padding: "8px 12px", color: "#C8102E",
              fontSize: 11, fontFamily: "'Courier New', monospace",
            }}>{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              background: loading ? "#1B2A6B" : "#C8102E",
              border: `1px solid ${loading ? "#2A3F8F" : "#C8102E"}`,
              borderRadius: 3, color: "#FFFFFF",
              fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase",
              padding: "11px 0", cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'Courier New', monospace", fontWeight: 700, marginTop: 4, transition: "all .15s",
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#a00d24"; }}
            onMouseLeave={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#C8102E"; }}
          >
            {loading ? "aguarde..." : "entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
