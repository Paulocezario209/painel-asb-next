"use client";

import { useEffect, useState, type ReactNode } from "react";
import { theme } from "@/lib/theme";

const LS_KEY = "asb_vendas_privacy_hidden";

export function VendasPrivacyShell({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored === "false") setHidden(false);
    } catch {
      // ignore (SSR or privacy mode)
    }
  }, []);

  function toggle() {
    setHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  // Pra evitar flash inicial mostrando valores antes do effect rodar,
  // sempre arrancar mascarado (hidden=true default).
  const cls = mounted && !hidden ? "" : "vendas-privacy-on";

  return (
    <div className={cls} style={{ position: "relative" }}>
      {/* botão olho */}
      <button
        onClick={toggle}
        aria-label={hidden ? "Revelar valores" : "Ocultar valores"}
        title={hidden ? "Revelar valores" : "Ocultar valores"}
        style={{
          position: "fixed",
          top: 14,
          right: 18,
          zIndex: 50,
          background: hidden ? "#1f1f1f" : "#0F6E56",
          border: `1px solid ${hidden ? "var(--asb-border)" : "#22c55e"}`,
          borderRadius: 8,
          padding: "8px 12px",
          cursor: "pointer",
          color: hidden ? "#c0d0e0" : "#fff",
          fontSize: 12,
          fontFamily: theme.font.label,
          letterSpacing: ".05em",
          textTransform: "uppercase",
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "all .15s",
        }}
      >
        <span style={{ fontSize: 14 }}>{hidden ? "👁‍🗨" : "👁"}</span>
        <span style={{ fontSize: 10 }}>{hidden ? "Revelar" : "Ocultar"}</span>
      </button>

      {/* CSS global pra mascarar valores R$ */}
      <style jsx global>{`
        .vendas-privacy-on .priv-brl {
          color: transparent !important;
          background: linear-gradient(90deg, #2a2a2a 0%, #1f1f1f 100%);
          border-radius: 4px;
          display: inline-block;
          padding: 0 6px;
          position: relative;
          user-select: none;
          min-width: 80px;
          letter-spacing: normal !important;
          text-align: center;
          vertical-align: baseline;
        }
        .vendas-privacy-on .priv-brl::after {
          content: "R$ ●●●●";
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e4e9f0;
          font-family: var(--font-geist-mono), monospace;
          font-size: 0.85em;
          font-weight: 600;
          letter-spacing: 1px;
          line-height: 1;
        }
        /* Texto-com-percentual também (% Atingido) */
        .vendas-privacy-on .priv-pct {
          color: transparent !important;
          background: linear-gradient(90deg, #2a2a2a 0%, #1f1f1f 100%);
          border-radius: 4px;
          display: inline-block;
          padding: 0 6px;
          position: relative;
          user-select: none;
          min-width: 45px;
          letter-spacing: normal !important;
          text-align: center;
        }
        .vendas-privacy-on .priv-pct::after {
          content: "●●%";
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e4e9f0;
          font-family: var(--font-geist-mono), monospace;
          font-size: 0.85em;
          font-weight: 600;
        }
      `}</style>

      {children}
    </div>
  );
}
