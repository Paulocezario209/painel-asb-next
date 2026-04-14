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
        background: "#0a0a0a",
        borderRight: "1px solid #2a2a2a",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderBottom: "1px solid #2a2a2a" }}
      >
        {/* Brand mark — red square with A */}
        <div
          style={{
            width: 30,
            height: 30,
            background: "#C8102E",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "'Inter', sans-serif", letterSpacing: "-0.02em" }} translate="no">A</span>
        </div>
        <div>
          <p style={{ color: "#F5F5F5", fontSize: 13, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", fontFamily: "'Courier New', monospace", lineHeight: 1.1 }} translate="no">
            ASB
          </p>
          <p style={{ color: "#666666", fontSize: 8, letterSpacing: ".15em", textTransform: "uppercase", fontFamily: "'Courier New', monospace", marginTop: 2 }}>
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
                borderRadius: 3,
                borderLeft: isActive ? "2px solid #C8102E" : "2px solid transparent",
                background: isActive ? "rgba(200,16,46,.1)" : "transparent",
                color: isActive ? "#E8192E" : "#666666",
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
                  (e.currentTarget as HTMLAnchorElement).style.background = "#1a1a1a";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#F5F5F5";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#666666";
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
      <div className="px-4 py-3" style={{ borderTop: "1px solid #2a2a2a" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#C8102E" }} />
          <p style={{ color: "#444444", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>
            v1.0 · SDR System
          </p>
        </div>
      </div>
    </aside>
  );
}
