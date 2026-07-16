"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, BarChart2, PhoneCall, FlaskConical, Upload, Flame, Filter, UserCheck, DollarSign, Target, Briefcase, Columns3, Wallet, Banknote, Coins, LayoutGrid, Network } from "lucide-react";

const SANS = "var(--font-geist-sans), system-ui, sans-serif";

const NAV_GROUPS = [
  {
    title: "Visão geral",
    items: [
      { href: "/dashboard",           label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/comercial", label: "Comercial", icon: LayoutGrid },
      { href: "/dashboard/funil",     label: "Funil",     icon: Filter },
      { href: "/dashboard/pipeline",  label: "Pipeline",  icon: Columns3 },
    ],
  },
  {
    title: "Time & Metas",
    items: [
      { href: "/dashboard/vendedores",     label: "Vendedores",     icon: UserCheck },
      { href: "/dashboard/vendas",         label: "Vendas",         icon: DollarSign },
      { href: "/dashboard/minha-comissao", label: "Minha Comissão", icon: Coins },
      { href: "/dashboard/gerente",        label: "Gerente",        icon: Target },
      { href: "/dashboard/remuneracao",    label: "Remuneração",    icon: Banknote },
    ],
  },
  {
    title: "Pipeline SDR",
    items: [
      { href: "/dashboard/leads",          label: "Leads",          icon: Users },
      { href: "/dashboard/clientes",       label: "Clientes",       icon: Briefcase },
      { href: "/dashboard/carteira-ativa", label: "Carteira ativa", icon: Wallet },
      { href: "/dashboard/handoffs",       label: "Handoffs",       icon: PhoneCall },
      { href: "/dashboard/cadencias",      label: "Cadências",      icon: Network },
    ],
  },
  {
    title: "Ferramentas",
    items: [
      { href: "/dashboard/insights",  label: "Inteligência",  icon: BarChart2 },
      { href: "/dashboard/simulator", label: "Simulador",     icon: FlaskConical },
      { href: "/dashboard/uploads",   label: "Uploads",       icon: Upload },
      { href: "/dashboard/hot-leads", label: "Leads quentes", icon: Flame },
    ],
  },
];

const VENDOR_BLOCKED = new Set(["/dashboard/vendedores", "/dashboard/gerente", "/dashboard/insights", "/dashboard/simulator", "/dashboard/uploads", "/dashboard/churn", "/dashboard/up-sell", "/dashboard/remuneracao"]);
const MANAGER_BLOCKED = new Set(["/dashboard/gerente", "/dashboard/simulator", "/dashboard/uploads", "/dashboard/minha-comissao"]);

// Paleta grafite (caixa escura, mesmo padrão dos cards do painel)
const SB = {
  bg: "#15161c",
  border: "rgba(255,255,255,.07)",
  itemIdle: "#9aa3ba",
  itemHover: "#23242c",
  itemActive: "#23242c",
  labelMuted: "#6b7488",
};

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

  const canSee = (href: string) => {
    if (role === "gestor") return href !== "/dashboard/minha-comissao";
    if (role === "manager") return !MANAGER_BLOCKED.has(href);
    return !VENDOR_BLOCKED.has(href);
  };

  return (
    <aside
      className={`w-52 flex flex-col shrink-0 asb-sidebar-drawer ${isOpen ? "open" : ""}`}
      style={{ background: SB.bg, borderRight: `1px solid ${SB.border}`, overflowY: "auto" }}
    >
      {/* Logo — tile + wordmark; clique volta à frente institucional */}
      <Link href="/inicio" title="Voltar à frente institucional" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", padding: "18px 14px 16px", borderBottom: `1px solid ${SB.border}` }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: "linear-gradient(140deg, #E01235 0%, #C8102E 45%, #1B2A6B 100%)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 850, fontSize: 15, letterSpacing: ".5px", boxShadow: "0 8px 18px -8px rgba(200,16,46,.55)" }}>
          ASB
        </div>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 750, fontSize: 15, color: "#fff", fontFamily: SANS, letterSpacing: "-.01em" }}>American Steak</div>
          <div style={{ fontSize: 10.5, color: "#8b93a7", fontWeight: 600, fontFamily: SANS, marginTop: 1 }}>SDR · Comercial</div>
        </div>
      </Link>

      {/* Nav agrupada */}
      <nav className="flex-1 px-2 py-2">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => canSee(i.href));
          if (items.length === 0) return null;
          return (
            <div key={group.title}>
              <div style={{ fontSize: 10, fontWeight: 750, letterSpacing: ".1em", textTransform: "uppercase", color: SB.labelMuted, padding: "13px 12px 5px", fontFamily: SANS }}>
                {group.title}
              </div>
              {items.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    style={{
                      display: "flex", alignItems: "center", gap: 11,
                      padding: "8px 11px", borderRadius: 9, marginBottom: 1,
                      borderLeft: isActive ? "3px solid #FF3B57" : "3px solid transparent",
                      background: isActive ? SB.itemActive : "transparent",
                      color: isActive ? "#FFFFFF" : SB.itemIdle,
                      fontSize: 13, fontWeight: isActive ? 650 : 550,
                      fontFamily: SANS,
                      boxShadow: isActive ? "0 6px 16px -10px rgba(0,0,0,.6)" : "none",
                      transition: "all .15s", textDecoration: "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLAnchorElement).style.background = SB.itemHover;
                        (e.currentTarget as HTMLAnchorElement).style.color = "#fff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                        (e.currentTarget as HTMLAnchorElement).style.color = SB.itemIdle;
                      }
                    }}
                  >
                    <Icon style={{ width: 17, height: 17, flexShrink: 0, color: isActive ? "#FF3B57" : undefined }} />
                    <span translate="no">{label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: `1px solid ${SB.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 3px rgba(34,197,94,.18)" }} />
          <p style={{ color: "#8b93a7", fontSize: 10, letterSpacing: ".06em", fontWeight: 600, fontFamily: SANS }}>
            v1.0 · SDR System
          </p>
        </div>
      </div>
    </aside>
  );
}
