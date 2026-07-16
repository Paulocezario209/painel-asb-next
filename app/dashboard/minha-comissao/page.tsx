import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { getUserContext } from "@/lib/auth/get-user-role";
import { VENDOR_LABELS } from "@/lib/vendor-labels";
import { RegrasComissaoModal } from "../remuneracao/regras-modal";
import { MinhaComissaoSimulador } from "./minha-comissao-sim";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { PageHead } from "@/app/dashboard/lib/ui";

export const dynamic = "force-dynamic";

const MESES = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmtBRL(v: number | null | undefined): string {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function pctColor(pct: number | null): string {
  const p = Number(pct) || 0;
  if (p >= 100) return theme.colors.success;
  if (p >= 50) return "#f59e0b";
  return theme.colors.critical;
}
function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, (m - 1) + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MinhaComissaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // ── Gate: "minha comissao" = a comissao de QUEM esta logado ──
  const supabase = await createClient();
  await supabase.auth.getUser();
  const ctx = await getUserContext();
  if (!ctx) redirect("/login");

  // ── Mes selecionavel (compartilhado) ────────────────────────────────────────
  const sp = await searchParams;
  const now = new Date();
  const mesAtualYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mesYM = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? (sp.mes as string) : mesAtualYM;
  const primeiroDiaMes = `${mesYM}-01`;
  const [ano, mesNum] = mesYM.split("-").map(Number);

  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const svc = srk
    ? createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srk, { auth: { persistSession: false } })
    : supabase;

  // ── GERENTE (Fernando): ve SO a propria comissao de gerente (3 baldes), SEM simulador ──
  if (ctx.comissaoPerfil === "gerente") {
    // Gerente (Fernando) agora usa a tela do time em Remuneracao — visão própria descontinuada.
    redirect("/dashboard/remuneracao");
  }

  // ── VENDEDOR: so o proprio (RLS-by-ctx, server-derived). Diretor/financeiro -> tela do time; demais -> /dashboard ──
  if (!ctx.isVendedor || !ctx.routing_team) {
    redirect(ctx.isDiretor || ctx.isFinanceiro ? "/dashboard/remuneracao" : "/dashboard");
  }
  const team = ctx.routing_team;

  const { data } = await svc
    .from("v_comissao_vendedor_resumo")
    .select("fixo_brl, faturado_mes, meta_mes, atingimento_pct, comissao_02pct, dias_batidos, bonus_diario_brl, bonus_semanal_brl, crescimento_pct, bonus_crescimento_brl, bonus_total_brl, total_ganho_brl, custo_comercial_pct")
    .eq("vendedor_routing_team", team)
    .eq("mes", primeiroDiaMes);

  const r = (data ?? [])[0] as undefined | {
    fixo_brl: number; faturado_mes: number; meta_mes: number; atingimento_pct: number | null;
    comissao_02pct: number; dias_batidos: number; bonus_diario_brl: number; bonus_semanal_brl: number;
    crescimento_pct: number | null; bonus_crescimento_brl: number; bonus_total_brl: number;
    total_ganho_brl: number; custo_comercial_pct: number | null;
  };

  // Quebra ASB|CNB do proprio vendedor (filtrada por team -> isolamento); so display
  const { data: vSplit } = await svc
    .from("v_faturamento_unificado")
    .select("origem, valor")
    .eq("vendedor_routing_team", team)
    .eq("mes", primeiroDiaMes);
  let vAsb = 0, vCnb = 0;
  for (const s of (vSplit ?? []) as unknown as { origem: string; valor: number }[]) {
    const val = Number(s.valor) || 0; if (s.origem === "CNB") vCnb += val; else vAsb += val;
  }

  const nome = VENDOR_LABELS[team] ?? "Vendedor";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 720 }}>
      {/* Header + seletor de mes */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <PageHead title="Minha Comissão" desc={`${nome} · base faturado · só você vê estes números`} />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <RegrasComissaoModal perfil="vendedor" />
          <Link href={`/dashboard/minha-comissao?mes=${shiftMonth(mesYM, -1)}`} style={{ ...S.muted, textDecoration: "none", padding: "4px 10px", border: `1px solid ${theme.colors.borderDefault}`, borderRadius: 6 }}>{"<"}</Link>
          <span style={{ ...S.label, color: "#FFFFFF", fontSize: 12 }}>{MESES[mesNum]} {ano}</span>
          <Link href={`/dashboard/minha-comissao?mes=${shiftMonth(mesYM, 1)}`} style={{ ...S.muted, textDecoration: "none", padding: "4px 10px", border: `1px solid ${theme.colors.borderDefault}`, borderRadius: 6 }}>{">"}</Link>
        </div>
      </div>

      {!r ? (
        <div style={{ ...S.card, padding: 24 }}>
          <p style={S.muted}>Sem comissao apurada para {MESES[mesNum]} {ano}. (Apura a partir do faturamento sincronizado do mes.)</p>
        </div>
      ) : (
        <>
          {/* Card do mes (realizado) */}
          <div className="asb-card" style={{ padding: "20px 22px", borderTop: `2px solid ${theme.colors.success}`, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <p style={S.label}>Total a receber ({MESES[mesNum]})</p>
              <p style={{ ...S.value, marginTop: 8 }}>{fmtBRL(r.total_ganho_brl)}</p>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <div>
                <p style={{ ...S.label, fontSize: 8 }}>Faturado</p>
                <p style={{ fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", color: "#FFFFFF", fontSize: 13 }}>{fmtBRL(r.faturado_mes)}</p>
                <p style={{ fontSize: 10, fontFamily: theme.font.label, color: "#8aa0b8", marginTop: 3 }}>ASB {fmtBRL(vAsb)}{vCnb > 0 ? <> &middot; <span style={{ color: theme.colors.accent, fontWeight: 700 }}>CNB {fmtBRL(vCnb)}</span></> : null}</p>
              </div>
              <div><p style={{ ...S.label, fontSize: 8 }}>Minha meta</p><p style={{ fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", color: "#c0d0e0", fontSize: 13 }}>{fmtBRL(r.meta_mes)}</p></div>
              <div><p style={{ ...S.label, fontSize: 8 }}>Atingimento</p><p style={{ fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 13, color: pctColor(r.atingimento_pct) }}>{r.atingimento_pct != null ? `${Number(r.atingimento_pct).toFixed(1)}%` : "-"}</p></div>
            </div>
            <div style={{ borderTop: `1px solid ${theme.colors.borderDefault}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <Row label="Salario fixo" val={r.fixo_brl} />
              <Row label="Comissao 0,2% sobre faturado" val={r.comissao_02pct} />
              <Row label={`Bonus diario (${Number(r.dias_batidos)} dias batidos)`} val={r.bonus_diario_brl} sub />
              <Row label="Bonus semanal" val={r.bonus_semanal_brl} sub />
              <Row label={`Bonus crescimento${r.crescimento_pct != null ? ` (${Number(r.crescimento_pct).toFixed(1)}% vs meta)` : ""}`} val={r.bonus_crescimento_brl} sub />
              <div style={{ borderTop: `1px dashed ${theme.colors.borderDefault}`, marginTop: 4, paddingTop: 6 }}>
                <Row label="Total" val={r.total_ganho_brl} bold />
              </div>
            </div>
          </div>

          {/* Simulador (client): so faturado projetado */}
          <MinhaComissaoSimulador
            fixo={Number(r.fixo_brl)}
            meta={Number(r.meta_mes)}
            faturadoAtual={Number(r.faturado_mes)}
            bonusDiario={Number(r.bonus_diario_brl)}
            bonusSemanal={Number(r.bonus_semanal_brl)}
          />
        </>
      )}
    </div>
  );
}

function Row({ label, val, bold, sub }: { label: string; val: number; bold?: boolean; sub?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontSize: sub ? 10 : 11, fontFamily: theme.font.label, color: sub ? "#8aa0b8" : (bold ? "#FFFFFF" : "#c0d0e0"), paddingLeft: sub ? 10 : 0 }}>{label}</span>
      <span style={{ fontSize: bold ? 14 : 12, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontWeight: bold ? 700 : 400, color: bold ? "#FFFFFF" : "#e4e9f0" }}>{(Number(val) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  );
}
