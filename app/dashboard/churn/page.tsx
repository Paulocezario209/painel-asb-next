import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CUSTOMER_STATUS, CHURN_STATES } from "@/lib/customer-status";
import { theme } from "@/lib/theme";
import { S } from "@/app/dashboard/lib/dashboard-tokens";

export const dynamic = "force-dynamic";

const STATUS_COLS = CHURN_STATES.map((k) => ({ key: k, ...CUSTOMER_STATUS[k] }));

const brl = (n: number | null) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// % pt-BR, 1 decimal, virgula (ex: 14,6)
const pct = (n: number) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

type Customer = {
  ares_pessoa_id: number;
  lead_id: string | null;
  name: string | null;
  city: string | null;
  customer_status: string;
  customer_tier: string | null;
  total_orders: number | null;
  dias_sem_compra: number | null;
  total_revenue_brl: number | null;
  vendedor_nome: string | null;
};

export default async function ChurnPage() {
  const supabase = await createClient();

  // Fonte: v_carteira_360 — carteira REAL ARES (clientes faturados), não só os leads SDR.
  // RBAC: a tela hoje não escopa por vendedor logado (mostra a carteira inteira); owner_seller_id/
  // vendedor_nome vêm da view se vier a escopar.
  const { data: customers } = await supabase
    .from("v_carteira_360")
    .select("ares_pessoa_id, lead_id, name, city, customer_status, customer_tier, total_orders, dias_sem_compra, total_revenue_brl, vendedor_nome")
    .in("customer_status", ["risco", "pre_churn", "churn_comercial", "inativo_definitivo"])
    .order("total_revenue_brl", { ascending: false, nullsFirst: false });

  // Denominador do % = carteira TOTAL (v_carteira_360, todos os status), nao so os 4 churn.
  // Query escopada (id/status/receita) — NAO contamina `customers` (consumido por byStatus + total).
  // Bounded (~327 < 1000), entao soma client-side e segura (sem o truncamento do DEBT-P2).
  const { data: carteiraTotal } = await supabase
    .from("v_carteira_360")
    .select("ares_pessoa_id, customer_status, total_revenue_brl");
  const totCli = (carteiraTotal ?? []).length;
  const totRec = (carteiraTotal ?? []).reduce(
    (s: number, c: { total_revenue_brl: number | null }) => s + (Number(c.total_revenue_brl) || 0),
    0,
  );

  const byStatus: Record<string, Customer[]> = { risco: [], pre_churn: [], churn_comercial: [], inativo_definitivo: [] };
  for (const c of (customers ?? []) as Customer[]) {
    if (byStatus[c.customer_status]) byStatus[c.customer_status].push(c);
  }

  const total = (customers ?? []).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Churn — Carteira de Clientes
        </h1>
        <p style={S.muted}>
          {total} clientes em risco/pré-churn/churn/inativo · carteira real ARES (v_carteira_360) · maiores no topo
        </p>
      </div>

      {/* KPIs */}
      <div className="asb-grid-kpi">
        {STATUS_COLS.map((col) => {
          const count = byStatus[col.key].length;
          const receita = byStatus[col.key].reduce((s, c) => s + (Number(c.total_revenue_brl) || 0), 0);
          const pctRec = totRec ? (receita / totRec) * 100 : 0;
          const pctCli = totCli ? (count / totCli) * 100 : 0;
          const verbo = col.key === "inativo_definitivo" ? "perdido" : "em risco";
          return (
            <div
              key={col.key}
              className="asb-card"
              style={{ padding: "20px 20px", borderTop: `2px solid ${col.color}` }}
            >
              <p style={{ ...S.label, color: col.color }}>{col.label}</p>
              <p style={{ ...S.value, marginTop: 12 }}>{count}</p>
              <p style={{ color: "#FFFFFF", fontSize: 12, fontWeight: 700, fontFamily: theme.font.label, marginTop: 4 }}>
                {brl(receita)} {verbo}
              </p>
              <p style={{ color: "#8b949e", fontSize: 10, fontFamily: theme.font.label, marginTop: 2 }}>
                {pct(pctRec)}% da receita · {pct(pctCli)}% da carteira
              </p>
              <p style={{ ...S.muted, fontSize: 10, marginTop: 8, lineHeight: 1.3 }}>{col.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Listas por status */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {STATUS_COLS.map((col) => (
          <div key={col.key} className="asb-card" style={{ padding: "20px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid var(--asb-border)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
              <span style={{ ...S.section, marginBottom: 0 }}>{col.label}</span>
              <span style={{ ...S.muted, marginLeft: "auto" }}>{byStatus[col.key].length} clientes</span>
            </div>

            {byStatus[col.key].length === 0 ? (
              <p style={{ ...S.muted, fontStyle: "italic", textAlign: "center", padding: "16px 0" }}>
                Nenhum cliente neste estado.
              </p>
            ) : (
              <div className="space-y-1.5">
                {byStatus[col.key].map((c) => {
                  const row = (
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-[var(--asb-card-hi)] hover:bg-[var(--asb-card-hi)] border border-[var(--asb-border)] hover:border-[var(--asb-border2)] rounded p-3 text-xs transition-colors">
                      <div className="text-white font-semibold truncate">
                        {c.name || `cliente ${c.ares_pessoa_id}`}
                        <span className="text-slate-200 text-[10px] font-normal ml-2">{c.city ?? "—"}</span>
                      </div>
                      <div className="text-slate-200">
                        <span className="text-slate-200 text-[10px]">Receita:</span>{" "}
                        <span className="text-white">{brl(c.total_revenue_brl)}</span>
                      </div>
                      <div className="text-slate-200">
                        <span className="text-slate-200 text-[10px]">Pedidos:</span>{" "}
                        <span className="text-white">{c.total_orders ?? "—"}</span>
                      </div>
                      <div className="text-slate-200">
                        <span className="text-slate-200 text-[10px]">Sem comprar:</span>{" "}
                        <span className="text-white">{c.dias_sem_compra ?? "—"}d</span>
                      </div>
                      <div className="text-slate-200">
                        <span className="text-slate-200 text-[10px]">Tier:</span>{" "}
                        <span className="text-white font-bold">{c.customer_tier ?? "—"}</span>
                      </div>
                      <div className="text-slate-200">{c.vendedor_nome?.split(" ")[0] ?? "—"}</div>
                    </div>
                  );
                  return c.lead_id ? (
                    <Link key={c.ares_pessoa_id} href={`/dashboard/cliente/${c.lead_id}`} className="block">
                      {row}
                    </Link>
                  ) : (
                    <div key={c.ares_pessoa_id}>{row}</div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={{ ...S.muted, fontSize: 10, textAlign: "center", marginTop: 4 }}>
        Régua absoluta (dias sem comprar): risco 15–21 · pré-churn 22–30 · churn comercial 31–59 · inativo ≥60.
        Carteira real ARES (faturados); "recuperado" volta na Fase A.2.
      </p>
    </div>
  );
}
