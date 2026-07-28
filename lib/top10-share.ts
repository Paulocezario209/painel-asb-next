// Indicador "Top 10 x Faturamento Mensal" — lógica pura e testável.
// Fonte ÚNICA dos números: view consolidada v_top10_share_mes (Supabase), que deriva de
// v_top10_clientes_mes V3 (régua: PEDIDO FATURADO no mês, BRT, sem cancelado/deletado/R$0).
// O frontend NÃO recalcula regra de negócio — só valida consistência e formata (pt-BR).
// Guardas: sem dados → não exibe; total <= 0 → 0%; soma dos 10 exibidos ≠ agregado → não
// exibe; percentual > 100 → não exibe (inconsistência a investigar, nunca publicar).

export type Top10ShareRow = {
  receita_top10: number | string | null;
  faturamento_mensal_total: number | string | null;
  percentual_top10: number | string | null;
  periodo: string | null;
  criterio: string | null;
};

export type Top10ShareView =
  | { show: false; reason: "sem_dados" | "inconsistente" }
  | {
      show: true;
      receitaTop10: number;
      faturamentoTotal: number;
      pct: number;
      barPct: number;
      pctLabel: string;
      totalLabel: string;
      periodo: string;
    };

export const brl = (n: number) =>
  `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const pctBR = (n: number) =>
  `${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export function resolveTop10Share(
  somaExibida: number,
  row: Top10ShareRow | null | undefined
): Top10ShareView {
  if (!row) return { show: false, reason: "sem_dados" };
  if (row.receita_top10 == null || row.faturamento_mensal_total == null || row.percentual_top10 == null) {
    return { show: false, reason: "sem_dados" };
  }

  const receita = Number(row.receita_top10);
  const total = Number(row.faturamento_mensal_total);
  const pctBackend = Number(row.percentual_top10);
  if (!Number.isFinite(receita) || !Number.isFinite(total) || !Number.isFinite(pctBackend)) {
    return { show: false, reason: "sem_dados" };
  }

  // Regra: faturamento <= 0 → percentual 0 (impede divisão por zero).
  const pctLocal = total > 0 ? Math.round((receita / total) * 1000) / 10 : 0;

  // Consistência 1: a soma dos 10 clientes exibidos deve bater com o agregado (tolerância 1 centavo).
  if (Math.abs(somaExibida - receita) > 0.011) return { show: false, reason: "inconsistente" };
  // Consistência 2: o percentual do backend deve corresponder ao cálculo matemático.
  if (Math.abs(pctBackend - pctLocal) > 0.05) return { show: false, reason: "inconsistente" };
  // Consistência 3: nunca publicar acima de 100%.
  if (pctBackend > 100 || pctBackend < 0) return { show: false, reason: "inconsistente" };

  return {
    show: true,
    receitaTop10: receita,
    faturamentoTotal: total,
    pct: pctBackend,
    barPct: Math.max(0, Math.min(100, pctBackend)),
    pctLabel: pctBR(pctBackend),
    totalLabel: brl(total),
    periodo: row.periodo ?? "",
  };
}
