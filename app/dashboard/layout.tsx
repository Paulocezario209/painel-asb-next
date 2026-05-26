import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserContext } from "@/lib/auth/get-user-role";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const ctx = await getUserContext();
  const role = ctx?.role ?? "vendedor";

  // tecnico_compras: acesso exclusivo a /compras — bloqueia toda a área SDR/dashboard
  if (role === "tecnico_compras") {
    redirect("/compras/resultados");
  }

  return (
    <DashboardShell email={user.email ?? ""} role={role}>
      {children}
    </DashboardShell>
  );
}
