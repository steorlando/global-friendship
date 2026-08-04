import { type SupabaseClient } from "@supabase/supabase-js";

export class ProfiloDeletionError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ProfiloDeletionError";
    this.status = status;
  }
}

export async function deleteGroupLeaderProfiloById(
  supabase: SupabaseClient,
  id: string
): Promise<{ id: string; email: string }> {
  const profileId = id.trim();
  if (!profileId) {
    throw new ProfiloDeletionError("id is required", 400);
  }

  const { data: existing, error: existingError } = await supabase
    .from("profili")
    .select("id,email,ruolo")
    .eq("id", profileId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (!existing) {
    throw new ProfiloDeletionError("Profile not found", 404);
  }
  if (existing.ruolo !== "capogruppo") {
    throw new ProfiloDeletionError(
      "Only group leader profiles can be deleted from this page",
      400
    );
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("profili")
    .delete()
    .eq("id", profileId)
    .eq("ruolo", "capogruppo")
    .select("id,email")
    .maybeSingle();

  if (deleteError) throw new Error(deleteError.message);
  if (!deleted) {
    throw new ProfiloDeletionError("Profile could not be deleted", 409);
  }

  return { id: String(deleted.id), email: String(deleted.email) };
}
