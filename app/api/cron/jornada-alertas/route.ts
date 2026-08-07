// app/api/cron/jornada-alertas/route.ts — job dos alertas da Jornada (a cada 30 min).
//
// Protegido por INTERNAL_API_KEY (header x-internal-key), igual aos demais jobs internos.
// Agendamento fica no n8n (fora daqui) — ver docs no rodapé deste arquivo.
//
// Idempotente: a chave (ares_pessoa_id, ares_pedido_id_origem) é UNIQUE e o upsert
// só avança estado. Rodar 10x seguidas produz exatamente o mesmo resultado.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  etapaPorPedidos, venceEm, criticoEm, proximoEstado, acaoValida,
  chavesDeTelefone, elegivelPorStatus, dentroDoCorte, lerDataDeCorte,
  RECORRENTE_MIN_PEDIDOS, type EstadoAlerta, type MensagemVendedor,
} from "@/lib/jornada/alertas";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface PedidoRow { ares_cliente_id: number; ares_pedido_id: number; data_faturamento: string; valor_faturado_brl: number | null; vendedor_routing_team: string | null }
interface AlertaRow {
  id: string; ares_pessoa_id: number; ares_pedido_id_origem: number; estado: EstadoAlerta;
  faturado_em: string; vence_em: string; critico_em: string; acao_em: string | null;
  virou_critico_at: string | null;
}

export async function POST(req: Request) {
  if (req.headers.get("x-internal-key") !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const agora = new Date();

  // Data de corte: sem ela o job não gera NADA (fail-closed) — evita alerta retroativo.
  const corte = lerDataDeCorte(process.env.JORNADA_ALERTAS_START_AT);
  if (!corte) {
    return NextResponse.json({
      ok: false,
      error: "JORNADA_ALERTAS_START_AT ausente ou inválida — job não executa sem data de corte",
    }, { status: 412 });
  }

  // Status elegíveis: só carteira viva/recuperável entra na jornada.
  const statusPorPessoa = new Map<number, string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("v_carteira_360").select("ares_pessoa_id, customer_status").range(from, from + 999);
    const rows = (data ?? []) as { ares_pessoa_id: number; customer_status: string | null }[];
    for (const c of rows) if (c.customer_status && !statusPorPessoa.has(c.ares_pessoa_id)) statusPorPessoa.set(c.ares_pessoa_id, c.customer_status);
    if (rows.length < 1000) break;
  }

  // ── 1) pedidos faturados válidos (paginado; fura o teto de 1000 linhas) ────
  const pedidos: PedidoRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("pedidos_espelho")
      .select("ares_cliente_id, ares_pedido_id, data_faturamento, valor_faturado_brl, vendedor_routing_team")
      .in("ares_id_status_pedido", [4, 13])
      .eq("is_deleted", false).eq("is_excluded", false)
      .not("data_faturamento", "is", null)
      .order("ares_cliente_id", { ascending: true }).order("data_faturamento", { ascending: true })
      .range(from, from + 999);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    const rows = (data ?? []) as PedidoRow[];
    pedidos.push(...rows);
    if (rows.length < 1000) break;
  }

  // agrupa por cliente, deduplicando por ares_pedido_id (chave canônica do pedido)
  const porCliente = new Map<number, PedidoRow[]>();
  const vistos = new Set<string>();
  for (const p of pedidos) {
    const k = `${p.ares_cliente_id}:${p.ares_pedido_id}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    if (!porCliente.has(p.ares_cliente_id)) porCliente.set(p.ares_cliente_id, []);
    porCliente.get(p.ares_cliente_id)!.push(p);
  }

  // ── 2) vendedores por routing_team (regra canônica de responsabilidade) ────
  const { data: vendorsRaw } = await sb.from("vendors").select("id, name, routing_team, active");
  const vendorPorTeam = new Map<string, { id: string; name: string }>();
  for (const v of (vendorsRaw ?? []) as { id: string; name: string; routing_team: string | null; active: boolean | null }[]) {
    if (v.routing_team && v.active !== false && !vendorPorTeam.has(v.routing_team)) {
      vendorPorTeam.set(v.routing_team, { id: v.id, name: v.name });
    }
  }

  // ── 3) telefones do cliente (ares_pessoas) → chaves normalizadas ──────────
  // Duas fontes no cadastro ARES: `telefones` (texto livre, vários números) e `whatsapp`.
  // Somamos as duas — o vendedor pode ter falado por qualquer uma. Ignora cadastro deletado.
  const telPorPessoa = new Map<number, string[]>();
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from("ares_pessoas")
      .select("ares_pessoa_id, telefones, whatsapp, ts_delete").range(from, from + 999);
    const rows = (data ?? []) as { ares_pessoa_id: number; telefones: string | null; whatsapp: string | null; ts_delete: string | null }[];
    for (const r of rows) {
      if (r.ts_delete) continue;
      const chaves = [...new Set([...chavesDeTelefone(r.telefones), ...chavesDeTelefone(r.whatsapp)])];
      if (chaves.length > 0) telPorPessoa.set(r.ares_pessoa_id, chaves);
    }
    if (rows.length < 1000) break;
  }
  // Telefone compartilhado por 2+ clientes é ambíguo → não atribui ação a ninguém
  // (evita creditar a ação ao cliente errado — cenário 22).
  const donosPorChave = new Map<string, Set<number>>();
  for (const [pid, chaves] of telPorPessoa) {
    for (const c of chaves) {
      if (!donosPorChave.has(c)) donosPorChave.set(c, new Set());
      donosPorChave.get(c)!.add(pid);
    }
  }

  // ── 4) alertas já existentes ──────────────────────────────────────────────
  const { data: existRaw } = await sb.from("jornada_alertas").select(
    "id, ares_pessoa_id, ares_pedido_id_origem, estado, faturado_em, vence_em, critico_em, acao_em, virou_critico_at",
  );
  const existentes = new Map<string, AlertaRow>();
  for (const a of (existRaw ?? []) as AlertaRow[]) existentes.set(`${a.ares_pessoa_id}:${a.ares_pedido_id_origem}`, a);

  // ── 5) mensagens outbound recentes (janela de 5 dias cobre 72h + folga) ───
  const desde = new Date(agora.getTime() - 5 * 24 * 3600_000).toISOString();
  const msgs: MensagemVendedor[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from("vendor_messages")
      .select("vendor_id, lead_phone, direction, created_at, evolution_message_id")
      .eq("direction", "outbound").gte("created_at", desde)
      .range(from, from + 999);
    const rows = (data ?? []) as MensagemVendedor[];
    msgs.push(...rows);
    if (rows.length < 1000) break;
  }

  // ── 6) decide por cliente ─────────────────────────────────────────────────
  const upserts: Record<string, unknown>[] = [];
  let criados = 0, vencidos = 0, criticos = 0, convertidos = 0, comAcao = 0;
  let inelegivelStatus = 0, inelegivelCorte = 0;

  for (const [pessoaId, peds] of porCliente) {
    peds.sort((a, b) => a.data_faturamento.localeCompare(b.data_faturamento) || a.ares_pedido_id - b.ares_pedido_id);
    const jaRecorrente = peds.length >= RECORRENTE_MIN_PEDIDOS;
    const origem = peds[peds.length - 1];                    // último pedido faturado
    const etapa = etapaPorPedidos(peds.length);
    const chave = `${pessoaId}:${origem.ares_pedido_id}`;
    const atual = existentes.get(chave) ?? null;

    // Alertas de pedidos ANTERIORES viram convertidos (o cliente avançou).
    for (const [k, a] of existentes) {
      if (a.ares_pessoa_id !== pessoaId) continue;
      if (a.ares_pedido_id_origem === origem.ares_pedido_id) continue;
      if (a.estado === "convertido" || a.estado === "dispensado") continue;
      upserts.push({
        ares_pessoa_id: a.ares_pessoa_id, ares_pedido_id_origem: a.ares_pedido_id_origem,
        estado: "convertido", pedido_resolucao_id: origem.ares_pedido_id,
        resolvido_em: agora.toISOString(), resolucao_motivo: "proximo_pedido_faturado",
      });
      convertidos++;
      existentes.delete(k);
    }

    if (jaRecorrente || !etapa) {
      if (atual && atual.estado !== "convertido" && atual.estado !== "dispensado") {
        upserts.push({
          ares_pessoa_id: pessoaId, ares_pedido_id_origem: origem.ares_pedido_id,
          estado: "convertido", resolvido_em: agora.toISOString(), resolucao_motivo: "cliente_recorrente",
        });
        convertidos++;
      }
      continue;                                              // recorrente não gera alerta novo
    }

    // ── ELEGIBILIDADE ───────────────────────────────────────────────────────
    // (a) só carteira viva/recuperável; (b) só pedido a partir da data de corte.
    if (!elegivelPorStatus(statusPorPessoa.get(pessoaId))) { inelegivelStatus++; continue; }

    const fat = new Date(origem.data_faturamento);
    if (!dentroDoCorte(fat, corte)) { inelegivelCorte++; continue; }

    const vEm = venceEm(fat), cEm = criticoEm(fat);
    const team = origem.vendedor_routing_team;
    const vend = team ? vendorPorTeam.get(team) ?? null : null;

    // telefone do cliente — só se NÃO for compartilhado com outro cliente
    const chaves = (telPorPessoa.get(pessoaId) ?? []).filter((c) => (donosPorChave.get(c)?.size ?? 0) === 1);
    const evidencia = acaoValida(msgs, {
      vendeEm: vEm, criticoEm: cEm, vendorIdResponsavel: vend?.id ?? null, chavesTelefoneCliente: chaves,
    });

    // Registro manual já lançado no alerta (fallback auditável) trava a escalada.
    const temRegistroManual = atual?.acao_em != null;

    const estado = proximoEstado({
      atual: atual ?? { estado: "pendente", faturado_em: fat.toISOString(), vence_em: vEm.toISOString(), critico_em: cEm.toISOString() },
      agora, temPedidoNovo: false, temAcaoValida: !!evidencia, jaRecorrente: false, temRegistroManual,
    });

    if (!atual) criados++;
    if (estado === "vencido") vencidos++;
    if (estado === "critico") criticos++;
    if (estado === "acao_registrada") comAcao++;

    upserts.push({
      ares_pessoa_id: pessoaId,
      etapa,
      ares_pedido_id_origem: origem.ares_pedido_id,
      faturado_em: fat.toISOString(),
      vence_em: vEm.toISOString(),
      critico_em: cEm.toISOString(),
      // congela o responsável na PRIMEIRA gravação; depois nunca reescreve
      ...(atual ? {} : {
        vendor_id_no_venc: vend?.id ?? null,
        vendor_nome_no_venc: vend?.name ?? null,
        routing_team_no_venc: team,
      }),
      estado,
      ...(estado === "critico" && !atual?.virou_critico_at ? { virou_critico_at: agora.toISOString() } : {}),
      ...(evidencia && !atual?.acao_em ? {
        acao_tipo: "vendor_message",
        acao_ref: evidencia.evolution_message_id ?? null,
        acao_em: evidencia.created_at,
      } : {}),
    });
  }

  if (upserts.length > 0) {
    const { error } = await sb.from("jornada_alertas").upsert(upserts, {
      onConflict: "ares_pessoa_id,ares_pedido_id_origem",
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true, executado_em: agora.toISOString(),
    data_de_corte: corte.toISOString(),
    clientes_avaliados: porCliente.size,
    inelegiveis: { por_status: inelegivelStatus, anteriores_ao_corte: inelegivelCorte },
    upserts: upserts.length, criados, vencidos, criticos, com_acao: comAcao, convertidos,
  });
}

// ── Agendamento (n8n, fora deste repo) ───────────────────────────────────────
// Schedule Trigger a cada 30 min → HTTP Request:
//   POST https://painel.americansteakbrasil.com/api/cron/jornada-alertas
//   header  x-internal-key: {{$env.INTERNAL_API_KEY}}
// Sem body. Resposta 200 traz o resumo da execução.
