"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { theme } from "@/lib/theme";
import { RED, GREEN, MUT, fmtBRLc, fmtMes, th, td } from "@/lib/marketing/ui";

export type VerbaRow = {
  mes: string;            // YYYY-MM-DD (dia 1º)
  canal: string;          // meta | google
  verba_brl: number;
  gasto_brl: number;
  saldo_brl: number;
  aporte_brl: number;
  nota: string | null;
};

const CANAIS_VERBA = ["meta", "google"] as const;
const CANAL_LABEL: Record<string, string> = { meta: "Meta Ads", google: "Google Ads" };

const cardBox: React.CSSProperties = { background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, flex: 1, minWidth: 170 };
const cardLabel: React.CSSProperties = { color: MUT, fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 6 };
const cardValue: React.CSSProperties = { fontSize: 22, fontWeight: 700, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" };

function mesISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function VerbaClient({ rows }: { rows: VerbaRow[] }) {
  const router = useRouter();
  const hoje = new Date();
  const mesAtual = mesISO(hoje);
  const proxMes = mesISO(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1));

  // ---- agregados do mês corrente (todos os canais)
  const atual = useMemo(() => {
    const doMes = rows.filter((r) => r.mes === mesAtual);
    return {
      verba: doMes.reduce((a, r) => a + Number(r.verba_brl), 0),
      gasto: doMes.reduce((a, r) => a + Number(r.gasto_brl), 0),
      saldo: doMes.reduce((a, r) => a + Number(r.saldo_brl), 0),
    };
  }, [rows, mesAtual]);

  // aporte sugerido p/ o próximo mês = verba do próximo (se definida; senão a atual como referência) − saldo positivo herdado
  const proximo = useMemo(() => {
    const verbaProx = rows.filter((r) => r.mes === proxMes).reduce((a, r) => a + Number(r.verba_brl), 0);
    const ref = verbaProx > 0 ? verbaProx : atual.verba;
    const definida = verbaProx > 0;
    return { definida, aporte: Math.max(ref - Math.max(atual.saldo, 0), 0), ref };
  }, [rows, proxMes, atual]);

  // ---- form de definição de verba
  const [fMes, setFMes] = useState(proxMes.slice(0, 7));
  const [fCanal, setFCanal] = useState<string>("meta");
  const [fValor, setFValor] = useState("");
  const [fNota, setFNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function salvar() {
    const valor = Number(fValor.replace(",", "."));
    if (!fMes || !Number.isFinite(valor) || valor < 0) {
      setMsg({ ok: false, text: "Informe mês e valor válidos." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/marketing/verba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes: `${fMes}-01`, canal: fCanal, verba_brl: valor, nota: fNota || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setMsg({ ok: true, text: `Verba de ${CANAL_LABEL[fCanal] ?? fCanal} em ${fmtMes(`${fMes}-01`)} definida: ${fmtBRLc(valor)}.` });
      setFValor("");
      setFNota("");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Falha ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Cards do mês corrente */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={cardBox}>
          <p style={cardLabel}>Verba do mês ({fmtMes(mesAtual)})</p>
          <p style={{ ...cardValue, color: "#FFFFFF" }}>{fmtBRLc(atual.verba)}</p>
        </div>
        <div style={cardBox}>
          <p style={cardLabel}>Gasto até hoje (MTD)</p>
          <p style={{ ...cardValue, color: "#c8d8e8" }}>{fmtBRLc(atual.gasto)}</p>
        </div>
        <div style={cardBox}>
          <p style={cardLabel}>Saldo do mês</p>
          <p style={{ ...cardValue, color: atual.saldo >= 0 ? GREEN : RED }}>{fmtBRLc(atual.saldo)}</p>
        </div>
        <div style={{ ...cardBox, border: `1px solid ${proximo.definida ? "#2a2a2a" : RED}` }}>
          <p style={cardLabel}>Aporte p/ {fmtMes(proxMes)} {proximo.definida ? "" : "(sugestão — verba não definida)"}</p>
          <p style={{ ...cardValue, color: YELLOWISH }}>{fmtBRLc(proximo.aporte)}</p>
          <p style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label, marginTop: 4 }}>
            verba {fmtBRLc(proximo.ref)} − saldo herdado {fmtBRLc(Math.max(atual.saldo, 0))}
          </p>
        </div>
      </div>

      {/* Form: definir verba do mês */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16 }}>
        <p style={{ color: "#FFFFFF", fontSize: 11, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>
          Definir verba do mês
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={fieldLabel}>
            Mês
            <input type="month" value={fMes} onChange={(e) => setFMes(e.target.value)} style={inputStyle} />
          </label>
          <label style={fieldLabel}>
            Canal
            <select value={fCanal} onChange={(e) => setFCanal(e.target.value)} style={inputStyle}>
              {CANAIS_VERBA.map((c) => (
                <option key={c} value={c}>{CANAL_LABEL[c]}</option>
              ))}
            </select>
          </label>
          <label style={fieldLabel}>
            Verba (R$)
            <input type="number" min="0" step="0.01" placeholder="1500,00" value={fValor} onChange={(e) => setFValor(e.target.value)} style={{ ...inputStyle, width: 120 }} />
          </label>
          <label style={{ ...fieldLabel, flex: 1, minWidth: 180 }}>
            Nota (opcional)
            <input type="text" placeholder="ex.: verba própria pós-Cránium" value={fNota} onChange={(e) => setFNota(e.target.value)} style={{ ...inputStyle, width: "100%" }} />
          </label>
          <button
            onClick={salvar}
            disabled={saving}
            style={{
              background: RED, color: "#FFFFFF", border: "none", borderRadius: 4,
              padding: "9px 18px", fontSize: 10, fontWeight: 700, fontFamily: theme.font.label,
              letterSpacing: ".12em", textTransform: "uppercase", cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
        {msg && (
          <p style={{ marginTop: 10, fontSize: 11, fontFamily: theme.font.label, color: msg.ok ? GREEN : RED }}>{msg.text}</p>
        )}
      </div>

      {/* Histórico mês a mês */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, overflowX: "auto" }}>
        <p style={{ color: "#FFFFFF", fontSize: 11, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 12 }}>
          Histórico verba × gasto
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #2a2a2a" }}>
              <th style={{ ...th, textAlign: "left" }}>Mês</th>
              <th style={{ ...th, textAlign: "left" }}>Canal</th>
              <th style={{ ...th, textAlign: "right" }}>Verba</th>
              <th style={{ ...th, textAlign: "right" }}>Gasto</th>
              <th style={{ ...th, textAlign: "right" }}>Saldo</th>
              <th style={{ ...th, textAlign: "right" }}>Aporte do mês</th>
              <th style={{ ...th, textAlign: "left" }}>Nota</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: MUT, padding: 24 }}>Sem dados — aplicar migration e definir a primeira verba.</td></tr>
            )}
            {rows.map((r) => {
              const saldo = Number(r.saldo_brl);
              const isMTD = r.mes === mesAtual;
              return (
                <tr key={`${r.mes}-${r.canal}`} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ ...td, textTransform: "capitalize" }}>
                    {fmtMes(r.mes)}/{r.mes.slice(0, 4)}
                    {isMTD && <span style={{ marginLeft: 6, fontSize: 8, color: "#e8b923", letterSpacing: ".1em" }}>MTD</span>}
                  </td>
                  <td style={td}>{CANAL_LABEL[r.canal] ?? r.canal}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtBRLc(Number(r.verba_brl))}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtBRLc(Number(r.gasto_brl))}</td>
                  <td style={{ ...td, textAlign: "right", color: saldo >= 0 ? GREEN : RED, fontWeight: 700 }}>{fmtBRLc(saldo)}</td>
                  <td style={{ ...td, textAlign: "right" }}>{fmtBRLc(Number(r.aporte_brl))}</td>
                  <td style={{ ...td, color: MUT, fontSize: 10 }}>{r.nota ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label, marginTop: 10 }}>
          Saldo = verba − gasto do mês. Aporte do mês = verba − saldo positivo herdado do mês anterior (regra: o saldo que sobra abate o débito seguinte). Mês corrente é MTD (gasto parcial).
        </p>
      </div>
    </div>
  );
}

const YELLOWISH = "#e8b923";
const fieldLabel: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, color: MUT, fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { background: "#0e1118", border: "1px solid #2a2a2a", borderRadius: 4, color: "#e4e9f0", padding: "8px 10px", fontSize: 12, fontFamily: theme.font.num };
