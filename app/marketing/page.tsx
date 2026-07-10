import { redirect } from "next/navigation";

export default function MarketingIndex() {
  // Overview é a 1ª aba da sidebar — entrypoint alinhado (auditoria 2026-07-10).
  redirect("/marketing/overview");
}
