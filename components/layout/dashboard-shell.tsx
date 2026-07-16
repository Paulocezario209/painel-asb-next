"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function DashboardShell({
  email,
  role = "vendedor",
  children,
}: {
  email: string;
  role?: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen" style={{ background: "var(--asb-page-2)" }}>
      {/* Mobile overlay */}
      <div
        className={`asb-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={role} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header email={email} onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main
          className="flex-1 overflow-auto asb-main-pad"
          style={{
            background:
              "radial-gradient(760px 460px at 88% -6%, rgba(200,16,46,.05), transparent 62%)," +
              "radial-gradient(720px 500px at 4% 2%, rgba(27,42,107,.06), transparent 60%)," +
              "linear-gradient(160deg, var(--asb-page-1), var(--asb-page-2))",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
