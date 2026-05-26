// app/compras/custos/page.tsx — Fase 5.2: dashboard de custo de produção (porting do protótipo React → Supabase).
// Client Component (estado/abas/modais). Dados via /api/compras/custos/* sobre custos_registro_diario.
// Convive com Fase 5.1 (template + upload XLSX + views v_custos_producao_*) — intocada.
import { DashboardCustos } from "./components/dashboard-custos";

export const dynamic = "force-dynamic";

export default function CustosPage() {
  return <DashboardCustos />;
}
