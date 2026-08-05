import "server-only";

import { requireStaffAvailabilityManagerOrAdmin } from "@/lib/statistics/staff-availability-server";
import type { ParticipantBadgeRow } from "@/lib/statistics/participant-badges";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export {
  requireStaffAvailabilityManagerOrAdmin as requireParticipantBadgesManagerOrAdmin,
};

const PAGE_SIZE = 500;

export async function loadParticipantBadgeRows(
  service: ReturnType<typeof createSupabaseServiceClient>,
): Promise<ParticipantBadgeRow[]> {
  const participants: ParticipantBadgeRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const selectFields: string =
      "id,nome,cognome,paese_residenza,nazione,citta:città,deleted_at";
    const { data, error } = await service
      .from("partecipanti")
      .select(selectFields)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as unknown as Array<ParticipantBadgeRow & {
      deleted_at: string | null;
    }>;
    participants.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return participants;
}
