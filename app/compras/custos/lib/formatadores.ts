// Formatadores (portado do protótipo)
export const brl = (n: number | null | undefined) =>
  `R$ ${Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const kg = (n: number | null | undefined) =>
  `${Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
export const num = (n: number | null | undefined, d = 0) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(1)}%`;
