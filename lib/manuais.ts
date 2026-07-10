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
      "Conversão por marcos: função no banco (criados → qualificados → handoff → assumidos → pedidos) do mês/vendedor filtrado.",
      "Camada Cliente e Recuperados: carteira real do ARES (v_carteira_360) — mesma base das telas Clientes/Carteira.",
      "Convertido = fechou pedido OU faturou no ARES (mesmo sem o vendedor arrastar o card).",
    ],
    comoUsar: [
      "Clique nos marcos ou nos cards da Camada Cliente para abrir a lista correspondente.",
      "“Leads Parados por Etapa” lista os 10 mais antigos de cada etapa não-terminal — bom ponto de partida do dia.",
      "A contagem global tem cache de 5 minutos — pode atrasar levemente vs a tela de Leads.",
    ],
  },
  "/dashboard/pipeline": {
    titulo: "Pipeline",
    oQueE: "O quadro Kanban do vendedor pós-handoff: arraste o lead pelas colunas conforme a negociação avança. Termina na conversão (1ª compra).",
    fontes: [
      "Cards: leads reais com etapa de pipeline (handoff → em andamento → negociação → proposta → pedido teste → convertido/perdido).",
      "Selo ✓ ARES: o lead já faturou na carteira real (v_carteira_360).",
      "Valor estimado: volume semanal (kg) × R$/kg médio definido pela gestão.",
    ],
    comoUsar: [
      "Arrastar um card grava a transição no banco (com motivo, quando perdido; valor, quando proposta).",
      "Vendedor move só os próprios leads; gestor move todos.",
      "“Parados >7d” = sem transição há mais de 7 dias — priorize-os.",
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
      "Órfãos de atendimento: leads com handoff sem resposta do vendedor — clique para abrir.",
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
  "/dashboard/leads": {
    titulo: "Leads",
    oQueE: "Todos os leads do SDR: ativos, perdidos (últimos 180 dias) e fora de rota — com score, origem e etapa.",
    fontes: [
      "Tabela: leads reais (sem testes); score/tier da view de score (volume, segmento, etapa, temperatura).",
      "Perdidos: motivo de perda registrado; “pipeline perdido” = volume × R$/kg médio.",
      "Fora de rota: municípios fora da cobertura atual (contato salvo para expansão).",
    ],
    comoUsar: [
      "Clique no lead para abrir o detalhe completo (conversa, timeline, ações).",
      "“Reabordar” nos perdidos abre o WhatsApp direto com o lead.",
      "Filtros combinam: busca + status + vendedor + ABC + produto + origem.",
    ],
  },
  "/dashboard/handoffs": {
    titulo: "Handoffs",
    oQueE: "Fila de leads qualificados pelo SDR aguardando o vendedor assumir — o ponto mais sensível da esteira.",
    fontes: [
      "Lista: leads com handoff feito e ainda não confirmado pelo vendedor (tempo real).",
      "Críticos: esperando há mais de 4 horas.",
      "Agendados Hoje: lead marcou horário com o especialista para hoje.",
    ],
    comoUsar: [
      "Ordem = mais antigo primeiro; zere os críticos antes de tudo.",
      "“Confirmar” marca que o vendedor assumiu (para o relógio do SLA).",
      "Volume ≥300kg é conta CUIT — atenção redobrada.",
    ],
  },
  "/dashboard/followups": {
    titulo: "Follow-ups",
    oQueE: "Histórico e saúde da régua de follow-up automático do SDR: o que foi enviado, quem respondeu e o que está represado.",
    fontes: [
      "Tabela/KPIs: histórico de envios do motor (fase, ângulo, resposta, conversão).",
      "“Vencidos”/“Sem data”: leads elegíveis com follow-up atrasado ou sem agendamento.",
    ],
    comoUsar: [
      "Taxa de resposta por ângulo mostra qual abordagem funciona — o Ângulo Top é o campeão.",
      "Clique nos KPIs para filtrar a lista.",
      "Parte dos “vencidos” pode estar com atendimento humano ativo (o motor não dispara nesses) — em revisão.",
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
      "Tudo vem dos leads (CRM): handoffs recebidos, % respondido, tempo médio de 1ª resposta, convertidos (1ª compra), win rate.",
      "Pipeline (R$): volume dos leads em aberto × R$/kg médio.",
    ],
    comoUsar: [
      "Win rate = convertidos ÷ handoffs — compare vendedores no mesmo período.",
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
    oQueE: "A página inicial: pulso geral do mês — leads, qualificados, handoffs, convertidos, alertas e onde focar agora.",
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
