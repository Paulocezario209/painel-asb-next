// app/marketing/_components/marketing-shell.tsx
"use client";

import { useState } from "react";
import { MarketingSidebar } from "./marketing-sidebar";
import { Header } from "@/components/layout/header";

export function MarketingShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen" style={{ background: "#0d1117" }}>
      {/* Mobile overlay */}
      <div
        className={`asb-overlay ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <MarketingSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header email={email} onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main
          className="flex-1 overflow-auto asb-main-pad"
          style={{ background: "#0d1117" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
