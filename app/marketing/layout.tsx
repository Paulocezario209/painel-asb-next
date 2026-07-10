// app/marketing/layout.tsx — gate de papel (auditoria 2026-07-10): gasto/CAC/receita
// são informação de gestão; least-privilege igual ao /dashboard (canAccess decide).
import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";
import { MarketingShell } from "./_components/marketing-shell";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");
  if (!canAccess(ctx.role, "/marketing")) {
    redirect(ctx.isTecnicoCompras ? "/compras" : "/dashboard");
  }

  return (
    <MarketingShell email={ctx.email}>
      {children}
    </MarketingShell>
  );
}
