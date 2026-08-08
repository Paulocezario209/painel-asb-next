"use client";

// Colapso persistente dos blocos da Central de Cadências (consultoria, item 13).
// - Persistência: localStorage (default seguro = aberto). Leitura via
//   useSyncExternalStore → sem setState em effect (lint react-hooks) e sem
//   hydration mismatch (snapshot do servidor = aberto).
// - Acessibilidade: <button> nativo com aria-expanded/aria-controls (teclado ok).
// - O cabeçalho chega pronto do servidor (ReactNode) — componentes de ícone não
//   cruzam a fronteira server→client como prop, JSX renderizado sim.
// - Conteúdo fechado fica display:none (as queries são server-side; não há custo
//   client a evitar).
import { useCallback, useSyncExternalStore } from "react";
import { ChevronDown } from "lucide-react";

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function readOpen(key: string): boolean {
  try {
    return localStorage.getItem(key) !== "0";
  } catch {
    return true; // localStorage indisponível → aberto
  }
}

export function CollapsibleSection({
  storageKey,
  id,
  header,
  children,
}: {
  storageKey: string;
  id?: string;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const KEY = `asb_cadencias_sec_${storageKey}`;
  const open = useSyncExternalStore(
    subscribe,
    () => readOpen(KEY),
    () => true, // snapshot no servidor: sempre aberto
  );

  const toggle = useCallback(() => {
    try {
      localStorage.setItem(KEY, open ? "0" : "1");
    } catch {
      /* preferência não persiste neste navegador */
    }
    listeners.forEach((cb) => cb());
  }, [KEY, open]);

  const contentId = `sec-${storageKey}`;
  return (
    <section id={id} style={{ scrollMarginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{header}</div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          title={open ? "Ocultar bloco" : "Exibir bloco"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "transparent",
            border: "1px solid rgba(255,255,255,.12)",
            borderRadius: 7,
            color: "#9aa3ba",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            padding: "4px 9px",
            cursor: "pointer",
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {open ? "ocultar" : "exibir"}
          <ChevronDown
            size={13}
            style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform .15s" }}
            aria-hidden
          />
        </button>
      </div>
      <div
        id={contentId}
        style={{ display: open ? "flex" : "none", flexDirection: "column", gap: 14 }}
      >
        {children}
      </div>
    </section>
  );
}
