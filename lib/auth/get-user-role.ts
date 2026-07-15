import { createClient } from "@/lib/supabase/server";

export type UserRole = "gestor" | "manager" | "vendedor" | "tecnico_compras" | "financeiro";

export interface UserContext {
  email: string;
  role: UserRole;
  routing_team: string | null;
  comissaoPerfil: string | null;   // 'diretor' | 'gerente' | null (gate das telas de remuneracao)
  isGestor: boolean;
  isManager: boolean;
  isVendedor: boolean;
  isTecnicoCompras: boolean;
  isFinanceiro: boolean;          // consultor externo DRE: ve tudo, READ-ONLY (escrita barrada no middleware)
  isDiretor: boolean;              // gestor + comissao_perfil='diretor' (so Paulo ve a tela do time)
  isGerente: boolean;              // comissao_perfil='gerente' (Fernando): usa a tela do time (Remuneracao), nao a Minha Comissao
}

const VENDOR_BLOCKED: string[] = [
  // /dashboard/funil LIBERADO ao vendedor (Paulo 2026-07-14): usa o Funil p/ navegar
  // até seus leads (cards de etapa clicáveis) — inclui achar os que já assumiu.
  "/dashboard/cadencias",   // F1: Central de Orquestração só gestor/manager (escopo por vendedor = fase futura)
  "/dashboard/vendedores",
  "/dashboard/insights",
  "/dashboard/simulator",
  "/dashboard/uploads",
  "/dashboard/remuneracao",
];

const MANAGER_BLOCKED: string[] = [
  "/dashboard/simulator",
  "/dashboard/uploads",
];

export function canAccess(role: UserRole, route: string): boolean {
  // /marketing (gasto/CAC/ROAS/receita = informação de gestão): gestor, manager e
  // financeiro. Vendedor e tecnico_compras FORA (auditoria 2026-07-10 — antes era
  // rota sem trava e qualquer sessão via o gasto de mídia).
  if (route.startsWith("/marketing")) {
    return role === "gestor" || role === "manager" || role === "financeiro";
  }
  // financeiro (consultor externo DRE): vê TUDO (read-only — escrita barrada no middleware)
  if (role === "gestor" || role === "financeiro") return true;
  if (role === "manager") return !MANAGER_BLOCKED.includes(route);
  if (role === "vendedor") return !VENDOR_BLOCKED.includes(route);
  // tecnico_compras: acesso exclusivo a /compras — bloqueado em todo /dashboard
  if (role === "tecnico_compras") return route.startsWith("/compras");
  return false;
}

export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, routing_team, comissao_perfil")
    .eq("email", user.email)
    .single();

  if (!profile) return null;

  const role = (profile.role || "vendedor") as UserRole;
  const comissaoPerfil = (profile.comissao_perfil ?? null) as string | null;
  return {
    email: user.email,
    role,
    routing_team: profile.routing_team,
    comissaoPerfil,
    isGestor: role === "gestor",
    isManager: role === "manager",
    isVendedor: role === "vendedor",
    isTecnicoCompras: role === "tecnico_compras",
    isFinanceiro: role === "financeiro",
    isDiretor: role === "gestor" && comissaoPerfil === "diretor",
    isGerente: comissaoPerfil === "gerente",
  };
}
