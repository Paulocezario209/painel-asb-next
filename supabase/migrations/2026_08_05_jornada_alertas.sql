-- ============================================================================
-- 2026_08_05_jornada_alertas.sql
-- Alertas da "Jornada do Cliente até a Recorrência" — 2 níveis.
--
--   48h após o último pedido faturado, sem o próximo pedido        -> vencido
--   +24h (72h no total) sem ação outbound do vendedor responsável  -> critico
--
-- Sujeito: CLIENTE ARES (ares_pessoa_id), não lead SDR.
-- Idempotência: UNIQUE (ares_pessoa_id, ares_pedido_id_origem) — um pedido de
-- origem gera no máximo um alerta, para sempre. O job usa ON CONFLICT.
--
-- ELEGIBILIDADE (Paulo, 2026-08-05), aplicada no JOB (não nesta DDL):
--   • customer_status IN ('ativo','atencao','risco') — churn/perdido tem tela própria;
--   • data_faturamento >= JORNADA_ALERTAS_START_AT (env) — SEM alerta retroativo.
--     Sem a env configurada o job não gera nada (fail-closed). Medido no dry-run:
--     sem esses dois filtros o card nasceria com 144 alertas, 121 de cliente perdido
--     e atrasos de até 261 dias.
--
-- APLICAR: Supabase SQL Editor (Paulo). NÃO aplicar por MCP (asb-migration-safety).
-- ROLLBACK: no rodapé.
-- ============================================================================

CREATE TABLE IF NOT EXISTS jornada_alertas (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- sujeito do alerta
  ares_pessoa_id         bigint NOT NULL,
  etapa                  text   NOT NULL,
  ares_pedido_id_origem  bigint NOT NULL,

  -- linha do tempo (horas corridas a partir do faturamento)
  faturado_em            timestamptz NOT NULL,
  vence_em               timestamptz NOT NULL,
  critico_em             timestamptz NOT NULL,
  virou_critico_at       timestamptz,

  -- responsável CONGELADO no vencimento: troca de carteira depois não reescreve
  vendor_id_no_venc      uuid,
  vendor_nome_no_venc    text,
  routing_team_no_venc   text,

  -- estado + evidência da ação
  estado                 text NOT NULL DEFAULT 'pendente',
  acao_tipo              text,          -- vendor_message | manual | dispensa
  acao_ref               text,          -- evolution_message_id (automático) ou null (manual)
  acao_em                timestamptz,

  -- registro MANUAL de contato (fallback auditável): obrigatório quando o cliente não
  -- tem telefone válido, o telefone é ambíguo, não há match ARES×Evolution, ou o contato
  -- foi por ligação/visita/canal não monitorado. Nunca gerado por abrir/visualizar a tela.
  acao_usuario           text,          -- e-mail de quem registrou
  acao_canal             text,          -- ligacao | visita | whatsapp_pessoal | email | outro
  acao_observacao        text,
  acao_proxima           text,          -- próxima ação combinada (opcional)

  -- resolução
  pedido_resolucao_id    bigint,
  resolvido_em           timestamptz,
  resolucao_motivo       text,

  criado_em              timestamptz NOT NULL DEFAULT now(),
  atualizado_em          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT jornada_alertas_uk UNIQUE (ares_pessoa_id, ares_pedido_id_origem),
  CONSTRAINT jornada_alertas_estado_ck CHECK (
    estado IN ('pendente','vencido','critico','acao_registrada','convertido','dispensado')
  ),
  CONSTRAINT jornada_alertas_etapa_ck CHECK (
    etapa IN ('aguardando_2','aguardando_3','aguardando_4','aguardando_recorrencia')
  ),
  CONSTRAINT jornada_alertas_janela_ck CHECK (critico_em > vence_em AND vence_em > faturado_em)
);

-- Índices dos acessos reais: card por estado, lista por vendedor, job por janela.
CREATE INDEX IF NOT EXISTS ix_jornada_alertas_estado        ON jornada_alertas (estado);
CREATE INDEX IF NOT EXISTS ix_jornada_alertas_vendor        ON jornada_alertas (vendor_id_no_venc);
CREATE INDEX IF NOT EXISTS ix_jornada_alertas_vence_em      ON jornada_alertas (vence_em);
CREATE INDEX IF NOT EXISTS ix_jornada_alertas_critico_em    ON jornada_alertas (critico_em);
CREATE INDEX IF NOT EXISTS ix_jornada_alertas_pessoa        ON jornada_alertas (ares_pessoa_id);
-- Card da Visão Geral lê só os abertos: índice parcial mantém a leitura barata.
CREATE INDEX IF NOT EXISTS ix_jornada_alertas_abertos
  ON jornada_alertas (estado, vence_em)
  WHERE estado IN ('vencido','critico','acao_registrada');

-- atualizado_em automático (mesmo padrão das demais tabelas do projeto)
CREATE OR REPLACE FUNCTION fn_jornada_alertas_touch() RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_jornada_alertas_touch ON jornada_alertas;
CREATE TRIGGER tg_jornada_alertas_touch
  BEFORE UPDATE ON jornada_alertas
  FOR EACH ROW EXECUTE FUNCTION fn_jornada_alertas_touch();

-- RLS: a tabela é lida pelo servidor (service role) com filtro de permissão em
-- app/dashboard. Bloqueamos anon/authenticated para não vazar por PostgREST.
ALTER TABLE jornada_alertas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON jornada_alertas FROM anon, authenticated;

COMMENT ON TABLE  jornada_alertas IS
  'Alertas da jornada do cliente ARES: 48h sem próximo pedido = vencido; +24h sem ação outbound do vendedor = critico. Histórico preservado (nunca deletar linha).';
COMMENT ON COLUMN jornada_alertas.vendor_id_no_venc IS
  'Responsável CONGELADO no vencimento. Troca de carteira posterior NAO reescreve.';
COMMENT ON COLUMN jornada_alertas.acao_ref IS
  'Evidencia da acao: evolution_message_id (vendor_messages) ou id do registro manual.';

-- ============================================================================
-- ROLLBACK
--   DROP TRIGGER IF EXISTS tg_jornada_alertas_touch ON jornada_alertas;
--   DROP FUNCTION IF EXISTS fn_jornada_alertas_touch();
--   DROP TABLE IF EXISTS jornada_alertas;
-- ============================================================================
