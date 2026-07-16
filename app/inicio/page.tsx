"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Briefcase, Package, Megaphone, ArrowRight, LogOut } from "lucide-react";

const mono = "var(--font-geist-sans), system-ui, sans-serif";

type Store = {
  id: string;
  label: string;
  desc: string;
  root: string;
  color: string;
  Icon: typeof Briefcase;
  bullets: string[];
};

const STORES: Store[] = [
  {
    id: "comercial",
    label: "Comercial",
    desc: "Pipeline SDR, funil, leads, clientes e metas.",
    root: "/dashboard",
    color: "#f0a04b",
    Icon: Briefcase,
    bullets: ["Dashboard & Funil", "Vendedores & Metas", "Carteira & Cadências"],
  },
  {
    id: "compras",
    label: "Compras & Estoque",
    desc: "Resultados, estoque, previsão e inventário.",
    root: "/compras/resultados",
    color: "#2ea043",
    Icon: Package,
    bullets: ["Resultados MTD", "Estoque & Previsão", "Custos & Mercado"],
  },
  {
    id: "marketing",
    label: "Marketing",
    desc: "Origem dos leads, anúncios, CAC e verba.",
    root: "/marketing/overview",
    color: "#C8102E",
    Icon: Megaphone,
    bullets: ["Origem & Atribuição", "Anúncios & CAC", "Verba & Gasto"],
  },
];

export default function InicioPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.email) setEmail(data.user.email);
    }).catch(() => {});
  }, []);

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch { /* ignore */ }
    router.push("/login");
    router.refresh();
  }

  return (
    <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Foto institucional (fábrica ASB) + scrim para legibilidade */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, zIndex: 0,
          backgroundImage: "url(/asb-fabrica.jpg)",
          backgroundSize: "cover", backgroundPosition: "center 38%",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, zIndex: 1,
          background:
            "linear-gradient(180deg, rgba(8,10,18,.72) 0%, rgba(8,10,18,.55) 34%, rgba(8,10,18,.80) 78%, rgba(8,10,18,.94) 100%)," +
            "radial-gradient(1200px 600px at 82% -8%, rgba(200,16,46,.20), transparent 60%)," +
            "radial-gradient(1100px 700px at 4% 10%, rgba(27,42,107,.35), transparent 60%)",
        }}
      />

      {/* Conteúdo */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", flex: 1, padding: "clamp(20px, 4vw, 40px)" }}>
        {/* Topbar */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/asb_logo_white.svg" alt="American Steak Brasil" style={{ height: 44, width: "auto" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {email && (
              <span style={{ color: "#c8d2e6", fontSize: 12, fontFamily: mono }}>
                <span style={{ color: "#ff5a72" }}>›</span> {email}
              </span>
            )}
            <button
              onClick={handleLogout}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.18)",
                color: "#e6ebf5", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
                padding: "7px 12px", borderRadius: 9, cursor: "pointer", fontFamily: mono, fontWeight: 700,
                backdropFilter: "blur(6px)", transition: "all .15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C8102E"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,.18)"; e.currentTarget.style.color = "#e6ebf5"; }}
            >
              <LogOut size={12} /> sair
            </button>
          </div>
        </header>

        {/* Hero */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 1180, margin: "0 auto", width: "100%", padding: "clamp(28px,5vh,64px) 0 clamp(20px,3vh,36px)" }}>
          <div style={{ marginBottom: "clamp(26px, 4vh, 44px)" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.16)", backdropFilter: "blur(6px)", marginBottom: 18 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
              <span style={{ color: "#dfe6f2", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", fontFamily: mono }}>
                Plataforma de Operações · SDR v3.1
              </span>
            </div>
            <h1 style={{ color: "#fff", fontSize: "clamp(30px, 5vw, 52px)", fontWeight: 850, letterSpacing: "-.025em", lineHeight: 1.02, margin: 0, textShadow: "0 2px 30px rgba(0,0,0,.5)" }}>
              American Steak Brasil
            </h1>
            <p style={{ color: "#cbd5ea", fontSize: "clamp(14px, 1.6vw, 17px)", marginTop: 14, maxWidth: 620, lineHeight: 1.5 }}>
              Central única de inteligência comercial, compras e marketing.
              Escolha uma frente para começar.
            </p>
          </div>

          {/* Cards dos 3 workspaces */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
            {STORES.map((s) => (
              <Link
                key={s.id}
                href={s.root}
                className="asb-hub-card"
                style={{
                  position: "relative", display: "flex", flexDirection: "column", gap: 14,
                  padding: "22px 22px 20px", borderRadius: 18, textDecoration: "none",
                  background: "rgba(20,22,30,.66)", border: "1px solid rgba(255,255,255,.12)",
                  backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
                  boxShadow: "0 24px 50px -24px rgba(0,0,0,.7)", overflow: "hidden",
                  transition: "transform .18s ease, border-color .18s ease, box-shadow .18s ease",
                }}
              >
                <span aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.color }} />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, display: "grid", placeItems: "center", background: s.color + "26", color: s.color, border: `1px solid ${s.color}55` }}>
                    <s.Icon size={22} />
                  </div>
                  <ArrowRight size={18} color="#8b93a7" />
                </div>
                <div>
                  <div style={{ color: "#fff", fontSize: 18, fontWeight: 750, letterSpacing: "-.01em" }}>{s.label}</div>
                  <div style={{ color: "#aeb7cc", fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>{s.desc}</div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                  {s.bullets.map((b) => (
                    <span key={b} style={{ fontSize: 10, color: "#c6cde0", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", padding: "3px 8px", borderRadius: 999, fontFamily: mono }}>
                      {b}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: "auto", paddingTop: 8, display: "flex", alignItems: "center", gap: 7, color: s.color, fontSize: 11, fontWeight: 750, letterSpacing: ".1em", textTransform: "uppercase", fontFamily: mono }}>
                  Acessar frente
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,.1)" }}>
          <span style={{ color: "#8b93a7", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: mono }}>
            American Steak Brasil · Carnes Nobres & American Steak
          </span>
          <span style={{ color: "#6b7488", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: mono }}>
            v1.0 · SDR System
          </span>
        </footer>
      </div>
    </div>
  );
}
