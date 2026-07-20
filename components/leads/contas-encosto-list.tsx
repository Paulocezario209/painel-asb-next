"use client";

import { theme } from "@/lib/theme";
import { PRECO_KG } from "@/lib/pricing";

// DEBT-318 (SDR): Contas de ENCOSTO (perdido-quente / backup ativo).
// Fonte: view v_contas_encosto. Presentacional (server-renderable): wa.me é <a>.
// O encosto NÃO é lead morto — é backup que reengaja no gatilho certo (data / concorrente).

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
      display: "inline-block", padding: "2px 7px", borderRadius: 3,
      fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase",
      fontFamily: theme.font.mono, fontWeight: 700,
      color, background: `${color}1a`, border: `1px solid ${color}66`, whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

export function ContasEncostoList({ contas }: { contas: ContaEncosto[] }) {
  const total = contas.length;
  const valorPotencial = contas.reduce((acc, c) => acc + Number(c.weekly_volume_kg ?? 0) * PRECO_KG, 0);
  const reengajaAgora = contas.filter(c => { const d = diasAte(c.next_followup_at); return d !== null && d <= 15; }).length;

  const card: React.CSSProperties = { background: theme.colors.bgCard, border: `1px solid ${theme.colors.borderDefault}`, borderRadius: 8 };
  const label: React.CSSProperties = { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: theme.colors.neutral, fontFamily: theme.font.mono };
  const ember = "#FF7A45";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div className="asb-grid-kpi">
        <div style={{ ...card, padding: 20, borderTop: `2px solid ${ember}` }}>
          <p style={{ ...label, color: ember }}>🔥 Contas de Encosto</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: "#fff", marginTop: 10 }}>{total}</p>
          <p style={{ ...label, marginTop: 6, fontSize: 10 }}>backups vivos · não são leads mortos</p>
        </div>
        <div style={{ ...card, padding: 20, borderTop: `2px solid ${theme.colors.success}` }}>
          <p style={{ ...label, color: theme.colors.success }}>Reengajar ≤ 15 dias</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: "#fff", marginTop: 10 }}>{reengajaAgora}</p>
          <p style={{ ...label, marginTop: 6, fontSize: 10 }}>data de volta chegando</p>
        </div>
        <div style={{ ...card, padding: 20, borderTop: `2px solid ${theme.colors.brandAsb}` }}>
          <p style={{ ...label, color: theme.colors.brandAsb }}>Pipeline em Espera</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 10, fontFamily: theme.font.mono }}>
            R$ {Math.round(valorPotencial).toLocaleString("pt-BR")}
          </p>
          <p style={{ ...label, marginTop: 6, fontSize: 10 }}>Σ volume × R$ {PRECO_KG}/kg</p>
        </div>
      </div>

      {/* Lista */}
      <div style={{ ...card, padding: "16px 20px" }}>
        {total === 0 ? (
          <p style={{ color: theme.colors.neutral, fontSize: 12, fontFamily: theme.font.mono, textAlign: "center", padding: "24px 0" }}>
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
              const waText = encodeURIComponent(`Olá! Aqui é da American Steak 🥩`);
              return (
                <div key={c.phone} style={{
                  display: "flex", flexDirection: "column", gap: 6,
                  padding: "12px 14px", borderRadius: 6,
                  background: "rgba(255,255,255,.015)", border: `1px solid ${theme.colors.borderDefault}`,
                  borderLeft: `3px solid ${venceu ? theme.colors.success : ember}`,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 650, color: "#fff", fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                        {c.restaurant_name || "—"}
                      </p>
                      <p style={{ ...label, marginTop: 2, fontSize: 10, textTransform: "none", letterSpacing: 0 }}>
                        {c.city || "—"} · {SEG_LABELS[c.segment ?? ""] || c.segment || "—"} · {c.weekly_volume_kg ? `${c.weekly_volume_kg} kg/sem` : "vol. —"}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {c.motivo_categoria && <Pill label={c.motivo_categoria} color={ember} />}
                      {venceu
                        ? <Pill label="REENGAJAR AGORA" color={theme.colors.success} />
                        : proximo
                          ? <Pill label={`EM ${dAte}D`} color={theme.colors.warning} />
                          : <Pill label={`VOLTA ${reengaja}`} color={theme.colors.neutral} />}
                    </div>
                  </div>

                  {c.motivo_detalhe && (
                    <p style={{ fontSize: 11, color: "#9aa3ba", fontFamily: "var(--font-geist-sans), system-ui, sans-serif", lineHeight: 1.4 }}>
                      {c.motivo_detalhe}
                    </p>
                  )}

                  <p style={{ fontSize: 10.5, color: ember, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                    ↳ {anguloPorMotivo(c.motivo_categoria)}
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ ...label, fontSize: 9.5 }}>
                      perdido há {c.dias_desde_perda ?? 0}d · reengaja {reengaja}
                    </span>
                    <a
                      href={`https://wa.me/${c.phone}?text=${waText}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        padding: "4px 12px", borderRadius: 4, textDecoration: "none",
                        background: `${theme.colors.success}1a`, border: `1px solid ${theme.colors.success}66`,
                        color: theme.colors.success, fontSize: 10, letterSpacing: ".06em", textTransform: "uppercase",
                        fontFamily: theme.font.mono, fontWeight: 700,
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
