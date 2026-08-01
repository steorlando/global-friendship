import "server-only";

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { StaffAvailabilityStatRow } from "@/lib/statistics/staff-availability";
import type {
  StaffAvailabilityExportParticipant,
  StaffAvailabilityExportRow,
} from "@/lib/statistics/staff-availability-export";

export async function requireStaffAvailabilityManagerOrAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const service = createSupabaseServiceClient();
  const { data: profiles, error: profileError } = await service
    .from("profili")
    .select("ruolo")
    .ilike("email", email)
    .in("ruolo", ["manager", "admin"])
    .limit(1);

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }
  if (!profiles || profiles.length === 0) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { service };
}

export async function loadStaffAvailabilityRows(
  service: ReturnType<typeof createSupabaseServiceClient>,
): Promise<StaffAvailabilityExportRow[]> {
  const { data: availabilityData, error: availabilityError } = await service
    .from("participant_staff_availability")
    .select(
      "participant_id,areas,band_role,band_instrument,social_media_tasks,social_media_other,updated_at",
    )
    .order("updated_at", { ascending: false });

  if (availabilityError) throw new Error(availabilityError.message);

  const availabilityRows = (availabilityData ?? []) as StaffAvailabilityStatRow[];
  const participantIds = availabilityRows.map((row) => row.participant_id);
  const participantBatches: string[][] = [];
  for (let start = 0; start < participantIds.length; start += 200) {
    participantBatches.push(participantIds.slice(start, start + 200));
  }
  const participantResults = await Promise.all(
    participantBatches.map((batchIds) =>
      service
        .from("partecipanti")
        .select(
          "id,personal_code,email,telefono,nome,cognome,gruppo_label,gruppo_id,deleted_at",
        )
        .in("id", batchIds)
        .is("deleted_at", null),
    ),
  );
  const participants: StaffAvailabilityExportParticipant[] = [];
  for (const result of participantResults) {
    if (result.error) throw new Error(result.error.message);
    participants.push(...((result.data ?? []) as StaffAvailabilityExportParticipant[]));
  }

  const availabilityByParticipant = new Map(
    availabilityRows.map((row) => [row.participant_id, row]),
  );
  return participants
    .map((participant) => ({
      ...participant,
      availability: availabilityByParticipant.get(participant.id),
    }))
    .filter((row): row is StaffAvailabilityExportRow => Boolean(row.availability))
    .sort((a, b) => {
      const groupCompare = (a.gruppo_label ?? a.gruppo_id ?? "").localeCompare(
        b.gruppo_label ?? b.gruppo_id ?? "",
        "it",
      );
      if (groupCompare !== 0) return groupCompare;
      const surnameCompare = (a.cognome ?? "").localeCompare(b.cognome ?? "", "it");
      if (surnameCompare !== 0) return surnameCompare;
      return (a.nome ?? "").localeCompare(b.nome ?? "", "it");
    });
}
