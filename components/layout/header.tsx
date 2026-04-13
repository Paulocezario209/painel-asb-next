"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Menu } from "lucide-react";

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
      style={{
        background: "#161b22",
        borderBottom: "1px solid #21262d",
      }}
    >
      {/* Left: hamburger (mobile) + logo (mobile) */}
      <div className="flex items-center gap-3">
        {/* Hamburger — visible on mobile only */}
        <button
          onClick={onMenuToggle}
          className="sm:hidden"
          style={{
            background: "transparent",
            border: "none",
            color: "#8b949e",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
          }}
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>

        {/* ASB logo — mobile only (sidebar hidden) */}
        <span
          className="sm:hidden"
          style={{
            color: "#e6edf3",
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'Courier New', monospace",
          }}
          translate="no"
        >
          ASB
        </span>
      </div>

      {/* Right: email + logout */}
      <div className="flex items-center gap-3">
        <span
          className="hidden sm:inline"
          style={{ color: "#8b949e", fontSize: 11, fontFamily: "'Courier New', monospace" }}
        >
          <span style={{ color: "#58a6ff" }}>$</span> {email}
        </span>
        {/* Compact email on mobile */}
        <span
          className="sm:hidden"
          style={{ color: "#8b949e", fontSize: 10, fontFamily: "'Courier New', monospace", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {email.split("@")[0]}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "1px solid #30363d",
            color: "#8b949e",
            fontSize: 9,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 3,
            cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#f85149";
            (e.currentTarget as HTMLButtonElement).style.color = "#f85149";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#30363d";
            (e.currentTarget as HTMLButtonElement).style.color = "#8b949e";
          }}
        >
          logout
        </button>
      </div>
    </header>
  );
}
