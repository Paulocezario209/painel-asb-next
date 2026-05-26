// Controle estatístico de processo — cartas I-MR (Shewhart) + regras Western Electric.
// Usado pela camada Custos (Gerencial). Puro, sem deps.

export type ZonaPonto = "normal" | "atencao" | "fora";
export type PontoIMR = {
  i: number; label: string; valor: number; mr: number | null;
  zona: ZonaPonto; regras: number[];
};
export type LimitesControle = {
  media: number; sigma: number; mrBar: number;
  lcs: number; lci: number; s1p: number; s1m: number; s2p: number; s2m: number;
  lcsMr: number; min: number; max: number; n: number;
};
export type ResultadoIMR = {
  limites: LimitesControle; pontos: PontoIMR[];
  pontosFora: number; pontosAtencao: number; sinal: string;
};

const D2 = 1.128; // constante d2 para n=2 (amplitude móvel)

export const calcMean = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
export const calcMR = (xs: number[]) => xs.map((v, i) => (i === 0 ? null : Math.abs(v - xs[i - 1])));
export function calcSigma(xs: number[]): number {
  const mrs = calcMR(xs).filter((v): v is number => v != null);
  const mrBar = calcMean(mrs);
  return mrBar / D2; // sigma estimado via amplitude móvel (I-MR)
}

export function computeControlLimits(xs: number[]): LimitesControle {
  const media = calcMean(xs);
  const mrs = calcMR(xs).filter((v): v is number => v != null);
  const mrBar = calcMean(mrs);
  const sigma = mrBar / D2;
  return {
    media, sigma, mrBar,
    lcs: media + 3 * sigma, lci: media - 3 * sigma,
    s1p: media + sigma, s1m: media - sigma,
    s2p: media + 2 * sigma, s2m: media - 2 * sigma,
    lcsMr: 3.267 * mrBar, // D4 para n=2
    min: xs.length ? Math.min(...xs) : 0,
    max: xs.length ? Math.max(...xs) : 0,
    n: xs.length,
  };
}

// Western Electric: 1) 1pt >3σ · 2) 2/3 >2σ mesmo lado · 3) 4/5 >1σ mesmo lado · 4) 8 seguidos mesmo lado
export function detectWesternElectricRules(xs: number[], lim: LimitesControle): number[][] {
  const out: number[][] = xs.map(() => []);
  const { media, sigma } = lim;
  if (sigma === 0) return out;
  const lado = (v: number) => (v > media ? 1 : v < media ? -1 : 0);
  for (let i = 0; i < xs.length; i++) {
    // Regra 1
    if (Math.abs(xs[i] - media) > 3 * sigma) out[i].push(1);
    // Regra 2: 2 de 3 além de 2σ no mesmo lado
    if (i >= 1) {
      for (const j of [[i - 2, i - 1, i], [i - 1, i]].filter((g) => g[0] >= 0)) {
        const win = j.map((k) => xs[k]);
        const ld = lado(xs[i]);
        const cnt = win.filter((v) => lado(v) === ld && Math.abs(v - media) > 2 * sigma).length;
        if (win.length >= 2 && cnt >= 2 && Math.abs(xs[i] - media) > 2 * sigma) { out[i].push(2); break; }
      }
    }
    // Regra 3: 4 de 5 além de 1σ mesmo lado
    if (i >= 3) {
      const win = xs.slice(Math.max(0, i - 4), i + 1);
      const ld = lado(xs[i]);
      const cnt = win.filter((v) => lado(v) === ld && Math.abs(v - media) > sigma).length;
      if (cnt >= 4 && Math.abs(xs[i] - media) > sigma) out[i].push(3);
    }
    // Regra 4: 8 consecutivos do mesmo lado
    if (i >= 7) {
      const win = xs.slice(i - 7, i + 1);
      const ld = lado(xs[i]);
      if (ld !== 0 && win.every((v) => lado(v) === ld)) out[i].push(4);
    }
  }
  return out;
}

export function analisarIMR(serie: { label: string; valor: number }[]): ResultadoIMR {
  const xs = serie.map((s) => s.valor);
  const lim = computeControlLimits(xs);
  const mrs = calcMR(xs);
  const regras = detectWesternElectricRules(xs, lim);
  const pontos: PontoIMR[] = serie.map((s, i) => {
    const rs = regras[i];
    const fora = rs.length > 0;
    const atencao = !fora && Math.abs(xs[i] - lim.media) > lim.s2p - lim.media; // além de 2σ
    return { i, label: s.label, valor: s.valor, mr: mrs[i], zona: fora ? "fora" : atencao ? "atencao" : "normal", regras: rs };
  });
  const pontosFora = pontos.filter((p) => p.zona === "fora").length;
  const pontosAtencao = pontos.filter((p) => p.zona === "atencao").length;
  const sinal = pontosFora > 0
    ? `${pontosFora} ponto(s) fora de controle (Western Electric)`
    : pontosAtencao > 0
    ? `${pontosAtencao} ponto(s) na zona de atenção (>2σ)`
    : "processo sob controle estatístico";
  return { limites: lim, pontos, pontosFora, pontosAtencao, sinal };
}
