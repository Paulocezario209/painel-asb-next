// app/marketing/_components/marketing-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, Radar, Megaphone, DollarSign, Wallet, Crosshair } from "lucide-react";

const SANS = "var(--font-geist-sans), system-ui, sans-serif";
const RED = "#FF3B57";

const navItems = [
  { href: "/marketing/overview",   label: "Visão Geral",      icon: LayoutDashboard },
  { href: "/marketing/calendario", label: "Calendário",       icon: CalendarDays },
  { href: "/marketing/origem",     label: "Origem dos Leads", icon: Radar },
  { href: "/marketing/anuncios",   label: "Anúncios",         icon: Megaphone },
  { href: "/marketing/atribuicao", label: "Atribuição",       icon: Crosshair },
  { href: "/marketing/funil-cac",  label: "Funil CAC",        icon: DollarSign },
  { href: "/marketing/verba",      label: "Verba & Gasto",    icon: Wallet },
];

const SB = { bg: "#15161c", border: "rgba(255,255,255,.07)", itemIdle: "#9aa3ba", itemHover: "#23242c", itemActive: "#23242c" };

export function MarketingSidebar({ isOpen = false, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  return (
    <aside
      className={`w-52 flex flex-col shrink-0 asb-sidebar-drawer ${isOpen ? "open" : ""}`}
      style={{ background: SB.bg, borderRight: `1px solid ${SB.border}`, overflowY: "auto" }}
    >
      <Link href="/inicio" title="Voltar à frente institucional" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", padding: "18px 14px 16px", borderBottom: `1px solid ${SB.border}` }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: "linear-gradient(140deg, #E01235 0%, #C8102E 45%, #1B2A6B 100%)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 850, fontSize: 15, letterSpacing: ".5px", boxShadow: "0 8px 18px -8px rgba(200,16,46,.55)" }}>ASB</div>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 750, fontSize: 15, color: "#fff", fontFamily: SANS, letterSpacing: "-.01em" }}>American Steak</div>
          <div style={{ fontSize: 10.5, color: "#8b93a7", fontWeight: 600, fontFamily: SANS, marginTop: 1 }}>Marketing</div>
        </div>
      </Link>

      <nav className="flex-1 px-2 py-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", gap: 11,
                padding: "8px 11px", borderRadius: 9, marginBottom: 2,
                borderLeft: isActive ? `3px solid ${RED}` : "3px solid transparent",
                background: isActive ? SB.itemActive : "transparent",
                color: isActive ? "#fff" : SB.itemIdle,
                fontSize: 13, fontWeight: isActive ? 650 : 550, fontFamily: SANS,
                boxShadow: isActive ? "0 6px 16px -10px rgba(0,0,0,.6)" : "none",
                transition: "all .15s", textDecoration: "none",
              }}
              onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.background = SB.itemHover; (e.currentTarget as HTMLAnchorElement).style.color = "#fff"; } }}
              onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = SB.itemIdle; } }}
            >
              <Icon style={{ width: 17, height: 17, flexShrink: 0, color: isActive ? RED : undefined }} />
              <span translate="no">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3" style={{ borderTop: `1px solid ${SB.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: RED, boxShadow: `0 0 0 3px rgba(255,59,87,.2)` }} />
          <p style={{ color: "#8b93a7", fontSize: 10, letterSpacing: ".06em", fontWeight: 600, fontFamily: SANS }}>Marketing · F1·F2·F3</p>
        </div>
      </div>
    </aside>
  );
}
