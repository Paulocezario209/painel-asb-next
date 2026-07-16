"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, History } from "lucide-react";
import { theme } from "@/lib/theme";
import { RED, GREEN, MUT, fmtBRLc, fmtMes, th, td } from "@/lib/marketing/ui";
import { SectionHead, StatTile } from "@/app/dashboard/lib/ui";
import { S } from "@/app/dashboard/lib/dashboard-tokens";

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

  // ---- POTE ÚNICO: totais por mês (todos os canais somados — verba da Cránium cobre Meta+Google)
  const totaisPorMes = useMemo(() => {
    const m = new Map<string, { verba: number; gasto: number; saldo: number }>();
    for (const r of rows) {
      const cur = m.get(r.mes) ?? { verba: 0, gasto: 0, saldo: 0 };
      cur.verba += Number(r.verba_brl);
      cur.gasto += Number(r.gasto_brl);
      cur.saldo += Number(r.saldo_brl);
      m.set(r.mes, cur);
    }
    return m;
  }, [rows]);

  // aporte do mês (nível TOTAL) = verba do mês − saldo positivo herdado do mês anterior
  const aporteDoMes = useMemo(() => {
    const meses = Array.from(totaisPorMes.keys()).sort();
    const m = new Map<string, number>();
    let saldoAnterior = 0;
    for (const mes of meses) {
      const t = totaisPorMes.get(mes)!;
      m.set(mes, Math.max(t.verba - Math.max(saldoAnterior, 0), 0));
      saldoAnterior = t.saldo;
    }
    return m;
  }, [totaisPorMes]);

  // ---- agregados do mês SELECIONADO (todos os canais)
  const isMesCorrente = selMes === mesAtual;
  const atual = useMemo(
    () => totaisPorMes.get(selMes) ?? { verba: 0, gasto: 0, saldo: 0 },
    [totaisPorMes, selMes],
  );

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
    const num = (v: number) => Number(v).toFixed(2).replace(".", ",");
    const fmtM = (mes: string) => `${MESES_FULL[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)}`;
    const mesesAno = Array.from(new Set(rows.filter((r) => r.mes.slice(0, 4) === selAno).map((r) => r.mes))).sort();
    const linhas = ["mes;canal;verba_brl;gasto_brl;saldo_brl;aporte_brl;nota"];
    for (const mes of mesesAno) {
      const doMes = rows.filter((r) => r.mes === mes).sort((a, b) => a.canal.localeCompare(b.canal));
      const t = totaisPorMes.get(mes)!;
      linhas.push(
        [fmtM(mes), "TOTAL", num(t.verba), num(t.gasto), num(t.saldo), num(aporteDoMes.get(mes) ?? 0),
          `"${(doMes.find((r) => r.nota)?.nota ?? "").replace(/"/g, '""')}"`].join(";"),
      );
      if (doMes.length > 1) {
        for (const r of doMes) {
          linhas.push(
            [fmtM(mes), CANAL_LABEL[r.canal] ?? r.canal, num(Number(r.verba_brl)), num(Number(r.gasto_brl)),
              num(Number(r.saldo_brl)), "", `"${(r.nota ?? "").replace(/"/g, '""')}"`].join(";"),
          );
        }
      }
    }
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
    border: `1px solid ${ativo ? RED : "var(--asb-border)"}`,
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
        <span style={{ width: 1, height: 20, background: "var(--asb-border)", margin: "0 4px" }} />
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
        <div style={{ flex: 1, minWidth: 190 }}>
          <StatTile
            label="Verba do Mês"
            value={fmtBRLc(atual.verba)}
            sub={`${fmtMes(selMes)}/${selAno}`}
          />
        </div>
        <div style={{ flex: 1, minWidth: 190 }}>
          <StatTile
            label={isMesCorrente ? "Gasto Até Hoje (MTD)" : "Gasto do Mês (Fechado)"}
            value={fmtBRLc(atual.gasto)}
            num="#c8d8e8"
          />
        </div>
        <div style={{ flex: 1, minWidth: 190 }}>
          <StatTile
            label="Saldo do Mês"
            value={fmtBRLc(atual.saldo)}
            accent={atual.saldo >= 0 ? GREEN : RED}
            num={atual.saldo >= 0 ? GREEN : RED}
          />
        </div>
        <div style={{ flex: 1, minWidth: 190 }}>
          <StatTile
            label={`Aporte p/ ${fmtMes(proxMes)}`}
            value={fmtBRLc(proximo.aporte)}
            num={YELLOWISH}
            accent={proximo.definida ? undefined : RED}
            badges={proximo.definida ? undefined : (
              <span style={{ background: `${RED}18`, border: `1px solid ${RED}50`, color: RED, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, fontFamily: theme.font.label }}>
                sugestão — verba não definida
              </span>
            )}
            sub={`verba ${fmtBRLc(proximo.ref)} − saldo herdado ${fmtBRLc(Math.max(atual.saldo, 0))}`}
          />
        </div>
      </div>

      {/* Form: definir verba do mês */}
      <div style={{ ...S.card, padding: "20px 24px" }}>
        <SectionHead Icon={Wallet} color="#8bb4ff" title="Definir Verba do Mês" desc="Registra a verba (pote único) do mês por canal" />
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
      <div style={{ ...S.card, padding: "20px 24px", overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
          <SectionHead Icon={History} color="#f59e0b" title={`Histórico Verba × Gasto — ${selAno}`} desc="Pote único por mês (TOTAL) com detalhamento por canal" />
          <button
            onClick={exportarCSV}
            style={{
              flexShrink: 0, background: "transparent", color: "#c0d0e0", border: "1px solid var(--asb-border)", borderRadius: 4,
              padding: "6px 14px", fontSize: 9, fontWeight: 700, fontFamily: theme.font.label,
              letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            ⬇ Exportar CSV
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--asb-border)" }}>
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
              <tr><td colSpan={7} style={{ ...td, fontFamily: theme.font.label, textAlign: "center", color: MUT, padding: 24 }}>Sem dados em {selAno} — defina a primeira verba no formulário acima.</td></tr>
            )}
            {Array.from(new Set(rows.filter((r) => r.mes.slice(0, 4) === selAno).map((r) => r.mes)))
              .sort((a, b) => b.localeCompare(a))
              .map((mes) => {
                const doMes = rows.filter((r) => r.mes === mes).sort((a, b) => a.canal.localeCompare(b.canal));
                const t = totaisPorMes.get(mes)!;
                const isMTD = mes === mesAtual;
                const multiCanal = doMes.length > 1;
                return [
                  <tr key={`${mes}-total`} style={{ borderBottom: multiCanal ? "none" : "1px solid var(--asb-border)", background: mes === selMes ? "rgba(200,16,46,.07)" : "transparent" }}>
                    <td style={{ ...td, fontFamily: theme.font.label, textTransform: "capitalize", color: "#FFFFFF", fontWeight: 700 }}>
                      {fmtMes(mes)}/{mes.slice(0, 4)}
                      {isMTD && <span style={{ marginLeft: 6, fontSize: 8, color: "#e8b923", letterSpacing: ".1em" }}>MTD</span>}
                    </td>
                    <td style={{ ...td, fontFamily: theme.font.label, color: "#FFFFFF", fontWeight: 700 }}>{multiCanal ? "TOTAL" : (CANAL_LABEL[doMes[0].canal] ?? doMes[0].canal)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#FFFFFF", fontWeight: 700 }}>{fmtBRLc(t.verba)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#FFFFFF", fontWeight: 700 }}>{fmtBRLc(t.gasto)}</td>
                    <td style={{ ...td, textAlign: "right", color: t.saldo >= 0 ? GREEN : RED, fontWeight: 700 }}>{fmtBRLc(t.saldo)}</td>
                    <td style={{ ...td, textAlign: "right", color: "#FFFFFF", fontWeight: 700 }}>{fmtBRLc(aporteDoMes.get(mes) ?? 0)}</td>
                    <td style={{ ...td, fontFamily: theme.font.label, color: MUT, fontSize: 10 }}>{multiCanal ? (doMes.find((r) => r.nota)?.nota ?? "—") : (doMes[0].nota ?? "—")}</td>
                  </tr>,
                  ...(multiCanal
                    ? doMes.map((r) => (
                        <tr key={`${mes}-${r.canal}`} style={{ borderBottom: r === doMes[doMes.length - 1] ? "1px solid var(--asb-border)" : "none", background: mes === selMes ? "rgba(200,16,46,.04)" : "transparent" }}>
                          <td style={td} />
                          <td style={{ ...td, fontFamily: theme.font.label, color: MUT, fontSize: 10, paddingLeft: 22 }}>↳ {CANAL_LABEL[r.canal] ?? r.canal}</td>
                          <td style={{ ...td, textAlign: "right", color: MUT, fontSize: 10 }}>{fmtBRLc(Number(r.verba_brl))}</td>
                          <td style={{ ...td, textAlign: "right", color: MUT, fontSize: 10 }}>{fmtBRLc(Number(r.gasto_brl))}</td>
                          <td style={{ ...td, textAlign: "right", color: MUT, fontSize: 10 }}>{fmtBRLc(Number(r.saldo_brl))}</td>
                          <td style={{ ...td, textAlign: "right", color: MUT, fontSize: 10 }}>—</td>
                          <td style={{ ...td, fontFamily: theme.font.label, color: MUT, fontSize: 10 }}>{r.nota ?? ""}</td>
                        </tr>
                      ))
                    : []),
                ];
              })}
          </tbody>
        </table>
        <p style={{ color: MUT, fontSize: 9, fontFamily: theme.font.label, marginTop: 10 }}>
          POTE ÚNICO: verba do mês cobre TODOS os canais somados (linha TOTAL); canais aparecem como detalhamento (↳). Saldo = verba − gasto do mês. Aporte do mês = verba − saldo positivo herdado do mês anterior (o saldo que sobra abate o débito seguinte). Mês corrente é MTD (gasto parcial).
        </p>
      </div>
    </div>
  );
}

const YELLOWISH = "#e8b923";
const fieldLabel: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, color: MUT, fontSize: 9, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)", borderRadius: 8, color: "#e6ebf5", padding: "8px 11px", fontSize: 12, fontFamily: theme.font.label };
