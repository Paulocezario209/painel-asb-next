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
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0a0a0a",
    border: "1px solid #2a2a2a",
    borderRadius: 3,
    color: "#F5F5F5",
    fontSize: 12,
    padding: "9px 12px",
    fontFamily: "'Courier New', monospace",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color .15s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    letterSpacing: ".15em",
    textTransform: "uppercase",
    color: "#666666",
    fontFamily: "'Courier New', monospace",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#0a0a0a" }}
    >
      {/* Subtle red glow behind card */}
      <div style={{
        position: "fixed",
        top: "40%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 400,
        height: 400,
        background: "radial-gradient(circle, rgba(200,16,46,.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div
        style={{
          background: "#111111",
          border: "1px solid #2a2a2a",
          borderRadius: 6,
          padding: "36px 32px",
          width: "100%",
          maxWidth: 380,
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Top red accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "#C8102E", borderRadius: "6px 6px 0 0" }} />

        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-5 flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              background: "#C8102E",
              borderRadius: 4,
            }}
          >
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 20, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }}>A</span>
          </div>
          <p style={{ color: "#F5F5F5", fontWeight: 700, fontSize: 15, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase" }}>
            AMERICAN STEAK BRASIL
          </p>
          <p style={{ color: "#444444", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", marginTop: 5, fontFamily: "'Courier New', monospace" }}>
            Painel de Vendas — acesso restrito
          </p>
        </div>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #2a2a2a", marginBottom: 24 }} />

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="email" style={labelStyle}>e-mail</label>
            <input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#C8102E")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            />
          </div>
          <div>
            <label htmlFor="password" style={labelStyle}>senha</label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#C8102E")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(200,16,46,.08)",
              border: "1px solid rgba(200,16,46,.3)",
              borderRadius: 3,
              padding: "8px 12px",
              color: "#E8192E",
              fontSize: 11,
              fontFamily: "'Courier New', monospace",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "#333333" : "#C8102E",
              border: "none",
              borderRadius: 3,
              color: loading ? "#888888" : "#fff",
              fontSize: 10,
              letterSpacing: ".15em",
              textTransform: "uppercase",
              padding: "11px 0",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'Courier New', monospace",
              fontWeight: 700,
              marginTop: 4,
              transition: "background .15s",
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#E8192E";
            }}
            onMouseLeave={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.background = "#C8102E";
            }}
          >
            {loading ? "aguarde..." : "entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
