// Lógica PURA do Top 10 consolidado por grupo econômico (fn_top10_clientes_grupos).
// Testada em tests/top10-grupos.test.ts. Mantém o espírito de lib/top10-share.ts:
// número errado NUNCA aparece — na dúvida, a UI esconde o detalhe, não inventa.

export type Top10GrupoUnidade = {
  ares_pessoa_id: number;
  nome: string | null;
  receita_mes: number;
  pedidos_mes: number;
};

export type Top10GrupoRow = {
  chave: string;
  eh_grupo: boolean;
  nome_exibicao: string | null;
  ares_pessoa_id: number;
  contato: string | null;
  bairro: string | null;
  vendedor_routing_team: string | null;
  vendedor_nome: string | null;
  pedidos_mes: number;
  receita_mes: number;
  recorrencia_semanal: number;
  ticket_medio: number;
  unidades: number;
  composicao: Top10GrupoUnidade[] | null;
  receita_total_mes: number | null;
};

// Ordena por receita desc e limita a N, com dedupe defensivo por `chave`
// (a RPC garante unicidade por construção; se algo duplicar, fica a 1ª ocorrência —
// nunca somamos duas vezes).
export function ordenarELimitar(rows: Top10GrupoRow[], n = 10): Top10GrupoRow[] {
  const seen = new Set<string>();
  const out: Top10GrupoRow[] = [];
  for (const r of [...rows].sort((a, b) => Number(b.receita_mes || 0) - Number(a.receita_mes || 0))) {
    if (seen.has(r.chave)) continue;
    seen.add(r.chave);
    out.push(r);
    if (out.length >= n) break;
  }
  return out;
}

// A composição por unidade só é exibida se fechar com o total do grupo
// (tolerância de centavos por arredondamento). Grupo sem composição válida
// continua no ranking — só perde o detalhamento.
export function composicaoConfere(row: Top10GrupoRow): boolean {
  if (!row.eh_grupo || !row.composicao || row.composicao.length === 0) return false;
  const soma = row.composicao.reduce((s, u) => s + Number(u.receita_mes || 0), 0);
  return Math.abs(soma - Number(row.receita_mes || 0)) < 0.05;
}

export type ShareConsolidado =
  | { show: false }
  | { show: true; pctLabel: string; barPct: number; totalLabel: string };

const brlFmt = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Share do Top N sobre o faturamento total do período (receita_total_mes da RPC,
// mesma régua/base). Guardas: sem total válido, ou % fora de (0, 100], não exibe.
export function shareConsolidado(totalExibido: number, receitaTotalMes: number | null | undefined): ShareConsolidado {
  const total = Number(receitaTotalMes ?? 0);
  const top = Number(totalExibido || 0);
  if (!(total > 0) || !(top > 0)) return { show: false };
  const pct = (top / total) * 100;
  if (pct > 100.05) return { show: false }; // top10 > total = dado inconsistente → esconder
  return {
    show: true,
    pctLabel: `${pct.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
    barPct: Math.min(100, pct),
    totalLabel: brlFmt(total),
  };
}
