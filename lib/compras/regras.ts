// lib/compras/regras.ts — FONTE ÚNICA das constantes de negócio do workspace Compras.
// Régua canônica: CLAUDE.md "REGRA COMPRAS MTD" + skill asb-compras-resultados.
// Antes (auditoria 2026-07-10): emitentes copiados 3×, thresholds 54/65 em 3 pontos,
// paleta do semáforo e formatador BRL redefinidos por arquivo. Mudou a régua? Ajustar SÓ aqui.

// Emitentes ASB: American Steak (1) + Red Foods (2074).
export const EMITENTES_ASB = [1, 2074];

// Semáforo % Compras/Faturado: 🟢 ≤54 · 🟡 54–65 · 🔴 >65.
export const SEMAFORO_VERDE_MAX = 54;
export const SEMAFORO_AMARELO_MAX = 65;

// Paleta única do semáforo de compras (mesmos hexes do calendário diário).
export const COR_SEMAFORO: Record<string, string> = {
  verde: "#2ea043",
  amarelo: "#d29922",
  vermelho: "#f85149",
  sem_dado: "#2a3340",
  credito: "#58a6ff",
};

export function nivelSemaforo(pct: number): "verde" | "amarelo" | "vermelho" {
  if (pct <= SEMAFORO_VERDE_MAX) return "verde";
  if (pct <= SEMAFORO_AMARELO_MAX) return "amarelo";
  return "vermelho";
}

export function semaforoPct(pct: number): { cor: string; label: string } {
  const nivel = nivelSemaforo(pct);
  return {
    cor: COR_SEMAFORO[nivel],
    label: nivel === "verde" ? "OK" : nivel === "amarelo" ? "ALERTA" : "CRÍTICO",
  };
}

// Cor a partir do rótulo textual da view v_resultado_mensal (OK/ALERTA/CRITICO).
export function corSemaforoLabel(s: string): string {
  return s === "CRITICO" ? COR_SEMAFORO.vermelho : s === "ALERTA" ? COR_SEMAFORO.amarelo : COR_SEMAFORO.verde;
}

// Moeda BRL sem centavos (padrão dos cards de compras).
export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
