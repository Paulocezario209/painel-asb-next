export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default function FunilCacPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Funil CAC
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>CAC e ROAS por campanha</p>
      </div>
      <div style={{ background: "#1a1a1a", border: "1px dashed #C8102E", borderRadius: 8, padding: 40, textAlign: "center" }}>
        <p style={{ color: "#C8102E", fontSize: 12, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Em construção — F3
        </p>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono, marginTop: 8 }}>
          CAC/ROAS por campanha (gasto ÷ convertidos por canal; funil clique→lead→cliente).
        </p>
      </div>
    </div>
  );
}
