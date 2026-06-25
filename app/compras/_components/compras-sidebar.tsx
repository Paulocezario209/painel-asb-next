// app/compras/_components/compras-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, Boxes, LineChart, ClipboardList, Factory, TrendingUp } from "lucide-react";

const navItems = [
  { href: "/compras/resultados", label: "Resultados",  icon: BarChart2 },
  { href: "/compras/estoque",    label: "Estoque",     icon: Boxes },
  { href: "/compras/previsao",   label: "Previsão",    icon: LineChart },
  { href: "/compras/inventario", label: "Inventário",  icon: ClipboardList },
  { href: "/compras/custos",     label: "Custos",      icon: Factory },
  { href: "/compras/mercado",    label: "Mercado",     icon: TrendingUp },
];

const GREEN = "#2ea043";
import { theme } from "@/lib/theme";

export function ComprasSidebar({
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
      style={{ background: "#080b14", borderRight: `1px solid ${GREEN}` }}
    >
      {/* Logo — verde para leitura instantânea de contexto */}
      <div style={{ textAlign: "center", padding: "20px 12px 16px", borderBottom: `1px solid ${GREEN}` }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 900, color: "#1B2A6B", lineHeight: 1 }}>A</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 900, color: GREEN, lineHeight: 1 }}>S</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 900, color: "#FFFFFF", lineHeight: 1 }}>B</span>
        </div>
        <div style={{ color: GREEN, fontSize: 9, letterSpacing: "3px", marginTop: 6, fontFamily: theme.font.label, textTransform: "uppercase" }}>
          Compras & Estoque
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
                borderLeft: isActive ? `3px solid ${GREEN}` : "3px solid transparent",
                background: isActive ? "rgba(46,160,67,.14)" : "transparent",
                color: isActive ? "#FFFFFF" : "#8899aa",
                fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
                fontFamily: theme.font.label, fontWeight: 600,
                transition: "all .15s", textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(46,160,67,.10)";
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
      <div className="px-4 py-3" style={{ borderTop: `1px solid ${GREEN}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
          <p style={{ color: "#556677", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: theme.font.label }}>
            Compras · Fase 0
          </p>
        </div>
      </div>
    </aside>
  );
}
