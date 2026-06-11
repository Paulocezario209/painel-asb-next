import { theme } from "@/lib/theme";

// ETAPA9C — fila de recuperação de leads perdidos (aba PERDIDOS em /leads).
// Presentacional (server-renderable): wa.me é <a>, sem interatividade client.

const PRECO_KG = 35;

export type LostLead = {
  phone: string;
  restaurant_name: string | null;
  name: string | null;
  city: string | null;
  segment: string | null;
  weekly_volume_kg: number | null;
  lost_reason: string | null;
  lost_at: string | null;
  routing_team: string | null;
};

const SEG_LABELS: Record<string, string> = {
  hamburgueria: "Hamburgueria", restaurante: "Restaurante", bar: "Bar",
  distribuidora: "Distribuidora", rede: "Rede/Franquia", churrascaria: "Churrascaria",
  food_truck: "Food Truck", dark_kitchen: "Dark Kitchen", acougue: "Açougue",
  steak_house: "Steak House", pub: "Pub", delivery: "Delivery",
};

// lost_reason é gravado cru pelo RPC (labels do dropdown). Reconhecimento por
// substring (lowercase) cobre labels reais ("Preço", "Comprou concorrente",
// "Fora de rota") e chaves legadas. Só inativo_30d_pre_handoff (cron) precisa de label.
const REASON_LABELS: Record<string, string> = {
  inativo_30d_pre_handoff: "Inativo 30d",
  preco: "Preço", concorrente: "Concorrente", sem_resposta: "Sem resposta",
  desinteressado: "Desinteressado", fora_de_alcance: "Fora de alcance",
};

const isPreco = (r: string | null) => /pre[çc]o|or[çc]amento/i.test(r ?? "");
const isConcorrente = (r: string | null) => /concorrente/i.test(r ?? "");
const isForaRota = (r: string | null) => /fora de rota|fora_de|alcance/i.test(r ?? "");

function reasonColor(reason: string | null): string {
  if (isPreco(reason)) return theme.colors.warning;
  if (isConcorrente(reason)) return theme.colors.critical;
  return theme.colors.neutral;
}

function diasDesde(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
}

// Badge de reabordagem recomendada
function reabordagem(reason: string | null, dias: number): { label: string; color: string } {
  if (isConcorrente(reason)) return { label: "DIFÍCIL", color: theme.colors.neutral };
  if (isForaRota(reason)) return { label: "EXPANSÃO FUTURA", color: theme.colors.neutral };
  if (isPreco(reason) && dias > 60) return { label: "REABORDAR AGORA", color: theme.colors.success };
  if (dias < 60) return { label: "AGUARDAR", color: theme.colors.warning };
  return { label: "AVALIAR", color: theme.colors.neutral };
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

export function PerdidosList({ leads }: { leads: LostLead[] }) {
  const total = leads.length;
  const precoCount = leads.filter(l => isPreco(l.lost_reason)).length;
  const pctPreco = total > 0 ? Math.round((precoCount / total) * 100) : 0;
  const valorPotencial = leads.reduce((acc, l) => acc + Number(l.weekly_volume_kg ?? 0) * PRECO_KG, 0);

  const card: React.CSSProperties = { background: theme.colors.bgCard, border: `1px solid ${theme.colors.borderDefault}`, borderRadius: 8 };
  const label: React.CSSProperties = { fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: theme.colors.neutral, fontFamily: theme.font.mono };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div className="asb-grid-kpi">
        <div style={{ ...card, padding: 20, borderTop: `2px solid ${theme.colors.neutral}` }}>
          <p style={label}>Perdidos (180d)</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: "#fff", marginTop: 10 }}>{total}</p>
        </div>
        <div style={{ ...card, padding: 20, borderTop: `2px solid ${theme.colors.warning}` }}>
          <p style={{ ...label, color: theme.colors.warning }}>% por Preço</p>
          <p style={{ fontSize: 26, fontWeight: 700, color: "#fff", marginTop: 10 }}>{pctPreco}%</p>
          <p style={{ ...label, marginTop: 6, fontSize: 10 }}>os mais recuperáveis</p>
        </div>
        <div style={{ ...card, padding: 20, borderTop: `2px solid ${theme.colors.brandAsb}` }}>
          <p style={{ ...label, color: theme.colors.brandAsb }}>Pipeline Perdido</p>
          <p style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 10, fontFamily: theme.font.mono }}>
            R$ {Math.round(valorPotencial).toLocaleString("pt-BR")}
          </p>
          <p style={{ ...label, marginTop: 6, fontSize: 10 }}>Σ volume × R$ {PRECO_KG}/kg</p>
        </div>
      </div>

      {/* Lista */}
      <div style={{ ...card, padding: "16px 20px" }}>
        {total === 0 ? (
          <p style={{ color: theme.colors.success, fontSize: 12, fontFamily: theme.font.mono, textAlign: "center", padding: "24px 0" }}>
            Nenhum lead perdido nos últimos 180 dias ✓
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {leads.map((l) => {
              const nome = l.restaurant_name || l.name || l.phone;
              const segLabel = l.segment ? (SEG_LABELS[l.segment] ?? l.segment) : "seu negócio";
              const dias = diasDesde(l.lost_at);
              const reab = reabordagem(l.lost_reason, dias);
              const msg = `Olá ${l.restaurant_name || l.name || ""}, tudo bem? Passando para ver se ainda posso ajudar você com ${segLabel}...`;
              const waUrl = `https://wa.me/${l.phone.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
              return (
                <div
                  key={l.phone}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                    background: theme.colors.bgBase, border: `1px solid ${theme.colors.borderDefault}`,
                    borderRadius: 6, padding: "10px 14px",
                  }}
                >
                  {/* Identificação */}
                  <div style={{ flex: "1 1 200px", minWidth: 160 }}>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 600, fontFamily: theme.font.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {nome}
                    </div>
                    <div style={{ color: theme.colors.neutral, fontSize: 10, fontFamily: theme.font.mono }}>
                      {[l.city, segLabel, l.weekly_volume_kg ? `${l.weekly_volume_kg}kg/sem` : null].filter(Boolean).join(" · ")}
                    </div>
                  </div>

                  {/* Motivo */}
                  <Pill label={REASON_LABELS[l.lost_reason ?? ""] ?? (l.lost_reason ?? "—")} color={reasonColor(l.lost_reason)} />

                  {/* Dias desde a perda */}
                  <span style={{ color: theme.colors.neutral, fontSize: 10, fontFamily: theme.font.mono, minWidth: 70 }}>
                    {dias}d atrás
                  </span>

                  {/* Reabordagem */}
                  <Pill label={reab.label} color={reab.color} />

                  {/* Botão reabordar */}
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4,
                      background: theme.colors.success, color: "#0a0f1f", textDecoration: "none",
                      fontFamily: theme.font.mono, fontSize: 10, fontWeight: 700,
                      letterSpacing: ".06em", textTransform: "uppercase",
                      padding: "6px 12px", borderRadius: 4, whiteSpace: "nowrap",
                    }}
                  >
                    ↩ Reabordar
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
