// app/compras/previsao/page.tsx — Fase 3 (cru): lista de compra (CMD + demanda - saldo - carteira).
// Fonte: v_previsao_compra + compras_config (read-only no M1). saldo_confiavel só p/ produtos ancorados.
import { createClient } from "@/lib/supabase/server";
import PrevisaoClient, { type PrevRow } from "./previsao-client";
import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead, StatTile } from "@/app/dashboard/lib/ui";

export const dynamic = "force-dynamic";

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
  const alerta = reporTotal > 0;
  const sinal = alerta ? "#C8102E" : "#22c55e";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <PageHead
        title="Previsão de Compras"
        desc="O que comprar e quanto: CMD (venda + produção) × horizonte − saldo − carteira aberta, por fornecedor."
      />

      {cfg && (
        <div style={{ ...S.card, padding: "12px 16px" }}>
          <p style={{ color: "#c8d2e6", fontSize: 12.5, fontFamily: theme.font.label }}>
            <span style={{ color: "#83879a" }}>Config ativa · </span>
            horizonte <b style={{ fontFamily: theme.font.num }}>{cfg.horizonte_dias}d</b> · segurança{" "}
            <b style={{ fontFamily: theme.font.num }}>{cfg.dias_seguranca}d</b> · ciclo{" "}
            <b style={{ fontFamily: theme.font.num }}>{cfg.ciclo_revisao_dias}d</b> · lead default{" "}
            <b style={{ fontFamily: theme.font.num }}>{cfg.lead_time_default}d</b>
            <span style={{ color: "#83879a" }}> (editável via SQL no M1)</span>
          </p>
        </div>
      )}

      {/* Semáforo de reposição — sinal (🔴 repor agora / 🟢 cobertura ok) preservado */}
      <div className="asb-grid-kpi">
        <StatTile
          label="Repor Agora"
          value={reporTotal}
          accent={sinal}
          num={sinal}
          sub={alerta ? "insumos abaixo do ponto de reposição" : "nenhum insumo abaixo do ponto de reposição"}
        />
      </div>

      <p style={{ color: "#aeb7cc", fontSize: 12, fontFamily: theme.font.label }}>
        <b style={{ color: "#c8d2e6" }}>&quot;s/ âncora&quot;</b> = sem saldo calculado (sem movimentação
        capturada no espelho — assume 0; confira antes de comprar).
      </p>

      <PrevisaoClient rows={merged} />

      <p style={{ color: "#83879a", fontSize: 11.5, fontFamily: theme.font.label, lineHeight: 1.5 }}>
        Comprável = produto com histórico de compra. CMD-90 = tipos 1+4, 90 dias corridos — janela longa p/
        planejamento (o Estoque usa CMD-30, ruptura). Fornecedor = mais frequente no histórico.
        Edição de config + sort interativo = ciclo 2. CMD de MP transformada: DEBT-069.
      </p>
    </div>
  );
}
