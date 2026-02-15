import { type SupabaseClient } from "@supabase/supabase-js";
import { isAppRole } from "@/lib/auth/roles";

export type ProfiloInput = {
  email: string;
  nome: string | null;
  cognome: string | null;
  ruolo: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeText(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function ensureRole(ruolo: string): string {
  if (!isAppRole(ruolo)) {
    throw new Error(`Invalid role: ${ruolo}`);
  }
  return ruolo;
}

async function findAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string | null> {
  const { data, error } = await supabase
    .schema("auth")
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (error) return null;
  return data?.id ?? null;
}

async function ensureAuthUserIdByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<string> {
  const existingId = await findAuthUserIdByEmail(supabase, email);
  if (existingId) return existingId;

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });

  if (!createError && created.user?.id) return created.user.id;

  const retried = await findAuthUserIdByEmail(supabase, email);
  if (retried) return retried;

  throw new Error(createError?.message ?? "Unable to create auth user");
}

export async function listProfili(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profili")
    .select("id,email,nome,cognome,ruolo,created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertProfiloByEmail(
  supabase: SupabaseClient,
  input: ProfiloInput
) {
  const email = normalizeEmail(input.email);
  const ruolo = ensureRole(input.ruolo);
  const nome = normalizeText(input.nome);
  const cognome = normalizeText(input.cognome);

  if (!email) throw new Error("Email is required");

  const { data: existing, error: existingError } = await supabase
    .from("profili")
    .select("id,email")
    .ilike("email", email)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  if (existing?.id) {
    const { data: updated, error: updateError } = await supabase
      .from("profili")
      .update({ email, nome, cognome, ruolo })
      .eq("id", existing.id)
      .select("id,email,nome,cognome,ruolo,created_at")
      .single();

    if (updateError) throw new Error(updateError.message);
    return updated;
  }

  const authUserId = await ensureAuthUserIdByEmail(supabase, email);

  const { data: inserted, error: insertError } = await supabase
    .from("profili")
    .insert({
      id: authUserId,
      email,
      nome,
      cognome,
      ruolo,
    })
    .select("id,email,nome,cognome,ruolo,created_at")
    .single();

  if (insertError) throw new Error(insertError.message);
  return inserted;
}

export async function updateProfiloById(
  supabase: SupabaseClient,
  id: string,
  input: { nome?: string | null; cognome?: string | null; ruolo?: string | null }
) {
  const patch: Record<string, string | null> = {};
  if (input.nome !== undefined) patch.nome = normalizeText(input.nome);
  if (input.cognome !== undefined) patch.cognome = normalizeText(input.cognome);
  if (input.ruolo !== undefined && input.ruolo !== null) {
    patch.ruolo = ensureRole(input.ruolo);
  }

  const { data, error } = await supabase
    .from("profili")
    .update(patch)
    .eq("id", id)
    .select("id,email,nome,cognome,ruolo,created_at")
    .single();

  if (error) throw new Error(error.message);
  return data;
}
