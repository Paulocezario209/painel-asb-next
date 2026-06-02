export const dynamic = "force-dynamic";

const mono = "'Courier New', monospace";

export default function AnunciosPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 4 }}>
          Anúncios
        </h1>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono }}>Custo por anúncio · Meta Ads</p>
      </div>
      <div style={{ background: "#1a1a1a", border: "1px dashed #C8102E", borderRadius: 8, padding: 40, textAlign: "center" }}>
        <p style={{ color: "#C8102E", fontSize: 12, fontWeight: 700, fontFamily: mono, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Em construção — F1
        </p>
        <p style={{ color: "#8899aa", fontSize: 11, fontFamily: mono, marginTop: 8 }}>
          Custo por anúncio (gasto Meta Ads cruzado por ctwa_clid/ad_id). Numerador do CAC.
        </p>
      </div>
    </div>
  );
}
