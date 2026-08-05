// lib/jornada/alertas.ts — FONTE ÚNICA da lógica dos alertas da Jornada.
//
// Dois níveis, sobre CLIENTE ARES (ares_pessoa_id) — não sobre lead SDR:
//   • 48h após o último pedido faturado sem o próximo pedido  → VENCIDO
//   • +24h (72h no total) sem ação outbound do vendedor       → CRÍTICO
//
// Módulo PURO (sem React/Supabase/Date.now implícito) → testável isolado.
// Todo cálculo de tempo recebe o "agora" por parâmetro, para o teste cravar o relógio.

export type EtapaAlerta =
  | "aguardando_2" | "aguardando_3" | "aguardando_4" | "aguardando_recorrencia";

export type EstadoAlerta =
  | "pendente" | "vencido" | "critico" | "acao_registrada" | "convertido" | "dispensado";

export const RECORRENTE_MIN_PEDIDOS = 5;   // régua canônica (lib/funnel/jornada.ts)
export const HORAS_ATE_VENCER = 48;
export const HORAS_ATE_CRITICO = 24;       // contadas A PARTIR do vencimento

// ── Elegibilidade (Paulo, 2026-08-05) ────────────────────────────────────────
// Só a carteira viva/recuperável gera alerta de jornada. pre_churn, churn_comercial
// e inativo_definitivo têm telas e fluxos próprios de churn/recuperação — se entrassem
// aqui, o card nasceria com 144 alertas (121 deles de cliente já perdido).
// Mesma convenção de v_recompra_prevista/v_tier_upgrade_candidates.
export const STATUS_ELEGIVEIS = new Set<string>(["ativo", "atencao", "risco"]);
export const elegivelPorStatus = (s: string | null | undefined): boolean =>
  !!s && STATUS_ELEGIVEIS.has(s);

/**
 * Data de corte da automação (JORNADA_ALERTAS_START_AT).
 * Só pedido faturado A PARTIR dela gera alerta — evita a Visão Geral nascer com
 * clientes atrasados há centenas de dias. NÃO é janela móvel: depois do corte,
 * cada novo pedido elegível abre sua janela de 48h normalmente, para sempre.
 * Sem a variável configurada, nada é gerado (fail-closed) — melhor card vazio do
 * que 144 alertas retroativos.
 */
export function dentroDoCorte(faturadoEm: Date, startAt: Date | null): boolean {
  if (!startAt) return false;
  return faturadoEm.getTime() >= startAt.getTime();
}

/** Lê e valida JORNADA_ALERTAS_START_AT. Devolve null se ausente/inválida. */
export function lerDataDeCorte(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

const H = 3600_000;

/** Etapa pela quantidade de pedidos faturados já realizados. null = já é recorrente. */
export function etapaPorPedidos(totalPedidos: number): EtapaAlerta | null {
  if (totalPedidos <= 0) return null;                       // sem 1º pedido: fora da jornada
  if (totalPedidos >= RECORRENTE_MIN_PEDIDOS) return null;  // recorrente: jornada concluída
  return (["aguardando_2", "aguardando_3", "aguardando_4", "aguardando_recorrencia"] as const)[totalPedidos - 1];
}

export const venceEm   = (faturadoEm: Date): Date => new Date(faturadoEm.getTime() + HORAS_ATE_VENCER * H);
export const criticoEm = (faturadoEm: Date): Date => new Date(faturadoEm.getTime() + (HORAS_ATE_VENCER + HORAS_ATE_CRITICO) * H);

// ── Normalização de telefone (BR) ────────────────────────────────────────────
// O mesmo número aparece em formatos diferentes entre vendor_messages.lead_phone
// (vem do WhatsApp: 5511987654321) e ares_pessoas.tel (digitado por humano:
// "(11) 98765-4321", "11 3456-7890"). Reduzimos os dois a uma CHAVE canônica:
//   DDD (2) + assinante SEM o 9º dígito (8)  →  10 dígitos
// Tirar o 9º dígito é o que faz "11987654321" casar com "1187654321" — o celular
// brasileiro ganhou o 9 em 2012 e as bases têm as duas grafias.
export function normalizarTelefone(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  let d = String(bruto).replace(/\D/g, "");
  if (d.length === 0) return null;
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);   // tira DDI
  if (d.length < 10 || d.length > 11) return null;            // sem DDD ou lixo → não casa
  const ddd = d.slice(0, 2);
  let assinante = d.slice(2);
  if (assinante.length === 9 && assinante.startsWith("9")) assinante = assinante.slice(1); // tira 9º dígito
  if (assinante.length !== 8) return null;
  return ddd + assinante;
}

/** Extrai todas as chaves de um campo de texto livre com vários números. */
export function chavesDeTelefone(campo: string | null | undefined): string[] {
  if (!campo) return [];
  const out = new Set<string>();
  for (const bruto of String(campo).split(/[;,/|]+|\s{2,}/)) {
    const k = normalizarTelefone(bruto);
    if (k) out.add(k);
  }
  if (out.size === 0) { const k = normalizarTelefone(campo); if (k) out.add(k); }
  return [...out];
}

// ── Ação válida do vendedor ──────────────────────────────────────────────────
export interface MensagemVendedor {
  vendor_id: string | null;
  lead_phone: string | null;
  direction: string | null;
  created_at: string;          // ISO
  evolution_message_id?: string | null;
}
export interface JanelaAcao {
  vendeEm: Date;               // início da janela (= vence_em)
  criticoEm: Date;             // fim da janela
  vendorIdResponsavel: string | null;
  chavesTelefoneCliente: string[];
}

/**
 * Uma ação só vale se for TUDO: outbound + do vendedor responsável + para o
 * telefone do cliente + dentro da janela [vence_em, critico_em].
 * Abrir tela/visualizar não gera vendor_message → não conta, por construção.
 */
export function acaoValida(msgs: MensagemVendedor[], j: JanelaAcao): MensagemVendedor | null {
  const alvo = new Set(j.chavesTelefoneCliente);
  if (alvo.size === 0) return null;
  for (const m of msgs) {
    if (m.direction !== "outbound") continue;                                  // inbound = cliente
    if (!j.vendorIdResponsavel || m.vendor_id !== j.vendorIdResponsavel) continue; // outro vendedor
    const k = normalizarTelefone(m.lead_phone);
    if (!k || !alvo.has(k)) continue;                                          // outro telefone
    const t = new Date(m.created_at).getTime();
    if (t < j.vendeEm.getTime() || t > j.criticoEm.getTime()) continue;        // fora da janela
    return m;
  }
  return null;
}

// ── Máquina de estados ───────────────────────────────────────────────────────
export interface AlertaAtual {
  estado: EstadoAlerta;
  faturado_em: string;
  vence_em: string;
  critico_em: string;
  acao_em?: string | null;
}
export interface TransicaoInput {
  atual: AlertaAtual | null;
  agora: Date;
  temPedidoNovo: boolean;      // cliente faturou de novo depois do pedido de origem
  temAcaoValida: boolean;      // mensagem outbound do responsável NA JANELA
  jaRecorrente: boolean;       // atingiu 5 pedidos
  temRegistroManual?: boolean; // "Registrar contato" lançado na janela (fallback auditável)
}

/**
 * Decide o estado do alerta. Determinística e idempotente: rodar N vezes com o
 * mesmo input devolve o mesmo estado. Estados terminais não retrocedem.
 */
export function proximoEstado(i: TransicaoInput): EstadoAlerta {
  const at = i.atual;
  // Terminais: nunca são reabertos pelo job.
  if (at && (at.estado === "convertido" || at.estado === "dispensado")) return at.estado;

  // Novo pedido (ou recorrência atingida) encerra como convertido — preserva histórico.
  if (i.temPedidoNovo || i.jaRecorrente) return "convertido";

  if (!at) return "pendente";
  const t = i.agora.getTime();
  const venc = new Date(at.vence_em).getTime();
  const crit = new Date(at.critico_em).getTime();

  if (t < venc) return "pendente";                       // dentro do prazo

  // Já venceu. Ação válida trava a escalada, mas o alerta CONTINUA aberto
  // (só sai com pedido novo ou dispensa) — regra explícita do Paulo.
  // Vale tanto a mensagem outbound automática quanto o registro manual (fallback
  // obrigatório para cliente sem telefone / telefone ambíguo / sem match Evolution).
  if (i.temAcaoValida || i.temRegistroManual || at.estado === "acao_registrada" || at.acao_em) {
    return "acao_registrada";
  }

  if (t >= crit) return "critico";
  return "vencido";
}

// ── Contador de atraso ───────────────────────────────────────────────────────
/** "3h em atraso" · "1 dia e 4h em atraso" · "2 dias e 7h em atraso". */
export function rotuloAtraso(desde: Date, agora: Date): string {
  const ms = agora.getTime() - desde.getTime();
  if (ms < 0) return "no prazo";
  const horas = Math.floor(ms / H);
  const d = Math.floor(horas / 24);
  const h = horas % 24;
  if (d === 0) return `${h}h em atraso`;
  return `${d} ${d === 1 ? "dia" : "dias"} e ${h}h em atraso`;
}

/** Referência do contador: crítico conta desde critico_em; vencido, desde vence_em. */
export function referenciaContador(a: Pick<AlertaAtual, "estado" | "vence_em" | "critico_em">): Date {
  return new Date(a.estado === "critico" ? a.critico_em : a.vence_em);
}
