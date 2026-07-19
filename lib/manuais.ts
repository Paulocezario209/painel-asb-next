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
  "/dashboard/funil": {
    titulo: "Funil",
    oQueE: "A jornada completa do lead: da chegada no SDR até virar cliente (1ª compra). Mostra onde cada lead está AGORA e a conversão da coorte do mês.",
    fontes: [
      "Cone de 4 fases e KPIs: etapas (funnel_stage) de todos os leads reais (sem testes, sem fora de rota).",
      "Conversão por marcos: função no banco (criados → qualificados → agendamento → assumidos → pedidos) do mês/vendedor filtrado.",
      "Camada Cliente e Recuperados: carteira real do ARES (v_carteira_360) — mesma base das telas Clientes/Carteira.",
      "Convertido = fechou pedido OU faturou no ARES (mesmo sem o vendedor arrastar o card).",
    ],
    comoUsar: [
      "Clique numa linha da Conversão da Coorte para abrir SÓ os leads daquele marco (mesmo mês/vendedor do filtro) — a tela de Leads mostra a tarja verde COORTE com o recorte ativo e o link 'limpar filtro'.",
      "“Leads por Etapa”: um card por etapa não-terminal (posição atual) — clique para abrir a lista completa daquela etapa na tela de Leads (tarja ETAPA + 'limpar filtro'). O número do card bate com a lista.",
      "A contagem global tem cache de 5 minutos — pode atrasar levemente vs a tela de Leads.",
    ],
  },
  "/dashboard/cadencias": {
    titulo: "Central de Orquestração de Cadências",
    oQueE: "O centro de comando das cadências em 5 seções (00 três visões · 01 Mapa · 02 Fila · 03 Dossiê · 04 Contrato de dados · 05 Plano por fases): onde cada lead está AGORA, em qual degrau (CURTA até 30d / LONGA nutrição), e — já com o motor F3 — qual é a PRÓXIMA AÇÃO e o próximo ângulo de cada lead, sem repetir os já usados.",
    fontes: [
      "Linha de saúde (topo): v_cadencia_saude — em cadência, curta, longa, sem cadência, em revisão, toques 24h, atrasados. Verde enquanto “sem cadência” = 0 (invariante CADÊNCIA SEM EXCEÇÃO).",
      "01 Mapa — cards por estado: v_orquestracao_mapa (total/atrasados/hoje por journey_state, derivado de v_orquestracao_leads). A borda-topo do card mostra a SITUAÇÃO operacional (verde no prazo · âmbar hoje · vermelho atrasado · roxo precisa humano · teal negociação · cinza pausado), não o estágio. Não lista testes nem fora-de-rota.",
      "01 Mapa — “pergunta que quebra”: qual_stage dos leads em qualificação interrompida. Longa por TEMPO: buckets de degrau (D+30/60/90/180/360 + recorrência) de v_cadencia_lead. Longa por MOTIVO: v_motivos_perda.",
      "02 Fila — silêncio, degrau, cadência (CURTA/LONGA) por lead: v_cadencia_lead. Coluna “Próxima ação” = proxima_acao REAL do motor F3 (v_lead_proxima_acao). Chips filtram (atrasado/hoje/precisa humano/negociação).",
      "03 Dossiê — cabeçalho + timeline (conversas_sdr + vendor_messages + funnel_stage_events) do lead selecionado. “Próxima melhor ação” = proxima_acao + proximo_angulo + “não repetir: {angulos_usados}” (v_lead_proxima_acao).",
      "03 Dossiê — “Contexto extraído”: análise da IA lida de v_orquestracao_leads (contexto_resumo + chips objeção/produto/gramatura/recompra + data da análise). Enquanto a IA não analisou o lead (contexto_extraido_em nulo), mostra “Ainda não analisado pela IA”.",
    ],
    comoUsar: [
      "Escopo por quem está logado: o gestor (e manager) vê TODOS os setores e pode filtrar pelo seletor no topo (Todos · Ana Paula/Sorocaba-SP · Alan/Campinas-Jundiaí · CUIT · Sem time). O vendedor vê SÓ o próprio setor — sem seletor, e não abre lead de outro setor (o filtro é travado no servidor).",
      "Filtro por setor (gestor) vale pro Mapa E pra Fila ao mesmo tempo. A lupa busca por empresa, nome, cidade ou telefone — clicar num resultado abre o Dossiê do lead direto, sem passar pelo Mapa.",
      "Saúde verde = cadência saudável. Se “sem cadência” subir de 0, há vazamento — vá à Fila e investigue.",
      "Clique num card de estado (01) para filtrar a Fila (02) por aquele estado; clique num lead da Fila para carregar o Dossiê (03) com a próxima melhor ação. “abrir dossiê completo” leva ao cadastro do lead.",
      "Cor do ponto/da borda = situação operacional (verde no prazo · âmbar hoje · vermelho atrasado · roxo precisa humano · teal negociação · cinza pausado).",
      "Verde no Contrato (04) = já existe e a tela consome; roxo/âmbar = Fase 2 (ainda sem dado). O Plano (05) mostra F1 no ar · F2 schema · F3 motor de cadência já no ar.",
    ],
  },
  "/dashboard/pipeline": {
    titulo: "Pipeline",
    oQueE: "O quadro Kanban do vendedor pós-handoff: arraste o lead pelas colunas conforme a negociação avança. Termina na conversão (1ª compra).",
    fontes: [
      "Cards: leads reais com etapa de pipeline (agendamento → em andamento → negociação → proposta → cadastro do cliente → convertido/perdido).",
      "Cadastro do Cliente: etapa PRÉ-pedido — o lead topou a proposta e vai fazer o 1º pedido; aqui o vendedor coleta a documentação padrão ASB (CNPJ ou CPF). NÃO é a conversão: a conversão vem sozinha do ARES quando o 1º pedido é faturado (o card ganha o selo ✓ ARES e vai pra Convertido).",
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
    oQueE: "Acompanhamento de meta × realizado do mês, por vendedor e no total, com calendário de metas diárias.",
    fontes: [
      "Meta Total: metas mensais cadastradas (upload de metas) — metas medem a operação ASB.",
      "Total Faturado (§5) = realizado OFICIAL: faturado ARES por dia de faturamento + vendas CNB dos vendedores (XLSX) — é a régua que fecha meta e semana.",
      "Faturado ASB e Faturado CNB: decomposição do próprio §5 (a soma SEMPRE fecha com o total).",
      "“Prévia ciclo/emissão”: tempo real por emissão — informativa, NÃO é a régua oficial.",
      "Regra §9: sábado fecha na semana que termina; a última meta da semana pode ser combinada (ex.: QUI+SEX).",
    ],
    comoUsar: [
      "Clique num dia do calendário para ver os pedidos (ARES + CNB) e ausentes daquele dia.",
      "O ✓/✗ do dia considera o fold da semana (regra do fechamento), não o dia isolado.",
      "% Atingido usa o §5 oficial — número diferente do fiscal do /gerente é esperado (réguas distintas).",
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
    ],
    comoUsar: [
      "Prioridades do Dia ordena o pior primeiro — é a lista de cobrança da manhã.",
      "Projeção = ritmo atual (run-rate §5) projetado até o fim do mês.",
      "Órfãos de atendimento: leads com agendamento sem resposta do vendedor — clique para abrir.",
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
      "“Aguardando resposta” é a fila de cobrança: lead esperando o vendedor falar.",
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
      "Recuperados: voltaram a comprar após 60+ dias parados.",
    ],
    comoUsar: [
      "Abas: Ativos (carteira viva) · Up-sell · Churn · Completa (todos, inclusive sem movimentação).",
      "Cards de status filtram a lista; clique no cliente para abrir o 360.",
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
      "Top 10 clientes do mês: faturado real ARES.",
      "Motivos de perda: registros de leads perdidos.",
    ],
    comoUsar: [
      "“Atenção Agora” é a lista de incêndios — comece por ela.",
      "Cada KPI clica para a tela correspondente.",
    ],
  },

  // ── WORKSPACE COMPRAS & ESTOQUE (lei Paulo 2026-07-10: toda tela tem manual) ──
  "/compras/resultados": {
    titulo: "Compras · Resultados",
    oQueE: "Compras × Faturamento do mês: quanto entrou, quanto foi comprado, se o gasto cabe no teto de 54% — e a projeção de fechamento.",
    fontes: [
      "Faturado MTD: faturado por EMISSÃO (data de faturamento). Compara com as compras pela ENTRADA de mercadoria (data de entrada) — bases próximas, não idênticas.",
      "Compras MTD (headline e % do semáforo) = ENTRADA REAL de mercadoria (NF+Recibo que entrou no período, ARES compras_entradas), líquida de devolução. Substitui a régua antiga 'pedido entregue' (que subcontava o mês corrente — pedido pode receber sem virar 'entregue'). 'A chegar'/comprometido vive só na projeção, não no realizado.",
      "Semáforo % Compras/Faturado: 🟢 ≤54% · 🟡 54–65% · 🔴 >65% (teto mantido; o painel fica mais amarelo porque a medição ficou correta — não é bug).",
      "PROJEÇÃO (regra 10/07): Faturado proj = ritmo dos dias úteis COMPLETOS (até ontem) × dias úteis do mês; Compras proj = 54% desse faturado (ORÇAMENTO). Pedidos realizados NÃO projetam nada — PCP lança o mês de uma vez e criaria falso ritmo. 'Disponível' = orçamento − comprometido.",
      "Cards do ano: v_resultado_mensal — mesma régua ÚNICA (entrada real por data de entrada, líquida de devolução); batem com o card do topo. Drilldown do dia (fornecedores/produtos) segue por PEDIDO de compra.",
    ],
    comoUsar: [
      "O 'Disponível p/ comprar' é a bússola do PCP: verde = ainda cabe; vermelho = comprometido já estourou o orçamento do ritmo atual.",
      "A projeção oscila mais no início do mês (amostra pequena) e converge no fim — comportamento validado no backtest de junho (proj 879k × real 878k).",
      "Clique num dia do calendário para ver os pedidos de compra e o % de margem daquele dia.",
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
  "/marketing/funil-cac": {
    titulo: "Marketing · Funil & CAC",
    oQueE: "O funil por canal (lead → qualificado → agendamento → convertido) com gasto, CAC por lead e custo por conversão de cada canal.",
    fontes: [
      "Funil: v_funil_por_canal — qualificado = escada completa (qual_stage ≥ 7), agendamento = vendedor respondeu, convertido = 1º pedido.",
      "Gasto/CAC/Custo por conversão: v_cac_por_canal. Conversão mensal: v_cac_mensal_canal.",
    ],
    comoUsar: [
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
