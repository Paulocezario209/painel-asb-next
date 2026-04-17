"use client";

import { useState, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface LeadConfig {
  segment:          string;
  city:             string;
  current_etapa:    number;
  weekly_volume_kg: number | null;
  current_supplier: string;
  rag_domain:       string;
}

interface SimEntry {
  message:    string;
  config:     LeadConfig;
  response:   string;
  domain:     string;
  intent:     string | null;
  qual_stage: number | null;
  elapsed_ms: number;
  error?:     string;
}

interface RagResponse {
  response?:   string;
  answer?:     string;
  domain?:     string;
  intent?:     string;
  qual_stage?: number;
  _agent?:     string;
  _elapsed_ms?: number;
  error?:      string;
  [key: string]: unknown;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const SEGMENTS = [
  ["", "— Selecione —"],
  ["hamburgueria",  "Hamburgueria"],
  ["restaurante",   "Restaurante"],
  ["bar",           "Bar / Pub"],
  ["steak_house",   "Steak House"],
  ["emporio",       "Empório"],
  ["delivery",      "Dark Kitchen / Delivery"],
  ["distribuidor",  "Distribuidor"],
  ["churrascaria",  "Churrascaria"],
];

const SUPPLIERS = [
  ["", "— Selecione —"],
  ["acougue_local",  "Açougue local"],
  ["frigorifico",    "Frigorífico direto"],
  ["distribuidor",   "Distribuidor"],
  ["outro",          "Outro"],
];

const RAG_DOMAINS = [
  ["auto",                   "Auto (qualificação)"],
  ["product_rag",            "product_rag"],
  ["logistics_rag",          "logistics_rag"],
  ["objection_rag",          "objection_rag"],
  ["butcher_technical_rag",  "butcher_technical_rag"],
  ["competitor_rag",         "competitor_rag"],
  ["market_pain_rag",        "market_pain_rag"],
  ["lead_qualification_rag", "lead_qualification_rag"],
];

const ETAPAS = Array.from({ length: 10 }, (_, i) => i);

// ── Design tokens ──────────────────────────────────────────────────────────────
const S = {
  card:    { background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 4, padding: "20px 24px" } as React.CSSProperties,
  label:   { display: "block", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase" as const, color: "#556677", fontFamily: "'Courier New', monospace", marginBottom: 6 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: "#c0c8d8", fontFamily: "'Courier New', monospace", marginBottom: 14 } as React.CSSProperties,
  muted:   { color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" } as React.CSSProperties,
  input:   {
    width: "100%", background: "#080b14", border: "1px solid #1B2A6B", borderRadius: 3,
    color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace",
    padding: "7px 10px", outline: "none", boxSizing: "border-box" as const,
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function QualBadge({ stage }: { stage: number | null }) {
  if (stage === null) return null;
  const color = stage >= 7 ? "#22c55e" : stage >= 4 ? "#f59e0b" : "#8899aa";
  return (
    <span style={{
      display: "inline-block", background: `${color}15`, border: `1px solid ${color}50`,
      color, fontSize: 10, fontFamily: "'Courier New', monospace", fontWeight: 700,
      padding: "2px 8px", borderRadius: 3,
    }}>
      etapa {stage}
    </span>
  );
}

function DomainBadge({ domain }: { domain: string }) {
  return (
    <span style={{
      display: "inline-block", background: "rgba(27,42,107,.25)", border: "1px solid #1B2A6B",
      color: "#8899aa", fontSize: 9, fontFamily: "'Courier New', monospace",
      padding: "2px 8px", borderRadius: 3, letterSpacing: ".10em",
    }}>
      {domain}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: LeadConfig = {
  segment:          "",
  city:             "",
  current_etapa:    1,
  weekly_volume_kg: null,
  current_supplier: "",
  rag_domain:       "auto",
};

export default function SimulatorPage() {
  const [config, setConfig]       = useState<LeadConfig>(DEFAULT_CONFIG);
  const [message, setMessage]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [lastResult, setLastResult] = useState<SimEntry | null>(null);
  const [history, setHistory]     = useState<SimEntry[]>([]);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);

  const set = useCallback(<K extends keyof LeadConfig>(k: K, v: LeadConfig[K]) =>
    setConfig(p => ({ ...p, [k]: v })), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);

    // Build history for context — Bug 2 fix: filter error entries before mapping
    const historyForApi = history
      .filter(h => !h.error && !!h.response)
      .slice(0, 4)
      .reverse()
      .flatMap(h => [
        { role: "user"      as const, content: h.message  },
        { role: "assistant" as const, content: h.response },
      ]);

    try {
      const res = await fetch("/api/simulator", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message, config, history: historyForApi }),
      });
      const data: RagResponse = await res.json();

      if (data.error) throw new Error(data.error);

      const entry: SimEntry = {
        message,
        config:     { ...config },
        response:   (data.response ?? data.answer ?? JSON.stringify(data, null, 2)) as string,
        domain:     (data.domain ?? data._agent ?? config.rag_domain) as string,
        intent:     (data.intent as string | null) ?? null,
        qual_stage: (data.qual_stage as number | null) ?? null,
        elapsed_ms: (data._elapsed_ms as number) ?? 0,
      };

      setLastResult(entry);
      setHistory(prev => [entry, ...prev].slice(0, 5));
      setMessage("");
      textareaRef.current?.focus();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      setLastResult({
        message,
        config: { ...config },
        response: "",
        domain: config.rag_domain,
        intent: null,
        qual_stage: null,
        elapsed_ms: 0,
        error: msg,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Simulador RAG
        </h1>
        <p style={S.muted}>Teste o comportamento do SDR sem usar leads reais</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Coluna esquerda: config + mensagem ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Bloco 1 — Config do lead */}
          <div style={S.card}>
            <p style={S.section}>
              <span style={{ color: "#C8102E", marginRight: 6 }}>▲</span>
              Perfil do Lead Simulado
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

              <div>
                <label style={S.label}>Segmento</label>
                <select value={config.segment} onChange={e => set("segment", e.target.value)} style={S.input}>
                  {SEGMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <label style={S.label}>Cidade</label>
                <input
                  type="text"
                  value={config.city}
                  placeholder="ex: São Paulo"
                  onChange={e => set("city", e.target.value)}
                  style={S.input}
                />
              </div>

              <div>
                <label style={S.label}>Etapa atual (0–9)</label>
                <select value={config.current_etapa} onChange={e => set("current_etapa", Number(e.target.value))} style={S.input}>
                  {ETAPAS.map(i => <option key={i} value={i}>Etapa {i}</option>)}
                </select>
              </div>

              <div>
                <label style={S.label}>Volume semanal (kg)</label>
                <input
                  type="number"
                  min={0}
                  value={config.weekly_volume_kg ?? ""}
                  placeholder="ex: 150"
                  onChange={e => set("weekly_volume_kg", e.target.value ? Number(e.target.value) : null)}
                  style={S.input}
                />
              </div>

              <div>
                <label style={S.label}>Fornecedor atual</label>
                <select value={config.current_supplier} onChange={e => set("current_supplier", e.target.value)} style={S.input}>
                  {SUPPLIERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

              <div>
                <label style={S.label}>Domínio RAG forçado</label>
                <select value={config.rag_domain} onChange={e => set("rag_domain", e.target.value)} style={S.input}>
                  {RAG_DOMAINS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>

            </div>
          </div>

          {/* Bloco 2 — Mensagem */}
          <div style={S.card}>
            <p style={S.section}>
              <span style={{ color: "#C8102E", marginRight: 6 }}>▲</span>
              Mensagem do Lead
            </p>
            <form onSubmit={handleSubmit}>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Digite a mensagem simulada do lead…"
                rows={5}
                style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
                <p style={{ ...S.muted, fontSize: 9 }}>⌘↵ para enviar</p>
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  style={{
                    padding: "7px 20px", borderRadius: 3, cursor: loading || !message.trim() ? "not-allowed" : "pointer",
                    fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
                    fontFamily: "'Courier New', monospace", fontWeight: 700,
                    border: "1px solid #C8102E",
                    background: loading || !message.trim() ? "rgba(200,16,46,.05)" : "rgba(200,16,46,.15)",
                    color: loading || !message.trim() ? "#556677" : "#C8102E",
                    transition: "all .15s",
                  }}
                >
                  {loading ? "Processando…" : "▶ Simular"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Coluna direita: resposta + histórico ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Bloco 3 — Resposta */}
          <div style={S.card}>
            <p style={S.section}>
              <span style={{ color: "#C8102E", marginRight: 6 }}>▲</span>
              Resposta do SDR
            </p>

            {loading && (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ color: "#556677", fontFamily: "'Courier New', monospace", fontSize: 11 }}>
                  ◌ consultando RAG…
                </p>
              </div>
            )}

            {!loading && !lastResult && (
              <p style={{ ...S.muted, textAlign: "center", padding: "24px 0" }}>
                Nenhuma simulação ainda. Configure o lead e envie uma mensagem.
              </p>
            )}

            {!loading && lastResult && (
              <div>
                {/* Meta row */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <DomainBadge domain={lastResult.domain} />
                  {lastResult.intent && (
                    <span style={{
                      display: "inline-block", background: "rgba(27,42,107,.2)", border: "1px solid #1B2A6B",
                      color: "#8899aa", fontSize: 9, fontFamily: "'Courier New', monospace",
                      padding: "2px 8px", borderRadius: 3,
                    }}>
                      intent: {lastResult.intent}
                    </span>
                  )}
                  <QualBadge stage={lastResult.qual_stage} />
                  {lastResult.elapsed_ms > 0 && (
                    <span style={{ ...S.muted, fontSize: 9, marginLeft: "auto" }}>
                      {lastResult.elapsed_ms}ms
                    </span>
                  )}
                </div>

                {/* Error */}
                {lastResult.error ? (
                  <div style={{
                    borderLeft: "3px solid #C8102E", background: "rgba(200,16,46,.06)",
                    padding: "10px 14px", borderRadius: "0 4px 4px 0",
                  }}>
                    <p style={{ color: "#C8102E", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
                      {lastResult.error}
                    </p>
                  </div>
                ) : (
                  /* Response text */
                  <div style={{
                    background: "#080b14", border: "1px solid rgba(27,42,107,.5)",
                    borderRadius: 3, padding: "14px 16px",
                  }}>
                    <p style={{
                      color: "#c8d8e8", fontSize: 12, fontFamily: "'Courier New', monospace",
                      lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0,
                    }}>
                      {lastResult.response}
                    </p>
                  </div>
                )}

                {/* Input echo */}
                <div style={{ marginTop: 10, borderLeft: "2px solid #1B2A6B", paddingLeft: 10 }}>
                  <p style={{ ...S.muted, fontSize: 10, fontStyle: "italic" }}>
                    Lead disse: "{lastResult.message}"
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Bloco 4 — Histórico da sessão */}
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p style={{ ...S.section, marginBottom: 0 }}>
                <span style={{ color: "#C8102E", marginRight: 6 }}>▲</span>
                Histórico da Sessão
              </p>
              {history.length > 0 && (
                <button
                  onClick={() => { setHistory([]); setLastResult(null); }}
                  style={{
                    background: "transparent", border: "1px solid #1B2A6B", color: "#556677",
                    fontSize: 9, fontFamily: "'Courier New', monospace", letterSpacing: ".10em",
                    textTransform: "uppercase", padding: "3px 8px", borderRadius: 3, cursor: "pointer",
                  }}
                >
                  Limpar
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <p style={{ ...S.muted, textAlign: "center", padding: "16px 0", fontSize: 10 }}>
                Nenhuma simulação nesta sessão
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {history.map((h, i) => (
                  <div key={i} style={{ borderLeft: "2px solid #1B2A6B", paddingLeft: 12 }}>
                    {/* Lead */}
                    <div style={{
                      background: "rgba(27,42,107,.15)", borderRadius: "0 4px 4px 0",
                      padding: "7px 10px", marginBottom: 6,
                    }}>
                      <p style={{ ...S.muted, fontSize: 9, marginBottom: 3 }}>Lead</p>
                      <p style={{ color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace", margin: 0 }}>
                        {h.message}
                      </p>
                    </div>
                    {/* SDR */}
                    {!h.error && h.response && (
                      <div style={{
                        background: "rgba(200,16,46,.06)", borderRadius: "0 4px 4px 0",
                        padding: "7px 10px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                          <p style={{ ...S.muted, fontSize: 9, margin: 0 }}>SDR</p>
                          <DomainBadge domain={h.domain} />
                          <QualBadge stage={h.qual_stage} />
                        </div>
                        <p style={{
                          color: "#c8d8e8", fontSize: 11, fontFamily: "'Courier New', monospace",
                          margin: 0, lineHeight: 1.5,
                          display: "-webkit-box",
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        } as React.CSSProperties}>
                          {h.response}
                        </p>
                      </div>
                    )}
                    {h.error && (
                      <p style={{ color: "#C8102E", fontSize: 10, fontFamily: "'Courier New', monospace", padding: "4px 10px" }}>
                        ✕ {h.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
