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
  fase_teste: string | null;   // pos_teste | pre_teste
};

// Fase do encosto — o PROCESSO comercial certo, por ter provado ou não (§11).
function faseInfo(fase: string | null): { badge: string; color: string; processo: string } {
  return fase === "pos_teste"
    ? { badge: "🧪 pós-teste", color: "#5eb3e6", processo: "Retorno de experiência" }
    : { badge: "🍽️ pré-teste", color: "#c99a3c", processo: "Convite ao teste" };
}

// Ângulo de reconquista = fase (provou/não provou) + motivo.
function anguloEncosto(motivo: string | null, fase: string | null): string {
  const m = (motivo ?? "").toLowerCase();
  if (fase !== "pos_teste") {
    return "Ele ainda NÃO provou — mandar amostra sob medida e transformar o 'não' num teste";
  }
  // pós-teste: já provou → ajustar o que travou na experiência real
  if (/sabor|produto/.test(m)) return "Já provou — blend sob medida no ponto do paladar dele (a amostra foi padrão)";
  if (/lealdade|incumbente|concorrente/.test(m)) return "Já provou — encosto sem exclusividade: no dia que o atual falhar, é você";
  if (/pagamento|prazo/.test(m)) return "Já provou — prazo estruturado com contrapartida (recorrência/volume)";
  if (/pre[çc]o/.test(m)) return "Já provou — custo oculto da inconsistência (não defender preço seco)";
  if (/log[íi]stica/.test(m)) return "Já provou — rota fixa + acesso pré-organizado do nosso lado";
  return "Já provou — retorno sobre a experiência: o que faltou pra avançar?";
}

const EMBER = "#FF7A45";

const SEG_LABELS: Record<string, string> = {
  hamburgueria: "Hamburgueria", restaurante: "Restaurante", bar: "Bar",
  distribuidora: "Distribuidora", rede: "Rede/Franquia", churrascaria: "Churrascaria",
  food_truck: "Food Truck", dark_kitchen: "Dark Kitchen", acougue: "Açougue",
};


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
              const fase = faseInfo(c.fase_teste);
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
                      <Pill label={fase.badge} color={fase.color} />
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

                  <p style={{ fontSize: 12, color: EMBER, fontFamily: theme.font.label, lineHeight: 1.4 }}>
                    ↳ <strong style={{ color: fase.color }}>{fase.processo}:</strong> {anguloEncosto(c.motivo_categoria, c.fase_teste)}
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
