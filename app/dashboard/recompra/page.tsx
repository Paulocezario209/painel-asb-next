import { permanentRedirect } from "next/navigation";

// Recompra foi promovida à camada própria "Carteira Ativa" (Fase 0).
// Mantém a URL antiga viva via redirect permanente (308).
export default function RecompraRedirect() {
  permanentRedirect("/dashboard/carteira-ativa");
}
