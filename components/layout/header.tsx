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
        background: "#111111",
        borderBottom: "1px solid #2a2a2a",
      }}
    >
      {/* Left: hamburger (mobile) + logo (mobile) */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="sm:hidden"
          style={{
            background: "transparent",
            border: "none",
            color: "#666666",
            cursor: "pointer",
            padding: 4,
            display: "flex",
            alignItems: "center",
          }}
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>

        {/* ASB logo — mobile only */}
        <div className="sm:hidden" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, background: "#C8102E", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 11 }} translate="no">A</span>
          </div>
          <span style={{ color: "#F5F5F5", fontSize: 12, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase" }} translate="no">
            ASB
          </span>
        </div>
      </div>

      {/* Right: email + logout */}
      <div className="flex items-center gap-3">
        <span
          className="hidden sm:inline"
          style={{ color: "#666666", fontSize: 11, fontFamily: "'Courier New', monospace" }}
        >
          <span style={{ color: "#C8102E" }}>›</span> {email}
        </span>
        <span
          className="sm:hidden"
          style={{ color: "#666666", fontSize: 10, fontFamily: "'Courier New', monospace", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {email.split("@")[0]}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "1px solid #2a2a2a",
            color: "#666666",
            fontSize: 9,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            padding: "4px 10px",
            borderRadius: 2,
            cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#C8102E";
            (e.currentTarget as HTMLButtonElement).style.color = "#C8102E";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#2a2a2a";
            (e.currentTarget as HTMLButtonElement).style.color = "#666666";
          }}
        >
          logout
        </button>
      </div>
    </header>
  );
}
