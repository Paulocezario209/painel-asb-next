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
      style={{ background: "#080b14", borderBottom: "1px solid #1B2A6B" }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="sm:hidden"
          style={{ background: "transparent", border: "none", color: "#8899aa", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>
        <div className="sm:hidden" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, background: "#1B2A6B", border: "1px solid #2A3F8F", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#FFFFFF", fontWeight: 700, fontSize: 11 }} translate="no">A</span>
          </div>
          <span style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase" }} translate="no">ASB</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline" style={{ color: "#8899aa", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
          <span style={{ color: "#C8102E" }}>›</span> {email}
        </span>
        <span className="sm:hidden" style={{ color: "#8899aa", fontSize: 10, fontFamily: "'Courier New', monospace", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email.split("@")[0]}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "transparent", border: "1px solid #1B2A6B", color: "#8899aa",
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
            (e.currentTarget as HTMLButtonElement).style.color = "#8899aa";
          }}
        >
          logout
        </button>
      </div>
    </header>
  );
}
