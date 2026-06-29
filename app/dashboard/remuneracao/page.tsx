import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";
import { theme } from "@/lib/theme";
import { getUserContext } from "@/lib/auth/get-user-role";

export const dynamic = "force-dynamic";

// ── Design tokens (padrao /dashboard/gerente) ───────────────────────────────
const S = {
  card:    { background: "#1a1a1a", border: `1px solid ${theme.colors.borderDefault}`, borderRadius: 8 } as React.CSSProperties,
  label:   { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: theme.colors.neutral, fontFamily: theme.font.label },
  value:   { fontSize: 28, fontWeight: 700, color: "#FFFFFF", fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const, lineHeight: 1 },
  section: { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase" as const, color: theme.colors.textPrimary, fontFamily: theme.font.label, marginBottom: 12 } as React.CSSProperties,
  muted:   { color: "#c0d0e0", fontSize: 11, fontFamily: theme.font.label } as React.CSSProperties,
  num:     { fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums" as const, color: "#FFFFFF" } as React.CSSProperties,
};

const VENDOR_LABELS: Record<string, { name: string; region: string }> = {
  SETOR_CUIT:               { name: "Fernando Carvalho", region: "Gerente Comercial - meta total do time" },
  SETOR_SOROCABA_SAO_PAULO: { name: "Ana Paula",         region: "Sorocaba / Grande SP" },
  SETOR_CAMPINAS_JUNDIAI:   { name: "Alan",              region: "Campinas / Jundiai" },
};

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

// Modelo unificado de card (gerente + vendedor normalizados)
interface CardModel {
  rt: string; nome: string; region: string; papel: "Gerente" | "Vendedor";
  fixo: number; faturado: number; meta: number; atingimento: number | null;
  comissaoLabel: string; comissao: number;
  comissaoBaldes?: { label: string; comissao: number }[];   // so o gerente (3 baldes)
  bonusBreak: { label: string; val: number }[]; bonus: number;
  total: number; custoPct: number | null; extra: string | null;
}

export default async function RemuneracaoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  // ── GATE SERVER-SIDE: tela do TIME = exclusiva do DIRETOR (Paulo). Fernando (gestor+gerente) barrado ──
  const supabase = await createClient();
  await supabase.auth.getUser();
  const ctx = await getUserContext();
  if (!ctx || !ctx.isGestor || ctx.comissaoPerfil !== "diretor") redirect("/dashboard");

  // ── Mes selecionavel (default = mes corrente) ──────────────────────────────
  const sp = await searchParams;
  const now = new Date();
  const mesAtualYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mesYM = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? (sp.mes as string) : mesAtualYM;
  const primeiroDiaMes = `${mesYM}-01`;
  const [ano, mesNum] = mesYM.split("-").map(Number);

  // ── Reads via SERVICE ROLE (server-side; views GRANT authenticated/service_role) ──
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const svc = srk
    ? createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srk, { auth: { persistSession: false } })
    : supabase;

  const [{ data: rawGer }, { data: rawGerBaldes }, { data: rawVend }] = await Promise.all([
    svc.from("v_comissao_gerente_resumo")
      .select("mes, faturado_brl, meta_brl, atingimento_pct, fixo_brl, comissao_brl, bonus_brl, total_ganho_brl, custo_comercial_pct")
      .eq("mes", primeiroDiaMes),
    svc.from("v_comissao_gerente_mensal")
      .select("balde, clientes, faturado_brl, comissao_brl")
      .eq("mes", primeiroDiaMes),
    svc.from("v_comissao_vendedor_resumo")
      .select("vendedor_routing_team, mes, fixo_brl, faturado_mes, meta_mes, atingimento_pct, comissao_02pct, dias_batidos, bonus_diario_brl, bonus_semanal_brl, crescimento_pct, bonus_crescimento_brl, bonus_total_brl, total_ganho_brl, custo_comercial_pct")
      .eq("mes", primeiroDiaMes),
  ]);

  const g = (rawGer ?? [])[0] as undefined | {
    faturado_brl: number; meta_brl: number; atingimento_pct: number | null; fixo_brl: number;
    comissao_brl: number; bonus_brl: number; total_ganho_brl: number; custo_comercial_pct: number | null;
  };
  const vend = (rawVend ?? []) as unknown as {
    vendedor_routing_team: string; fixo_brl: number; faturado_mes: number; meta_mes: number;
    atingimento_pct: number | null; comissao_02pct: number; dias_batidos: number;
    bonus_diario_brl: number; bonus_semanal_brl: number; crescimento_pct: number | null;
    bonus_crescimento_brl: number; bonus_total_brl: number; total_ganho_brl: number; custo_comercial_pct: number | null;
  }[];

  // ── Baldes do gerente (v_comissao_gerente_mensal) — ordem fixa + label/cli/faturado ──
  type BaldeRow = { balde: string; clientes: number; faturado_brl: number; comissao_brl: number };
  const baldesRaw = (rawGerBaldes ?? []) as unknown as BaldeRow[];
  const fmtBRL0 = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const BALDE_LABEL: Record<string, string> = { NOVO: "Novos", RESGATE: "Resgate", CRESCIMENTO: "Crescimento", CARTEIRA: "Carteira (piso)" };
  const comissaoBaldes = ["NOVO", "RESGATE", "CRESCIMENTO", "CARTEIRA"].map((b) => {
    const r = baldesRaw.find(x => x.balde === b);
    const cli = Number(r?.clientes ?? 0);
    const fat = Number(r?.faturado_brl ?? 0);
    return { label: `${BALDE_LABEL[b]} (${cli} cli - fat ${fmtBRL0(fat)})`, comissao: Number(r?.comissao_brl ?? 0) };
  });

  // ── Monta os 3 cards (Fernando gerente + Ana/Alan vendedores) ──────────────
  const cards: CardModel[] = [];

  if (g) {
    cards.push({
      rt: "SETOR_CUIT", nome: VENDOR_LABELS.SETOR_CUIT.name, region: VENDOR_LABELS.SETOR_CUIT.region, papel: "Gerente",
      fixo: Number(g.fixo_brl), faturado: Number(g.faturado_brl), meta: Number(g.meta_brl), atingimento: g.atingimento_pct,
      comissaoLabel: "Comissao (3 baldes)", comissao: Number(g.comissao_brl),
      comissaoBaldes,
      bonusBreak: [{ label: "Bonus por faixa de atingimento", val: Number(g.bonus_brl) }], bonus: Number(g.bonus_brl),
      total: Number(g.total_ganho_brl), custoPct: g.custo_comercial_pct, extra: null,
    });
  }
  for (const rt of ["SETOR_SOROCABA_SAO_PAULO", "SETOR_CAMPINAS_JUNDIAI"]) {
    const v = vend.find(x => x.vendedor_routing_team === rt);
    const lbl = VENDOR_LABELS[rt];
    if (!v) {
      cards.push({ rt, nome: lbl.name, region: lbl.region, papel: "Vendedor", fixo: 0, faturado: 0, meta: 0, atingimento: null,
        comissaoLabel: "Comissao 0,2%", comissao: 0, bonusBreak: [], bonus: 0, total: 0, custoPct: null, extra: "sem dados no mes" });
      continue;
    }
    cards.push({
      rt, nome: lbl.name, region: lbl.region, papel: "Vendedor",
      fixo: Number(v.fixo_brl), faturado: Number(v.faturado_mes), meta: Number(v.meta_mes), atingimento: v.atingimento_pct,
      comissaoLabel: "Comissao 0,2%", comissao: Number(v.comissao_02pct),
      bonusBreak: [
        { label: "Bonus diario", val: Number(v.bonus_diario_brl) },
        { label: "Bonus semanal", val: Number(v.bonus_semanal_brl) },
        { label: `Bonus crescimento${v.crescimento_pct != null ? ` (${Number(v.crescimento_pct).toFixed(1)}% vs meta)` : ""}`, val: Number(v.bonus_crescimento_brl) },
      ],
      bonus: Number(v.bonus_total_brl),
      total: Number(v.total_ganho_brl), custoPct: v.custo_comercial_pct,
      extra: `${Number(v.dias_batidos)} dias de meta batidos`,
    });
  }

  // ── KPIs de rodape ─────────────────────────────────────────────────────────
  const custoTotal = cards.reduce((s, c) => s + c.total, 0);
  const faturadoTime = Number(g?.faturado_brl ?? 0);   // total da empresa (gerente = company-wide)
  const pctSobreFaturado = faturadoTime > 0 ? (custoTotal / faturadoTime) * 100 : null;

  const semDados = !g && vend.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header + seletor de mes */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: theme.font.label, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
            Remuneracao do Time
          </h1>
          <p style={S.muted}>Comissao do time comercial &middot; base FATURADO &middot; privada (gestor)</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={`/dashboard/remuneracao?mes=${shiftMonth(mesYM, -1)}`} style={{ ...S.muted, textDecoration: "none", padding: "4px 10px", border: `1px solid ${theme.colors.borderDefault}`, borderRadius: 6 }}>{"<"}</Link>
          <span style={{ ...S.label, color: "#FFFFFF", fontSize: 12 }}>{MESES[mesNum]} {ano}</span>
          <Link href={`/dashboard/remuneracao?mes=${shiftMonth(mesYM, 1)}`} style={{ ...S.muted, textDecoration: "none", padding: "4px 10px", border: `1px solid ${theme.colors.borderDefault}`, borderRadius: 6 }}>{">"}</Link>
        </div>
      </div>

      {semDados ? (
        <div style={{ ...S.card, padding: "24px" }}>
          <p style={S.muted}>Sem dados de comissao para {MESES[mesNum]} {ano}. (As views apuram a partir do faturamento sincronizado do mes.)</p>
        </div>
      ) : (
        <>
          {/* 3 cards comparaveis */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {cards.map((c) => {
              const accent = c.papel === "Gerente" ? theme.colors.accent : theme.colors.success;
              return (
                <div key={c.rt} className="asb-card" style={{ padding: "20px 22px", borderTop: `2px solid ${accent}`, display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* header do card */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 700, fontFamily: theme.font.label }}>{c.nome}</span>
                      <span style={{ fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", fontFamily: theme.font.label, color: accent, border: `1px solid ${accent}`, borderRadius: 4, padding: "2px 6px" }}>{c.papel}</span>
                    </div>
                    <p style={{ ...S.muted, fontSize: 9, marginTop: 4 }}>{c.region}</p>
                  </div>

                  {/* total ganho */}
                  <div>
                    <p style={S.label}>Total a receber</p>
                    <p style={{ ...S.value, marginTop: 8 }}>{fmtBRL(c.total)}</p>
                  </div>

                  {/* faturado / meta / atingimento */}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ ...S.label, fontSize: 8 }}>Faturado</p>
                      <p style={{ ...S.num, fontSize: 13 }}>{fmtBRL(c.faturado)}</p>
                    </div>
                    <div>
                      <p style={{ ...S.label, fontSize: 8 }}>Meta</p>
                      <p style={{ ...S.num, fontSize: 13, color: "#c0d0e0" }}>{fmtBRL(c.meta)}</p>
                    </div>
                    <div>
                      <p style={{ ...S.label, fontSize: 8 }}>Atingimento</p>
                      <p style={{ fontSize: 13, fontFamily: theme.font.num, fontVariantNumeric: "tabular-nums", fontWeight: 700, color: pctColor(c.atingimento) }}>
                        {c.atingimento != null ? `${Number(c.atingimento).toFixed(1)}%` : "-"}
                      </p>
                    </div>
                  </div>

                  {/* breakdown de componentes */}
                  <div style={{ borderTop: `1px solid ${theme.colors.borderDefault}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                    <Row label="Salario fixo" val={c.fixo} />
                    <Row label={c.comissaoLabel} val={c.comissao} />
                    {c.comissaoBaldes?.map((b, i) => (<Row key={`cb${i}`} label={b.label} val={b.comissao} sub />))}
                    {c.bonusBreak.map((b, i) => (<Row key={i} label={b.label} val={b.val} sub />))}
                    <div style={{ borderTop: `1px dashed ${theme.colors.borderDefault}`, marginTop: 4, paddingTop: 6 }}>
                      <Row label="Total" val={c.total} bold />
                    </div>
                  </div>

                  <p style={{ ...S.muted, fontSize: 9 }}>
                    Custo {c.custoPct != null ? `${Number(c.custoPct).toFixed(2)}%` : "-"} s/ faturado{c.extra ? ` · ${c.extra}` : ""}
                  </p>
                </div>
              );
            })}
          </div>

          {/* 3 KPIs de rodape */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div style={{ ...S.card, padding: "18px 22px" }}>
              <p style={S.label}>Custo total do time</p>
              <p style={{ ...S.value, marginTop: 10, fontSize: 22 }}>{fmtBRL(custoTotal)}</p>
              <p style={{ ...S.muted, fontSize: 9, marginTop: 4 }}>fixo + comissao + bonus dos 3</p>
            </div>
            <div style={{ ...S.card, padding: "18px 22px" }}>
              <p style={S.label}>Faturado do time</p>
              <p style={{ ...S.value, marginTop: 10, fontSize: 22 }}>{fmtBRL(faturadoTime)}</p>
              <p style={{ ...S.muted, fontSize: 9, marginTop: 4 }}>total empresa (eixo faturamento)</p>
            </div>
            <div style={{ ...S.card, padding: "18px 22px", borderTop: `2px solid ${pctColor(pctSobreFaturado != null && pctSobreFaturado <= 5 ? 100 : 0)}` }}>
              <p style={S.label}>Custo comercial %</p>
              <p style={{ ...S.value, marginTop: 10, fontSize: 22 }}>{pctSobreFaturado != null ? `${pctSobreFaturado.toFixed(2)}%` : "-"}</p>
              <p style={{ ...S.muted, fontSize: 9, marginTop: 4 }}>custo total / faturado do time</p>
            </div>
          </div>
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
