// lib/fichas.ts — Funil v3 Onda 3: ficha de cadastro PF/PJ enviada ao lead na etapa
// "Cadastro do Cliente". FONTE ÚNICA do texto — o mesmo string alimenta o preview (modal)
// e o envio (CP → Evolution do vendedor). Não duplicar em outro lugar.

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
