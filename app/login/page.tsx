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
    background: "#0d1117",
    border: "1px solid #30363d",
    borderRadius: 4,
    color: "#e6edf3",
    fontSize: 12,
    padding: "8px 12px",
    fontFamily: "'Courier New', monospace",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    letterSpacing: ".14em",
    textTransform: "uppercase",
    color: "#8b949e",
    fontFamily: "'Courier New', monospace",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#0d1117" }}
    >
      <div
        style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: 8,
          padding: "32px 28px",
          width: "100%",
          maxWidth: 380,
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 flex items-center justify-center"
            style={{
              width: 40,
              height: 40,
              background: "#C8102E",
              borderRadius: 6,
            }}
          >
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>A</span>
          </div>
          <p style={{ color: "#e6edf3", fontWeight: 700, fontSize: 16, fontFamily: "'Courier New', monospace" }}>
            ASB
          </p>
          <p style={{ color: "#8b949e", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", marginTop: 4 }}>
            Painel de Vendas — acesso restrito
          </p>
        </div>

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
              onFocus={(e) => (e.currentTarget.style.borderColor = "#58a6ff")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#30363d")}
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
              onFocus={(e) => (e.currentTarget.style.borderColor = "#58a6ff")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#30363d")}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(248,81,73,.1)",
              border: "1px solid rgba(248,81,73,.3)",
              borderRadius: 4,
              padding: "8px 12px",
              color: "#f85149",
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
              background: loading ? "#8b949e" : "#C8102E",
              border: "none",
              borderRadius: 4,
              color: "#fff",
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              padding: "10px 0",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'Courier New', monospace",
              fontWeight: 700,
              marginTop: 4,
              transition: "background .15s",
            }}
          >
            {loading ? "aguarde..." : "entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
