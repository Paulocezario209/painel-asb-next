// components/layout/store-switcher.tsx
"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Briefcase, Package, Megaphone, ChevronDown, Check } from "lucide-react";

type Store = {
  id: string;
  label: string;
  desc: string;
  root: string;
  color: string;
  Icon: typeof Briefcase;
};

const STORES: Store[] = [
  {
    id: "comercial",
    label: "Comercial",
    desc: "Vendas · funil · leads · clientes",
    root: "/dashboard",
    color: "#f0a04b", // laranja
    Icon: Briefcase,
  },
  {
    id: "compras",
    label: "Compras & Estoque",
    desc: "Resultados · estoque · previsão · inventário",
    root: "/compras/resultados",
    color: "#2ea043", // verde
    Icon: Package,
  },
  {
    id: "marketing",
    label: "Marketing",
    desc: "Origem dos leads · anúncios · CAC",
    root: "/marketing/origem",
    color: "#C8102E", // vermelho
    Icon: Megaphone,
  },
];

const mono = "var(--font-geist-sans), system-ui, sans-serif";

export function StoreSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // store ativo derivado da rota (fonte de verdade), não só do localStorage
  const active =
    STORES.find((s) => s.id !== "comercial" && pathname.startsWith("/" + s.id)) ??
    STORES[0];

  function selectStore(s: Store) {
    try {
      localStorage.setItem("asb_active_store", s.id);
    } catch {
      /* localStorage indisponível — ignora, rota já é a fonte de verdade */
    }
    setOpen(false);
    if (!pathname.startsWith(s.root.split("/").slice(0, 2).join("/"))) {
      router.push(s.root);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Badge clicável (desktop + mobile) */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Trocar de módulo"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--asb-shell)", border: "1px solid var(--asb-shell-border)",
          borderRadius: 10, padding: "5px 10px", cursor: "pointer",
          boxShadow: "0 1px 2px rgba(20,22,40,.05)",
          transition: "border-color .15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = active.color)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--asb-shell-border)")}
      >
        <div
          style={{
            width: 24, height: 24, background: active.color, borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <active.Icon size={13} color="#08110a" />
        </div>
        <span
          style={{ color: "#f4f4f8", fontSize: 12, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" }}
          translate="no"
        >
          ASB
        </span>
        <span style={{ color: active.color, fontSize: 10, fontFamily: mono, textTransform: "uppercase", letterSpacing: ".08em" }}>
          {active.label}
        </span>
        <ChevronDown size={13} color="#556677" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {/* Dropdown de stores */}
      {open && (
        <>
          {/* backdrop p/ fechar ao clicar fora */}
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute", top: 40, left: 0, zIndex: 50,
              width: 280, background: "#17181d", border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 12, padding: 8, boxShadow: "0 20px 44px -18px rgba(20,22,40,.6)",
              display: "flex", flexDirection: "column", gap: 6,
            }}
          >
            <span style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: "#e4e9f0", fontFamily: mono, padding: "2px 4px 4px" }}>
              Módulos ASB
            </span>
            {STORES.map((s) => {
              const isActive = s.id === active.id;
              return (
                <button
                  key={s.id}
                  onClick={() => selectStore(s)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, textAlign: "left",
                    background: isActive ? "rgba(46,160,67,.06)" : "transparent",
                    border: `1px solid ${isActive ? s.color : "#1B2A6B"}`,
                    borderRadius: 4, padding: 10, cursor: "pointer", transition: "all .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = s.color)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = isActive ? s.color : "#1B2A6B")}
                >
                  <div style={{ width: 34, height: 34, background: s.color, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <s.Icon size={18} color="#08110a" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 700, fontFamily: mono, textTransform: "uppercase", letterSpacing: ".06em" }}>
                      {s.label}
                    </div>
                    <div style={{ color: "#c0d0e0", fontSize: 10, fontFamily: mono, marginTop: 2 }}>
                      {s.desc}
                    </div>
                  </div>
                  {isActive && <Check size={14} color={s.color} />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
