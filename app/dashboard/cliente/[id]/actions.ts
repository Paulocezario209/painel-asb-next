"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/auth/get-user-role";

type Result = { ok: boolean; err?: string; data?: unknown };

async function getActor(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ? `painel:${user.email}` : "painel";
}

// Server actions NAO passam pelo middleware -> guard de escrita aqui (financeiro = somente leitura)
async function assertNotReadOnly(): Promise<void> {
  const ctx = await getUserContext();
  if (ctx?.isFinanceiro) throw new Error("forbidden: conta somente leitura (financeiro)");
}

// markClienteAtivoAction/markClienteRecorrenteAction REMOVIDAS (Passo 10 Pipeline V3,
// Paulo 2026-08-06): pedido_1..4/cliente_recorrente são 100% automáticos via ARES
// (recompute_customer_stage, Passo 4) — nenhum botão do painel move manualmente pra lá.
// RPCs mark_cliente_ativo/mark_cliente_recorrente ficam órfãs no banco (DEBT, ver
// docs/DEBT_LOG.md do monorepo) — nenhum outro caller confirmado nesta sessão.

export async function setCustomerHealthAction(
  leadId: string,
  newHealth: string,
  reason?: string
): Promise<Result> {
  try {
    await assertNotReadOnly();
    const supabase = await createClient();
    const actor = await getActor();
    const { data, error } = await supabase.rpc("set_customer_health", {
      p_lead_id: leadId,
      p_new_health: newHealth,
      p_reason: reason ?? null,
      p_actor: actor,
    });
    if (error) throw error;
    revalidatePath(`/dashboard/cliente/${leadId}`);
    revalidatePath("/dashboard/clientes");
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, err: msg };
  }
}

export async function markCustomerLostAction(
  leadId: string,
  reason: string
): Promise<Result> {
  try {
    await assertNotReadOnly();
    if (!reason || reason.trim().length < 2) {
      return { ok: false, err: "Motivo obrigatório" };
    }
    const supabase = await createClient();
    const actor = await getActor();
    const { data, error } = await supabase.rpc("mark_customer_lost", {
      p_lead_id: leadId,
      p_reason: reason,
      p_actor: actor,
    });
    if (error) throw error;
    revalidatePath(`/dashboard/cliente/${leadId}`);
    revalidatePath("/dashboard/clientes");
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, err: msg };
  }
}

export async function reassignCustomerVendorAction(
  leadId: string,
  newOwnerSellerId: string,
  motivo: string
): Promise<Result> {
  try {
    await assertNotReadOnly();
    if (!motivo || motivo.trim().length < 2) {
      return { ok: false, err: "Motivo obrigatório" };
    }
    const supabase = await createClient();
    const actor = await getActor();
    const { data, error } = await supabase.rpc("reassign_customer_vendor", {
      p_lead_id: leadId,
      p_new_owner_seller_id: newOwnerSellerId,
      p_motivo: motivo,
      p_actor: actor,
    });
    if (error) throw error;
    revalidatePath(`/dashboard/cliente/${leadId}`);
    revalidatePath("/dashboard/clientes");
    return { ok: true, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, err: msg };
  }
}
