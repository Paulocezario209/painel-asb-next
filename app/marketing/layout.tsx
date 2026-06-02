// app/marketing/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MarketingShell } from "./_components/marketing-shell";

export default async function MarketingLayout({
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
    <MarketingShell email={user.email ?? ""}>
      {children}
    </MarketingShell>
  );
}
