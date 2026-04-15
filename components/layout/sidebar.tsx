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
      style={{ background: "#080b14", borderRight: "1px solid #1B2A6B" }}
    >
      {/* Logo */}
      <div
        className="flex items-center justify-center px-4 py-3"
        style={{ borderBottom: "1px solid #1B2A6B" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/asb_logo.png" alt="American Steak Brasil" style={{ width: 130, height: "auto" }} />
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
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 10px", borderRadius: 3,
                borderLeft: isActive ? "3px solid #C8102E" : "3px solid transparent",
                background: isActive ? "#1B2A6B" : "transparent",
                color: isActive ? "#FFFFFF" : "#8899aa",
                fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
                fontFamily: "'Courier New', monospace", fontWeight: 600,
                transition: "all .15s", textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(27,42,107,.22)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#c0c8d8";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#8899aa";
                }
              }}
            >
              <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
              <span translate="no">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid #1B2A6B" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
          <p style={{ color: "#556677", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>
            v1.0 · SDR System
          </p>
        </div>
      </div>
    </aside>
  );
}
