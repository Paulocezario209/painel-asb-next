"use client";
import { C } from "../lib/ui";
import { theme } from "@/lib/theme";
import { STATUS_COR, type Status } from "../lib/classificar";
import type { Registro } from "../lib/storage-supabase";

const DIAS_SEM = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

export function Calendario({ ano, mes, registros, onPickDia }: {
  ano: number; mes: number; registros: Record<string, Registro>; onPickDia: (data: string, r?: Registro) => void;
}) {
  const primeiro = new Date(ano, mes - 1, 1);
  const offset = primeiro.getDay(); // 0=dom
  const totalDias = new Date(ano, mes, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: totalDias }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 }}>
        {DIAS_SEM.map((d) => <div key={d} style={{ textAlign: "center", fontSize: 9, color: C.mut2, fontFamily: theme.font.label, letterSpacing: ".05em", padding: 4 }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
        {cells.map((dia, i) => {
          if (dia === null) return <div key={i} />;
          const data = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
          const r = registros[data];
          const st = (r?.status as Status) ?? "sem_dados";
          const cor = STATUS_COR[st];
          const temDado = r && (r.kg_produzido > 0 || st === "feriado");
          return (
            <button key={i} onClick={() => onPickDia(data, r)}
              title={r ? `${data} · ${r.kg_produzido}kg · R$${r.custo_kg ?? "—"}/kg` : data}
              style={{
                aspectRatio: "1", borderRadius: 5, cursor: "pointer", padding: 4, textAlign: "left",
                background: temDado ? `${cor}22` : C.card2,
                border: `1px solid ${temDado ? cor : C.borda}`,
                display: "flex", flexDirection: "column", justifyContent: "space-between",
              }}>
              <span style={{ fontSize: 11, color: C.branco, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{dia}</span>
              {r && r.kg_produzido > 0 ? (
                <span style={{ fontSize: 9, color: cor, fontFamily: theme.font.num, fontWeight: 700 }}>R${(r.custo_kg ?? 0).toFixed(1)}</span>
              ) : st === "feriado" ? (
                <span style={{ fontSize: 8, color: cor, fontFamily: theme.font.label }}>feriado</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
