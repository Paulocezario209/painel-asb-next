// app/marketing/_components/marketing-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Radar, Megaphone, DollarSign } from "lucide-react";

const navItems = [
  { href: "/marketing/overview",   label: "Overview",         icon: LayoutDashboard },
  { href: "/marketing/calendario", label: "Calendário",       icon: CalendarDays },
  { href: "/marketing/origem",     label: "Origem dos Leads", icon: Radar },
  { href: "/marketing/anuncios",   label: "Anúncios",         icon: Megaphone },
  { href: "/marketing/funil-cac",  label: "Funil CAC",        icon: DollarSign },
];

const RED = "#C8102E";
import { theme } from "@/lib/theme";

export function MarketingSidebar({
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
      style={{ background: "#080b14", borderRight: `1px solid ${RED}` }}
    >
      {/* Logo — vermelho para leitura instantânea de contexto */}
      <div style={{ textAlign: "center", padding: "20px 12px 16px", borderBottom: `1px solid ${RED}` }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 900, color: "#1B2A6B", lineHeight: 1 }}>A</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 900, color: RED, lineHeight: 1 }}>S</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 900, color: "#FFFFFF", lineHeight: 1 }}>B</span>
        </div>
        <div style={{ color: RED, fontSize: 9, letterSpacing: "3px", marginTop: 6, fontFamily: theme.font.label, textTransform: "uppercase" }}>
          Marketing
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "7px 10px", borderRadius: 3,
                borderLeft: isActive ? `3px solid ${RED}` : "3px solid transparent",
                background: isActive ? "rgba(200,16,46,.14)" : "transparent",
                color: isActive ? "#FFFFFF" : "#c0d0e0",
                fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
                fontFamily: theme.font.label, fontWeight: 600,
                transition: "all .15s", textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(200,16,46,.10)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#c0c8d8";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#c0d0e0";
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
      <div className="px-4 py-3" style={{ borderTop: `1px solid ${RED}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: RED, boxShadow: `0 0 6px ${RED}` }} />
          <p style={{ color: "#e4e9f0", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: theme.font.label }}>
            Marketing · F1·F2·F3
          </p>
        </div>
      </div>
    </aside>
  );
}
