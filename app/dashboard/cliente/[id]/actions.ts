"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type Result = { ok: boolean; err?: string; data?: unknown };

async function getActor(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ? `painel:${user.email}` : "painel";
}

export async function markClienteAtivoAction(leadId: string): Promise<Result> {
  try {
    const supabase = await createClient();
    const actor = await getActor();
    const { data, error } = await supabase.rpc("mark_cliente_ativo", {
      p_lead_id: leadId,
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

export async function markClienteRecorrenteAction(leadId: string): Promise<Result> {
  try {
    const supabase = await createClient();
    const actor = await getActor();
    const { data, error } = await supabase.rpc("mark_cliente_recorrente", {
      p_lead_id: leadId,
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

export async function setCustomerHealthAction(
  leadId: string,
  newHealth: string,
  reason?: string
): Promise<Result> {
  try {
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
