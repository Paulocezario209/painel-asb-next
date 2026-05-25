// app/compras/page.tsx — raiz do store Compras redireciona para a 1ª aba
import { redirect } from "next/navigation";

export default function ComprasIndex() {
  redirect("/compras/resultados");
}
