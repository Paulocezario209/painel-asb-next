"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, AlertCircle, Loader2, FileSpreadsheet, RotateCcw } from "lucide-react";

type State = "idle" | "uploading" | "preview" | "applying" | "done" | "error";

type LinhaAncora = {
  row: number;
  id_produto: number | null;
  descricao: string;
  unidade: string;
  qtd_contada: number | null;
  contagem_raw: string;
  status_ancora: "limpa" | "ambigua";
};
type PreviewResp = {
  mode: "preview";
  total_contadas: number;
  limpas: number;
  ambiguas: number;
  entram_no_saldo_kg: number;
  previa_saldo: LinhaAncora[];
  ambiguas_lista: LinhaAncora[];
};
type AppliedResp = {
  mode: "applied";
  total_contadas: number;
  auditoria_gravada: number;
  saldo_ancora_atualizados: number;
  entram_no_saldo_kg: number;
  ambiguas: number;
  nota_saldo_nao_encontrado: number;
};

const mono = "var(--font-geist-sans), system-ui, sans-serif";

export function AncoraUpload() {
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
    form.append("file", f); form.append("dry_run", "true");
    try {
      const res = await fetch("/api/compras/ancora/upload", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setErrorMsg(err.error ?? `Erro HTTP ${res.status}`); setState("error"); return;
      }
      setPreview(await res.json()); setState("preview");
    } catch (e) { setErrorMsg(String(e)); setState("error"); }
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
    setState("applying"); setErrorMsg(null);
    const form = new FormData();
    form.append("file", file); form.append("dry_run", "false");
    try {
      const res = await fetch("/api/compras/ancora/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? `Erro HTTP ${res.status}`); setState("error"); return; }
      setApplied(data as AppliedResp); setState("done"); router.refresh();
    } catch (e) { setErrorMsg(String(e)); setState("error"); }
  }
  function reset() {
    setState("idle"); setFile(null); setFilename(null);
    setPreview(null); setApplied(null); setErrorMsg(null);
  }

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
            {isDragActive ? "Solte o XLSX aqui" : "Arraste o inventário 01/05 (XLSX) ou clique"}
          </p>
          <p style={{ fontSize: 10, color: "#e4e9f0", marginTop: 8, fontFamily: mono }}>
            Aba &quot;Inventario&quot; · só linhas com Contagem/anotação · M1 grava saldo só de KG limpas
          </p>
        </div>
      )}

      {(state === "uploading" || state === "applying") && (
        <div style={{ padding: 28, textAlign: "center", background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 8 }}>
          <Loader2 size={28} className="animate-spin" color="#2ea043" style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 12, color: "#c8d8e8", fontFamily: mono }}>
            {state === "uploading" ? "Parseando inventário..." : "Gravando âncora + recomputando saldo..."}
          </p>
        </div>
      )}

      {state === "error" && errorMsg && (
        <div style={{ padding: 16, background: "#0f1428", border: "1px solid #f85149", borderRadius: 8, display: "flex", gap: 10 }}>
          <AlertCircle size={20} color="#f85149" />
          <div><p style={{ fontSize: 12, color: "#f85149", fontWeight: 700, marginBottom: 4 }}>Erro</p>
            <p style={{ fontSize: 11, color: "#c8d8e8" }}>{errorMsg}</p></div>
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
            <Stat label="Contadas" value={preview.total_contadas} cor="#c8d8e8" />
            <Stat label="Limpas" value={preview.limpas} cor="#2ea043" />
            <Stat label="Ambíguas" value={preview.ambiguas} cor="#d29922" />
            <Stat label="Saldo (KG)" value={preview.entram_no_saldo_kg} cor="#2ea043" />
          </div>

          {preview.previa_saldo.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, color: "#2ea043", fontWeight: 700, fontFamily: mono, marginBottom: 6, letterSpacing: ".1em", textTransform: "uppercase" }}>✓ Entram no saldo (KG limpas)</p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: mono }}>
                  <thead><tr><th style={{ ...th, textAlign: "left" }}>Id</th><th style={{ ...th, textAlign: "left" }}>Produto</th><th style={th}>Un</th><th style={{ ...th, textAlign: "right" }}>Qtd</th></tr></thead>
                  <tbody>
                    {preview.previa_saldo.map((p) => (
                      <tr key={p.row} style={{ borderTop: "1px solid #1B2A6B" }}>
                        <td style={td}>{p.id_produto}</td>
                        <td style={{ ...td, color: "#FFFFFF" }}>{p.descricao}</td>
                        <td style={{ ...td, textAlign: "center" }}>{p.unidade}</td>
                        <td style={{ ...td, textAlign: "right", color: "#2ea043", fontWeight: 700 }}>{p.qtd_contada}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {preview.ambiguas_lista.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 10, color: "#d29922", fontWeight: 700, fontFamily: mono, marginBottom: 6, letterSpacing: ".1em", textTransform: "uppercase" }}>⚠ Ambíguas (auditadas, fora do saldo)</p>
              {preview.ambiguas_lista.map((e) => (
                <p key={e.row} style={{ fontSize: 10, color: "#c8d8e8", fontFamily: mono }}>
                  L{e.row} · {e.id_produto ?? "—"} {e.descricao} [{e.unidade || "?"}] → <span style={{ color: "#d29922" }}>{e.contagem_raw}</span>
                </p>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={reset} style={btnGhost}><RotateCcw size={14} /> Cancelar</button>
            <button onClick={aplicar} disabled={preview.entram_no_saldo_kg === 0 && preview.ambiguas === 0} style={btnGo(preview.total_contadas > 0)}>
              Gravar âncora ({preview.entram_no_saldo_kg} no saldo)
            </button>
          </div>
        </div>
      )}

      {state === "done" && applied && (
        <div style={{ padding: 20, background: "#0f1428", border: "1px solid #2ea043", borderRadius: 8 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
            <CheckCircle size={24} color="#2ea043" />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#2ea043" }}>Âncora gravada · saldo recomputado</p>
              <p style={{ fontSize: 10, color: "#c0d0e0", fontFamily: mono }}>
                {applied.saldo_ancora_atualizados} saldos KG · {applied.auditoria_gravada} na auditoria · {applied.ambiguas} ambíguas
              </p>
            </div>
          </div>
          {applied.nota_saldo_nao_encontrado > 0 && (
            <p style={{ fontSize: 10, color: "#d29922", fontFamily: mono }}>
              ⚠ {applied.nota_saldo_nao_encontrado} produto(s) KG limpos sem match em estoque_saldo (sem movimento recente?) — ficaram só na auditoria.
            </p>
          )}
          <button onClick={reset} style={{ ...btnGhost, marginTop: 14 }}><Upload size={14} /> Subir outra</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, cor }: { label: string; value: number; cor: string }) {
  return (
    <div style={{ background: "#0b0f1d", borderRadius: 4, padding: "10px 12px" }}>
      <p style={{ fontSize: 9, color: "#e4e9f0", fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 18, color: cor, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>{value}</p>
    </div>
  );
}
const th: React.CSSProperties = { fontSize: 9, color: "#e4e9f0", fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", padding: "6px 8px", textAlign: "right" };
const td: React.CSSProperties = { padding: "6px 8px", color: "#c8d8e8", fontFamily: mono };
const btnGhost: React.CSSProperties = { background: "transparent", border: "1px solid #1B2A6B", color: "#c0d0e0", padding: "8px 14px", borderRadius: 4, fontSize: 11, fontFamily: mono, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
const btnGo = (on: boolean): React.CSSProperties => ({ background: on ? "#2ea043" : "#1B2A6B", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: mono, cursor: on ? "pointer" : "not-allowed", letterSpacing: ".05em", textTransform: "uppercase" });
