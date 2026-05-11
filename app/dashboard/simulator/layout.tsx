import { redirect } from "next/navigation";
import { getUserContext, canAccess } from "@/lib/auth/get-user-role";

export default async function SimulatorLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getUserContext();
  if (!ctx || !canAccess(ctx.role, "/dashboard/simulator")) redirect("/dashboard");
  return <>{children}</>;
}
