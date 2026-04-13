"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function Header({ email }: { email: string }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header
      className="h-12 flex items-center justify-between px-6 shrink-0"
      style={{
        background: "#161b22",
        borderBottom: "1px solid #21262d",
      }}
    >
      <div />
      <div className="flex items-center gap-4">
        <span style={{ color: "#8b949e", fontSize: 11, fontFamily: "'Courier New', monospace" }}>
          <span style={{ color: "#58a6ff" }}>$</span> {email}
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
