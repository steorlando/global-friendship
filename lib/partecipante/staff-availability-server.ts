import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  BandRole,
  ParticipantStaffAvailability,
  ParticipantStaffAvailabilityInput,
  SocialMediaTask,
  StaffArea,
} from "@/lib/partecipante/staff-availability";

type StaffAvailabilityRow = {
  areas: StaffArea[];
  band_role: BandRole | null;
  band_instrument: string | null;
  social_media_tasks: SocialMediaTask[];
  social_media_other: string | null;
  updated_at: string;
};

export async function loadParticipantStaffAvailability(
  participantId: string
): Promise<ParticipantStaffAvailability | null> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("participant_staff_availability")
    .select(
      "areas,band_role,band_instrument,social_media_tasks,social_media_other,updated_at"
    )
    .eq("participant_id", participantId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as StaffAvailabilityRow;
  return {
    areas: row.areas,
    bandRole: row.band_role,
    bandInstrument: row.band_instrument,
    socialMediaTasks: row.social_media_tasks,
    socialMediaOther: row.social_media_other,
    updatedAt: row.updated_at,
  };
}

export async function upsertParticipantStaffAvailability(
  participantId: string,
  availability: ParticipantStaffAvailabilityInput
): Promise<ParticipantStaffAvailability> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("participant_staff_availability")
    .upsert(
      {
        participant_id: participantId,
        areas: availability.areas,
        band_role: availability.bandRole,
        band_instrument: availability.bandInstrument,
        social_media_tasks: availability.socialMediaTasks,
        social_media_other: availability.socialMediaOther,
      },
      { onConflict: "participant_id" }
    )
    .select(
      "areas,band_role,band_instrument,social_media_tasks,social_media_other,updated_at"
    )
    .single();

  if (error) throw new Error(error.message);

  const row = data as StaffAvailabilityRow;
  return {
    areas: row.areas,
    bandRole: row.band_role,
    bandInstrument: row.band_instrument,
    socialMediaTasks: row.social_media_tasks,
    socialMediaOther: row.social_media_other,
    updatedAt: row.updated_at,
  };
}
