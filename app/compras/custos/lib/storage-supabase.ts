// Substitui window.storage do protótipo por chamadas à API (Supabase server-side).
export type Registro = {
  id?: number; data: string; kg_produzido: number; custo_total: number; custo_kg: number | null;
  temperatura: number; ops: number; horas_moagem: number; horas_modelagem: number; horas_embalamento: number;
  status: string; obs: string | null; source: string;
};

const BASE = "/api/compras/custos";
async function jget(url: string) { const r = await fetch(url); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`); return r.json(); }
async function jsend(url: string, method: string, body: unknown) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
  return d;
}

export const api = {
  carregarTodos: () => jget(`${BASE}/producao?todos=true`).then((d) => d.registros as Registro[]),
  salvarRegistro: (r: Record<string, unknown>) => jsend(`${BASE}/producao`, "POST", r),
  salvarLote: (registros: Record<string, unknown>[]) => jsend(`${BASE}/producao/lote`, "POST", { registros }),
  removerRegistro: (data: string) => jsend(`${BASE}/producao`, "DELETE", { data }),
  copiarMes: (mesOrigem: number, mesDestino: number, ano: number) => jsend(`${BASE}/producao/copiar-mes`, "POST", { mesOrigem, mesDestino, ano }),
  limparMes: (ano: number, mes: number) => jsend(`${BASE}/producao/limpar-mes`, "POST", { ano, mes, confirmacao: "LIMPAR" }),
  alertasConfig: () => jget(`${BASE}/alertas/config`).then((d) => d.config),
  processoConfig: () => jget(`${BASE}/processo/config`).then((d) => d.config),
  projecaoConfig: (ano: number) => jget(`${BASE}/projecao/config?ano=${ano}`).then((d) => d.config),
  insumos: () => jget(`${BASE}/insumos`).then((d) => d.insumos),
  salvarInsumo: (i: Record<string, unknown>) => jsend(`${BASE}/insumos`, "POST", i),
  removerInsumo: (id: number) => jsend(`${BASE}/insumos`, "DELETE", { id }),
  criarBackup: (nome: string) => jsend(`${BASE}/backup`, "POST", { nome }),
  aresSync: () => jsend(`${BASE}/ares-sync`, "POST", {}),
};
