"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, BarChart2, PhoneCall, FlaskConical, Upload, Flame, Filter, UserCheck, DollarSign, Target, Briefcase, Columns3, Wallet, Banknote, Coins, LayoutGrid, Network } from "lucide-react";

const navItems = [
  { href: "/dashboard",            label: "Dashboard",   icon: LayoutDashboard },
  { href: "/dashboard/comercial",  label: "Comercial",   icon: LayoutGrid },
  { href: "/dashboard/funil",     label: "Funil",       icon: Filter },
  { href: "/dashboard/pipeline",  label: "Pipeline",    icon: Columns3 },
  { href: "/dashboard/vendedores", label: "Vendedores",  icon: UserCheck },
  { href: "/dashboard/vendas",     label: "Vendas",      icon: DollarSign },
  { href: "/dashboard/minha-comissao", label: "Minha Comissao", icon: Coins },
  { href: "/dashboard/gerente",   label: "Gerente",     icon: Target },
  { href: "/dashboard/remuneracao", label: "Remuneracao", icon: Banknote },
  { href: "/dashboard/leads",      label: "Leads",       icon: Users },
  { href: "/dashboard/clientes",   label: "Clientes",    icon: Briefcase },
  { href: "/dashboard/carteira-ativa", label: "Carteira Ativa", icon: Wallet },
  { href: "/dashboard/handoffs",   label: "Handoffs",    icon: PhoneCall },
  // "Follow-ups" saiu do menu (2026-07-15): a Central de Cadências já é a superfície completa de
  // cadências. A rota /dashboard/followups continua existindo (log de envios), acessível por URL.
  { href: "/dashboard/cadencias",  label: "Cadências",   icon: Network },
  { href: "/dashboard/insights",   label: "Inteligência", icon: BarChart2 },
  { href: "/dashboard/simulator",  label: "Simulador",   icon: FlaskConical },
  { href: "/dashboard/uploads",    label: "Uploads",     icon: Upload },
  { href: "/dashboard/hot-leads",  label: "Leads Quentes", icon: Flame },
];

// /dashboard/funil LIBERADO ao vendedor (Paulo 2026-07-14) — item aparece na sidebar.
// /dashboard/cadencias LIBERADO ao vendedor (2026-07-15) — aparece na sidebar; a página trava o escopo no setor dele.
const VENDOR_BLOCKED = new Set(["/dashboard/vendedores", "/dashboard/gerente", "/dashboard/insights", "/dashboard/simulator", "/dashboard/uploads", "/dashboard/churn", "/dashboard/up-sell", "/dashboard/remuneracao"]);
// manager (Fernando): ganha Remuneracao (tela do time); perde Minha Comissao (redireciona p/ Remuneracao).
const MANAGER_BLOCKED = new Set(["/dashboard/gerente", "/dashboard/simulator", "/dashboard/uploads", "/dashboard/minha-comissao"]);

export function Sidebar({
  isOpen = false,
  onClose,
  role = "vendedor",
}: {
  isOpen?: boolean;
  onClose?: () => void;
  role?: string;
}) {
  const pathname = usePathname();

  const visibleItems = navItems.filter(item => {
    // gestor (Paulo) vê tudo, EXCETO Minha Comissao (usa a tela do time em Remuneracao).
    if (role === "gestor") return item.href !== "/dashboard/minha-comissao";
    if (role === "manager") return !MANAGER_BLOCKED.has(item.href);
    // vendedor: mantém Minha Comissao (visão própria); Remuneracao segue bloqueada (VENDOR_BLOCKED).
    return !VENDOR_BLOCKED.has(item.href);
  });

  return (
    <aside
      className={`w-52 flex flex-col shrink-0 asb-sidebar-drawer ${isOpen ? "open" : ""}`}
      style={{ background: "var(--asb-shell)", borderRight: "1px solid var(--asb-shell-border)" }}
    >
      {/* Logo — clique volta para a frente institucional */}
      <Link href="/inicio" title="Voltar à frente institucional" style={{ display: "block", textDecoration: "none", textAlign: "center", padding: "20px 12px 16px", borderBottom: "1px solid var(--asb-shell-border)" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 900, color: "#1B2A6B", lineHeight: 1 }}>A</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 900, color: "#C8102E", lineHeight: 1 }}>S</span>
          <span style={{ fontFamily: "Georgia, serif", fontSize: 42, fontWeight: 900, color: "#12131A", lineHeight: 1 }}>B</span>
        </div>
        <div style={{ color: "#C8102E", fontSize: 11, letterSpacing: "4px", marginTop: 4 }}>★★★★★</div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {visibleItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 11px", borderRadius: 9,
                borderLeft: isActive ? "3px solid #C8102E" : "3px solid transparent",
                background: isActive ? "var(--asb-card)" : "transparent",
                color: isActive ? "#FFFFFF" : "#565A6B",
                fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase",
                fontFamily: "'Courier New', monospace", fontWeight: 600,
                boxShadow: isActive ? "0 6px 16px -8px rgba(20,22,40,.4)" : "none",
                transition: "all .15s", textDecoration: "none",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--asb-shell-2)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#12131A";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "#565A6B";
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
      <div className="px-4 py-3" style={{ borderTop: "1px solid var(--asb-shell-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
          <p style={{ color: "#8B90A3", fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: "'Courier New', monospace" }}>
            v1.0 · SDR System
          </p>
        </div>
      </div>
    </aside>
  );
}
