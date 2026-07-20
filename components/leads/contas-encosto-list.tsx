import { KpiCard, SectionHead } from "@/app/dashboard/lib/ui";
import { S } from "@/app/dashboard/lib/dashboard-tokens";
import { theme } from "@/lib/theme";
import { PRECO_KG } from "@/lib/pricing";
import { Anchor, CalendarClock, Wallet } from "lucide-react";

// DEBT-318 (SDR): Contas de ENCOSTO (perdido-quente / backup ativo).
// Fonte: view v_contas_encosto. Presentacional (server-renderable).
// DESIGN: compõe com o KIT grafite (KpiCard/SectionHead/tokens S) — sem desenho na mão.

export type ContaEncosto = {
  phone: string;
  restaurant_name: string | null;
  city: string | null;
  segment: string | null;
  weekly_volume_kg: number | null;
  motivo_categoria: string | null;
  motivo_detalhe: string | null;
  lost_at: string | null;
  dias_desde_perda: number | null;
  next_followup_at: string | null;
};

const EMBER = "#FF7A45";

const SEG_LABELS: Record<string, string> = {
  hamburgueria: "Hamburgueria", restaurante: "Restaurante", bar: "Bar",
  distribuidora: "Distribuidora", rede: "Rede/Franquia", churrascaria: "Churrascaria",
  food_truck: "Food Truck", dark_kitchen: "Dark Kitchen", acougue: "Açougue",
};

// Ângulo de reconquista por motivo — o "o que dizer quando voltar" (§11 CADENCIA_INTELIGENTE).
function anguloPorMotivo(m: string | null): string {
  const r = (m ?? "").toLowerCase();
  if (/sabor|produto/.test(r)) return "Blend sob medida — a amostra foi padrão, não calibrada ao paladar dele";
  if (/lealdade|incumbente|concorrente/.test(r)) return "Encosto sem exclusividade — no dia que faltar, me chama";
  if (/pagamento|prazo/.test(r)) return "Prazo estruturado com contrapartida (recorrência/volume)";
  if (/pre[çc]o/.test(r)) return "Custo oculto da inconsistência — nunca defender preço seco";
  if (/log[íi]stica/.test(r)) return "Rota fixa + acesso pré-organizado do nosso lado";
  return "Nutrição de disponibilidade mental (LONGA)";
}

function diasAte(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 999,
      fontSize: 10.5, fontWeight: 700, fontFamily: theme.font.label,
      color, background: `${color}1a`, border: `1px solid ${color}55`, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

export function ContasEncostoList({ contas }: { contas: ContaEncosto[] }) {
  const total = contas.length;
  const valorPotencial = contas.reduce((acc, c) => acc + Number(c.weekly_volume_kg ?? 0) * PRECO_KG, 0);
  const reengajaAgora = contas.filter(c => { const d = diasAte(c.next_followup_at); return d !== null && d <= 15; }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs — KIT canônico */}
      <div className="asb-grid-kpi">
        <KpiCard label="Contas de Encosto" value={String(total)} Icon={Anchor} accent={EMBER} num={EMBER}
                 note="backups vivos · não são leads mortos" />
        <KpiCard label="Reengajar em 15 Dias" value={String(reengajaAgora)} Icon={CalendarClock} accent="#22c55e" num="#22c55e"
                 note="data de volta chegando" />
        <KpiCard label="Pipeline em Espera" value={`R$ ${Math.round(valorPotencial).toLocaleString("pt-BR")}`} Icon={Wallet} accent="#185FA5"
                 note={`Σ volume × R$ ${PRECO_KG}/kg`} />
      </div>

      {/* Lista */}
      <div style={{ ...S.card, padding: "18px 20px" }}>
        <SectionHead Icon={Anchor} color={EMBER} title="Backups ativos" desc="Ordenados pela data de reengajamento" />
        {total === 0 ? (
          <p style={{ ...S.muted, textAlign: "center", padding: "24px 0" }}>
            Nenhuma conta de encosto ainda. Ao encerrar um atendimento com amostra aprovada, marque “🔥 Manter como encosto”.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {contas.map((c) => {
              const dAte = diasAte(c.next_followup_at);
              const venceu = dAte !== null && dAte <= 0;
              const proximo = dAte !== null && dAte > 0 && dAte <= 15;
              const reengaja = c.next_followup_at
                ? new Date(c.next_followup_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                : "—";
              const waText = encodeURIComponent("Olá! Aqui é da American Steak 🥩");
              return (
                <div key={c.phone} style={{
                  display: "flex", flexDirection: "column", gap: 6,
                  padding: "12px 14px", borderRadius: 10,
                  background: "var(--asb-card-hi)", border: "1px solid var(--asb-border)",
                  borderLeft: `3px solid ${venceu ? "#22c55e" : EMBER}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", fontFamily: theme.font.label }}>
                        {c.restaurant_name || "—"}
                      </p>
                      <p style={{ ...S.muted, marginTop: 2 }}>
                        {c.city || "—"} · {SEG_LABELS[c.segment ?? ""] || c.segment || "—"} · {c.weekly_volume_kg ? `${c.weekly_volume_kg} kg/sem` : "vol. —"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {c.motivo_categoria && <Pill label={c.motivo_categoria} color={EMBER} />}
                      {venceu
                        ? <Pill label="REENGAJAR AGORA" color="#22c55e" />
                        : proximo
                          ? <Pill label={`EM ${dAte}D`} color="#f59e0b" />
                          : <Pill label={`VOLTA ${reengaja}`} color="#83879a" />}
                    </div>
                  </div>

                  {c.motivo_detalhe && (
                    <p style={{ ...S.text, lineHeight: 1.4 }}>{c.motivo_detalhe}</p>
                  )}

                  <p style={{ fontSize: 12, color: EMBER, fontFamily: theme.font.label }}>
                    ↳ {anguloPorMotivo(c.motivo_categoria)}
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <span style={S.label}>perdido há {c.dias_desde_perda ?? 0}d · reengaja {reengaja}</span>
                    <a
                      href={`https://wa.me/${c.phone}?text=${waText}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        padding: "5px 13px", borderRadius: 999, textDecoration: "none",
                        background: "rgba(34,197,94,.16)", border: "1px solid rgba(34,197,94,.4)",
                        color: "#22c55e", fontSize: 11, fontWeight: 700, fontFamily: theme.font.label,
                      }}
                    >WhatsApp</a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
