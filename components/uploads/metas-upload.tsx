"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, AlertCircle, Loader2, FileSpreadsheet, RotateCcw } from "lucide-react";

type State = "idle" | "uploading" | "preview" | "applying" | "done" | "error";

type ParsedMeta = {
  row: number;
  vendedor_raw: string;
  vendedor_routing_team: string | null;
  ano: number;
  mes: number;
  meta_valor_brl: number;
  data_inicio: string;
  data_fim: string;
  error?: string;
};

type PreviewResp = {
  mode: "preview";
  total: number;
  validas: number;
  invalidas: number;
  previa: ParsedMeta[];
  erros: ParsedMeta[];
};

type AppliedResp = {
  mode: "applied";
  total: number;
  aplicadas: number;
  invalidas: number;
  detalhe: Array<{ vendedor: string; mes: number; ano: number; valor: number; action: string }>;
  erros: ParsedMeta[];
};

const VENDOR_NOMES: Record<string, string> = {
  SETOR_SOROCABA_SAO_PAULO: "Ana Paula",
  SETOR_CAMPINAS_JUNDIAI: "Alan",
  SETOR_CUIT: "SETOR CUIT",
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function MetasUpload() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [filename, setFilename] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [applied, setApplied] = useState<AppliedResp | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;

    setFilename(f.name);
    setFile(f);
    setState("uploading");
    setPreview(null);
    setApplied(null);
    setErrorMsg(null);

    const form = new FormData();
    form.append("file", f);
    form.append("dry_run", "true");

    try {
      const res = await fetch("/api/metas/upload", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error ?? `Erro HTTP ${res.status}`);
        setState("error");
        return;
      }
      const data: PreviewResp = await res.json();
      setPreview(data);
      setState("preview");
    } catch (e) {
      setErrorMsg(String(e));
      setState("error");
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    disabled: state === "uploading" || state === "applying",
  });

  async function aplicar() {
    if (!file) return;
    setState("applying");
    setErrorMsg(null);

    const form = new FormData();
    form.append("file", file);
    form.append("dry_run", "false");

    try {
      const res = await fetch("/api/metas/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? `Erro HTTP ${res.status}`);
        setState("error");
        return;
      }
      setApplied(data as AppliedResp);
      setState("done");
      router.refresh();
    } catch (e) {
      setErrorMsg(String(e));
      setState("error");
    }
  }

  function reset() {
    setState("idle");
    setFile(null);
    setFilename(null);
    setPreview(null);
    setApplied(null);
    setErrorMsg(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Dropzone */}
      {(state === "idle" || state === "error") && (
        <div
          {...getRootProps()}
          className="bg-[#1a1a1a] border-2 border-dashed border-[#2a2a2a] rounded-lg"
          style={{
            padding: 40,
            textAlign: "center",
            cursor: "pointer",
            transition: "all .15s",
            background: isDragActive ? "#15203d" : "#1a1a1a",
            borderColor: isDragActive ? "#ff7b1c" : "#2a2a2a",
          }}
        >
          <input {...getInputProps()} />
          <Upload size={48} color="#556677" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
            {isDragActive ? "Solte o arquivo aqui" : "Arraste XLSX de metas ou clique pra escolher"}
          </p>
          <p style={{ fontSize: 10, color: "#e4e9f0", marginTop: 8, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
            Colunas esperadas: Vendedor · Mes · Ano · MetaMensal
          </p>
        </div>
      )}

      {/* Loading */}
      {(state === "uploading" || state === "applying") && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg" style={{ padding: 32, textAlign: "center" }}>
          <Loader2 size={32} className="animate-spin" color="#ff7b1c" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 12, color: "#c8d8e8", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
            {state === "uploading" ? "Parseando XLSX..." : "Gravando metas..."}
          </p>
        </div>
      )}

      {/* Erro */}
      {state === "error" && errorMsg && (
        <div className="bg-[#1a1a1a] border border-[#C8102E] rounded-lg" style={{ padding: 16, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertCircle size={20} color="#C8102E" />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: "#C8102E", fontWeight: 700, marginBottom: 4 }}>Erro</p>
            <p style={{ fontSize: 11, color: "#c8d8e8" }}>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {state === "preview" && preview && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FileSpreadsheet size={18} color="#ff7b1c" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#FFFFFF", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                {filename}
              </span>
            </div>
            <span style={{ fontSize: 9, color: "#ff7b1c", background: "rgba(255,123,28,.15)", padding: "3px 8px", borderRadius: 3, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
              PREVIEW
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            <Stat label="Total linhas" value={preview.total} cor="#c8d8e8" />
            <Stat label="Válidas" value={preview.validas} cor="#22c55e" />
            <Stat label="Inválidas" value={preview.invalidas} cor="#C8102E" />
          </div>

          {preview.previa.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, color: "#22c55e", fontWeight: 700, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", marginBottom: 6, letterSpacing: ".1em", textTransform: "uppercase" }}>
                ✓ Será gravado
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  <thead>
                    <tr>
                      <th style={{ ...th, textAlign: "left" }}>Vendedor</th>
                      <th style={th}>Ano/Mês</th>
                      <th style={{ ...th, textAlign: "right" }}>Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.previa.map((p) => (
                      <tr key={p.row} style={{ borderTop: "1px solid #2a2a2a" }}>
                        <td style={{ ...td, color: "#FFFFFF" }}>
                          {VENDOR_NOMES[p.vendedor_routing_team ?? ""] ?? p.vendedor_raw}
                        </td>
                        <td style={td}>{p.ano}/{String(p.mes).padStart(2, "0")}</td>
                        <td style={{ ...td, textAlign: "right", color: "#22c55e", fontWeight: 700 }}>
                          {fmtBRL(p.meta_valor_brl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.erros.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, color: "#C8102E", fontWeight: 700, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", marginBottom: 6, letterSpacing: ".1em", textTransform: "uppercase" }}>
                ✗ Erros
              </p>
              {preview.erros.map((e) => (
                <p key={e.row} style={{ fontSize: 10, color: "#c8d8e8", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                  Linha {e.row}: <span style={{ color: "#C8102E" }}>{e.error}</span>
                </p>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button
              onClick={reset}
              style={{
                background: "transparent",
                border: "1px solid #2a2a2a",
                color: "#c0d0e0",
                padding: "8px 14px",
                borderRadius: 4,
                fontSize: 11,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <RotateCcw size={14} /> Cancelar
            </button>
            <button
              onClick={aplicar}
              disabled={preview.validas === 0}
              style={{
                background: preview.validas > 0 ? "#22c55e" : "#2a2a2a",
                border: "none",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                cursor: preview.validas > 0 ? "pointer" : "not-allowed",
                letterSpacing: ".05em",
                textTransform: "uppercase",
              }}
            >
              Aplicar {preview.validas} meta(s)
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {state === "done" && applied && (
        <div className="bg-[#1a1a1a] border border-[#22c55e] rounded-lg" style={{ padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <CheckCircle size={24} color="#22c55e" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>
                {applied.aplicadas} meta(s) gravada(s)
              </p>
              <p style={{ fontSize: 10, color: "#c0d0e0", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                Painel /dashboard/vendas atualizado em &lt;15min (cron)
              </p>
            </div>
          </div>
          {applied.detalhe.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "left" }}>Vendedor</th>
                    <th style={th}>Período</th>
                    <th style={{ ...th, textAlign: "right" }}>Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {applied.detalhe.map((d, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #2a2a2a" }}>
                      <td style={{ ...td, color: "#FFFFFF" }}>
                        {VENDOR_NOMES[d.vendedor] ?? d.vendedor}
                      </td>
                      <td style={td}>{d.ano}/{String(d.mes).padStart(2, "0")}</td>
                      <td style={{ ...td, textAlign: "right", color: "#22c55e", fontWeight: 700 }}>
                        {fmtBRL(d.valor)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              background: "transparent",
              border: "1px solid #2a2a2a",
              color: "#c0d0e0",
              padding: "8px 14px",
              borderRadius: 4,
              fontSize: 11,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Upload size={14} /> Subir outra planilha
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, cor }: { label: string; value: number; cor: string }) {
  return (
    <div style={{ background: "#0a0f1f", borderRadius: 4, padding: "10px 12px" }}>
      <p style={{ fontSize: 9, color: "#e4e9f0", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 2 }}>
        {label}
      </p>
      <p style={{ fontSize: 18, color: cor, fontWeight: 700, fontFamily: "'Inter', system-ui, sans-serif" }}>
        {value}
      </p>
    </div>
  );
}

const th: React.CSSProperties = {
  fontSize: 9,
  color: "#e4e9f0",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  letterSpacing: ".1em",
  textTransform: "uppercase",
  padding: "6px 8px",
  textAlign: "right",
};

const td: React.CSSProperties = {
  padding: "6px 8px",
  color: "#c8d8e8",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
};
