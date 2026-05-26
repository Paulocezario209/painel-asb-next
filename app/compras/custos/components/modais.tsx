"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { C, mono, sInput, sLabel, btn, btnGhost } from "../lib/ui";
import { api } from "../lib/storage-supabase";

function Shell({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.card, border: `1px solid ${C.borda}`, borderRadius: 8, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ color: C.branco, fontSize: 13, fontWeight: 700, fontFamily: mono, letterSpacing: ".08em", textTransform: "uppercase" }}>{titulo}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.mut }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={sLabel}>{label}</span>{children}</div>;
}

const hoje = () => new Date().toISOString().slice(0, 10);

export function ModalProducao({ registro, onClose, onSaved }: { registro?: Record<string, unknown> | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    data: (registro?.data as string) ?? hoje(),
    kgProduzido: Number(registro?.kg_produzido ?? 0),
    custoTotal: Number(registro?.custo_total ?? 0),
    temperatura: Number(registro?.temperatura ?? 0),
    ops: Number(registro?.ops ?? 0),
    horasMoagem: Number(registro?.horas_moagem ?? 0),
    horasModelagem: Number(registro?.horas_modelagem ?? 0),
    horasEmbalamento: Number(registro?.horas_embalamento ?? 0),
    obs: (registro?.obs as string) ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  const custoKg = f.kgProduzido > 0 ? f.custoTotal / f.kgProduzido : 0;

  async function salvar() {
    setSaving(true); setErr(null);
    try { await api.salvarRegistro(f); onSaved(); onClose(); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  return (
    <Shell titulo={registro ? "Editar Dia" : "Registrar Dia"} onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Campo label="Data"><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} style={sInput} /></Campo>
        <Campo label="kg Produzido"><input type="number" step="0.01" value={f.kgProduzido} onChange={(e) => set("kgProduzido", Number(e.target.value))} style={sInput} /></Campo>
        <Campo label="Custo Total (R$)"><input type="number" step="0.01" value={f.custoTotal} onChange={(e) => set("custoTotal", Number(e.target.value))} style={sInput} /></Campo>
        <Campo label="Temperatura (°C)"><input type="number" step="0.1" value={f.temperatura} onChange={(e) => set("temperatura", Number(e.target.value))} style={sInput} /></Campo>
        <Campo label="OPs"><input type="number" value={f.ops} onChange={(e) => set("ops", Number(e.target.value))} style={sInput} /></Campo>
        <Campo label="Custo/kg (auto)"><div style={{ ...sInput, color: C.verde, display: "flex", alignItems: "center" }}>R$ {custoKg.toFixed(2)}</div></Campo>
        <Campo label="Horas Moagem"><input type="number" step="0.01" value={f.horasMoagem} onChange={(e) => set("horasMoagem", Number(e.target.value))} style={sInput} /></Campo>
        <Campo label="Horas Modelagem"><input type="number" step="0.01" value={f.horasModelagem} onChange={(e) => set("horasModelagem", Number(e.target.value))} style={sInput} /></Campo>
        <Campo label="Horas Embalamento"><input type="number" step="0.01" value={f.horasEmbalamento} onChange={(e) => set("horasEmbalamento", Number(e.target.value))} style={sInput} /></Campo>
        <div style={{ gridColumn: "1 / -1" }}><Campo label="Observação"><input value={f.obs} onChange={(e) => set("obs", e.target.value)} style={sInput} placeholder="ex: Semana 2 / feriado..." /></Campo></div>
      </div>
      {err && <p style={{ color: C.vermelho, fontSize: 11, fontFamily: mono, marginTop: 10 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={salvar} disabled={saving || !f.data} style={btn(!saving && !!f.data)}>{saving ? "Salvando..." : "Salvar"}</button>
      </div>
    </Shell>
  );
}

export function ModalLote({ semanaInicio, onClose, onSaved }: { semanaInicio?: string; onClose: () => void; onSaved: () => void }) {
  const base = semanaInicio ?? hoje();
  const dias = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(base + "T00:00:00"); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const [linhas, setLinhas] = useState(dias.map((data) => ({ data, kgProduzido: 0, custoTotal: 0, temperatura: 0, ops: 0 })));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upd = (i: number, k: string, v: string | number) => setLinhas((p) => p.map((l, j) => j === i ? { ...l, [k]: v } : l));

  async function salvar() {
    setSaving(true); setErr(null);
    try { await api.salvarLote(linhas.filter((l) => l.kgProduzido > 0 || l.custoTotal > 0)); onSaved(); onClose(); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }

  return (
    <Shell titulo="Lote Semanal" onClose={onClose}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: mono, fontSize: 11 }}>
        <thead><tr>{["Data", "kg", "Custo R$", "Temp", "OPs"].map((h) => <th key={h} style={{ ...sLabel, padding: "4px 6px", textAlign: "left" }}>{h}</th>)}</tr></thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={l.data}>
              <td style={{ padding: 3, color: C.texto }}>{l.data.slice(5)}</td>
              <td style={{ padding: 3 }}><input type="number" step="0.01" value={l.kgProduzido} onChange={(e) => upd(i, "kgProduzido", Number(e.target.value))} style={{ ...sInput, padding: "4px 6px" }} /></td>
              <td style={{ padding: 3 }}><input type="number" step="0.01" value={l.custoTotal} onChange={(e) => upd(i, "custoTotal", Number(e.target.value))} style={{ ...sInput, padding: "4px 6px" }} /></td>
              <td style={{ padding: 3 }}><input type="number" step="0.1" value={l.temperatura} onChange={(e) => upd(i, "temperatura", Number(e.target.value))} style={{ ...sInput, padding: "4px 6px" }} /></td>
              <td style={{ padding: 3 }}><input type="number" value={l.ops} onChange={(e) => upd(i, "ops", Number(e.target.value))} style={{ ...sInput, padding: "4px 6px" }} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {err && <p style={{ color: C.vermelho, fontSize: 11, fontFamily: mono, marginTop: 10 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={salvar} disabled={saving} style={btn(!saving)}>{saving ? "Salvando..." : "Gravar lote"}</button>
      </div>
    </Shell>
  );
}

export function ModalInsumo({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ data: hoje(), materia: "", fornecedor: "", quantidade: 0, unidade: "kg", custo_unit: 0, lote: "", validade: "", sif: "", categoria: "", obs: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  async function salvar() {
    setSaving(true); setErr(null);
    try { await api.salvarInsumo({ ...f, validade: f.validade || null }); onSaved(); onClose(); }
    catch (e) { setErr((e as Error).message); setSaving(false); }
  }
  return (
    <Shell titulo="Novo Insumo" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Campo label="Data"><input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} style={sInput} /></Campo>
        <Campo label="Matéria"><input value={f.materia} onChange={(e) => set("materia", e.target.value)} style={sInput} /></Campo>
        <Campo label="Fornecedor"><input value={f.fornecedor} onChange={(e) => set("fornecedor", e.target.value)} style={sInput} /></Campo>
        <Campo label="Quantidade"><input type="number" step="0.001" value={f.quantidade} onChange={(e) => set("quantidade", Number(e.target.value))} style={sInput} /></Campo>
        <Campo label="Unidade"><select value={f.unidade} onChange={(e) => set("unidade", e.target.value)} style={sInput}>{["kg", "un", "L", "m", "outro"].map((u) => <option key={u} value={u}>{u}</option>)}</select></Campo>
        <Campo label="Custo Unit. (R$)"><input type="number" step="0.0001" value={f.custo_unit} onChange={(e) => set("custo_unit", Number(e.target.value))} style={sInput} /></Campo>
        <Campo label="Lote"><input value={f.lote} onChange={(e) => set("lote", e.target.value)} style={sInput} /></Campo>
        <Campo label="Validade"><input type="date" value={f.validade} onChange={(e) => set("validade", e.target.value)} style={sInput} /></Campo>
        <Campo label="SIF"><input value={f.sif} onChange={(e) => set("sif", e.target.value)} style={sInput} /></Campo>
        <Campo label="Categoria"><input value={f.categoria} onChange={(e) => set("categoria", e.target.value)} style={sInput} /></Campo>
      </div>
      {err && <p style={{ color: C.vermelho, fontSize: 11, fontFamily: mono, marginTop: 10 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
        <button onClick={onClose} style={btnGhost}>Cancelar</button>
        <button onClick={salvar} disabled={saving || !f.materia} style={btn(!saving && !!f.materia)}>{saving ? "Salvando..." : "Salvar"}</button>
      </div>
    </Shell>
  );
}
