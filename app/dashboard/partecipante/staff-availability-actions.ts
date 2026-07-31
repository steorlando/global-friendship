"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeParticipantStaffAvailabilityInput } from "@/lib/partecipante/staff-availability";
import { upsertParticipantStaffAvailability } from "@/lib/partecipante/staff-availability-server";

type SaveStaffAvailabilityResult =
  | {
      ok: true;
      availability: Awaited<ReturnType<typeof upsertParticipantStaffAvailability>>;
    }
  | { ok: false; error: string };

export async function saveParticipantStaffAvailability(
  participantId: string,
  input: unknown
): Promise<SaveStaffAvailabilityResult> {
  const normalizedParticipantId = participantId.trim();
  if (!normalizedParticipantId) {
    return { ok: false, error: "Participant not selected" };
  }

  const validation = normalizeParticipantStaffAvailabilityInput(input);
  if (!validation.ok) {
    return validation;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  const email = user?.email?.trim().toLowerCase();
  if (userError || !email) {
    return { ok: false, error: "Unauthorized" };
  }

  const service = createSupabaseServiceClient();
  const { data: participant, error: participantError } = await service
    .from("partecipanti")
    .select("id")
    .eq("id", normalizedParticipantId)
    .ilike("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  if (participantError) {
    return { ok: false, error: participantError.message };
  }
  if (!participant) {
    return { ok: false, error: "Participant not found for this account" };
  }

  try {
    const availability = await upsertParticipantStaffAvailability(
      normalizedParticipantId,
      validation.value
    );
    return { ok: true, availability };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to save staff availability",
    };
  }
}
