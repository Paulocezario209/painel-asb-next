"use client";

import { useEffect } from "react";
import { theme } from "@/lib/theme";
import { MissaoDoDia } from "./missao-do-dia";
import type { EstrategiasResponse } from "./actions";

const VENDOR_LABELS: Record<string, string> = {
  SETOR_CUIT: "SETOR CUIT",
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula",
  SETOR_CAMPINAS_JUNDIAI: "Alan",
};

type Props = {
  vendor: string;
  data: EstrategiasResponse;
  onClose: () => void;
};

export function PreviewMissaoModal({ vendor, data, onClose }: Props) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [onClose]);

  const nome = VENDOR_LABELS[vendor] ?? vendor;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 600,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {/* Header banner */}
        <div
          style={{
            background: "#ff7b1c",
            color: "#fff",
            padding: "10px 16px",
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>👁</span>
            <div>
              <p style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", fontFamily: theme.font.label, opacity: 0.8 }}>
                PREVIEW DA MISSÃO
              </p>
              <p style={{ fontSize: 13, fontWeight: 700 }}>
                Como {nome} vê o painel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              fontSize: 22,
              cursor: "pointer",
              padding: "0 4px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Missão real do vendedor */}
        <div style={{ background: "var(--asb-card)", borderBottomLeftRadius: 8, borderBottomRightRadius: 8, overflow: "hidden" }}>
          <MissaoDoDia data={data} vendor={vendor} />
        </div>

        {/* Footer */}
        <p style={{ fontSize: 9, color: "#fff", textAlign: "center", opacity: 0.6, marginTop: 6 }}>
          Esc ou clique fora pra fechar
        </p>
      </div>
    </div>
  );
}
