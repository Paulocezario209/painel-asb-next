import { createClient } from "@/lib/supabase/server";

export type UserRole = "gestor" | "manager" | "vendedor";

export interface UserContext {
  email: string;
  role: UserRole;
  routing_team: string | null;
  isGestor: boolean;
  isManager: boolean;
  isVendedor: boolean;
}

const VENDOR_BLOCKED: string[] = [
  "/dashboard/funil",
  "/dashboard/vendedores",
  "/dashboard/insights",
  "/dashboard/simulator",
  "/dashboard/uploads",
];

const MANAGER_BLOCKED: string[] = [
  "/dashboard/simulator",
  "/dashboard/uploads",
];

export function canAccess(role: UserRole, route: string): boolean {
  if (role === "gestor") return true;
  if (role === "manager") return !MANAGER_BLOCKED.includes(route);
  if (role === "vendedor") return !VENDOR_BLOCKED.includes(route);
  return false;
}

export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, routing_team")
    .eq("email", user.email)
    .single();

  if (!profile) return null;

  const role = (profile.role || "vendedor") as UserRole;
  return {
    email: user.email,
    role,
    routing_team: profile.routing_team,
    isGestor: role === "gestor",
    isManager: role === "manager",
    isVendedor: role === "vendedor",
  };
}
