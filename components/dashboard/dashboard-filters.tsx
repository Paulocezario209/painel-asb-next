// components/dashboard/dashboard-filters.tsx — P2: filtros de mês + vendedor (URL-driven).
// Client Component: atualiza ?mes=YYYY-MM e ?vendedor=SETOR_* na URL (Server Component pai relê).
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { VENDOR_LABELS, VENDOR_ORDER } from "@/lib/vendor-labels";

const mono = "var(--font-geist-sans), system-ui, sans-serif";
const GREEN = "#2ea043";

// showSemTime (opt-in, default off): acrescenta "Sem time" (?vendedor=none → routing_team null/'').
// Só a Central de Cadências usa hoje; demais telas seguem com Todos + setores.
export function DashboardFilters({ showMonth = true, showVendedor = true, showSearch = false, showSemTime = false, searchPlaceholder = "buscar nome, cidade ou telefone", defaultMes, maxMonth }: { showMonth?: boolean; showVendedor?: boolean; showSearch?: boolean; showSemTime?: boolean; searchPlaceholder?: string; defaultMes?: string; maxMonth?: string }) {
  const VENDEDORES = [
    { v: "", label: "Todos" },
    ...VENDOR_ORDER.map(v => ({ v, label: VENDOR_LABELS[v] })),
    ...(showSemTime ? [{ v: "none", label: "Sem time" }] : []),
  ];
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const mesUrl = sp.get("mes") ?? "";
  // defaultMes (ex.: mês corrente) é exibido quando a URL não tem ?mes= — telas com default de mês.
  const mes = mesUrl || defaultMes || "";
  const vendedor = sp.get("vendedor") ?? "";
  const qUrl = sp.get("q") ?? "";

  // BUGFIX: input month é controlado; router.push é assíncrono, então o input revertia a
  // seleção visual antes do searchParams atualizar. Estado local reflete a seleção na hora;
  // useEffect ressincroniza com a URL (reload/navegação externa/limpar).
  const [mesLocal, setMesLocal] = useState(mes);
  useEffect(() => { setMesLocal(mes); }, [mes]);

  // Busca (lupa): estado local + debounce 350ms → escreve ?q= na URL (server relê e filtra).
  // Ressincroniza com a URL em navegação externa / limpar.
  const [qLocal, setQLocal] = useState(qUrl);
  useEffect(() => { setQLocal(qUrl); }, [qUrl]);
  useEffect(() => {
    const val = qLocal.trim();
    if (val === qUrl) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams(sp.toString());
      if (val) p.set("q", val); else p.delete("q");
      const qs = p.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qLocal]);

  function update(key: string, val: string) {
    const p = new URLSearchParams(sp.toString());
    if (val) p.set(key, val);
    else p.delete(key);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      {showSearch && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--asb-card-hi)", border: `1px solid ${qLocal ? GREEN : "rgba(255,255,255,.14)"}`, borderRadius: 5, padding: "4px 9px" }}>
          <span style={{ color: qLocal ? GREEN : "#c0d0e0", fontSize: 12 }} aria-hidden>{"⌕"}</span>
          <input
            type="search"
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            placeholder={searchPlaceholder}
            style={{ background: "transparent", border: "none", outline: "none", color: "#c8d8e8", fontSize: 11, fontFamily: mono, width: 220 }}
          />
          {qLocal && (
            <button onClick={() => setQLocal("")} aria-label="limpar busca" style={{ background: "none", border: "none", color: "#c0d0e0", fontSize: 12, cursor: "pointer", lineHeight: 1 }}>×</button>
          )}
        </div>
      )}
      {showMonth && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#e4e9f0", fontSize: 9, fontFamily: mono, letterSpacing: ".12em", textTransform: "uppercase" }}>Mês</span>
          <input
            type="month"
            value={mesLocal}
            max={maxMonth}
            onChange={(e) => { setMesLocal(e.target.value); update("mes", e.target.value); }}
            style={{ background: "var(--asb-card-hi)", border: "1px solid #2a2a2a", borderRadius: 5, padding: "5px 8px", color: "#c8d8e8", fontSize: 11, fontFamily: mono, colorScheme: "dark" }}
          />
          {(defaultMes ? (mesUrl && mesUrl !== defaultMes) : mesLocal) && (
            <button onClick={() => { setMesLocal(defaultMes ?? ""); update("mes", ""); }} style={{ background: "none", border: "none", color: "#c0d0e0", fontSize: 10, fontFamily: mono, cursor: "pointer" }}>
              {defaultMes ? "mês atual" : "limpar"}
            </button>
          )}
        </div>
      )}

      {showVendedor && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#e4e9f0", fontSize: 9, fontFamily: mono, letterSpacing: ".12em", textTransform: "uppercase", marginRight: 2 }}>Vendedor</span>
          {VENDEDORES.map(({ v, label }) => {
            const active = vendedor === v || (!vendedor && v === "");
            return (
              <button
                key={v || "todos"}
                onClick={() => update("vendedor", v)}
                style={{
                  background: active ? `rgba(46,160,67,.16)` : "transparent",
                  border: `1px solid ${active ? GREEN : "rgba(255,255,255,.14)"}`,
                  borderRadius: 5, padding: "5px 11px",
                  color: active ? "#fff" : "#c0d0e0",
                  fontSize: 10, fontFamily: mono, letterSpacing: ".06em", cursor: "pointer",
                  fontWeight: active ? 700 : 400,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
