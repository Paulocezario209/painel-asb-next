// app/compras/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ComprasShell } from "./_components/compras-shell";

export default async function ComprasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ComprasShell email={user.email ?? ""}>
      {children}
    </ComprasShell>
  );
}
