"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Bell } from "lucide-react";

const navItems = [
  { href: "/dashboard",           label: "Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/leads",     label: "Leads",      icon: Users },
  { href: "/dashboard/followups", label: "Follow-ups", icon: Bell },
];

export function Sidebar({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`w-52 flex flex-col shrink-0 asb-sidebar-drawer ${isOpen ? "open" : ""}`}
      style={{
        background: "#0d1117",
        borderRight: "1px solid #21262d",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4 py-4"
        style={{ borderBottom: "1px solid #21262d" }}
      >
        <div
          className="w-7 h-7 flex items-center justify-center rounded"
          style={{ background: "#C8102E" }}
        >
          <span className="text-white font-bold text-xs" translate="no">A</span>
        </div>
        <div>
          <p className="font-bold leading-tight" style={{ color: "#e6edf3", fontSize: 13 }} translate="no">
            ASB
          </p>
          <p style={{ color: "#8b949e", fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase" }}>
            Painel SDR
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "7px 10px",
                borderRadius: 4,
                borderLeft: isActive ? "2px solid #58a6ff" : "2px solid transparent",
                background: isActive ? "rgba(88,166,255,.08)" : "transparent",
                color: isActive ? "#58a6ff" : "#8b949e",
                fontSize: 10,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                fontFamily: "'Courier New', monospace",
                fontWeight: 600,
                transition: "all .15s",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "#21262d";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#c9d1d9";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#8b949e";
                }
              }}
            >
              <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
              <span translate="no">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid #21262d" }}>
        <p style={{ color: "#8b949e", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase" }}>
          v1.0 · SDR System
        </p>
      </div>
    </aside>
  );
}
