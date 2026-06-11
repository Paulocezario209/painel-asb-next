// components/dashboard/dashboard-filters.tsx — P2: filtros de mês + vendedor (URL-driven).
// Client Component: atualiza ?mes=YYYY-MM e ?vendedor=SETOR_* na URL (Server Component pai relê).
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const mono = "'Courier New', monospace";
const GREEN = "#2ea043";

const VENDEDORES = [
  { v: "", label: "Todos" },
  { v: "SETOR_SOROCABA_SAO_PAULO", label: "Ana" },
  { v: "SETOR_CAMPINAS_JUNDIAI", label: "Alan" },
  { v: "SETOR_CUIT", label: "CUIT" },
];

export function DashboardFilters({ showMonth = true, showVendedor = true, maxMonth }: { showMonth?: boolean; showVendedor?: boolean; maxMonth?: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const pathname = usePathname();
  const mes = sp.get("mes") ?? "";
  const vendedor = sp.get("vendedor") ?? "";

  // BUGFIX: input month é controlado; router.push é assíncrono, então o input revertia a
  // seleção visual antes do searchParams atualizar. Estado local reflete a seleção na hora;
  // useEffect ressincroniza com a URL (reload/navegação externa/limpar).
  const [mesLocal, setMesLocal] = useState(mes);
  useEffect(() => { setMesLocal(mes); }, [mes]);

  function update(key: string, val: string) {
    const p = new URLSearchParams(sp.toString());
    if (val) p.set(key, val);
    else p.delete(key);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      {showMonth && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#556677", fontSize: 9, fontFamily: mono, letterSpacing: ".12em", textTransform: "uppercase" }}>Mês</span>
          <input
            type="month"
            value={mesLocal}
            max={maxMonth}
            onChange={(e) => { setMesLocal(e.target.value); update("mes", e.target.value); }}
            style={{ background: "#0d1117", border: "1px solid #2a2a2a", borderRadius: 5, padding: "5px 8px", color: "#c8d8e8", fontSize: 11, fontFamily: mono, colorScheme: "dark" }}
          />
          {mesLocal && (
            <button onClick={() => { setMesLocal(""); update("mes", ""); }} style={{ background: "none", border: "none", color: "#8899aa", fontSize: 10, fontFamily: mono, cursor: "pointer" }}>limpar</button>
          )}
        </div>
      )}

      {showVendedor && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#556677", fontSize: 9, fontFamily: mono, letterSpacing: ".12em", textTransform: "uppercase", marginRight: 2 }}>Vendedor</span>
          {VENDEDORES.map(({ v, label }) => {
            const active = vendedor === v || (!vendedor && v === "");
            return (
              <button
                key={v || "todos"}
                onClick={() => update("vendedor", v)}
                style={{
                  background: active ? `rgba(46,160,67,.16)` : "transparent",
                  border: `1px solid ${active ? GREEN : "#2a2a2a"}`,
                  borderRadius: 5, padding: "5px 11px",
                  color: active ? "#fff" : "#8899aa",
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
