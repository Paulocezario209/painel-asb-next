// Modulos do dashboard DESATIVADOS por decisao de produto (consultoria comercial,
// micro-lote 1, 2026-08-08): telas fora de uso somem da navegacao e o acesso direto
// por URL redireciona para /dashboard. Paginas, componentes e dados ficam intactos.
//
// PARA REATIVAR uma tela: remova a rota desta lista (unico ponto de controle).
// A sidebar (components/layout/sidebar.tsx) e o canAccess (lib/auth/get-user-role.ts)
// leem AMBOS daqui — nao ha segunda lista a manter.
//
// Este arquivo nao pode importar nada server-only (next/headers etc.): ele e
// compartilhado entre Server Components e o Client Component da sidebar.
export const MODULOS_DESATIVADOS: readonly string[] = [
  "/dashboard/insights", // "Inteligência"
  "/dashboard/hot-leads", // "Leads quentes"
];

export function moduloDesativado(route: string): boolean {
  return MODULOS_DESATIVADOS.some(
    (m) => route === m || route.startsWith(`${m}/`)
  );
}
