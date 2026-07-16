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
    router.push("/inicio");
    router.refresh();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--asb-card-hi)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 9,
    color: "#FFFFFF", fontSize: 12, padding: "10px 12px",
    fontFamily: "'Courier New', monospace", outline: "none", boxSizing: "border-box", transition: "border-color .15s",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase",
    color: "#e4e9f0", fontFamily: "'Courier New', monospace", display: "block", marginBottom: 6,
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background:
        "radial-gradient(760px 460px at 84% 6%, rgba(200,16,46,.06), transparent 62%)," +
        "radial-gradient(720px 500px at 8% 90%, rgba(27,42,107,.08), transparent 60%)," +
        "linear-gradient(160deg, var(--asb-page-1), var(--asb-page-2))",
    }}>
      <div style={{
        background: "var(--asb-card)", border: "1px solid rgba(255,255,255,.09)", borderRadius: 18,
        padding: "36px 32px", width: "100%", maxWidth: 380,
        position: "relative", zIndex: 1,
        boxShadow: "0 2px 6px rgba(20,22,40,.08), 0 30px 60px -24px rgba(20,22,40,.4)",
      }}>
        {/* Top red accent line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, #C8102E, #1B2A6B)", borderRadius: "18px 18px 0 0" }} />

        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/asb_logo.png" alt="American Steak Brasil" style={{ height: 100, width: "auto", margin: "0 auto 12px" }} />
          <p style={{ color: "#e4e9f0", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>
            Painel de Vendas — acesso restrito
          </p>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,.1)", marginBottom: 24 }} />

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label htmlFor="email" style={labelStyle}>e-mail</label>
            <input id="email" type="email" placeholder="seu@email.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#C8102E")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.12)")} />
          </div>
          <div>
            <label htmlFor="password" style={labelStyle}>senha</label>
            <input id="password" type="password" placeholder="••••••••" value={password}
              onChange={(e) => setPassword(e.target.value)} required style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#C8102E")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,.12)")} />
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
              borderRadius: 9, color: "#FFFFFF",
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
