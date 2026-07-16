"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, AlertCircle, Loader2, FileSpreadsheet, RotateCcw, Undo2 } from "lucide-react";

type State = "idle" | "uploading" | "preview" | "applying" | "done" | "error" | "reverting";
type Resumo = Record<string, { ok: number; erros: number }>;
type RowErr = { aba: string; linha: number; motivo: string };
type PreviewResp = { mode: "preview"; resumo: Resumo; total_ok: number; total_erros: number; erros: RowErr[] };
type AppliedResp = { mode: "applied"; upload_id: number; resumo: Resumo; total_ok: number };

const mono = "var(--font-geist-sans), system-ui, sans-serif";
const ENDPOINT = "/api/compras/custos/upload";

export function CustosUpload() {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [filename, setFilename] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [applied, setApplied] = useState<AppliedResp | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onDrop = useCallback(async (accepted: File[]) => {
    const f = accepted[0];
    if (!f) return;
    setFilename(f.name); setFile(f); setState("uploading");
    setPreview(null); setApplied(null); setErrorMsg(null);
    const form = new FormData();
    form.append("file", f); form.append("mode", "preview");
    try {
      const res = await fetch(ENDPOINT, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? `Erro HTTP ${res.status}`); setState("error"); return; }
      setPreview(data as PreviewResp); setState("preview");
    } catch (e) { setErrorMsg(String(e)); setState("error"); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] },
    maxFiles: 1,
    disabled: state === "uploading" || state === "applying" || state === "reverting",
  });

  async function gravar() {
    if (!file) return;
    setState("applying"); setErrorMsg(null);
    const form = new FormData();
    form.append("file", file); form.append("mode", "grava");
    try {
      const res = await fetch(ENDPOINT, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? `Erro HTTP ${res.status}`); setState("error"); return; }
      setApplied(data as AppliedResp); setState("done"); router.refresh();
    } catch (e) { setErrorMsg(String(e)); setState("error"); }
  }

  async function reverter() {
    if (!applied) return;
    setState("reverting"); setErrorMsg(null);
    try {
      const res = await fetch(`${ENDPOINT}/revert`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upload_id: applied.upload_id }),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? `Erro HTTP ${res.status}`); setState("error"); return; }
      reset(); router.refresh();
    } catch (e) { setErrorMsg(String(e)); setState("error"); }
  }

  function reset() {
    setState("idle"); setFile(null); setFilename(null);
    setPreview(null); setApplied(null); setErrorMsg(null);
  }

  const abas = preview ? Object.entries(preview.resumo) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {(state === "idle" || state === "error") && (
        <div {...getRootProps()} style={{
          padding: 36, textAlign: "center", cursor: "pointer", borderRadius: 8,
          border: `2px dashed ${isDragActive ? "#2ea043" : "#1B2A6B"}`,
          background: isDragActive ? "#0f1f15" : "#0f1428", transition: "all .15s",
        }}>
          <input {...getInputProps()} />
          <Upload size={40} color="#556677" style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 13, color: "#FFFFFF", fontWeight: 700, fontFamily: mono }}>
            {isDragActive ? "Solte o XLSX aqui" : "Arraste o template preenchido (XLSX) ou clique"}
          </p>
          <p style={{ fontSize: 10, color: "#e4e9f0", marginTop: 8, fontFamily: mono }}>
            5 abas: Temp Produto · Temp Setor · Horas · Jornada · Qualidade · ID OP validado contra o ARES
          </p>
        </div>
      )}

      {(state === "uploading" || state === "applying" || state === "reverting") && (
        <div style={{ padding: 28, textAlign: "center", background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 8 }}>
          <Loader2 size={28} className="animate-spin" color="#2ea043" style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 12, color: "#c8d8e8", fontFamily: mono }}>
            {state === "uploading" ? "Validando apontamentos..." : state === "applying" ? "Gravando..." : "Revertendo..."}
          </p>
        </div>
      )}

      {state === "error" && errorMsg && (
        <div style={{ padding: 16, background: "#0f1428", border: "1px solid #f85149", borderRadius: 8, display: "flex", gap: 10 }}>
          <AlertCircle size={20} color="#f85149" />
          <div><p style={{ fontSize: 12, color: "#f85149", fontWeight: 700, marginBottom: 4 }}>Erro</p>
            <p style={{ fontSize: 11, color: "#c8d8e8", fontFamily: mono }}>{errorMsg}</p></div>
        </div>
      )}

      {state === "preview" && preview && (
        <div style={{ padding: 20, background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 700, color: "#FFFFFF", fontFamily: mono }}>
              <FileSpreadsheet size={18} color="#2ea043" /> {filename}
            </span>
            <span style={{ fontSize: 9, color: "#2ea043", background: "rgba(46,160,67,.15)", padding: "3px 8px", borderRadius: 3, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, fontFamily: mono }}>PREVIEW</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 14 }}>
            {abas.map(([aba, r]) => (
              <div key={aba} style={{ background: "#0b0f1d", borderRadius: 4, padding: "8px 10px" }}>
                <p style={{ fontSize: 8, color: "#e4e9f0", fontFamily: mono, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>{aba}</p>
                <p style={{ fontSize: 16, color: r.erros > 0 ? "#d29922" : "#2ea043", fontWeight: 700, fontFamily: "Inter, sans-serif" }}>
                  {r.ok}<span style={{ fontSize: 10, color: "#e4e9f0" }}> ok</span>
                  {r.erros > 0 && <span style={{ fontSize: 11, color: "#f85149" }}> · {r.erros} erro</span>}
                </p>
              </div>
            ))}
          </div>

          {preview.total_erros > 0 && (
            <div style={{ marginBottom: 14, maxHeight: 220, overflowY: "auto" }}>
              <p style={{ fontSize: 10, color: "#f85149", fontWeight: 700, fontFamily: mono, marginBottom: 6, letterSpacing: ".1em", textTransform: "uppercase" }}>
                ✗ {preview.total_erros} erro(s) — corrija no XLSX e suba de novo
              </p>
              {preview.erros.map((e, i) => (
                <p key={i} style={{ fontSize: 10, color: "#c8d8e8", fontFamily: mono }}>
                  <span style={{ color: "#c0d0e0" }}>{e.aba} L{e.linha}</span> · <span style={{ color: "#f85149" }}>{e.motivo}</span>
                </p>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={reset} style={btnGhost}><RotateCcw size={14} /> Cancelar</button>
            <button onClick={gravar} disabled={preview.total_erros > 0 || preview.total_ok === 0} style={btnGo(preview.total_erros === 0 && preview.total_ok > 0)}>
              Gravar ({preview.total_ok} linhas)
            </button>
          </div>
        </div>
      )}

      {state === "done" && applied && (
        <div style={{ padding: 20, background: "#0f1428", border: "1px solid #2ea043", borderRadius: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <CheckCircle size={24} color="#2ea043" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#2ea043" }}>Gravado · {applied.total_ok} linhas</p>
              <p style={{ fontSize: 10, color: "#c0d0e0", fontFamily: mono }}>upload #{applied.upload_id} · o dashboard semanal já reflete</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={reset} style={btnGhost}><Upload size={14} /> Subir outro</button>
            <button onClick={reverter} style={{ ...btnGhost, borderColor: "#f85149", color: "#f85149" }}><Undo2 size={14} /> Reverter este upload</button>
          </div>
        </div>
      )}
    </div>
  );
}

const btnGhost: React.CSSProperties = { background: "transparent", border: "1px solid #1B2A6B", color: "#c0d0e0", padding: "8px 14px", borderRadius: 4, fontSize: 11, fontFamily: mono, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
const btnGo = (on: boolean): React.CSSProperties => ({ background: on ? "#2ea043" : "#1B2A6B", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: mono, cursor: on ? "pointer" : "not-allowed", letterSpacing: ".05em", textTransform: "uppercase" });
