// lib/fichas.ts — Funil v3 Onda 3: ficha de cadastro PF/PJ enviada ao lead na etapa
// "Cadastro do Cliente". FONTE ÚNICA do texto — o mesmo string alimenta o preview (modal)
// e o envio (CP → Evolution do vendedor). Não duplicar em outro lugar.
//
// Onda 4b: ficha de ORÇAMENTO enviada na etapa "Em Negociação" — mesma disciplina
// (esta função é a FONTE ÚNICA do texto do orçamento: preview + envio).

export type FichaLead = {
  restaurant_name?: string | null;
  city?: string | null;
};

// Modelo canônico (Paulo). Um formulário só, com seletor PF/PJ na primeira linha.
// Pré-preenche o que o painel já sabe (Nome Fantasia ← restaurant_name; Cidade ← city).
export function fichaCadastro(lead: FichaLead): string {
  const fantasia = (lead.restaurant_name || "").trim();
  const cidade = (lead.city || "").trim();
  return [
    "📋 *Cadastro American Steak*",
    "",
    "Pra liberar seu primeiro pedido, preciso de alguns dados. É rápido — pode responder aqui mesmo:",
    "",
    "*Tipo de cadastro:*  ( ) Pessoa Física   ( ) Pessoa Jurídica",
    "🍔🌭🥩 *Segmento:*",
    "🥩 *Receita do blend do cliente:*",
    "",
    "━━━━━━━━ 👤 *DADOS*",
    "Nome / Razão Social:",
    `Nome Fantasia: ${fantasia}`,
    "CPF / CNPJ:",
    "Inscrição Estadual (ou isento):",
    "Data de nascimento (se PF):",
    "",
    "━━━━━━━━ 📞 *CONTATO*",
    "Telefone (comprador):",
    "Telefone (financeiro):",
    "E-mail:",
    "",
    "━━━━━━━━ 📍 *ENDEREÇO*",
    "Rua:",
    "Número:      Complemento:",
    "Bairro:",
    `Cidade: ${cidade}      Estado:      CEP:`,
    "",
    "━━━━━━━━ 🚚 *ENTREGA*",
    "Endereço de entrega é o mesmo?  ( ) Sim   ( ) Não",
    "Se diferente, me manda o endereço de entrega.",
    "",
    "Qualquer dúvida é só chamar. 🙌",
  ].join("\n");
}

// ── Ficha de Orçamento (Em Negociação) ───────────────────────────────────────
// Um item por produto. Gramatura vem do nome (número final, 100–220 g); unidades/caixa
// e preço são MANUAIS (o ARES não guarda esses campos estruturados). Peso total é
// derivado = unidades × gramatura. Preço nunca sai do ARES.

export type OrcamentoItem = {
  nome: string;                       // nome de exibição (ex.: "Smash Fraldinha Angus")
  gramatura_g?: number | null;        // gramatura em g (do nome) — opcional
  unidades_caixa?: number | null;     // unidades por caixa (manual)
  peso_kg?: number | null;            // se ausente e houver gramatura+unidades, é calculado
  valor_unitario?: number | null;     // R$ (manual)
  valor_caixa?: number | null;        // R$ (manual)
};

// Número BR: milhar com ".", decimal com "," — sem depender de ICU/locale (padrão do projeto).
function numBR(n: number, casas: number): string {
  const [i, d = ""] = Math.abs(n).toFixed(casas).split(".");
  const ig = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const sinal = n < 0 ? "-" : "";
  return casas > 0 ? `${sinal}${ig},${d}` : `${sinal}${ig}`;
}
function moedaBR(n: number | null | undefined): string {
  return n == null || isNaN(n) ? "—" : `R$ ${numBR(n, 2)}`;
}

// Peso total (kg) de um item: usa peso_kg se dado; senão unidades × gramatura ÷ 1000.
export function pesoTotalKg(it: OrcamentoItem): number | null {
  if (it.peso_kg != null && !isNaN(it.peso_kg)) return it.peso_kg;
  if (it.gramatura_g != null && it.unidades_caixa != null)
    return (it.gramatura_g * it.unidades_caixa) / 1000;
  return null;
}

function blocoOrcamento(it: OrcamentoItem): string {
  const g = it.gramatura_g != null ? ` ${numBR(it.gramatura_g, 0)} g` : "";
  const peso = pesoTotalKg(it);
  const linhas = [
    `📋 *ORÇAMENTO – ${(it.nome || "").toUpperCase().trim()}${g}*`,
    "",
    `🍔 ${(it.nome || "").trim()}${g}`,
    "",
    it.unidades_caixa != null ? `• Caixa com ${numBR(it.unidades_caixa, 0)} unidades` : "• Caixa:",
    peso != null ? `• Peso total: ${numBR(peso, 2)} kg` : "• Peso total:",
    "",
    `👉 Valor unitário: ${moedaBR(it.valor_unitario)}`,
    `👉 Valor da caixa: ${moedaBR(it.valor_caixa)}`,
  ];
  return linhas.join("\n");
}

// Texto final do orçamento — um bloco por produto, separados por linha em branco.
export function fichaOrcamento(itens: OrcamentoItem[]): string {
  return (itens || []).map(blocoOrcamento).join("\n\n");
}
