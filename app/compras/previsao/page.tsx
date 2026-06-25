// app/compras/previsao/page.tsx — Fase 3 (cru): lista de compra (CMD + demanda - saldo - carteira).
// Fonte: v_previsao_compra + compras_config (read-only no M1). saldo_confiavel só p/ produtos ancorados.
import { createClient } from "@/lib/supabase/server";
import PrevisaoClient, { type PrevRow } from "./previsao-client";

export const dynamic = "force-dynamic";

import { theme } from "@/lib/theme";
type PoolRow = {
  pool_key: string; pool_nome: string; skus: string | null;
  cmd: number; demanda_horizonte: number; saldo_atual: number | null; saldo_confiavel: boolean;
  em_pedido: number; lead_time_dias: number; ponto_reposicao: number; a_comprar: number; repor_agora: boolean;
};
type PoolMember = { id_produto: number; pool_key: string };
type Config = { horizonte_dias: number; dias_seguranca: number; ciclo_revisao_dias: number; lead_time_default: number };

export default async function PrevisaoPage() {
  const supabase = await createClient();
  const [prevRes, cfgRes, poolRes, memberRes] = await Promise.all([
    supabase.from("v_previsao_compra").select("*"),
    supabase.from("compras_config").select("*").eq("id", 1).maybeSingle(),
    supabase.from("v_previsao_compra_pool").select("*"),
    supabase.from("produto_pool").select("id_produto,pool_key"),
  ]);
  const rows = (prevRes.data ?? []) as PrevRow[];
  const cfg = (cfgRes.data ?? null) as Config | null;
  const poolRows = (poolRes.data ?? []) as PoolRow[];
  const poolMembers = (memberRes.data ?? []) as PoolMember[];

  // Membros a esconder — DEFENSIVO: só esconde SKUs cujo pool de fato veio em poolRows.
  // Pool vazio/erro => presentKeys vazio => pooledIds vazio => nada escondido (comportamento de hoje).
  const presentKeys = new Set(poolRows.map((p) => p.pool_key));
  const pooledIds = new Set(
    poolMembers.filter((m) => presentKeys.has(m.pool_key)).map((m) => m.id_produto),
  );

  const adaptPool = (p: PoolRow): PrevRow => ({
    id_produto: `pool:${p.pool_key}`,
    descricao: p.pool_nome,
    grupo_nome: null,
    fornecedor_provavel: null,
    cmd: p.cmd, demanda_horizonte: p.demanda_horizonte,
    saldo_atual: p.saldo_atual, saldo_confiavel: p.saldo_confiavel,
    em_pedido: p.em_pedido, lead_time_dias: p.lead_time_dias,
    ponto_reposicao: p.ponto_reposicao, a_comprar: p.a_comprar, repor_agora: p.repor_agora,
    skus: p.skus, __isPool: true,
  });

  const baseRows = rows.filter((r) => !pooledIds.has(r.id_produto as number));
  const merged: PrevRow[] = [...baseRows, ...poolRows.map(adaptPool)].sort(
    (a, b) =>
      (Number(b.repor_agora) - Number(a.repor_agora)) ||
      ((b.a_comprar ?? 0) - (a.a_comprar ?? 0)),
  );

  // banner conta o TOTAL (não filtrado) — a busca acontece no client
  const reporTotal = merged.filter((r) => r.repor_agora).length;

  const th: React.CSSProperties = { fontSize: 9, color: "#556677", fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", padding: "8px 10px", textAlign: "right", borderBottom: "1px solid #1B2A6B" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>Previsão de Compras</h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: theme.font.label }}>
          O que comprar e quanto: CMD (venda+produção) × horizonte − saldo − carteira aberta, por fornecedor.
        </p>
      </div>

      {cfg && (
        <div style={{ ...th, textAlign: "left", border: "none", paddingLeft: 0, color: "#8899aa" }}>
          ⚙ config: horizonte {cfg.horizonte_dias}d · segurança {cfg.dias_seguranca}d · ciclo {cfg.ciclo_revisao_dias}d · lead default {cfg.lead_time_default}d
          <span style={{ color: "#556677" }}> (editável via SQL no M1)</span>
        </div>
      )}

      <div style={{ border: "1px solid #f85149", background: "rgba(248,81,73,.07)", borderRadius: 6, padding: "10px 14px" }}>
        <p style={{ color: "#f85149", fontSize: 11, fontFamily: theme.font.label }}>
          🔴 REPOR AGORA: {reporTotal} insumo(s) abaixo do ponto de reposição.
          <span style={{ color: "#556677" }}> &quot;s/ âncora&quot; = saldo não confiável até inventário 30/05 (assume 0).</span>
        </p>
      </div>

      <PrevisaoClient rows={merged} />

      <p style={{ color: "#556677", fontSize: 9, fontFamily: theme.font.label }}>
        Comprável = produto com histórico de compra. CMD tipos 1+4 (90d). Fornecedor = mais frequente no histórico.
        Edição de config + sort interativo = ciclo 2. CMD de MP transformada: DEBT-069.
      </p>
    </div>
  );
}
