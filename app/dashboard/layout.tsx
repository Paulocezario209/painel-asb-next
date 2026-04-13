import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

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

  return (
    <div className="flex h-screen" style={{ background: "#0d1117" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header email={user.email ?? ""} />
        <main className="flex-1 overflow-auto p-6" style={{ background: "#0d1117" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
