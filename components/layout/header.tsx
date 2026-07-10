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
      style={{ background: "#080b14", borderBottom: "1px solid #1B2A6B" }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="sm:hidden"
          style={{ background: "transparent", border: "none", color: "#c0d0e0", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>
        <StoreSwitcher />
      </div>

      <div className="flex items-center gap-3">
        <ManualTelaButton />
        <span className="hidden sm:inline" style={{ color: "#c0d0e0", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
          <span style={{ color: "#C8102E" }}>›</span> {email}
        </span>
        <span className="sm:hidden" style={{ color: "#c0d0e0", fontSize: 10, fontFamily: "'Courier New', monospace", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email.split("@")[0]}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "transparent", border: "1px solid #1B2A6B", color: "#c0d0e0",
            fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
            padding: "4px 10px", borderRadius: 2, cursor: "pointer",
            fontFamily: "'Courier New', monospace", transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#C8102E";
            (e.currentTarget as HTMLButtonElement).style.color = "#C8102E";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#1B2A6B";
            (e.currentTarget as HTMLButtonElement).style.color = "#c0d0e0";
          }}
        >
          logout
        </button>
      </div>
    </header>
  );
}
