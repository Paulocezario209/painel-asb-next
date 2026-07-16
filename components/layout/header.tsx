"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Menu } from "lucide-react";
import { StoreSwitcher } from "./store-switcher";
import { ManualTelaButton } from "./manual-tela";

export function Header({
  email,
  onMenuToggle,
}: {
  email: string;
  onMenuToggle?: () => void;
}) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      className="h-12 flex items-center justify-between px-4 shrink-0"
      style={{ background: "color-mix(in srgb, var(--asb-page-1) 78%, transparent)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--asb-shell-border)" }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="sm:hidden"
          style={{ background: "transparent", border: "none", color: "#565A6B", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>
        <StoreSwitcher />
      </div>

      <div className="flex items-center gap-3">
        <ManualTelaButton />
        <span className="hidden sm:inline" style={{ color: "#565A6B", fontSize: 11, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
          <span style={{ color: "#C8102E" }}>›</span> {email}
        </span>
        <span className="sm:hidden" style={{ color: "#565A6B", fontSize: 10, fontFamily: "var(--font-geist-sans), system-ui, sans-serif", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email.split("@")[0]}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "var(--asb-shell)", border: "1px solid var(--asb-shell-border)", color: "#565A6B",
            fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
            padding: "4px 10px", borderRadius: 8, cursor: "pointer",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif", transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#C8102E";
            (e.currentTarget as HTMLButtonElement).style.color = "#C8102E";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--asb-shell-border)";
            (e.currentTarget as HTMLButtonElement).style.color = "#565A6B";
          }}
        >
          logout
        </button>
      </div>
    </header>
  );
}
