// app/compras/custos/page.tsx — Fase 5: dashboard de custo de produção (espelha o relatório semanal da Qualidade).
// Fontes: v_custos_producao_semana (rollup) + v_custos_producao_mes + custos_config + planilhas_upload_log.
// kg/OPs/custo MP = ARES auto · horas/jornada/qualidade = upload XLSX · custos de processo = derivado (× custo_hora).
import { createClient } from "@/lib/supabase/server";
import { CustosUpload } from "@/components/uploads/custos-upload";
import { CustosChart, type SemanaPonto } from "@/components/compras/custos-chart";

export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

type SemanaRow = {
  ano: number; semana_iso: number; semana_inicio: string | null; semana_fim: string | null;
  kg_total: number | null; kg_medio_dia: number | null;
  n_ops_total: number | null; n_ops_medio_dia: number | null; dias_com_producao: number | null;
  dias_trabalhados: number | null; horas_semanais: number | null; horas_medio_dia: number | null;
  h_moagem_total: number | null; h_modelagem_total: number | null; h_embalamento_total: number | null;
  custo_mp_total: number | null; custo_processo_total: number | null;
  custo_proc_moagem: number | null; custo_proc_modelagem: number | null; custo_proc_embalamento: number | null;
  custo_total: number | null; custo_medio_kg: number | null; custo_processo_kg: number | null;
  custo_proc_por_dia: number | null; custo_proc_por_hora: number | null;
};
type ConfigRow = { custo_hora_moagem: number; custo_hora_modelagem: number; custo_hora_embalamento: number;
  threshold_custo_ideal: number; threshold_custo_atencao: number; threshold_custo_alerta: number };
type UploadLog = { id: number; arquivo_nome: string | null; id_usuario: string | null;
  ts_upload: string; total_linhas_ok: number | null; status: string };

const num = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const brl = (n: number | null | undefined) =>
  n == null ? "—" : `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
// decimal h → HH:MM:SS (fidelidade ao relatório)
const hms = (h: number | null | undefined) => {
  if (h == null) return "—";
  const tot = Math.round(h * 3600); const hh = Math.floor(tot / 3600);
  const mm = Math.floor((tot % 3600) / 60); const ss = tot % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};
const classCor = (c: ConfigRow | null, v: number | null) => {
  if (!c || v == null) return { cor: "#556677", label: "—" };
  if (v <= c.threshold_custo_ideal) return { cor: "#2ea043", label: "IDEAL" };
  if (v <= c.threshold_custo_atencao) return { cor: "#d29922", label: "ATENÇÃO" };
  if (v <= c.threshold_custo_alerta) return { cor: "#e8833a", label: "ALERTA" };
  return { cor: "#f85149", label: "CRÍTICO" };
};

export default async function CustosPage() {
  const supabase = await createClient();
  const [semRes, cfgRes, logRes] = await Promise.all([
    supabase.from("v_custos_producao_semana").select("*").order("semana_inicio", { ascending: false }).limit(8),
    supabase.from("custos_config").select("*").eq("id", 1).single(),
    supabase.from("planilhas_upload_log").select("id,arquivo_nome,id_usuario,ts_upload,total_linhas_ok,status").order("ts_upload", { ascending: false }).limit(10),
  ]);
  const semanas = (semRes.data ?? []) as SemanaRow[];   // desc
  const cfg = (cfgRes.data ?? null) as ConfigRow | null;
  const logs = (logRes.data ?? []) as UploadLog[];

  const ultima = semanas[0] ?? null;
  const custoHoraZero = cfg && cfg.custo_hora_moagem === 0 && cfg.custo_hora_modelagem === 0 && cfg.custo_hora_embalamento === 0;
  const cls = classCor(cfg, ultima?.custo_medio_kg ?? null);

  // chart: ordem ascendente
  const chartData: SemanaPonto[] = [...semanas].reverse().map((s) => ({
    semana: `S${s.semana_iso}`, kg_total: s.kg_total, custo_medio_kg: s.custo_medio_kg, custo_processo_kg: s.custo_processo_kg,
  }));

  // tabela espelho: indicadores como linhas, semanas como colunas (formato do PDF)
  const cols = semanas; // desc (mais recente à esquerda)
  type Lin = { label: string; fmt: (s: SemanaRow) => string; grupo?: boolean };
  const linhas: Lin[] = [
    { label: "PRODUÇÃO", fmt: () => "", grupo: true },
    { label: "kg Produzido Semanal", fmt: (s) => num(s.kg_total, 1) },
    { label: "kg Produzido Diário (média)", fmt: (s) => num(s.kg_medio_dia, 1) },
    { label: "OPs Produzidas Semanal", fmt: (s) => num(s.n_ops_total) },
    { label: "OPs Produzidas Dia (média)", fmt: (s) => num(s.n_ops_medio_dia, 1) },
    { label: "HORAS DE OPERAÇÃO", fmt: () => "", grupo: true },
    { label: "Horas moagem semanal", fmt: (s) => hms(s.h_moagem_total) },
    { label: "Horas modelagem semanal", fmt: (s) => hms(s.h_modelagem_total) },
    { label: "Horas embalamento semanal", fmt: (s) => hms(s.h_embalamento_total) },
    { label: "JORNADA", fmt: () => "", grupo: true },
    { label: "Dias trabalhados", fmt: (s) => num(s.dias_trabalhados, 1) },
    { label: "Horas trabalhadas semana", fmt: (s) => num(s.horas_semanais, 1) },
    { label: "Horas trabalhadas/dia (média)", fmt: (s) => num(s.horas_medio_dia, 1) },
    { label: "CUSTOS DE PROCESSO", fmt: () => "", grupo: true },
    { label: "Custo Moagem", fmt: (s) => brl(s.custo_proc_moagem) },
    { label: "Custo Modelagem", fmt: (s) => brl(s.custo_proc_modelagem) },
    { label: "Custo Embalamento", fmt: (s) => brl(s.custo_proc_embalamento) },
    { label: "Custo Total Processo", fmt: (s) => brl(s.custo_processo_total) },
    { label: "Custo Processo / dia", fmt: (s) => brl(s.custo_proc_por_dia) },
    { label: "Custo Processo / hora", fmt: (s) => brl(s.custo_proc_por_hora) },
    { label: "CUSTO POR KG", fmt: () => "", grupo: true },
    { label: "Custo MP (matéria-prima)", fmt: (s) => brl(s.custo_mp_total) },
    { label: "Custo Médio / kg (c/ MP)", fmt: (s) => brl(s.custo_medio_kg) },
    { label: "Custo Processo / kg (s/ MP)", fmt: (s) => brl(s.custo_processo_kg) },
  ];

  const th: React.CSSProperties = { fontSize: 9, color: "#556677", fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #1B2A6B" };
  const td: React.CSSProperties = { padding: "6px 10px", color: "#c8d8e8", fontFamily: mono, fontSize: 12, textAlign: "right" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Custo de Produção
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Espelha o relatório semanal da Qualidade. kg/OPs/custo MP vêm do ARES · horas/jornada/qualidade via upload XLSX · custos de processo derivados.
        </p>
      </div>

      {custoHoraZero && (
        <div style={{ border: "1px solid #d29922", background: "rgba(210,153,34,.08)", borderRadius: 6, padding: "10px 14px" }}>
          <p style={{ color: "#d29922", fontSize: 11, fontFamily: mono }}>
            CUSTO_HORA = R$ 0,00 (moagem/modelagem/embalamento) — aguardando RH/financeiro (DEBT-075).
            Os custos de processo e o custo/kg-processo ficam zerados até o preenchimento em custos_config. O custo MP (ARES) não é afetado.
          </p>
        </div>
      )}

      {/* KPIs da última semana */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Kpi label="Semana" value={ultima ? `S${ultima.semana_iso}/${ultima.ano}` : "—"} cor="#c8d8e8" />
        <Kpi label="kg Produzido" value={num(ultima?.kg_total ?? null, 1)} cor="#FFFFFF" />
        <Kpi label="Custo MP" value={brl(ultima?.custo_mp_total ?? null)} cor="#c8d8e8" />
        <Kpi label="Custo/kg (c/ MP)" value={brl(ultima?.custo_medio_kg ?? null)} cor={cls.cor} sub={cls.label} />
        <Kpi label="Custo/kg processo" value={brl(ultima?.custo_processo_kg ?? null)} cor="#d29922" />
      </div>

      {/* Chart */}
      <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, padding: "14px 10px 6px" }}>
        <p style={{ color: "#556677", fontSize: 9, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", padding: "0 6px 8px" }}>
          kg produzido × custo/kg por semana
        </p>
        <CustosChart data={chartData} />
      </div>

      {/* Tabela espelho semanal */}
      <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>Indicador (semanal)</th>
              {cols.map((s) => (<th key={`${s.ano}-${s.semana_iso}`} style={th}>S{s.semana_iso}/{s.ano}</th>))}
            </tr>
          </thead>
          <tbody>
            {cols.length === 0 ? (
              <tr><td colSpan={2} style={{ ...td, textAlign: "center", color: "#556677", padding: 20 }}>
                sem semanas com produção ainda — depende da migration jornada/semana aplicada + apontamentos
              </td></tr>
            ) : (
              linhas.map((l, i) => l.grupo ? (
                <tr key={i}><td colSpan={cols.length + 1} style={{ ...td, textAlign: "left", color: "#2ea043", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700, paddingTop: 12, borderBottom: "1px solid #1B2A6B" }}>{l.label}</td></tr>
              ) : (
                <tr key={i} style={{ borderBottom: "1px solid #0b0f1d" }}>
                  <td style={{ ...td, textAlign: "left", color: "#8899aa" }}>{l.label}</td>
                  {cols.map((s) => (<td key={`${s.ano}-${s.semana_iso}`} style={td}>{l.fmt(s)}</td>))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p style={{ color: "#556677", fontSize: 9, fontFamily: mono }}>
        Temperatura média semanal e perda de MP serão agregadas das abas Temp/Qualidade num próximo passo.
        kg/OPs do ARES (DEBT-073: denominador kg em validação). Horas em HH:MM:SS (armazenadas em decimal).
      </p>

      {/* Upload de apontamentos */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <a href="/api/compras/custos/template" style={{ color: "#2ea043", fontSize: 11, fontFamily: mono, textDecoration: "none", border: "1px solid #2ea043", borderRadius: 4, padding: "8px 14px", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 700 }}>
          ↓ Baixar template (5 abas)
        </a>
      </div>
      <details>
        <summary style={{ color: "#556677", fontSize: 10, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer" }}>
          Subir apontamentos da semana (XLSX)
        </summary>
        <div style={{ marginTop: 10 }}><CustosUpload /></div>
      </details>

      {/* Histórico de uploads */}
      {logs.length > 0 && (
        <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={{ ...th, textAlign: "left" }}>Upload</th><th style={{ ...th, textAlign: "left" }}>Arquivo</th>
              <th style={th}>Linhas</th><th style={{ ...th, textAlign: "center" }}>Status</th><th style={th}>Quando</th>
            </tr></thead>
            <tbody>
              {logs.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #0b0f1d" }}>
                  <td style={{ ...td, textAlign: "left" }}>#{u.id}</td>
                  <td style={{ ...td, textAlign: "left", color: "#FFFFFF", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.arquivo_nome ?? "—"}</td>
                  <td style={td}>{num(u.total_linhas_ok ?? null)}</td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 700, fontFamily: mono, color: u.status === "gravado" ? "#2ea043" : u.status === "revertido" ? "#f85149" : "#d29922" }}>{u.status.toUpperCase()}</span>
                  </td>
                  <td style={td}>{new Date(u.ts_upload).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, cor, sub }: { label: string; value: string; cor: string; sub?: string }) {
  return (
    <div style={{ background: "#0f1428", border: "1px solid #1B2A6B", borderRadius: 6, padding: "12px 14px" }}>
      <p style={{ fontSize: 9, color: "#556677", fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, color: cor, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>{value}</p>
      {sub && <p style={{ fontSize: 9, color: cor, fontFamily: mono, fontWeight: 700, marginTop: 2 }}>{sub}</p>}
    </div>
  );
}
