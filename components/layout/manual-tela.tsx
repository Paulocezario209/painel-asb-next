"use client";

// Botão "?" do Header — abre o manual de instruções da tela atual.
// Pedido Paulo 2026-07-10. Conteúdo: lib/manuais.ts (fonte única, um bloco por rota).
// Integração ÚNICA no Header compartilhado — nenhuma página é tocada; tela sem
// manual cadastrado simplesmente não mostra o botão. Reversível removendo o
// <ManualTelaButton /> do header.

import { useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, X } from "lucide-react";
import { manualForPath } from "@/lib/manuais";

const mono = "var(--font-geist-sans), system-ui, sans-serif";

export function ManualTelaButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const manual = manualForPath(pathname ?? "");
  if (!manual) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Manual · ${manual.titulo}`}
        aria-label="Manual da tela"
        style={{
          background: "var(--asb-shell)", border: "1px solid var(--asb-shell-border)", color: "#565A6B",
          fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
          padding: "5px 10px", borderRadius: 8, cursor: "pointer",
          fontFamily: mono, transition: "all .15s",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#1B2A6B";
          (e.currentTarget as HTMLButtonElement).style.color = "#1B2A6B";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--asb-shell-border)";
          (e.currentTarget as HTMLButtonElement).style.color = "#565A6B";
        }}
      >
        <HelpCircle size={12} />
        <span className="hidden sm:inline">manual</span>
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 60,
            background: "rgba(0,0,0,.65)", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0d1220", border: "1px solid #1B2A6B", borderRadius: 8,
              width: "min(560px, 100%)", maxHeight: "82vh", overflowY: "auto",
              padding: 20, boxShadow: "0 12px 40px rgba(0,0,0,.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2 style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 700, fontFamily: mono, letterSpacing: ".12em", textTransform: "uppercase" }}>
                📖 Manual · {manual.titulo}
              </h2>
              <button onClick={() => setOpen(false)} aria-label="Fechar"
                style={{ background: "transparent", border: "none", color: "#c0d0e0", cursor: "pointer", padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            <p style={{ color: "#e4e9f0", fontSize: 12, lineHeight: 1.55, marginBottom: 14 }}>{manual.oQueE}</p>

            <p style={{ color: "#6390f5", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", fontFamily: mono, marginBottom: 6 }}>
              De onde vêm os números
            </p>
            <ul style={{ margin: "0 0 14px", paddingLeft: 16 }}>
              {manual.fontes.map((f, i) => (
                <li key={i} style={{ color: "#c0d0e0", fontSize: 11, lineHeight: 1.5, marginBottom: 4 }}>{f}</li>
              ))}
            </ul>

            <p style={{ color: "#22c55e", fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", fontFamily: mono, marginBottom: 6 }}>
              Como usar
            </p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {manual.comoUsar.map((c, i) => (
                <li key={i} style={{ color: "#c0d0e0", fontSize: 11, lineHeight: 1.5, marginBottom: 4 }}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
