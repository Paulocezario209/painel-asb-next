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

const MESES_FULL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function VerbaClient({ rows }: { rows: VerbaRow[] }) {
  const router = useRouter();
  const hoje = new Date();
  const mesAtual = mesISO(hoje);

  // ---- seletor de período (estilo Gerenciador Meta): ano em chips + mês em chips
  const [selMes, setSelMes] = useState(mesAtual);
  const selAno = selMes.slice(0, 4);
  const anos = useMemo(() => {
    const set = new Set<string>(rows.map((r) => r.mes.slice(0, 4)));
    set.add(mesAtual.slice(0, 4));
    return Array.from(set).sort();
  }, [rows, mesAtual]);
  const proxMes = useMemo(() => {
    const [y, m] = selMes.split("-").map(Number);
    return mesISO(new Date(y, m, 1)); // m é 1-based no ISO → new Date(y, m) já é o mês seguinte
  }, [selMes]);
  const mesesComDado = useMemo(() => new Set(rows.map((r) => r.mes)), [rows]);

  // ---- agregados do mês SELECIONADO (todos os canais)
  const isMesCorrente = selMes === mesAtual;
  const atual = useMemo(() => {
    const doMes = rows.filter((r) => r.mes === selMes);
    return {
      verba: doMes.reduce((a, r) => a + Number(r.verba_brl), 0),
      gasto: doMes.reduce((a, r) => a + Number(r.gasto_brl), 0),
      saldo: doMes.reduce((a, r) => a + Number(r.saldo_brl), 0),
    };
  }, [rows, selMes]);

  // aporte do mês seguinte ao selecionado = verba do próximo (se definida; senão a do selecionado como referência) − saldo positivo herdado
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

  // ---- export CSV (Excel BR: ; como separador, vírgula decimal, BOM p/ acentos)
  function exportarCSV() {
    const doAno = rows.filter((r) => r.mes.slice(0, 4) === selAno).sort((a, b) => a.mes.localeCompare(b.mes) || a.canal.localeCompare(b.canal));
    const num = (v: number) => Number(v).toFixed(2).replace(".", ",");
    const linhas = [
      "mes;canal;verba_brl;gasto_brl;saldo_brl;aporte_brl;nota",
      ...doAno.map((r) =>
        [
          `${MESES_FULL[Number(r.mes.slice(5, 7)) - 1]}/${r.mes.slice(0, 4)}`,
          CANAL_LABEL[r.canal] ?? r.canal,
          num(Number(r.verba_brl)), num(Number(r.gasto_brl)), num(Number(r.saldo_brl)), num(Number(r.aporte_brl)),
          `"${(r.nota ?? "").replace(/"/g, '""')}"`,
        ].join(";"),
      ),
    ];
    const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verba_x_gasto_${selAno}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chip = (ativo: boolean): React.CSSProperties => ({
    background: ativo ? RED : "transparent",
    color: ativo ? "#FFFFFF" : "#c0d0e0",
    border: `1px solid ${ativo ? RED : "#2a2a2a"}`,
    borderRadius: 4, padding: "6px 12px", fontSize: 10, fontWeight: 700,
    fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase",
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Seletor de período (estilo Gerenciador Meta): ano + mês */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {anos.map((ano) => (
          <button key={ano} style={chip(ano === selAno)} onClick={() => setSelMes(ano === mesAtual.slice(0, 4) ? mesAtual : `${ano}-01-01`)}>
            {ano}
          </button>
        ))}
        <span style={{ width: 1, height: 20, background: "#2a2a2a", margin: "0 4px" }} />
        {MESES_FULL.map((nome, i) => {
          const iso = `${selAno}-${String(i + 1).padStart(2, "0")}-01`;
          const temDado = mesesComDado.has(iso);
          return (
            <button
              key={iso}
              style={{ ...chip(iso === selMes), opacity: temDado || iso === mesAtual ? 1 : 0.35 }}
              onClick={() => setSelMes(iso)}
              title={temDado ? undefined : "sem verba/gasto registrados"}
            >
              {nome}
            </button>
          );
        })}
        {!isMesCorrente && (
          <button style={{ ...chip(false), borderStyle: "dashed" }} onClick={() => setSelMes(mesAtual)}>
            hoje
          </button>
        )}
      </div>

      {/* Cards do mês selecionado */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={cardBox}>
          <p style={cardLabel}>Verba do mês ({fmtMes(selMes)}/{selAno})</p>
          <p style={{ ...cardValue, color: "#FFFFFF" }}>{fmtBRLc(atual.verba)}</p>
        </div>
        <div style={cardBox}>
          <p style={cardLabel}>{isMesCorrente ? "Gasto até hoje (MTD)" : "Gasto do mês (fechado)"}</p>
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

      {/* Histórico mês a mês (ano selecionado) */}
      <div style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8, padding: 16, overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ color: "#FFFFFF", fontSize: 11, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".08em", textTransform: "uppercase" }}>
            Histórico verba × gasto — {selAno}
          </p>
          <button
            onClick={exportarCSV}
            style={{
              background: "transparent", color: "#c0d0e0", border: "1px solid #2a2a2a", borderRadius: 4,
              padding: "6px 14px", fontSize: 9, fontWeight: 700, fontFamily: theme.font.label,
              letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            ⬇ Exportar CSV
          </button>
        </div>
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
            {rows.filter((r) => r.mes.slice(0, 4) === selAno).length === 0 && (
              <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: MUT, padding: 24 }}>Sem dados em {selAno} — defina a primeira verba no formulário acima.</td></tr>
            )}
            {rows.filter((r) => r.mes.slice(0, 4) === selAno).map((r) => {
              const saldo = Number(r.saldo_brl);
              const isMTD = r.mes === mesAtual;
              return (
                <tr key={`${r.mes}-${r.canal}`} style={{ borderBottom: "1px solid #222", background: r.mes === selMes ? "rgba(200,16,46,.07)" : "transparent" }}>
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
