// scripts/validar-alertas-dry-run.ts — SIMULAÇÃO do cron de alertas da Jornada.
//
// SOMENTE LEITURA: não grava, não cria registro em jornada_alertas, não altera estado.
// Importa a MESMA lógica pura do job (lib/jornada/alertas.ts) para a simulação ser fiel.
//
// Uso:
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node --import tsx scripts/validar-alertas-dry-run.ts

import { createClient } from "@supabase/supabase-js";
import {
  etapaPorPedidos, venceEm, criticoEm, proximoEstado, acaoValida,
  chavesDeTelefone, normalizarTelefone, rotuloAtraso, referenciaContador,
  elegivelPorStatus, dentroDoCorte, lerDataDeCorte,
  RECORRENTE_MIN_PEDIDOS, type MensagemVendedor,
} from "../lib/jornada/alertas";

const CORTE = lerDataDeCorte(process.env.JORNADA_ALERTAS_START_AT);

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const agora = new Date();
const fmt = (d: Date | string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
const mask = (t: string | null) => (t ? `…${String(t).replace(/\D/g, "").slice(-4)}` : "—");

/** Pagina qualquer consulta em blocos de 1000 (fura o teto do PostgREST). */
async function paginar<T>(fazer: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fazer(from, from + 999);
    if (error) break;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function main() {
  // 1) pedidos faturados válidos
  const pedidos = await paginar<{ ares_cliente_id: number; ares_pedido_id: number; data_faturamento: string; valor_faturado_brl: number | null; vendedor_routing_team: string | null }>(
    (a, b) => sb.from("pedidos_espelho")
      .select("ares_cliente_id, ares_pedido_id, data_faturamento, valor_faturado_brl, vendedor_routing_team")
      .in("ares_id_status_pedido", [4, 13])
      .eq("is_deleted", false).eq("is_excluded", false)
      .not("data_faturamento", "is", null)
      .order("ares_cliente_id", { ascending: true })
      .order("data_faturamento", { ascending: true })
      .range(a, b),
  );

  const porCliente = new Map<number, typeof pedidos>();
  const vistos = new Set<string>();
  for (const p of pedidos) {
    const k = `${p.ares_cliente_id}:${p.ares_pedido_id}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    if (!porCliente.has(p.ares_cliente_id)) porCliente.set(p.ares_cliente_id, []);
    porCliente.get(p.ares_cliente_id)!.push(p);
  }

  // 2) vendedores
  const { data: vraw } = await sb.from("vendors").select("id, name, routing_team, active, evolution_instance");
  const vendorPorTeam = new Map<string, { id: string; name: string; inst: string | null }>();
  for (const v of (vraw ?? []) as { id: string; name: string; routing_team: string | null; active: boolean | null; evolution_instance: string | null }[]) {
    if (v.routing_team && v.active !== false && !vendorPorTeam.has(v.routing_team)) {
      vendorPorTeam.set(v.routing_team, { id: v.id, name: v.name, inst: v.evolution_instance });
    }
  }

  // 3) telefones ARES (telefones + whatsapp; ignora cadastro deletado)
  const pessoas = await paginar<{ ares_pessoa_id: number; nome: string | null; fantasia: string | null; telefones: string | null; whatsapp: string | null; ts_delete: string | null }>(
    (a, b) => sb.from("ares_pessoas").select("ares_pessoa_id, nome, fantasia, telefones, whatsapp, ts_delete").range(a, b),
  );
  const telPorPessoa = new Map<number, { tel: string | null; chaves: string[]; nome: string }>();
  for (const p of pessoas) {
    if (p.ts_delete) continue;
    telPorPessoa.set(p.ares_pessoa_id, {
      tel: p.telefones ?? p.whatsapp,
      chaves: [...new Set([...chavesDeTelefone(p.telefones), ...chavesDeTelefone(p.whatsapp)])],
      nome: p.fantasia || p.nome || `Cliente ${p.ares_pessoa_id}`,
    });
  }

  // 3b) customer_status (régua oficial fn_status_cliente) — para medir o impacto do horizonte
  const statusPorPessoa = new Map<number, string>();
  for (const c of await paginar<{ ares_pessoa_id: number; customer_status: string | null }>(
    (a, b) => sb.from("v_carteira_360").select("ares_pessoa_id, customer_status").range(a, b))) {
    if (c.customer_status && !statusPorPessoa.has(c.ares_pessoa_id)) statusPorPessoa.set(c.ares_pessoa_id, c.customer_status);
  }
  const donos = new Map<string, Set<number>>();
  for (const [pid, v] of telPorPessoa) for (const c of v.chaves) {
    if (!donos.has(c)) donos.set(c, new Set());
    donos.get(c)!.add(pid);
  }

  // 4) mensagens outbound (5 dias — cobre 72h + folga)
  const desde = new Date(agora.getTime() - 5 * 24 * 3600_000).toISOString();
  const msgs = await paginar<MensagemVendedor & { evolution_instance?: string | null }>(
    (a, b) => sb.from("vendor_messages")
      .select("vendor_id, lead_phone, direction, created_at, evolution_message_id, evolution_instance")
      .eq("direction", "outbound").gte("created_at", desde).range(a, b),
  );

  // 5) simula
  const linhas: Record<string, unknown>[] = [];
  let nVencidos = 0, nAcao = 0, nCriticos = 0, nSemTel = 0, nAmbiguo = 0, nSemMatch = 0, nPendentes = 0;
  let nInelegStatus = 0, nInelegCorte = 0;

  for (const [pessoaId, peds] of porCliente) {
    peds.sort((a, b) => a.data_faturamento.localeCompare(b.data_faturamento) || a.ares_pedido_id - b.ares_pedido_id);
    if (peds.length >= RECORRENTE_MIN_PEDIDOS) continue;          // recorrente: fora
    const etapa = etapaPorPedidos(peds.length);
    if (!etapa) continue;

    const origem = peds[peds.length - 1];
    if (!elegivelPorStatus(statusPorPessoa.get(pessoaId))) { nInelegStatus++; continue; }
    const fat = new Date(origem.data_faturamento);
    if (!dentroDoCorte(fat, CORTE)) { nInelegCorte++; continue; }
    const vEm = venceEm(fat), cEm = criticoEm(fat);
    if (agora < vEm) { nPendentes++; continue; }                  // ainda no prazo

    const team = origem.vendedor_routing_team;
    const vend = team ? vendorPorTeam.get(team) ?? null : null;
    const info = telPorPessoa.get(pessoaId);

    const todasChaves = info?.chaves ?? [];
    const chaves = todasChaves.filter((c) => (donos.get(c)?.size ?? 0) === 1);

    const semTel = todasChaves.length === 0;
    const soAmbiguo = !semTel && chaves.length === 0;
    if (semTel) nSemTel++;
    if (soAmbiguo) nAmbiguo++;

    const evid = acaoValida(msgs, { vendeEm: vEm, criticoEm: cEm, vendorIdResponsavel: vend?.id ?? null, chavesTelefoneCliente: chaves });

    // Houve mensagem do vendedor para ALGUM telefone conhecido? (mede o match ARES×Evolution)
    const msgsDoVend = msgs.filter((m) => vend && m.vendor_id === vend.id);
    const casouAlgum = msgsDoVend.some((m) => { const k = normalizarTelefone(m.lead_phone); return k && chaves.includes(k); });
    if (!semTel && !soAmbiguo && !casouAlgum) nSemMatch++;

    const estado = proximoEstado({
      atual: { estado: "pendente", faturado_em: fat.toISOString(), vence_em: vEm.toISOString(), critico_em: cEm.toISOString() },
      agora, temPedidoNovo: false, temAcaoValida: !!evid, jaRecorrente: false,
    });
    if (estado === "vencido") nVencidos++;
    if (estado === "acao_registrada") nAcao++;
    if (estado === "critico") nCriticos++;

    linhas.push({
      status: statusPorPessoa.get(pessoaId) ?? "?",
      diasAtraso: Math.floor((agora.getTime() - vEm.getTime()) / 86400_000),
      cliente: info?.nome ?? `Cliente ${pessoaId}`, pessoaId,
      tel_ares: mask(info?.tel ?? null),
      tel_norm: chaves.length ? chaves.map((c) => `…${c.slice(-4)}`).join(",") : (semTel ? "SEM TEL" : "AMBÍGUO"),
      vendedor: vend?.name ?? "—", setor: team ?? "—", instancia: vend?.inst ?? "—",
      etapa, faturado: fat, vence: vEm, critico: cEm,
      msgs_outbound: msgsDoVend.filter((m) => { const k = normalizarTelefone(m.lead_phone); return k && chaves.includes(k); }).length,
      evid: evid?.evolution_message_id ?? null,
      estado,
    });
  }

  // ── relatório ──────────────────────────────────────────────────────────────
  console.log("=".repeat(118));
  console.log("SIMULAÇÃO DO CRON DE ALERTAS — SOMENTE LEITURA (nada gravado)   ·   " + agora.toLocaleString("pt-BR"));
  console.log("=".repeat(118));
  console.log(`clientes com pedido faturado : ${porCliente.size}`);
  console.log(`ainda no prazo (<48h)        : ${nPendentes}`);
  console.log(`mensagens outbound (5 dias)  : ${msgs.length}`);
  console.log(`DATA DE CORTE                : ${CORTE ? CORTE.toISOString() : "NAO CONFIGURADA (fail-closed)"}`);
  console.log(`inelegiveis por status       : ${nInelegStatus}`);
  console.log(`inelegiveis por corte        : ${nInelegCorte}`);
  console.log(`pessoas ARES com telefone    : ${[...telPorPessoa.values()].filter((v) => v.chaves.length > 0).length} de ${telPorPessoa.size}`);
  console.log("-".repeat(118));
  console.log(`FICARIAM VENCIDOS            : ${nVencidos}`);
  console.log(`COM AÇÃO OUTBOUND DETECTADA  : ${nAcao}`);
  console.log(`FICARIAM CRÍTICOS            : ${nCriticos}`);
  console.log(`SEM TELEFONE no ARES         : ${nSemTel}`);
  console.log(`TELEFONE AMBÍGUO (2+ donos)  : ${nAmbiguo}`);
  console.log(`SEM match ARES × Evolution   : ${nSemMatch}`);
  console.log("=".repeat(118));

  // ── impacto do horizonte: por status e por idade do atraso ────────────────
  const porStatus = new Map<string, number>();
  for (const l of linhas) porStatus.set(String(l.status), (porStatus.get(String(l.status)) ?? 0) + 1);
  console.log("\nDISTRIBUIÇÃO POR customer_status (régua oficial fn_status_cliente):");
  for (const [s, n] of [...porStatus.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${s.padEnd(22)} ${n}`);

  const faixas: [string, (d: number) => boolean][] = [
    ["≤ 7 dias de atraso", (d) => d <= 7],
    ["8 a 30 dias", (d) => d > 7 && d <= 30],
    ["31 a 90 dias", (d) => d > 30 && d <= 90],
    ["> 90 dias (dormente)", (d) => d > 90],
  ];
  console.log("\nDISTRIBUIÇÃO POR IDADE DO ATRASO:");
  for (const [rot, f] of faixas) console.log(`   ${rot.padEnd(24)} ${linhas.filter((l) => f(Number(l.diasAtraso))).length}`);

  const vivos = linhas.filter((l) => ["ativo", "atencao", "risco"].includes(String(l.status)));
  console.log(`\nSE FILTRAR por carteira viva/recuperável (ativo+atencao+risco): ${vivos.length} alertas (em vez de ${linhas.length})`);
  const vivos30 = vivos.filter((l) => Number(l.diasAtraso) <= 30);
  console.log(`SE FILTRAR também por atraso ≤ 30 dias:                          ${vivos30.length} alertas`);

  const amostra = linhas.filter((l) => l.estado === "critico").slice(0, 15);
  console.log(`\nAMOSTRA — ${amostra.length} de ${nCriticos} que ficariam CRÍTICOS\n`);
  for (const l of amostra) {
    console.log(`• ${String(l.cliente).slice(0, 42).padEnd(42)} id=${l.pessoaId}`);
    console.log(`    tel ARES ${l.tel_ares}  → normalizado ${l.tel_norm}`);
    console.log(`    vendedor ${l.vendedor} · setor ${l.setor} · instância ${l.instancia}`);
    console.log(`    etapa ${l.etapa} · faturado ${fmt(l.faturado as Date)} · vence ${fmt(l.vence as Date)} · crítico ${fmt(l.critico as Date)}`);
    console.log(`    janela 24h: ${fmt(l.vence as Date)} → ${fmt(l.critico as Date)} · msgs outbound casadas: ${l.msgs_outbound} · evidência: ${l.evid ?? "nenhuma"}`);
    console.log(`    RESULTADO: ${String(l.estado).toUpperCase()} · ${rotuloAtraso(referenciaContador({ estado: l.estado as never, vence_em: (l.vence as Date).toISOString(), critico_em: (l.critico as Date).toISOString() }), agora)}`);
    console.log("");
  }

  const comAcao = linhas.filter((l) => l.estado === "acao_registrada").slice(0, 5);
  if (comAcao.length) {
    console.log(`AMOSTRA — ${comAcao.length} de ${nAcao} com AÇÃO DETECTADA (não viram críticos)\n`);
    for (const l of comAcao) {
      console.log(`• ${String(l.cliente).slice(0, 42).padEnd(42)} vendedor ${l.vendedor} · msgs ${l.msgs_outbound} · evidência ${l.evid}`);
    }
  }
}

main().catch((e) => { console.error("FALHA:", e?.message ?? e); process.exit(1); });
