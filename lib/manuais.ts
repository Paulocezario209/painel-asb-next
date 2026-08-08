// lib/manuais.ts — FONTE ÚNICA dos manuais de instrução por tela (botão "?" no Header).
// Pedido Paulo 2026-07-10: "cada sidebar pode ter seu manual de instruções".
// Manual novo/ajuste = mexer SÓ aqui. O Header resolve pela rota (match por prefixo mais longo).
//
// Estrutura: título · o que é · de onde vêm os números (fonte/régua) · como usar.
// Réguas de dinheiro (decisões cravadas): §5 = realizado oficial ARES+CNB por dia de
// faturamento; metas medem ASB e o realizado soma as vendas CNB dos vendedores (XLSX);
// fiscal NF+Recibo é outra régua (só /gerente); comissão tem base própria.

export type ManualTela = {
  titulo: string;
  oQueE: string;
  fontes: string[];      // "de onde vem cada número" — bullets
  comoUsar: string[];    // dicas de uso — bullets
};

export const MANUAIS: Record<string, ManualTela> = {
  "/dashboard/contas-encosto": {
    titulo: "Contas de Encosto",
    oQueE: "Leads perdidos mas QUENTES (backup ativo): a amostra foi aprovada, a relação é boa, mas ficou com o fornecedor atual. Não são leads mortos — são contas em que a ASB fica de segundo fornecedor de encosto, prontas pra reengajar no gatilho certo (a data de volta, ou quando o concorrente tropeçar).",
    fontes: [
      "Lista e KPIs: view v_contas_encosto — leads com is_encosto=true (marcado no encerramento do atendimento), sem testes.",
      "Motivo (badge): lost_reason gravado no encerramento (Sabor/produto, Lealdade/incumbente, Pagamento, Logística...). Dirige o ângulo de reconquista sugerido em cada card.",
      "‘Reengaja em’: next_followup_at — o RPC de encerramento agenda 45 dias por padrão quando a conta é marcada como encosto; a cadência LONGA (motor F3) mantém a conta viva até lá.",
      "Pipeline em Espera: Σ volume semanal × preço/kg — o valor que volta a jogo se o encosto converter.",
      "Fase (badge 🧪 pós-teste / 🍽️ pré-teste): fase_teste da view — pós-teste = já fez pedido/amostra (retorno de experiência); pré-teste = declinou sem provar (convite ao teste). Régua: first_order_at OU está na carteira ARES.",
    ],
    comoUsar: [
      "Uma conta vira encosto na ficha do lead → Ações → ‘Encerrar Atendimento’ → marcar ‘🔥 Manter como encosto’. Motivos quentes (sabor, concorrente, prazo) já sugerem o encosto automaticamente.",
      "Priorize os cards ‘REENGAJAR AGORA’ (data de volta venceu) e ‘EM Nd’ (chegando) — são os que pedem toque.",
      "O ângulo (linha laranja ↳) é o que dizer quando voltar, por motivo: sabor → blend sob medida; concorrente → encosto sem exclusividade; pagamento → prazo com contrapartida.",
      "Se a conta reativar (responder/fazer pedido), ela sai automaticamente do encosto (o marcador zera na reativação).",
    ],
  },
  "/dashboard/funil": {
    titulo: "Funil",
    oQueE: "A jornada completa do lead: da chegada no SDR até virar cliente (1ª compra). Mostra onde cada lead está AGORA e a conversão da coorte do mês.",
    fontes: [
      "Bloco 1 — Funil Comercial (aquisição): Conversão por marcos (criados → qualificados → agendamento → vendedor assumiu → pedido fechado) do mês/vendedor filtrado + KPIs de fase (funnel_stage dos leads reais, sem testes/fora-de-rota). Termina no 1º pedido faturado.",
      "Bloco 2 — Jornada do Cliente até a Recorrência: carteira real ARES (v_carteira_360) + pedidos_espelho (histórico pedido-a-pedido, paginado). Classifica cada cliente pelo nº de pedidos FATURADOS no histórico completo (status 4/13): 1=1º/Ativação · 2=2º · 3=3º · 4=4º · 5+=Recorrente. Categorias mutuamente exclusivas. Deduplicado por cliente (a v_carteira_360 duplica clientes do SETOR_CUIT por ter 2 cadastros de vendedor — DEBT do fan-out registrado à parte).",
      "Funil da Jornada (SUBSTITUI o antigo cone 'Onde estão os leads agora'): população ACUMULADA 1º→Recorrente (quem chegou ao Nº pedido ou além), com taxa de avanço, faturamento acumulado e tempo mediano/médio até cada marco. Aquisição e evolução são processos distintos — por isso funis separados.",
      "Intervalos (mediana = principal, média = secundária) e tempo até recorrência: calculados de pedidos_espelho. Score de evolução (0–100): 40% atraso vs mediana da etapa · 25% dias desde último pedido · 20% queda de frequência · 15% redução de faturamento — só variáveis auditáveis, sem IA (o G5 enriquece depois).",
      "Motivo do bloqueio: exibido SÓ quando confirmado (exit_reason do lead vinculado, ~10% da carteira); senão 'Motivo não identificado' — nunca inferido.",
    ],
    comoUsar: [
      "Bloco 1: clique numa linha da Conversão da Coorte para abrir SÓ os leads daquele marco (mesmo mês/vendedor do filtro) na tela de Leads (tarja verde COORTE + 'limpar filtro').",
      "Jornada — seletor “Base analisada”: Carteira Viva (só ativos/atenção — quem ainda precisa ser conduzido à recorrência) OU Histórico Geral (toda a carteira faturada, inclusive quem virou churn/perdido; só aqui aparecem as taxas de avanço). A troca atualiza contagem, %base, %faturamento, ticket, intervalos, funil e a lista.",
      "Classificação é SEMPRE pelo histórico completo: o filtro de período NÃO afeta a Jornada (só a Conversão por Marcos). Cliente com 7 pedidos é Recorrente, nunca 1º/2º. Churn e perdido não são alterados — seguem nas telas de retenção.",
      "Clique num card da Jornada → lista detalhada do estágio (ordenável por faturamento, score, dias, intervalo, ticket, vendedor, cidade): cliente, vendedor, cidade, pedidos, faturado, ticket, último pedido, dias, score (🟢0-30 · 🟡31-60 · 🟠61-80 · 🔴81-100), situação e motivo. Clique num cliente → Dossiê com a linha do tempo pedido-a-pedido (datas, valores, intervalos, acumulado) e o score aberto por componente.",
      "“Leads por Etapa”: um card por etapa não-terminal (posição atual) — clique abre a lista daquela etapa na tela de Leads. A contagem global tem cache de 5 minutos.",
    ],
  },
  "/dashboard/funil/visao-geral": {
    titulo: "Visão Geral do CRI",
    oQueE: "Resumo executivo do Customer Revenue Intelligence (CRI) no período: leads recebidos, qualificados, abandonos, 1os pedidos, clientes com recompra, faturamento atribuído, custo (mídia/operacional/total), CAC parcial, taxa de conversão, taxa de recorrência e distribuição por origem. Motor de Período configurável, sem janela fixa.",
    fontes: [
      "RPC fn_cri_visao_geral(data_inicio, data_fim) — leads recebidos/qualificados de ai_sdr_leads (created_at no período; qualificado = qual_stage≥7, mesma régua de v_cac_campanha_full/v_cac_anuncio_full). Abandonos via v_cri_etapa_transicoes (mesma régua da tela Custo por Etapa). 1os pedidos/recompra via v_cri_conversion_sequencia_pedidos (F4, numero_sequencia=1 / ≥2). Custo via fn_cri_custo_por_periodo (F2).",
      "RPC fn_cri_distribuicao_origem(data_inicio, data_fim) — leads por origem_canal (SDR único escritor) + 1os pedidos/faturamento vinculados via ares_pessoa_id.",
      "CAC = custo total conhecido ÷ 1os pedidos — sempre 'parcial' hoje porque custo operacional (cri_custo_operacional) está vazio. Taxa de Conversão = 1os pedidos ÷ leads recebidos NO MESMO período — lead recebido no fim da janela pode não ter tido tempo de converter ainda (limite de qualquer taxa por período civil, não erro).",
      "'Evolução vs período anterior' chama a mesma RPC 2x (período atual + anterior de mesma duração) — nunca recalcula métrica no frontend.",
    ],
    comoUsar: [
      "Período: 2 campos de data no topo (Motor de Período) — qualquer intervalo, sem seleção abre no mês corrente até hoje.",
      "Selo geral (canto superior direito do filtro): o peor selo entre os componentes financeiros — hoje sempre 'parcial' até custo operacional ser alimentado.",
      "Acesso restrito a gestor/manager/financeiro — envolve faturamento e custo, informação de gestão.",
    ],
  },
  "/dashboard/funil/custo-por-etapa": {
    titulo: "Custo Acumulado por Etapa",
    oQueE: "O KPI central do Customer Revenue Intelligence (CRI): quantidade, tempo e faturamento por etapa da trilha de aquisição (00 Campanha/origem → 08+ Recorrência), no período configurável escolhido — sem janela fixa embutida no código.",
    fontes: [
      "RPC fn_cri_custo_acumulado_por_etapa(data_inicio, data_fim) — cruza Identity Ledger (F1) + Motor de Custo/Período (F2) + Journey Layer (F3) + Conversion Layer (F4). Mapeamento das 22 etapas reais de funnel_stage_whitelist para a trilha de 9 etapas + Abandono/Saída em fn_cri_mapear_etapa_trilha.",
      "Chegou/Avançou/Abandonou/Parou vêm de funnel_stage_events (v_cri_etapa_transicoes) — desfecho real por transição, não só 'saiu para algum lugar'. Faturamento Atribuído vem de customer_state (fonte única de receita do CRI, decisão que resolve DEBT-122/256).",
      "Custo incremental/acumulado por etapa e Margem/Retorno aparecem sempre com selo 'parcial' — não existe hoje fonte de custo POR ETAPA (o Motor de Custo aloca só por canal/mês) nem margem confirmada/estimada. Regra: ausência desses 2 campos nunca bloqueia os demais 9, que são sempre calculados de verdade.",
    ],
    comoUsar: [
      "Período: 2 campos de data no topo (Motor de Período) — qualquer intervalo é válido, não só 60 dias. Sem seleção, abre no mês corrente até hoje.",
      "Linha 'Abandono/Saída' (com ⚠) não é uma etapa numerada da trilha — é o total de leads que saíram para lead_perdido/fora_de_rota/fornecedor/pedido_teste no período, mostrado à parte.",
      "Acesso restrito a gestor/manager/financeiro (mesma régua de /marketing) — envolve faturamento por etapa, informação de gestão.",
    ],
  },
  "/dashboard/funil/jornada-dos-leads": {
    titulo: "Jornada dos Leads",
    oQueE: "Funil de LEADS pré-venda: onde cada lead está agora, por quais etapas passou, quanto tempo permaneceu em cada uma e onde travou (parado) ou avançou, no período configurável. Não é a mesma coisa que 'Jornada do Cliente até a Recorrência' (Bloco 2 desta mesma página /dashboard/funil) — aquela é 100% pós-1ª-compra (carteira real ARES); esta é pré-venda (trilha do CRI, funnel_stage_events).",
    fontes: [
      "RPC fn_cri_jornada_kpis(data_inicio, data_fim) — 8 KPIs. Reusa v_cri_etapa_transicoes (F5) para etapa atual/tempo por etapa, v_cri_conversion_cliente (F4) para tempo até 1º pedido. 'Em Qualificação' é a ÚNICA foto do agora (não muda com o período); os outros 7 são eventos escopados ao período (created_at/entrou_em/first_order_at dentro de [início,fim]).",
      "RPC fn_cri_jornada_distribuicao_etapa(data_inicio, data_fim) — estende fn_cri_custo_acumulado_por_etapa (F5) com % do total. Avançou/Parou/Abandonou são um recorte por COORTE: contam só entre quem ENTROU naquela etapa dentro do período (mesma régua já usada em Custo Acumulado por Etapa) — um lead que entrou na etapa antes da janela e só avançou dentro dela não entra nesse breakdown específico, mas aparece corretamente na lista investigativa, na etapa atual dele.",
      "RPC fn_cri_jornada_lista(...8 parâmetros) — lista investigativa, 1 linha por lead. Status (convertido/abandonado/parado/ativo) é 100% Motor de Período: convertido = first_order_at no período; abandonado = entrou na etapa 99 no período; parado = entrou na etapa atual no período e ainda não saiu; ativo = nenhum evento do período (inclui leads convertidos/abandonados HÁ MAIS TEMPO, fora da janela consultada — a etapa atual continua mostrada, só o rótulo de status respeita o período). Responsável mostrado via vendorLabel() (lib/vendor-labels.ts) — mesmo padrão de todo o painel, sem JOIN em vendors.",
    ],
    comoUsar: [
      "Período: 2 campos de data no topo (Motor de Período). 8 filtros: início, fim, etapa, responsável, status, origem, campanha e 'parado há ≥ N dias' — todos combináveis via URL, sem JS.",
      "Card 'Em Qualificação' não se move com o período (é a foto de agora) — os demais 7 KPIs e o status de cada linha da lista, sim.",
      "Clique no nome/telefone do lead na Lista Investigativa abre a ficha (/dashboard/leads/{telefone}). Lista limitada a 1000 linhas — refine os filtros se atingir o limite.",
      "Acesso restrito a gestor/manager/financeiro (mesma régua de /marketing).",
    ],
  },
  "/dashboard/funil/conversao": {
    titulo: "Conversão",
    oQueE: "Drill dedicado no evento de conversão: taxa, velocidade, ticket médio, funil de recompra por posição do pedido (1º..4º, 5º+ agrupado) e margem (contrato F4 — hoje sempre 'não informada', nunca inventada), no período configurável.",
    fontes: [
      "RPC fn_cri_conversao_kpis(data_inicio, data_fim) — 13 campos. Taxa de Conversão e Tempo Médio reusam exatamente as réguas de fn_cri_visao_geral/fn_cri_jornada_kpis (mesma fórmula, não segunda definição). Margem é agregação dinâmica sobre v_cri_margem_pedido.confiabilidade — nunca hardcoded.",
      "RPC fn_cri_conversao_por_sequencia(data_inicio, data_fim) — funil de recompra por posição do pedido (v_cri_conversion_sequencia_pedidos/F4, numero_sequencia).",
      "RPC fn_cri_conversao_distribuicao_tempo(data_inicio, data_fim) — leads convertidos no período em faixas de dias até o 1º pedido (v_cri_conversion_cliente/F4, exclui tempo negativo — cliente ARES pré-existente reconciliado depois com lead, não é conversão real).",
      "RPC fn_cri_conversao_lista(data_inicio, data_fim, origem, responsável, sequência_min) — pedidos do período com o lead de origem, quando existe (bridge ares_cliente_id↔ares_pessoa_id).",
      "3 números diferentes de 'conversão' coexistem de propósito (não é bug): Taxa de Conversão usa ai_sdr_leads.first_order_at (mesma régua de Jornada dos Leads); 1os Pedidos usa data_faturamento em v_cri_conversion_sequencia_pedidos (mesma régua de Visão Geral); Tempo Médio/Distribuição usam v_cri_conversion_cliente (customer_state, fonte única de receita do F4). Cada um mede um ângulo diferente do mesmo evento.",
    ],
    comoUsar: [
      "Período: 2 campos de data no topo (Motor de Período). Sem seleção, abre no mês corrente até hoje.",
      "'Pedidos do Período' mostra os 50 mais recentes — a maioria dos pedidos de clientes antigos não tem lead SDR correspondente (cliente ARES pré-existente à ferramenta), o card informa quantos de quantos.",
      "Margem aparece sempre com o selo real (hoje 'não informado' em toda a base) — nunca um número inventado ou % fixo.",
      "Acesso restrito a gestor/manager/financeiro (mesma régua de /marketing).",
    ],
  },
  "/dashboard/funil/revenue-window": {
    titulo: "Revenue Window",
    oQueE: "Comportamento pós-1º pedido de cada cliente dentro de uma janela configurável (7/15/30/60/90/180/365 dias ou personalizada) — sem limite de quantidade de pedidos. Separa período de aquisição (quando o cliente fez o 1º pedido), janela de observação (N dias a partir daí) e data de fechamento, e sinaliza se a coorte consultada já maturou por completo, está parcialmente madura, ou ainda em observação.",
    fontes: [
      "RPC fn_cri_revenue_window_cliente/_kpis/_lista(p_janela_dias, data_inicio, data_fim) — reusam integralmente F4 (v_cri_conversion_sequencia_pedidos) e F6 (fn_cri_revenue_window, fn_cri_faixa_por_dias, v_cri_retention_status_com_recuperacao, fn_hoje_brt). Nenhuma tabela nova.",
      "60 dias é só o default desta TELA (prop de UI) — as 3 RPCs exigem p_janela_dias explícito, sem default no SQL. Qualquer valor digitado no campo 'Janela' funciona (Regra 1/2 do Paulo).",
      "Bucket de pedidos (1/2/3/4/5+): a contagem real nunca tem teto — '5+' é só rótulo de leitura, o 4º pedido é marco analítico, não limite técnico.",
      "'% de Recompra' usa TODA a coorte (madura + em observação); '% de Recorrência' usa SÓ a coorte madura (janela já concluída) — não cruza coorte imatura com concluída sem sinalizar (selo de maturidade no topo da tela).",
      "'Inativos na Janela' é fn_cri_faixa_por_dias aplicada aos dias sem comprar DENTRO da janela (congela no fechamento para coortes maduras) — diferente de 'Recuperados', que usa o histórico ALL-TIME do cliente (v_cri_retention_status_com_recuperacao/F6).",
      "Margem aparece sempre com o selo real (hoje 'não informado' em toda a base) — nunca % fixo.",
    ],
    comoUsar: [
      "2 controles de período: 'Período de aquisição' (Motor de Período — só entram clientes cujo 1º pedido all-time caiu nessa janela) e 'Janela' (dias de observação pós-1º-pedido, com atalhos 7/15/30/60/90/180/365 ou valor customizado).",
      "Selo no topo do filtro mostra se a coorte consultada é madura, parcial ou ainda em observação — leia a nota amarela quando for 'parcial' antes de comparar recompra entre períodos.",
      "Lista investigativa: 5 filtros (bucket de pedidos, origem, responsável, só recuperados, só inativos na janela). Maioria dos clientes antigos não tem lead SDR correspondente.",
      "Acesso restrito a gestor/manager/financeiro (mesma régua de /marketing).",
    ],
  },
  "/dashboard/funil/origens": {
    titulo: "Origens",
    oQueE: "Jornada financeira e operacional do lead por origem: recebido → qualificado → abandonado → convertido → recompra → recorrência → faturamento → custo → selo. NÃO repete CAC/ROAS/atribuição de Marketing (/marketing/origem, /marketing/atribuicao, /marketing/funil-cac, /marketing/overview cobrem canal/campanha/anúncio até 1º pedido) — cobre o gap exclusivo do CRI: trilha fina de 8 etapas + pós-venda, por origem, no Motor de Período.",
    fontes: [
      "RPC fn_cri_origens_kpis(data_inicio, data_fim) — 9 baldes SEMPRE presentes (mesmo com 0 no período), 22 métricas + selo. Leads/qualificação/abandono via ai_sdr_leads + v_cri_etapa_transicoes (mesmas réguas de Visão Geral/Custo por Etapa); pedidos/recompra/faturamento via v_cri_conversion_sequencia_pedidos (F4) com o MESMO bridge ares_cliente_id↔ares_pessoa_id de Conversão/Revenue Window; custo via fn_cri_custo_por_periodo (F2, Motor de Custo).",
      "Mapeamento origem_canal→balde: fn_cri_origem_bucket (classificador puro) — 'instagram'/'google'→Mídia Paga, 'ig_bio'→Bio do Instagram, 'lp'→Landing Page, 'organico'→Orgânico, 'indicacao'→Indicação, NULL/valor não reconhecido→Origem Desconhecida (NUNCA Orgânico — regra explícita do Paulo). Pedidos de clientes ARES sem lead SDR correspondente também caem em Origem Desconhecida.",
      "Custo de mídia: o Motor de Custo do CRI (F2) só desce a canal google/meta — não à granularidade de objetivo de campanha que existe em v_cac_por_canal (Marketing). Por isso 100% do custo de mídia conhecido cai em Mídia Paga; as demais origens mostram custo de mídia 0 (limitação de granularidade, não custo real zero) e selo 'não informado'.",
      "'Clientes Recorrentes'/'Taxa de Recorrência' são FOTO DO AGORA (funnel_stage='cliente_recorrente', rótulo atual do lead) — diferente de 'Recompra' (evento no período, numero_sequencia≥2). Mesma dualidade estado-atual×evento-no-período já documentada em Jornada dos Leads.",
      "'Retorno sobre Faturamento' usa faturamento real ARES (F4) ÷ custo do Motor de Custo (F2) — mesma forma de ROAS, fontes diferentes das de Marketing (que usa ai_sdr_leads.total_revenue_brl, aproximação documentada em DEBT-256). Não substitui o ROAS de /marketing/origem.",
    ],
    comoUsar: [
      "Período: 2 campos de data no topo (Motor de Período). Evolução vs período anterior (▲/▼) nas colunas Leads Recebidos e Faturamento.",
      "Leia a nota amarela antes de comparar Orgânico com Origem Desconhecida — a maior parte do faturamento histórico está em Origem Desconhecida (clientes antigos sem lead SDR), não em Orgânico.",
      "Linhas esmaecidas (WhatsApp Direto, Site, Prospecção Ativa hoje): balde existe e será preenchido sozinho quando a origem passar a distinguir esses casos — não é erro, é 0 real.",
      "Acesso restrito a gestor/manager/financeiro (mesma régua de /marketing).",
    ],
  },
  "/dashboard/funil/pedidos-recorrencia": {
    titulo: "Pedidos e Recorrência",
    oQueE: "Ritmo de recompra por cliente com pelo menos 1 pedido faturado: resumo agregado (estágio real no pipeline, ticket médio, intervalo médio entre pedidos, status de cadência) e, ao clicar num cliente, o drill-down pedido-a-pedido completo (sequência, faturamento acumulado, dias desde o pedido anterior). Estava PAUSADA aguardando a Pipeline Canônica V3 — reusa 100% os building blocks do F4 (LEI ÚNICA: estágio nunca é recalculado aqui, vem de customer_state via v_cri_conversion_cliente).",
    fontes: [
      "v_cri_recorrencia_resumo — 1 linha por cliente. total_orders/total_revenue_brl/avg_ticket_brl/avg_order_interval_days vêm de v_cri_conversion_cliente (customer_state, backfill híbrido direto do ARES — agregado confiável). status_cadencia compara days_since_last_order contra o avg_order_interval_days do PRÓPRIO cliente: >2x=atrasado, >1,3x=atenção, senão no ritmo (NULL no 1º pedido, sem intervalo histórico ainda).",
      "v_cri_pedidos_sequencia — 1 linha por pedido faturado em pedidos_espelho, com numero_sequencia (1º/2º/3º...), faturamento_acumulado_brl (running total) e dias_desde_pedido_anterior (LAG). É o drill-down por trás do botão de cada cliente.",
      "pedidos_no_espelho (DEBT-093, aberto 2026-05-29, quantificado 2026-08-07: 239/357 clientes divergem, 11.581 pedidos de diferença): pedidos_espelho é um espelho incompleto do histórico ARES pra clientes antigos — total_orders é o número confiável, pedidos_no_espelho é quantos aparecem no drill-down. A tela divulga o gap (nota amarela + coluna com parênteses) em vez de esconder.",
    ],
    comoUsar: [
      "3 filtros combináveis via URL: busca por nome, responsável (routing_team) e status de cadência.",
      "4 KPIs no topo contam sobre os clientes filtrados: total com pedido, no ritmo, em atenção, atrasados.",
      "Clique no nome do cliente na tabela \"Recorrência por Cliente\" abre a seção \"Sequência de Pedidos\" abaixo, com o histórico completo pedido-a-pedido daquele cliente.",
      "Quando o número de pedidos no resumo diverge do número no drill-down, a tela avisa explicitamente (DEBT-093) — não é erro de contagem, é limite do espelho pra histórico antigo.",
      "Acesso restrito a gestor/manager/financeiro (mesma régua de /marketing).",
    ],
  },
  "/dashboard/funil/comparacao-periodos": {
    titulo: "Comparação de Períodos",
    oQueE: "Os mesmos 13 KPIs centrais da Visão Geral do CRI, lado a lado entre 2 períodos (A e B) escolhidos livremente, com delta absoluto e percentual — sem nenhuma métrica nova ou recalculada. Zero SQL novo: só chama fn_cri_visao_geral e fn_cri_distribuicao_origem 2x cada (uma vez por período), exatamente como o próprio comentário dessas functions já prescrevia desde a Visão Geral.",
    fontes: [
      "fn_cri_visao_geral(data_inicio, data_fim) — chamada 1x por período. Os 13 KPIs (leads, qualificação, abandono, conversão, recompra, faturamento, custo, CAC, taxas) são idênticos aos de /dashboard/funil/visao-geral — mesma régua, mesma fonte, sem segunda definição.",
      "fn_cri_distribuicao_origem(data_inicio, data_fim) — idem, comparação por origem_canal entre os 2 períodos.",
      "Delta e % são calculados no frontend (Período A − Período B) — nunca no banco. 'Menor é melhor' inverte a cor em Abandonos/Custo/CAC (subir é ruim); nas demais métricas, subir é verde.",
    ],
    comoUsar: [
      "2 pares de data (Período A e Período B). Default: A = mês corrente até hoje; B = período imediatamente anterior, com a MESMA duração de A (não é 'mês anterior inteiro').",
      "Quando as durações de A e B divergem (você mudou as datas manualmente), a tela avisa: comparar totais absolutos (leads, faturamento) entre períodos de tamanhos diferentes é enganoso — prefira as taxas (Conversão, Recorrência) nesse caso.",
      "Selo de confiabilidade de cada período mostrado ao lado do KPI central — reflete o mesmo selo_geral da Visão Geral (pior selo entre os componentes financeiros do período).",
      "Acesso restrito a gestor/manager/financeiro (mesma régua de /marketing).",
    ],
  },
  "/dashboard/funil/qualidade-dados": {
    titulo: "Qualidade dos Dados",
    oQueE: "Última tela do CRI (F9, 9/9) — consolida os selos e gaps de completude que as outras 8 telas já expõem isoladamente, num só lugar: origem conhecida, vínculo lead↔cliente ARES, margem informada e selo de custo (escopados ao período), mais o gap do espelho de pedidos (DEBT-093, foto de agora). Não é métrica nova — é auditoria.",
    fontes: [
      "fn_cri_qualidade_dados(data_inicio, data_fim) — leads no período com origem_canal conhecida (ai_sdr_leads); leads com vínculo a cliente ARES (ares_pessoa_id preenchido — normal ser baixo em período recente, só vincula após 1º pedido); pedidos com margem informada (v_cri_margem_pedido, F4 — hoje sempre 0%, contrato explícito de nunca inventar custo); selo de custo do período (fn_cri_custo_por_periodo, F2, mesma régua de pior-selo da Visão Geral).",
      "fn_cri_qualidade_espelho_snapshot() — SEM Motor de Período (foto de agora, mesmo padrão de 'Em Qualificação' na Jornada dos Leads): reusa v_cri_recorrencia_resumo (Passo 14a) para expor cobertura de pedidos_espelho vs customer_state.total_orders — DEBT-093, gap estrutural do histórico antigo, não um evento datado.",
      "Nenhum objeto novo de dado — as 2 functions só agregam o que v_cri_margem_pedido, fn_cri_custo_por_periodo e v_cri_recorrencia_resumo já calculavam.",
    ],
    comoUsar: [
      "Período (Motor de Período) afeta só os 4 KPIs do topo — leads/pedidos/custo. O bloco 'Espelho de Pedidos' abaixo é sempre foto de agora, independente do período escolhido.",
      "Cores seguem a mesma leitura em toda a tela: verde ≥90% de completude, âmbar ≥60%, vermelho abaixo — exceto Vínculo ARES e Margem, onde baixo % é esperado (não é alarme, é a nota azul explica o porquê).",
      "Link direto para Pedidos e Recorrência para investigar o gap do espelho cliente a cliente.",
      "Acesso restrito a gestor/manager/financeiro (mesma régua de /marketing).",
    ],
  },
  "/dashboard/cadencias": {
    titulo: "Central de Orquestração de Cadências",
    oQueE: "O centro de comando das cadências em 5 seções (As três visões · Cadência Curta/Mapa · Cadência Longa · Fila · Dossiê): onde cada lead está AGORA, em qual degrau (CURTA até 30d / LONGA nutrição), e — já com o motor F3 — qual é a PRÓXIMA AÇÃO e o próximo ângulo de cada lead, sem repetir os já usados. Cada bloco tem botão ocultar/exibir ao lado do título (a preferência fica salva no seu navegador).",
    fontes: [
      "Linha de saúde (topo): v_cadencia_saude — em cadência, curta, longa, sem cadência, em revisão, toques 24h, atrasados. Verde enquanto “sem cadência” = 0 (invariante CADÊNCIA SEM EXCEÇÃO).",
      "Mapa (Cadência Curta) — cards por estado: v_orquestracao_mapa (total/atrasados/hoje por journey_state, derivado de v_orquestracao_leads), incluindo o card “Perda aguard. aprovação” (perda solicitada esperando decisão do gerente em /dashboard/gerente). A borda-topo do card mostra a SITUAÇÃO operacional (verde no prazo · âmbar hoje · vermelho atrasado · roxo precisa humano · teal negociação · cinza pausado), não o estágio. Não lista testes nem fora-de-rota.",
      "Mapa — “Em qual pergunta a qualificação quebra”: qual_stage dos leads em qualificação interrompida; o rótulo é a pergunta EM ABERTO no degrau (1 início/nome-cidade · 2 operação · 3 segmento · 4 volume/prazo). Longa por TEMPO: buckets de degrau (D+30/60/90/180/360 + recorrência) de v_cadencia_lead. Longa por MOTIVO: v_motivos_perda.",
      "Fila — silêncio, degrau, cadência (CURTA/LONGA) por lead: v_cadencia_lead. Coluna “Próxima ação” = proxima_acao REAL do motor F3 (v_lead_proxima_acao). Chips filtram (atrasado/hoje/precisa humano/negociação).",
      "Dossiê — cabeçalho + timeline (conversas_sdr + vendor_messages + funnel_stage_events) do lead selecionado. “Próxima melhor ação” = proxima_acao + proximo_angulo + “não repetir: {angulos_usados}” (v_lead_proxima_acao).",
      "Dossiê — “Contexto extraído”: análise da IA lida de v_orquestracao_leads (contexto_resumo + chips objeção/produto/gramatura/recompra + data da análise). Enquanto a IA não analisou o lead (contexto_extraido_em nulo), mostra “Ainda não analisado pela IA”.",
    ],
    comoUsar: [
      "Escopo por quem está logado: o gestor (e manager) vê TODOS os setores e pode filtrar pelo seletor no topo (Todos · Ana Paula/Sorocaba-SP · Alan/Campinas-Jundiaí · CUIT · Sem time). O vendedor vê SÓ o próprio setor — sem seletor, e não abre lead de outro setor (o filtro é travado no servidor).",
      "Filtro por setor (gestor) vale pro Mapa E pra Fila ao mesmo tempo. A lupa busca por empresa, nome, cidade ou telefone — clicar num resultado abre o Dossiê do lead direto, sem passar pelo Mapa.",
      "Saúde verde = cadência saudável. Se “sem cadência” subir de 0, há vazamento — vá à Fila e investigue.",
      "Clique num card de estado (Mapa) para filtrar a Fila por aquele estado; clique num lead da Fila para carregar o Dossiê com a próxima melhor ação. “abrir dossiê completo” leva ao cadastro do lead.",
      "Cor do ponto/da borda = situação operacional (verde no prazo · âmbar hoje · vermelho atrasado · roxo precisa humano · teal negociação · cinza pausado).",
      "Os filtros ativos aparecem como chips logo abaixo da busca, com “× limpar filtros” para voltar ao estado inicial num clique.",
    ],
  },
  "/dashboard/pipeline": {
    titulo: "Pipeline",
    oQueE: "O quadro Kanban do vendedor pós-handoff: arraste o lead pelas colunas conforme a negociação avança. Termina em Aguardando 1º Pedido — a última ação manual do vendedor (Pipeline Canônica V3, Passo 10, 2026-08-06).",
    fontes: [
      "Cards: leads reais com etapa de pipeline (agendamento → em andamento → negociação → proposta → cadastro do cliente → aguardando 1º pedido). Marcar perdido move pra fila de aprovação do gerente (perda_solicitada) — ver manual do /dashboard/gerente.",
      "Cadastro do Cliente: etapa PRÉ-pedido — o lead topou a proposta e vai fazer o 1º pedido; aqui o vendedor coleta a documentação padrão ASB (CNPJ ou CPF).",
      "Aguardando 1º Pedido: última coluna do board — a partir daqui a evolução é 100% automática via ARES (v_carteira_360.total_orders), sem nenhuma ação manual: pedido_1 → pedido_2 → pedido_3 → pedido_4 → cliente recorrente. O vendedor NÃO move mais o card depois disso — ele some do Pipeline e passa a viver em Clientes/Carteira.",
      "Selo ✓ ARES: o lead já faturou na carteira real (v_carteira_360).",
      "💡 Nudge de sugestão (a IA sinaliza, NUNCA move): no Agendamento, se o vendedor já respondeu o lead (seller_first_reply_at) → sugere Em Andamento; na Proposta, se o CNPJ/cadastro ARES foi captado → sugere Cadastro. É só um lembrete no card — quem move é sempre o vendedor.",
      "Valor estimado: volume semanal (kg) × R$/kg médio definido pela gestão.",
    ],
    comoUsar: [
      "Arrastar um card grava a transição no banco (com motivo, quando perdido). Mover pra Proposta é direto — a proposta é o formulário 🧾 (orçamento) dentro da coluna, não um valor forçado.",
      "Vendedor move só os próprios leads; gestor move todos. TRAVA SEQUENCIAL: o vendedor avança 1 etapa por vez (sem pular e sem voltar) — marcar 'Perdido' pode de qualquer etapa. Só o GESTOR move fora de ordem (pular/voltar).",
      "“Parados >7d” = sem transição há mais de 7 dias — priorize-os.",
      "📋 Enviar ficha (só na etapa Cadastro do Cliente): abre o preview da ficha PF/PJ e envia ao lead pelo SEU WhatsApp (instância Evolution do vendedor). Você revê o texto antes; o lead recebe na mesma conversa. A IA nunca envia — só você. O cadastro no ARES continua manual.",
      "🧾 Montar orçamento (só na etapa Proposta — na Negociação você absorve as infos, na Proposta envia): abre a ficha de orçamento — você busca os produtos no CATÁLOGO COMPLETO (todo produto já vendido: blends, linguiças, molhos, espetos…) ou digita à mão, e informa unidades/caixa e o PREÇO (o sistema nunca sugere preço). Gramatura e unidades/caixa são puxadas do nome quando existem (ex.: 80G, CX 48 UN) — editáveis; o peso total é calculado. O preview mostra exatamente o texto que sai, e o envio vai pelo SEU WhatsApp. A IA nunca envia — só você.",
    ],
  },
  "/dashboard/vendas": {
    titulo: "Vendas",
    oQueE: "Acompanhamento de meta × realizado do mês, por vendedor e no total, com calendário de metas diárias. O seletor MÊS no topo consulta qualquer mês cadastrado (histórico e futuro).",
    fontes: [
      "Meta Total: metas mensais cadastradas (upload de metas) — metas medem a operação ASB.",
      "Calendário e cards por mês: RPCs calendario_metas_mes / resumo_mes_vendedor_mes — no mês corrente entregam exatamente os mesmos números das views v_calendario_metas / v_resumo_mes_vendedor (paridade validada).",
      "Total Faturado (§5) = realizado OFICIAL: faturado ARES por dia de faturamento + vendas CNB dos vendedores (XLSX) — é a régua que fecha meta e semana.",
      "Faturado ASB e Faturado CNB: decomposição do próprio §5 (a soma SEMPRE fecha com o total).",
      "“Prévia ciclo/emissão”: tempo real por emissão — informativa, NÃO é a régua oficial.",
      "Regra §9: sábado fecha na semana que termina; a última meta da semana pode ser combinada (ex.: QUI+SEX).",
    ],
    comoUsar: [
      "Clique num dia do calendário para ver os pedidos (ARES + CNB) e ausentes daquele dia.",
      "O ✓/✗ do dia considera o fold da semana (regra do fechamento), não o dia isolado.",
      "% Atingido usa o §5 oficial — número diferente do fiscal do /gerente é esperado (réguas distintas).",
      "Troque o mês no seletor MÊS (ou volte com “mês atual”). Em mês consultado o card mostra Realizado (mês) × Meta do mês e o % é o do mês inteiro.",
      "Ciclo, alertas comerciais, ranking e missão do dia só aparecem no mês corrente — são leitura de “agora”, não de histórico.",
    ],
  },
  "/dashboard/gerente": {
    titulo: "Gerente",
    oQueE: "Visão executiva do dono: fiscal do mês, prioridades por vendedor, projeção de fechamento, oportunidades e retenção.",
    fontes: [
      "Faturado total (NF+Recibo): régua FISCAL (faturamento_tipo_dia) — inclui recibo, NÃO inclui CNB. Por isso difere do §5 do /vendas.",
      "“Não atribuído”: diferença entre o fiscal e a soma por vendedor (§5) — faturamento sem vendedor atribuído.",
      "Ranking/Prioridades: realizado §5 por vendedor (mesma régua do /vendas).",
      "Up-sell/Risco/Retention: views da carteira real ARES.",
      "Perdas Pendentes (Pipeline Canônica V3, Passo 11, 2026-08-06): fila de aprovação — toda perda (marcada pelo vendedor OU automática do cron) passa por aqui (estágio perda_solicitada) antes de virar perdido definitivo. Cada card mostra etapa de origem, quem solicitou, motivo, contexto da conversa e previsão de cadência; botão Estrategista avalia se vale resgatar. Só o gerente/gestor aprova ou rejeita (rejeitar exige etapa de retorno + motivo).",
    ],
    comoUsar: [
      "Prioridades do Dia ordena o pior primeiro — é a lista de cobrança da manhã.",
      "Projeção = ritmo atual (run-rate §5) projetado até o fim do mês.",
      "Órfãos de atendimento: leads com agendamento sem resposta do vendedor — clique para abrir.",
      "Perdas Pendentes: aprovar manda pra perdido definitivo; rejeitar exige escolher a etapa de retorno e o motivo — o lead volta pra pipeline ativo nessa etapa.",
    ],
  },
  "/dashboard/minha-comissao": {
    titulo: "Minha Comissão",
    oQueE: "Sua remuneração do mês: fixo, comissão de 0,2%, bônus diário/semanal e bônus de crescimento — com simulador.",
    fontes: [
      "Faturado: base de comissão do mês (inclui suas vendas CNB).",
      "Bônus diário/semanal: dias/semanas com meta batida (regra do fold §9 — sábado fecha a semana).",
      "Crescimento: % sobre o mesmo mês anterior — degraus >3% R$150 · >8% R$300 · >12% R$500 (teto).",
    ],
    comoUsar: [
      "Use o simulador para ver quanto falta faturar para o próximo degrau.",
      "Semana com meta batida pelo fold paga bônus semanal; resgate (R$200/100) é só quando NÃO bateu.",
      "Dúvida na regra? Botão “Regras” abre a tabela completa.",
    ],
  },
  "/dashboard/remuneracao": {
    titulo: "Remuneração",
    oQueE: "Visão do time (gestor/financeiro): remuneração de cada vendedor + gerente, custo comercial total e % sobre o faturado.",
    fontes: [
      "Cards: views de comissão (base própria — inclui CNB dos vendedores).",
      "Gerente: baldes NOVO 1% · RESGATE 1% · CRESCIMENTO 0,6% (SKU novo; 0,1% same-product) · CARTEIRA 0,1% + tabela de degraus.",
      "Metas da semana: calendário oficial (fold §9).",
    ],
    comoUsar: [
      "Custo comercial % = custo total do time ÷ faturado do time — acompanhe a tendência mês a mês.",
      "“Regras” abre a política completa de remuneração.",
    ],
  },
  "/dashboard/comercial": {
    titulo: "Comercial",
    oQueE: "Uma porta só para a camada comercial — a jornada de ponta a ponta em cards. Aquisição (Leads SDR · Parados · Perdidos · Pipeline) e Carteira (Clientes · Carteira Ativa). Cada card mostra o total vivo e abre a tela que já existe.",
    fontes: [
      "Leads SDR: entraram hoje (ai_sdr_leads created_at BRT). Parados: v_leads_parados (1–30d). Perdidos: lead_perdido nos últimos 180d. Pipeline: leads em aberto com o vendedor (agendamento→cadastro do cliente).",
      "Clientes: v_carteira_360 viva (ativo + atenção). Carteira Ativa: recompra devida (risco + pré-churn).",
    ],
    comoUsar: [
      "Clique num card para abrir a tela completa daquela camada — o card é só o atalho com o número do momento.",
      "É o mesmo dado das telas Leads / Pipeline / Clientes / Carteira Ativa — aqui reunido em um lugar.",
    ],
  },
  "/dashboard/leads": {
    titulo: "Leads",
    oQueE: "Os leads do SDR numa linha do tempo por idade: Leads SDR (entraram HOJE — a caixa de entrada do dia), Parados (1–30 dias, precisam de atenção), Perdidos (últimos 180 dias), Fora de Rota e Esgotada (a cadência desistiu). Cards no topo mostram o total de cada aba. Convertidos NÃO aparecem aqui: viraram cliente e vivem na Carteira.",
    fontes: [
      "Leads SDR: leads que ENTRARAM HOJE (created_at no dia corrente, BRT). Virou o dia → caem em Parados. É a caixa de entrada do SDR — o vendedor sabe quem chegou hoje. Reais (sem testes), em rota, não convertidos, não perdidos, fora de cadência automática.",
      "Parados: view v_leads_parados (RLS por vendedor). Leads que ENTRARAM no SDR há 1 a 30 dias e ainda estão no funil — em 3 faixas de idade de entrada: 1–7 dias (default), 8–14 e 15–30. Inclui os já assumidos pelo vendedor (ele administra pelas mesmas janelas). Até o dia 30 o vendedor deve resolver: fechar ou marcar perdido (com motivo). Acima de 30 dias sai de Parados → cadência longa. Não lista fora-de-rota nem convertidos/perdidos.",
      "Perdidos: motivo de perda registrado; “pipeline perdido” = volume × R$/kg médio.",
      "Fora de rota: municípios fora da cobertura atual (contato salvo para expansão).",
      "Esgotada: view v_cadencia_esgotada — leads que a cadência automática DESISTIU (o envio do WhatsApp falhou 3× ou o texto vazou placeholder 3×). O motor de follow-up os exclui de propósito (não insiste com quem não recebe), então some do resto do painel; esta aba os traz de volta pro radar. O gestor tria: telefone errado? reabrir manualmente? marcar perdido? (DEBT-318)",
    ],
    comoUsar: [
      "Cards no topo mostram o tamanho de cada aba e o % que representa; clique no card para trocar de aba.",
      "Clique no lead para abrir o detalhe completo (conversa, timeline, ações).",
      "Aba Parados abre na faixa “1–7 dias” (a mais recente/acionável); troque de faixa de idade pelos chips.",
      "Leads SDR: filtros combinam (busca + status + vendedor + ABC + produto + origem); a busca é no servidor.",
      "“Reabordar” nos perdidos abre o WhatsApp direto com o lead.",
    ],
  },
  "/dashboard/handoffs": {
    titulo: "Agendamentos",
    oQueE: "Fila de leads qualificados pelo SDR, com horário agendado, aguardando o vendedor assumir — o ponto mais sensível da esteira.",
    fontes: [
      "Lista: leads com agendamento feito e ainda não confirmado pelo vendedor (tempo real).",
      "Coluna “Agendado para”: dia e hora (BRT) que o lead marcou com o especialista — vem de scheduled_at.",
      "Coluna “Situação”: ancorada no horário AGENDADO — Agendado (azul, no futuro) → No horário (âmbar, até 30min depois) → Atrasado / Vencido (vermelho, só DEPOIS do horário passar). Agendado pro futuro NUNCA aparece como vencido.",
      "Vencidos: leads que JÁ passaram do horário agendado (não é mais “esperando há X horas desde a criação”).",
      "Agendados Hoje: lead marcou horário com o especialista para hoje.",
      "Eficiência do Atendimento (por vendedor): mede como o vendedor assume os agendamentos, ancorado no botão Confirmar — Confirmados (% que ele confirmou / total, com o número bruto), Até confirmar (tempo médio entre o lead cair e o vendedor confirmar) e No horário (% que confirmou até 30min do horário agendado, mostrando “de N com hora” porque o agendamento com horário ainda é recente e a cobertura cresce). Vendedor vê o seu; gestor vê todos (RLS).",
    ],
    comoUsar: [
      "Ordem = por horário AGENDADO (mais cedo primeiro) = prioridade de atendimento; quem não tem agenda vai pro fim. Entre os sem agenda, os já vencidos e maior score sobem.",
      "“Confirmar” marca que o vendedor assumiu (para o relógio do SLA) — e alimenta a Eficiência do Atendimento (% confirmados, tempo até confirmar, % no horário).",
      "Volume ≥300kg é conta CUIT — atenção redobrada.",
    ],
  },
  "/dashboard/followups": {
    titulo: "Follow-ups",
    oQueE: "A camada de nutrição automática do SDR. Em cima: o board de Cadência ativa (quem a automação está nutrindo agora, por fase). Embaixo: o histórico de disparos (o que foi enviado, quem respondeu).",
    fontes: [
      "Board “Cadência ativa”: view v_leads_cadencia (RLS por vendedor) — leads com próximo toque agendado, em 4 fases: Retomada (reengajamento recente), Pós-ativo, Mensal e Semestral (nutrição longa). É o MESMO conjunto que sai da aba Ativos (Leads) — a automação está cuidando, não é lead parado do vendedor.",
      "KPIs/Histórico: envios do motor (fase, ângulo, resposta, conversão).",
      "“Vencidos”/“Sem data”: leads elegíveis com follow-up atrasado ou sem agendamento.",
    ],
    comoUsar: [
      "Board abre na fase “Retomada” (a mais acionável); troque de fase pelos chips. O número vermelho no chip = toques vencidos (deviam ter disparado).",
      "Cada linha é um lead na sua cadência — “Próximo toque” em vermelho = vencido. Clique para abrir a ficha.",
      "Taxa de resposta por ângulo mostra qual abordagem funciona — o Ângulo Top é o campeão. Clique nos KPIs para filtrar o histórico.",
      "Os contadores seguem as mesmas regras do motor (sem leads em atendimento humano, sem fora de rota) — alerta aqui é atraso real.",
    ],
  },
  "/dashboard/insights": {
    titulo: "Inteligência",
    oQueE: "Raio-X agregado da base de leads: segmentos, dores, fornecedores atuais, temperatura e funil por segmento.",
    fontes: [
      "Todos os gráficos: base completa de leads reais (agregado global, cache de 1 hora).",
    ],
    comoUsar: [
      "Use para decidir discurso comercial e prioridade de segmento — não para operação do dia (dados com até 1h de atraso).",
      "“Funil por Segmento” mostra onde a qualificação trava por tipo de negócio.",
    ],
  },
  "/dashboard/vendedores": {
    titulo: "Vendedores",
    oQueE: "Performance comercial pós-handoff por vendedor: resposta, tempo, pipeline em mãos e conversão.",
    fontes: [
      "Tudo vem dos leads (CRM): agendamentos recebidos, % respondido, tempo médio de 1ª resposta, convertidos (1ª compra), win rate.",
      "Pipeline (R$): volume dos leads em aberto × R$/kg médio.",
    ],
    comoUsar: [
      "Win rate = convertidos ÷ agendamentos — compare vendedores no mesmo período.",
      "“Aguardando resposta” é a fila de cobrança: lead ATIVO esperando o vendedor falar. NÃO entram: fora_de_rota (vive só no card Fora de Rota), fornecedor (desviado ao gestor pelo bot — fora do CRM, DEBT-331), convertidos (o vendedor já fechou — muitas vezes pelo WhatsApp dele, sem a 1ª resposta capturada; contam como respondidos, não como não-atendidos) e perdidos (fechados).",
    ],
  },
  "/dashboard/hot-leads": {
    titulo: "Leads Quentes",
    oQueE: "A lista curta de oportunidades: leads quentes em conversa (Perfil A) + clientes que já compraram (Perfil B).",
    fontes: [
      "View dedicada com score, temperatura, últimos contatos, pedidos e receita.",
    ],
    comoUsar: [
      "Ordenada por score — de cima para baixo é a ordem de ataque.",
      "Clique na linha para abrir o lead completo.",
    ],
  },
  "/dashboard/uploads": {
    titulo: "Uploads",
    oQueE: "Entrada de dados manuais: metas mensais dos vendedores e vendas CNB (XLSX).",
    fontes: [
      "Metas: grava na tabela de metas (desativa o período anterior e insere o novo).",
      "Vendas CNB: somam no realizado §5 dos vendedores — essencial para a meta fechar certo.",
    ],
    comoUsar: [
      "Sempre use “Pré-visualizar” antes de gravar.",
      "CNB: o arquivo aceita atualização (reenvio do mesmo período substitui, não duplica).",
    ],
  },
  "/dashboard/simulator": {
    titulo: "Simulador",
    oQueE: "Bancada de teste do SDR: converse com o bot como se fosse um lead, sem tocar produção.",
    fontes: [
      "As respostas vêm do mesmo cérebro de produção (Control Plane/RAG), com telefone fictício.",
    ],
    comoUsar: [
      "Escolha o perfil e a etapa da qualificação para testar cenários específicos.",
      "Nada aqui vira lead real nem dispara WhatsApp.",
    ],
  },
  "/dashboard/clientes": {
    titulo: "Clientes",
    oQueE: "A carteira real de clientes (quem já faturou no ARES): saúde, movimento do mês e visão completa.",
    fontes: [
      "Tudo vem do faturado real do ARES (pedidos faturados, sem cancelados/excluídos). CNB não entra aqui.",
      "Saúde: régua única por dias sem comprar — ativo ≤7 · atenção 8-14 · risco 15-21 · pré-churn 22-30 · churn 31-59 · inativo ≥60.",
      "Movimento de Carteira: comparação mês × mês anterior (quem entrou, quem deixou de faturar). No mês corrente, “deixou de faturar” encolhe até o fechamento.",
      "Novos clientes (eixo = 1º faturamento no mês, carteira ARES inteira): quebrado em CP (campanha — cliente com lead SDR de anúncio/ad_id) e ORG (orgânico — cliente sem lead OU lead sem anúncio + walk-in captado direto pelo vendedor). CP + ORG = total. ⚠️ é DIFERENTE do “Pedido fechado” do Funil de Vendas: lá o eixo é o mês de NASCIMENTO do lead (created_at), só EM ROTA e só quem virou lead no bot — por isso 19 novos clientes ≠ 11 do funil (os 10 walk-in + leads nascidos em meses anteriores entram só aqui).",
      "Recuperados: voltaram a comprar após 60+ dias parados.",
    ],
    comoUsar: [
      "Abas: Ativos (carteira viva) · Up-sell · Churn · Completa (todos, inclusive sem movimentação).",
      "Cards de status filtram a lista; clique no cliente para abrir o 360.",
      "CP baixo × ORG alto no card de Novos = a maioria dos clientes novos veio orgânica (indicação/boca-a-boca/prospecção do vendedor), não da mídia paga.",
    ],
  },
  "/dashboard/vendedores/mensal": {
    titulo: "Vendedores — Visão Mensal",
    oQueE: "Comparativo mês selecionado × mês anterior, por setor, para o líder comercial conduzir o feedback mensal com evidências — sem avaliações automáticas.",
    fontes: [
      "Meta × Faturado × % × dias batidos: RPC resumo_mes_vendedor_mes (regra oficial data_meta + CNB, a mesma de /dashboard/vendas).",
      "Clientes novos (1ª compra) e recompra (2ª+): fn_visao_geral_compras sobre a sequência de pedidos faturados do CRI (v_cri_pedidos_sequencia).",
      "Carteira ativa/churn: v_carteira_360 com a régua oficial fn_status_cliente — fotografia de AGORA (não retroage ao mês).",
      "Perdidos no mês: ai_sdr_leads.lost_at dentro do mês; parados: v_leads_parados (agora).",
    ],
    comoUsar: [
      "Selecione o mês no filtro — cada setor mostra o mês escolhido com o delta contra o mês anterior.",
      "Use na reunião mensal: meta batida? novos entrando? recompra crescendo? perdidos subindo? — os números são evidência, a leitura é do líder.",
      "Atenção às fotografias de agora (carteira/parados): elas não mudam com o filtro de mês.",
    ],
  },
  "/dashboard/churn": {
    titulo: "Churn — Carteira de Clientes",
    oQueE: "Os clientes da carteira real ARES que pararam de comprar, organizados pelas 4 faixas de risco da régua oficial (fn_status_cliente): risco 15–21 dias sem comprar · pré-churn 22–30 · churn comercial 31–59 · inativo definitivo 60+.",
    fontes: [
      "v_carteira_360 (carteira real ARES — clientes com pedido FATURADO, não leads SDR). customer_status vem da régua absoluta fn_status_cliente, a MESMA usada em Clientes, Carteira Ativa e alertas de jornada.",
      "Cards por faixa: contagem + receita histórica em risco + % da receita e % da carteira. O denominador dos % é a carteira TOTAL (todos os status) — filtrado junto quando há filtro de setor.",
      "Listas por faixa: os MESMOS registros que compõem os cards (uma única query) — o total do card sempre bate com a listagem.",
    ],
    comoUsar: [
      "Filtro por vendedor/setor no topo (?vendedor=): aplica em cards, listas e denominadores ao mesmo tempo.",
      "Maiores receitas no topo de cada faixa — priorize o resgate por valor, não por ordem alfabética.",
      "Clique num cliente (quando tem vínculo com lead) para abrir o dossiê em /dashboard/cliente.",
      "Régua dos 8/9 dias: a faixa \"ativo\" da régua oficial é ≤9 dias sem comprar — clientes ativos/atenção NÃO aparecem aqui (veja Carteira Ativa).",
    ],
  },
  "/dashboard/carteira-ativa": {
    titulo: "Carteira Ativa",
    oQueE: "A máquina de recompra: clientes saudáveis com compra recorrente (3+ pedidos), a cesta deles e a projeção contra a meta do dia.",
    fontes: [
      "Lista: clientes ativos/atenção com 3+ pedidos (universo de recompra — por isso o número é menor que o total de ativos em Clientes).",
      "Cesta 90d, Top 10 produtos e Mix por grupo: itens faturados reais (ARES).",
      "Recompra × Meta: soma dos tickets esperados até o próximo dia de meta.",
    ],
    comoUsar: [
      "Ordenada por dias sem compra — o topo é quem ligar primeiro.",
      "A cesta mostra o que o cliente costuma levar: use como roteiro da ligação.",
    ],
  },
  "/dashboard": {
    titulo: "Dashboard",
    oQueE: "A página inicial: pulso geral do mês — leads, qualificados, agendamentos, convertidos, alertas e onde focar agora.",
    fontes: [
      "KPIs e alertas: base de leads reais do mês (sem testes, sem fora de rota).",
      "Compras & Recorrência: (a) estado atual do funil — clientes em compra 1/2/3/4 e recorrentes 5+ (funnel_stage da Pipeline V3, promovido automaticamente pelo cascade ARES a cada 15min); (b) faturamento do período por Nº da compra do cliente (fn_visao_geral_compras sobre v_cri_pedidos_sequencia — 1ª compra = cliente novo, 2ª+ = recompra).",
      "Top 10 clientes do mês: pedidos FATURADOS no mês (ARES, régua conciliada com o financeiro), com redes consolidadas por grupo econômico (ex.: Grupo Alemão = 3 lojas numa entrada única, composição por unidade no detalhe) + barra de representatividade = Receita Top 10 ÷ faturamento do período.",
      "Motivos de perda: registros de leads perdidos.",
    ],
    comoUsar: [
      "“Atenção Agora” é a lista de incêndios — comece por ela.",
      "Cada KPI clica para a tela correspondente.",
      "Os filtros de mês e vendedor do topo valem também para Compras & Recorrência e Top 10 (o estado atual do funil ignora o mês — é snapshot).",
    ],
  },

  // ── WORKSPACE COMPRAS & ESTOQUE (lei Paulo 2026-07-10: toda tela tem manual) ──
  "/compras/resultados": {
    titulo: "Compras · Resultados",
    oQueE: "Compras × Faturamento do mês: quanto entrou, quanto foi comprado, se o gasto cabe no teto de 54% — e a projeção de fechamento. Tudo na janela dia 01 → hoje, atualiza a cada faturamento.",
    fontes: [
      "CARD 'Faturado MTD' = faturamento CONSOLIDADO ASB + CNB do período (desde 2026-07-30) — ARES (NF+Recibo, líquido de frete, exclui cancelado/excluído/deletado) somado às vendas CNB/Carnes Nobres Boutique (upload XLSX), por data de faturamento/lançamento, dia 01 → hoje. Não discrimina ASB de CNB na tela — mesma soma única do 'Total Faturado' em /dashboard/vendas. Atualiza sozinho conforme o dia fatura.",
      "CARD 'Compras MTD' = ENTRADA REAL de mercadoria (NF+Recibo que ENTROU no período, ARES compras_entradas), líquida de devolução, dia 01 → hoje. É o realizado — pedido só conta quando a mercadoria entra. Chip 'A chegar' = comprometido − já recebido (informativo).",
      "CARD '% Compras / Faturado' = Compras MTD ÷ Faturado MTD. Semáforo: 🟢 ≤54% · 🟡 54–65% · 🔴 >65% (teto 54% mantido). Amarelo aqui é a medição correta, não bug.",
      "PROJEÇÃO — 'Faturado Projetado' = ritmo dos dias úteis COMPLETOS (até ontem) × dias úteis do mês. 'Orçamento Compras (54%)' = 54% desse faturado (teto). 'Comprometido Até Hoje' = pedidos cuja ENTREGA cai NESTE mês (previsão/entrega real no mês), ≠cancelado, não-deletado — pedido lançado agora pra entregar mês que vem NÃO conta aqui, conta no mês da entrega. 'Disponível' = Orçamento − Comprometido. '% Comprometido' e 'Ritmo da Meta' = indicadores.",
      "TILES 'Ano 2026' = v_resultado_mensal, mesma régua ÚNICA (entrada real por data de entrada, líquida de devolução); batem com o card do topo.",
      "GRÁFICOS — 'Faturado real × meta diária' (realizado vs meta por dia) · 'Margem dia a dia' (% compras/faturado por dia, compras = entrada real) · 'Faturado por tipo' (NF × Recibo do MTD).",
      "CALENDÁRIO do mês = semáforo de margem por dia (compras = entrada real). Clique num dia abre 'Fornecedores do dia' = ENTRADA REAL (NF/Recibo entregue): reconcilia CENTAVO com a célula, NÃO lista pedido pendente/aprovado/cancelado/deletado. Detalhe por produto na entrada ainda não existe (só NF/Recibo por fornecedor).",
    ],
    comoUsar: [
      "Os 3 cards do topo (Faturado/Compras/%) e a projeção usam a MESMA janela (01 → hoje) e a mesma régua NF+Recibo — batem entre si e travam no fim do dia após o faturamento.",
      "'Disponível p/ comprar' é a bússola do PCP: verde = ainda cabe no teto; vermelho = comprometido (só entregas DESTE mês) já passou do orçamento do ritmo atual.",
      "A projeção oscila mais no início do mês (amostra pequena) e converge no fim — validado no backtest de junho (proj 879k × real 878k).",
      "Clique num dia do calendário para ver os fornecedores (por NF/Recibo entregue) e o % de margem daquele dia.",
    ],
  },
  "/compras/estoque": {
    titulo: "Compras · Estoque",
    oQueE: "Saldo atual por produto com cobertura em dias e semáforo de ruptura.",
    fontes: [
      "Saldo = Σ da movimentação ARES espelhada (modelo OPT-B, desde 30/05). A contagem física (âncora) é só auditoria — não é a base do saldo.",
      "CMD-30/dia = consumo médio (venda + consumo de produção), janela de 30 dias úteis — janela CURTA de propósito, para reagir rápido a ruptura.",
      "Cobertura (dias) = saldo ÷ CMD-30. Semáforo: vermelho <7d · amarelo ≤14d · verde.",
      "'SEM CMD' = matéria-prima sem saída capturada (transformação interna — limitação conhecida).",
    ],
    comoUsar: [
      "Ordene pela menor cobertura — o topo da lista é o risco de ruptura da semana.",
      "Produto fora da lista = sem movimentação capturada na janela do espelho (não significa saldo zero físico — confira no ARES).",
      "O CMD daqui (30d) é DIFERENTE do da Previsão (90d) — propósitos distintos, não compare os números.",
    ],
  },
  "/compras/previsao": {
    titulo: "Compras · Previsão",
    oQueE: "Lista de compra sugerida: o que repor, quanto, e de qual fornecedor — para o horizonte configurado.",
    fontes: [
      "A comprar = demanda do horizonte − saldo − carteira aberta (pedidos já feitos).",
      "CMD-90/dia = consumo médio em 90 dias corridos — janela LONGA de propósito, para planejamento estável (não compare com o CMD-30 do Estoque).",
      "'s/ âncora' = sem saldo calculado no espelho (assume 0) — confira antes de comprar.",
      "Fornecedor sugerido = o mais frequente no histórico daquele insumo.",
    ],
    comoUsar: [
      "'REPOR AGORA' (vermelho) = abaixo do ponto de reposição considerando lead time — prioridade da semana.",
      "As colunas de pico mostram se o consumo tem rajadas — insumo com pico alto merece margem extra.",
      "Config (horizonte/segurança/ciclo) ainda é editada via SQL nesta fase.",
    ],
  },
  "/compras/inventario": {
    titulo: "Compras · Inventário",
    oQueE: "Saúde da contagem física: quando cada produto foi contado pela última vez, cobertura por grupo e divergências grandes.",
    fontes: [
      "Última contagem = contagem física (upload de âncora) OU acerto de inventário no ARES (tipos 16/17).",
      "Divergência = contagem física × saldo calculado; >50 unidades marca 'divergência grande'.",
      "⚠️ A janela do espelho é de 90 dias — contagens mais antigas não aparecem, então 'dias desde contagem' pode SUBESTIMAR o tempo real.",
    ],
    comoUsar: [
      "'Precisam de contagem' lista os mais velhos/nunca contados — roteiro do próximo inventário.",
      "'Em revisão' = linhas ambíguas da transcrição do XLSX — resolver na aba Estoque.",
    ],
  },
  "/compras/custos": {
    titulo: "Compras · Custos de Produção",
    oQueE: "Custo de produção diário: kg produzido, custo total e custo/kg, com alertas por faixa, cartas de controle e projeção 12 meses.",
    fontes: [
      "Custo do dia = consumo de matéria-prima (ARES, movimentos tipo 4) + operacional (horas apontadas × custo-hora configurado).",
      "Kg do dia = soma das OPs encerradas no dia (ARES — em validação, DEBT-073).",
      "Faixas de custo/kg: IDEAL ≤18 · ATENÇÃO ≤19 · ALERTA ≤20 · CRÍTICO >20 (config na aba Alertas; estes são os padrões).",
      "Registro manual e Sync ARES convivem: dias marcados 'manual' NUNCA são sobrescritos pelo sync.",
      "Se o custo-hora estiver 0 (aguardando RH/financeiro), a composição colapsa toda em matéria-prima.",
    ],
    comoUsar: [
      "Faça um Backup antes de operações grandes (limpar mês, restore) — o backup guarda registros E insumos.",
      "Upload XLSX: use o Template gerado (aba Instruções tem os limites); se falhar no meio, o sistema desfaz o que gravou.",
      "Cartas I-MR (Shewhart): pontos fora do limite = dia atípico para investigar, não necessariamente erro.",
    ],
  },
  "/compras/mercado": {
    titulo: "Compras · Mercado",
    oQueE: "Inteligência de mercado de proteína: cotações CEPEA (boi/frango/suíno), sinal de compra por IA e notícias do setor — mais um chat para perguntar ao vivo.",
    fontes: [
      "Cotações e gráfico 90d: coleta diária automática às 06h (boi em R$/@; frango e suíno em R$/kg).",
      "Sinal COMPRAR/AGUARDAR/EVITAR e notícias: análise batch diária por IA — pode ter até 24h de defasagem.",
      "Chat: outra IA, com busca na web AO VIVO — resposta em tempo real pode divergir do sinal do card (que é de ontem). É esperado.",
    ],
    comoUsar: [
      "Use o sinal do card como tendência e o chat para a decisão do dia ('como está o boi gordo hoje?').",
      "Badge de pressão nas notícias é sob a ótica do COMPRADOR: pressão de alta = ruim para comprar.",
      "'ATUALIZADO' mostra a data da cotação mais recente do conjunto.",
    ],
  },

  // ── WORKSPACE MARKETING (mesma lei) ──
  "/marketing/overview": {
    titulo: "Marketing · Overview",
    oQueE: "Pulso do marketing: CAC do mês por canal, alertas e ranking de criativos.",
    fontes: [
      "CAC mensal por canal: gasto de mídia ÷ leads/clientes atribuídos (v_cac_mensal_canal — atribuição capturada na entrada do lead, origem_*).",
      "Alertas: v_marketing_alertas. Ranking de criativos: v_ranking_criativo (performance por anúncio).",
    ],
    comoUsar: [
      "CAC subindo com ranking de criativo caindo = hora de trocar criativo, não necessariamente verba.",
      "O gasto vem do ETL diário do Meta — divergência com o gerenciador de anúncios no MESMO dia é defasagem de sync.",
    ],
  },
  "/marketing/origem": {
    titulo: "Marketing · Origem",
    oQueE: "De onde vêm os leads e quanto custa cada canal (orgânico × pago × indicação).",
    fontes: [
      "Atribuição: origem_* capturada no PRIMEIRO contato do lead (fonte única — o SDR é o dono da atribuição).",
      "CAC por canal: v_cac_por_canal e v_cac_mensal_canal.",
    ],
    comoUsar: [
      "Compare o CAC entre canais no mesmo mês — canal caro sustentado pede revisão de criativo ou verba.",
      "Canais: instagram (ctwa) · google · site (lp) · organico · indicacao. Parte dos leads chega sem atribuição (DEBT-119) — o gasto deles aparece na tela Anúncios, bloco 'sem retorno'.",
      "Total desta tela é MENOR que o do Funil CAC de propósito (DEBT-347): o Funil inclui o bucket 'pré-captura (bridge)' (compra confirmada via ARES sem nenhuma atribuição) — aqui não entra, porque não dá pra calcular CAC de quem não tem canal.",
    ],
  },
  "/marketing/anuncios": {
    titulo: "Marketing · Anúncios",
    oQueE: "Performance por anúncio/criativo: gasto, leads e custo por lead de cada peça.",
    fontes: [
      "v_ranking_criativo (por anúncio) e v_performance_diaria (série diária) — leads casados ao anúncio pela atribuição de entrada.",
    ],
    comoUsar: [
      "Compare custo/lead entre criativos da MESMA campanha — orçamento migra para o vencedor.",
      "Criativo com muitos leads e poucos qualificados = atrai o público errado (ver funil-cac).",
    ],
  },
  "/marketing/verba": {
    titulo: "Marketing · Verba & Gasto",
    oQueE: "Controle mensal de verba de mídia paga por canal: verba definida × gasto real, saldo do mês e aporte a pedir no mês seguinte.",
    fontes: [
      "Verba: marketing_verba_mensal (definida manualmente nesta tela, por mês/canal).",
      "Gasto real: paid_media_daily (ETL Meta 06:10 BRT + Google 06:15 BRT). Cruzamento: v_verba_x_gasto_mensal.",
      "Régua do aporte: verba do mês − saldo positivo herdado do mês anterior (saldo que sobra abate o débito seguinte; saldo negativo não abate).",
    ],
    comoUsar: [
      "No início do mês, defina a verba de cada canal no formulário — o card 'Aporte' passa a mostrar exatamente quanto transferir.",
      "Saldo VERDE = sobrou verba (mídia sub-investida); VERMELHO = gastou além do definido.",
      "Compare a coluna Gasto com a fatura da plataforma/agência — divergência persistente = dinheiro repassado que não virou mídia (caso Cránium jan-jun/2026).",
    ],
  },
  "/marketing/atribuicao": {
    titulo: "Marketing · Atribuição",
    oQueE: "Atribuição completa de campanhas Meta/Google por campanha, conjunto e anúncio — gasto, funil (leads → qualificados → agendamentos → propostas → convertidos), receita e as réguas CPL/CPQL/CAC/ROAS/taxa. Mais o card de Orgânico Direto (captado pelo vendedor), o tratamento de gasto sem retorno e a classificação canal/jornada.",
    fontes: [
      "Por campanha/anúncio: v_cac_campanha_full / v_cac_anuncio_full (gasto de paid_media_daily; funil de ai_sdr_leads — qualificado=qual_stage≥7, agendamento=vendedor respondeu, proposta=funil≥proposta, convertido=1º pedido).",
      "Réguas: CPL=gasto÷leads · CPQL=gasto÷qualificados · CAC=gasto÷convertidos · ROAS=receita÷gasto (receita aprox. do lead, DEBT-256).",
      "Orgânico Direto (vendedor): v_organico_vendedor — cliente cujo 1º faturamento é do mês, SEM lead SDR (não veio pelo bot), que apareceu no inbound da instância WhatsApp do vendedor (vendor_messages) na janela [mês−3, fim do mês]. Régua 'virou cliente' = zero ruído, reconcilia com a carteira. NÃO escreve origem_* nem entra no funil do bot — superfície de leitura paralela (DEBT-329).",
      "Gasto sem retorno (2 baldes SEPARADOS): v_gasto_sem_retorno = anúncio com gasto e 0 lead; v_leads_nao_atribuidos = lead de canal pago sem ad_id. Nunca somar os dois.",
      "Canal/Jornada: v_lead_canal_jornada — channel (instagram (ctwa)/google/site (lp)/organico/indicacao/direto, mesma taxonomia de Origem dos Leads e Funil CAC) × journey (CTWA Direct / LP to WhatsApp / Direct). 'site (lp)' É canal próprio mesmo com origem paga — corrigido DEBT-349/350/351 (campanha Meta objetivo=trafego_site manda o clique pra LP antes do WhatsApp).",
    ],
    comoUsar: [
      "Ache o anúncio de ROAS < 1× (vermelho): gasta mais do que retorna — candidato a pausar ou revisar criativo.",
      "Card 'Orgânico Direto' = cliente novo que fechou sem passar pelo bot (indicação/boca-a-boca/prospecção do vendedor). Explica a diferença entre os convertidos pagos e os clientes novos da carteira — é receita que a mídia paga não captura.",
      "Bloco 'Anúncios com gasto e 0 lead' = dinheiro sem qualquer retorno; 'Leads sem anúncio identificado' = tem lead, mas faltou o código (tag na LP), não a campanha.",
      "CPQL alto com CPL baixo = atrai lead barato mas não qualifica; o vazamento está no meio do funil.",
    ],
  },
  "/marketing/funil-cac": {
    titulo: "Marketing · Funil & CAC",
    oQueE: "O funil por canal (lead → qualificado → agendamento → convertido) com gasto, CAC por lead e custo por conversão de cada canal. O seletor de período define a JANELA (coorte por mês de atribuição): 'Acumulado' soma tudo desde 02/06; '1 mês' mostra só o mês corrente e reconcilia com a Visão Geral e com o funil do Comercial.",
    fontes: [
      "Funil: v_funil_por_canal_mensal — coorte por mês de atribuição (bridge usa created_at); qualificado = qual_stage ≥ 7, agendamento = vendedor respondeu (seller_first_reply_at), convertido = 1º pedido. Gasto/CAC/conversão: v_cac_mensal_canal (mesma janela).",
      "INCLUI fora-de-rota (você pagou por eles) — o funil do Comercial é só EM ROTA, então no '1 mês' os convertidos batem, mas o Marketing mostra alguns leads a mais.",
    ],
    comoUsar: [
      "Escolha '1 mês' para comparar com o Comercial/Visão Geral; 'Acumulado' para o retrato de aquisição desde o início.",
      "Canal com CAC/lead baixo mas custo por conversão alto = funil vazando — veja em qual etapa ele perde.",
      "É o melhor lugar para decidir realocação de verba entre canais.",
    ],
  },
  "/marketing/calendario": {
    titulo: "Marketing · Calendário",
    oQueE: "Visão diária de gasto e leads — os dias fortes e fracos do mês, lado a lado.",
    fontes: [
      "v_performance_diaria (gasto e leads por dia, via ETL Meta + atribuição de entrada).",
    ],
    comoUsar: [
      "Dias com gasto e zero leads merecem investigação (criativo reprovado? link quebrado?).",
    ],
  },
};

// Resolve o manual pela rota atual (prefixo mais longo vence; "/dashboard" é fallback do grupo).
export function manualForPath(pathname: string): ManualTela | null {
  const keys = Object.keys(MANUAIS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (pathname === k || pathname.startsWith(k + "/") ) return MANUAIS[k];
    if (k !== "/dashboard" && pathname.startsWith(k)) return MANUAIS[k];
  }
  if (pathname.startsWith("/dashboard")) return MANUAIS["/dashboard"];
  return null;
}
