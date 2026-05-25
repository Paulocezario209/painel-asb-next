// app/compras/_components/compras-shell.tsx
"use client";

import { useState } from "react";
import { ComprasSidebar } from "./compras-sidebar";
import { Header } from "@/components/layout/header";

export function ComprasShell({
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

      <ComprasSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

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
