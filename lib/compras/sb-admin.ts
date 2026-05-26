// Cliente Supabase service-role para API routes da camada Custos (server-only).
// Retorna null se as env vars não estiverem presentes (guard DEBT-070).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function sbAdmin(): SupabaseClient | null {
  if (!SB_URL || !SB_SRK) return null;
  return createClient(SB_URL, SB_SRK, { auth: { persistSession: false } });
}

export const ENV_ERR = {
  error: "Config ausente: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias no servidor.",
};
