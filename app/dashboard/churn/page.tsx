import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { CUSTOMER_STATUS, CHURN_STATES } from "@/lib/customer-status";

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Churn — Carteira de Clientes</h1>
        <p className="text-sm text-slate-200 mt-1">
          {total} clientes em risco/pré-churn/churn/inativo · carteira real ARES (v_carteira_360) · maiores no topo
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {STATUS_COLS.map((col) => {
          const count = byStatus[col.key].length;
          const receita = byStatus[col.key].reduce((s, c) => s + (Number(c.total_revenue_brl) || 0), 0);
          const pctRec = totRec ? (receita / totRec) * 100 : 0;
          const pctCli = totCli ? (count / totCli) * 100 : 0;
          const verbo = col.key === "inativo_definitivo" ? "perdido" : "em risco";
          return (
            <div
              key={col.key}
              className="bg-[#16161c] border border-[#2a2a35] rounded-lg p-4 shadow-[0_0_24px_-8px_rgba(79,125,240,0.45)]"
              style={{ borderTop: `3px solid ${col.color}` }}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: col.color }}>
                {col.label}
              </div>
              <div className="text-4xl font-bold text-white mt-2">{count}</div>
              <div className="text-sm font-bold text-white mt-1">{brl(receita)} {verbo}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{pct(pctRec)}% da receita · {pct(pctCli)}% da carteira</div>
              <div className="text-[10px] text-slate-200 mt-2 leading-tight">{col.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Listas por status */}
      <div className="space-y-4">
        {STATUS_COLS.map((col) => (
          <div key={col.key} className="bg-[#16161c] border border-[#2a2a35] rounded-lg p-4 shadow-[0_0_24px_-8px_rgba(79,125,240,0.45)]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2a2a2a]">
              <div className="w-3 h-3 rounded-full" style={{ background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">{col.label}</h2>
              <span className="text-xs text-slate-200 ml-auto">{byStatus[col.key].length} clientes</span>
            </div>

            {byStatus[col.key].length === 0 ? (
              <div className="text-xs text-gray-600 italic py-4 text-center">
                Nenhum cliente neste estado.
              </div>
            ) : (
              <div className="space-y-1.5">
                {byStatus[col.key].map((c) => {
                  const row = (
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] gap-2 items-center bg-[#0f0f0f] hover:bg-[#181818] border border-[#2a2a35] hover:border-[#185FA5] rounded p-3 text-xs transition-all shadow-[0_0_12px_-9px_rgba(79,125,240,0.6)]">
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

      <div className="text-[10px] text-gray-600 text-center mt-4">
        Régua absoluta (dias sem comprar): risco 15–21 · pré-churn 22–30 · churn comercial 31–59 · inativo ≥60.
        Carteira real ARES (faturados); "recuperado" volta na Fase A.2.
      </div>
    </div>
  );
}
