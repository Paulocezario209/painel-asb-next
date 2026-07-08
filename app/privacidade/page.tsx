// Política de Privacidade — página PÚBLICA (exceção no proxy.ts).
// Origem do conteúdo: monorepo docs/legal/privacy.html (GATE-2 LGPD / CAPI).
// Alterações de texto: editar lá E aqui (manter espelhado).
export const metadata = {
  title: "Política de Privacidade — American Steak Brasil",
  robots: "index, follow",
};

export default function PrivacidadePage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 20px",
        lineHeight: 1.65,
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        color: "#e8e8e8",
      }}
    >
      <h1 style={{ fontSize: "1.6rem", borderBottom: "2px solid #185FA5", paddingBottom: 8 }}>
        Política de Privacidade — American Steak Brasil
      </h1>
      <p style={{ color: "#999", fontSize: ".9rem" }}>
        Versão 1.0 · Vigência: 2026-07-08 · Controladora: American Steak Ltda., CNPJ 17.016.832/0001-07
      </p>

      <H2>1. Quem somos</H2>
      <p>
        A American Steak Brasil (&quot;ASB&quot;) é uma indústria de alimentos certificada (SISP registro 1896,
        Selo Agro Artesanal) especializada em hambúrgueres e blends para food service (B2B). Esta política
        descreve como tratamos dados pessoais de leads e clientes que interagem com nossos canais comerciais,
        em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
      </p>

      <H2>2. Dados que coletamos</H2>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: ".92rem" }}>
        <thead>
          <tr>
            <Th>Dado</Th>
            <Th>Origem</Th>
            <Th>Finalidade</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>Número de WhatsApp e nome de exibição</Td>
            <Td>Você, ao iniciar conversa em nosso WhatsApp comercial</Td>
            <Td>Atendimento comercial, qualificação e continuidade da conversa</Td>
          </tr>
          <tr>
            <Td>Informações comerciais (nome do estabelecimento, cidade, tipo de negócio, volume estimado)</Td>
            <Td>Você, durante a conversa</Td>
            <Td>Direcionar o consultor correto e preparar proposta adequada</Td>
          </tr>
          <tr>
            <Td>Dados de origem da visita (campanha, anúncio, canal)</Td>
            <Td>Parâmetros técnicos do clique (ex.: identificador do anúncio)</Td>
            <Td>Medir eficiência de mídia e melhorar o atendimento</Td>
          </tr>
          <tr>
            <Td>Dados de pedidos e faturamento</Td>
            <Td>Nosso sistema de gestão, quando você se torna cliente</Td>
            <Td>Execução de contrato, entrega e pós-venda</Td>
          </tr>
        </tbody>
      </table>

      <H2>3. Compartilhamento com plataformas de mídia (medição de conversão)</H2>
      <p>
        Para medir a eficácia de nossos anúncios, podemos informar às plataformas Meta (Facebook/Instagram) e
        Google que uma conversão comercial ocorreu, por meio de suas APIs de conversão.{" "}
        <strong>
          Nesses envios, o seu número de telefone é transformado de forma irreversível (hash criptográfico
          SHA-256) antes de sair dos nossos sistemas
        </strong>{" "}
        — a plataforma recebe apenas o código embaralhado, usado exclusivamente para correspondência
        estatística com contas já existentes na própria plataforma, junto do valor e da data da conversão. Não
        vendemos dados pessoais e não compartilhamos o conteúdo das suas conversas.
      </p>

      <H2>4. Bases legais</H2>
      <p>
        Tratamos dados com base em: <strong>execução de contrato e procedimentos preliminares</strong> (art.
        7º, V — atendimento e proposta comercial solicitados por você); <strong>legítimo interesse</strong>{" "}
        (art. 7º, IX — medição de mídia com dado pseudonimizado por hash, mínima intrusão, sem decisões
        automatizadas que produzam efeitos jurídicos sobre você); e <strong>consentimento</strong>, quando
        aplicável.
      </p>

      <H2>5. Retenção e segurança</H2>
      <p>
        Dados de leads são mantidos enquanto durar o relacionamento comercial ou a expectativa razoável de
        contato; dados de clientes, pelos prazos legais fiscais e contratuais. Adotamos controle de acesso por
        credenciais, criptografia em trânsito e pseudonimização (hash) em envios a terceiros.
      </p>

      <H2>6. Seus direitos (art. 18, LGPD)</H2>
      <p>
        Você pode solicitar a qualquer momento: confirmação de tratamento, acesso, correção, anonimização,
        portabilidade, informação sobre compartilhamentos, revisão e <strong>eliminação</strong> dos seus
        dados, além de se opor ao envio de conversões pseudonimizadas às plataformas de mídia (opt-out). Basta
        pedir na própria conversa de WhatsApp (&quot;quero excluir meus dados&quot;) ou pelo contato abaixo.
      </p>

      <H2>7. Contato do encarregado (DPO)</H2>
      <p>
        American Steak Brasil — Encarregado de Dados
        <br />
        E-mail: <a href="mailto:paulorcezario01@gmail.com" style={{ color: "#4a90d9" }}>paulorcezario01@gmail.com</a>
      </p>

      <H2>8. Alterações</H2>
      <p>
        Esta política pode ser atualizada; a versão vigente estará sempre nesta página, com data de vigência
        no topo.
      </p>
    </main>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: "1.15rem", marginTop: "2rem", color: "#4a90d9" }}>{children}</h2>;
}
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ border: "1px solid #333", padding: 8, textAlign: "left", background: "#1e2430" }}>
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ border: "1px solid #333", padding: 8, verticalAlign: "top" }}>{children}</td>;
}
