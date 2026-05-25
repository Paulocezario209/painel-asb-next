// app/compras/resultados/page.tsx
export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default function ResultadosPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Resultados · Compras × Faturamento
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>
          Real do dia + previsão (compras lançadas/pendentes vs faturamento por meta dos vendedores) e % de margem.
        </p>
      </div>
      <FaseZeroPlaceholder />
    </div>
  );
}

function FaseZeroPlaceholder() {
  return (
    <div style={{ border: "1px dashed #2ea043", borderRadius: 6, padding: 32, textAlign: "center", background: "rgba(46,160,67,.04)" }}>
      <p style={{ color: "#2ea043", fontSize: 12, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700 }}>
        Aguardando Fase 0
      </p>
      <p style={{ color: "#556677", fontSize: 11, fontFamily: mono, marginTop: 8 }}>
        Dados reais entram após as tabelas-espelho + sync ARES serem aprovados e construídos.
      </p>
    </div>
  );
}
