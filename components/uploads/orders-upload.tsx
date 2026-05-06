"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Upload, CheckCircle, AlertCircle, Loader2, FileSpreadsheet, RotateCcw } from "lucide-react";

type UploadState = "idle" | "uploading" | "done" | "error";

interface UploadError {
  row: number;
  order_ref: string | null;
  reason: string;
}

interface UploadResult {
  batch_id: string;
  rows_total: number;
  rows_inserted: number;
  rows_updated: number;
  rows_skipped: number;
  status: "completed" | "partial" | "failed";
  errors: UploadError[];
}

export function OrdersUpload() {
  const router = useRouter();
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setFilename(file.name);
    setState("uploading");
    setResult(null);
    setErrorMsg(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/orders/upload", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        setState("error");
        setErrorMsg(data.error ?? `Erro ${res.status}`);
        return;
      }

      setResult(data as UploadResult);
      setState("done");

      if (data.status === "completed") {
        router.refresh();
      }
    } catch (err) {
      setState("error");
      setErrorMsg(String(err));
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    disabled: state === "uploading",
  });

  const reset = () => {
    setState("idle");
    setResult(null);
    setErrorMsg(null);
    setFilename(null);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Dropzone */}
      {state === "idle" && (
        <div
          {...getRootProps()}
          style={{
            border: `2px dashed ${isDragActive ? "#C8102E" : "#1B2A6B"}`,
            borderRadius: 6,
            padding: "48px 24px",
            textAlign: "center",
            cursor: "pointer",
            background: isDragActive ? "rgba(200,16,46,.06)" : "rgba(27,42,107,.06)",
            transition: "all .2s",
          }}
        >
          <input {...getInputProps()} />
          <Upload
            style={{ width: 40, height: 40, margin: "0 auto 16px", color: isDragActive ? "#C8102E" : "#1B2A6B" }}
          />
          <p style={{ color: "#c0c8d8", fontSize: 14, fontFamily: "'Courier New', monospace" }}>
            {isDragActive
              ? "Solte o arquivo aqui..."
              : "Arraste um XLSX aqui ou clique para selecionar"}
          </p>
          <p style={{ color: "#556677", fontSize: 11, marginTop: 8, fontFamily: "'Courier New', monospace" }}>
            Aceita .xlsx e .xls · Export ARES
          </p>
        </div>
      )}

      {/* Uploading */}
      {state === "uploading" && (
        <div
          style={{
            border: "1px solid #1B2A6B",
            borderRadius: 6,
            padding: "48px 24px",
            textAlign: "center",
            background: "rgba(27,42,107,.06)",
          }}
        >
          <Loader2
            style={{ width: 36, height: 36, margin: "0 auto 16px", color: "#1B2A6B", animation: "spin 1s linear infinite" }}
          />
          <p style={{ color: "#c0c8d8", fontSize: 13, fontFamily: "'Courier New', monospace" }}>
            Processando <strong>{filename}</strong>…
          </p>
          <p style={{ color: "#556677", fontSize: 11, marginTop: 6, fontFamily: "'Courier New', monospace" }}>
            Enviando rows para /internal/orders
          </p>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Done */}
      {state === "done" && result && (
        <div style={{ border: "1px solid #1B2A6B", borderRadius: 6, overflow: "hidden" }}>
          {/* Header */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "14px 16px",
              background: result.status === "failed" ? "rgba(200,16,46,.12)" :
                          result.status === "partial" ? "rgba(234,179,8,.08)" :
                          "rgba(34,197,94,.08)",
              borderBottom: "1px solid #1B2A6B",
            }}
          >
            {result.status === "failed"
              ? <AlertCircle style={{ width: 18, height: 18, color: "#C8102E", flexShrink: 0 }} />
              : result.status === "partial"
              ? <AlertCircle style={{ width: 18, height: 18, color: "#eab308", flexShrink: 0 }} />
              : <CheckCircle style={{ width: 18, height: 18, color: "#22c55e", flexShrink: 0 }} />
            }
            <span style={{ color: "#c0c8d8", fontSize: 12, fontFamily: "'Courier New', monospace", flex: 1 }}>
              <FileSpreadsheet style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />
              {filename}
            </span>
            <span style={{ color: "#556677", fontSize: 10, fontFamily: "'Courier New', monospace" }}>
              batch: {result.batch_id.slice(0, 8)}…
            </span>
          </div>

          {/* Totals */}
          <div
            style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
              gap: 1, background: "#1B2A6B",
            }}
          >
            {[
              { label: "Total", value: result.rows_total, color: "#c0c8d8" },
              { label: "Inseridos", value: result.rows_inserted, color: "#22c55e" },
              { label: "Atualizados", value: result.rows_updated, color: "#60a5fa" },
              { label: "Skipped", value: result.rows_skipped, color: "#C8102E" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{ background: "#080b14", padding: "16px 12px", textAlign: "center" }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "'Courier New', monospace" }}>
                  {value}
                </div>
                <div style={{ fontSize: 9, color: "#556677", letterSpacing: ".12em", textTransform: "uppercase", fontFamily: "'Courier New', monospace", marginTop: 4 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Errors */}
          {result.errors.length > 0 && (
            <div style={{ padding: "12px 16px", borderTop: "1px solid #1B2A6B" }}>
              <p style={{ color: "#eab308", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", fontFamily: "'Courier New', monospace", marginBottom: 8 }}>
                Erros ({result.errors.length})
              </p>
              <div style={{ maxHeight: 180, overflowY: "auto" }}>
                {result.errors.map((e, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex", gap: 10, padding: "5px 0",
                      borderBottom: idx < result.errors.length - 1 ? "1px solid #0f1826" : "none",
                    }}
                  >
                    <span style={{ color: "#556677", fontSize: 10, fontFamily: "'Courier New', monospace", flexShrink: 0 }}>
                      L{e.row}
                    </span>
                    {e.order_ref && (
                      <span style={{ color: "#8899aa", fontSize: 10, fontFamily: "'Courier New', monospace", flexShrink: 0 }}>
                        #{e.order_ref}
                      </span>
                    )}
                    <span style={{ color: "#C8102E", fontSize: 10, fontFamily: "'Courier New', monospace" }}>
                      {e.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ padding: "12px 16px", borderTop: "1px solid #1B2A6B", textAlign: "right" }}>
            <button
              onClick={reset}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "6px 14px", borderRadius: 3,
                background: "transparent", border: "1px solid #1B2A6B",
                color: "#8899aa", fontSize: 10, letterSpacing: ".1em",
                textTransform: "uppercase", fontFamily: "'Courier New', monospace",
                cursor: "pointer",
              }}
            >
              <RotateCcw style={{ width: 11, height: 11 }} />
              Novo upload
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {state === "error" && (
        <div style={{ border: "1px solid #C8102E", borderRadius: 6, padding: "24px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AlertCircle style={{ width: 18, height: 18, color: "#C8102E", flexShrink: 0 }} />
            <span style={{ color: "#C8102E", fontSize: 13, fontFamily: "'Courier New', monospace" }}>
              Erro no upload
            </span>
          </div>
          <p style={{ color: "#8899aa", fontSize: 12, fontFamily: "'Courier New', monospace", marginBottom: 16 }}>
            {errorMsg}
          </p>
          <button
            onClick={reset}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 14px", borderRadius: 3,
              background: "transparent", border: "1px solid #1B2A6B",
              color: "#8899aa", fontSize: 10, letterSpacing: ".1em",
              textTransform: "uppercase", fontFamily: "'Courier New', monospace",
              cursor: "pointer",
            }}
          >
            <RotateCcw style={{ width: 11, height: 11 }} />
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}
