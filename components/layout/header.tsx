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
      style={{ background: "#0d1a0d", borderBottom: "1px solid #1a2e1a" }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="sm:hidden"
          style={{ background: "transparent", border: "none", color: "#4a6a4a", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
          aria-label="Menu"
        >
          <Menu size={18} />
        </button>
        <div className="sm:hidden" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, background: "#1B5E20", border: "1px solid #00C853", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#00E676", fontWeight: 700, fontSize: 11 }} translate="no">A</span>
          </div>
          <span style={{ color: "#00C853", fontSize: 12, fontWeight: 700, fontFamily: "'Courier New', monospace", letterSpacing: ".1em", textTransform: "uppercase" }} translate="no">ASB</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden sm:inline" style={{ color: "#4a6a4a", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
          <span style={{ color: "#00C853" }}>›</span> {email}
        </span>
        <span className="sm:hidden" style={{ color: "#4a6a4a", fontSize: 10, fontFamily: "'Courier New', monospace", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {email.split("@")[0]}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "transparent", border: "1px solid #1a2e1a", color: "#4a6a4a",
            fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase",
            padding: "4px 10px", borderRadius: 2, cursor: "pointer",
            fontFamily: "'Courier New', monospace", transition: "all .15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#00C853";
            (e.currentTarget as HTMLButtonElement).style.color = "#00C853";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a2e1a";
            (e.currentTarget as HTMLButtonElement).style.color = "#4a6a4a";
          }}
        >
          logout
        </button>
      </div>
    </header>
  );
}
