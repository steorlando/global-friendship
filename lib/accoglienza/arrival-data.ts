import type { SupabaseClient } from "@supabase/supabase-js";
import { groupDisplayName, loadGroupDisplayNamesById } from "@/lib/groups/display-names";
import {
  buildArrivalGroupSummary,
  resolveArrivalAccommodationType,
  type ArrivalGroupSummaryRow,
  type ArrivalParticipant,
} from "./arrivals";

type ParticipantRow = {
  id: string;
  personal_code: string | null;
  nome: string | null;
  cognome: string | null;
  paese_residenza: string | null;
  nazione: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  gruppo_leader: string | null;
  data_arrivo: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  tipo_iscrizione: string | null;
  preferenza_alloggio_operatore: string | null;
  deleted_at: string | null;
};

type ArrivalRow = {
  participant_id: string;
  arrived_at: string | null;
};

type AssignmentRow = {
  partecipante_id: string;
  stanza_id: string;
};

type RoomRow = {
  id: string;
  albergo_id: string;
};

type HotelRow = {
  id: string;
  nome: string;
};

type LeaderLinkRow = {
  profilo_id: string;
  gruppo_id: string;
};

type LeaderProfileRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
};

const BATCH_SIZE = 100;

function batches<T>(values: T[]): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += BATCH_SIZE) {
    result.push(values.slice(index, index + BATCH_SIZE));
  }
  return result;
}

function text(value: string | null | undefined, fallback = "-"): string {
  return value?.trim() || fallback;
}

function leaderLabel(profile: LeaderProfileRow): string {
  const fullName = [profile.nome, profile.cognome]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
  return fullName || text(profile.email);
}

async function loadInBatches<T>(
  values: string[],
  load: (batch: string[]) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<T[]> {
  if (values.length === 0) return [];
  const results = await Promise.all(batches(values).map(load));
  const rows: T[] = [];
  for (const result of results) {
    if (result.error) throw new Error(result.error.message);
    rows.push(...(result.data ?? []));
  }
  return rows;
}

export async function loadArrivalParticipants(
  service: SupabaseClient
): Promise<ArrivalParticipant[]> {
  const { data: participantData, error: participantError } = await service
    .from("partecipanti")
    .select(
      "id,personal_code,nome,cognome,paese_residenza,nazione,gruppo_id,gruppo_label,gruppo_leader,data_arrivo,alloggio,alloggio_short,tipo_iscrizione,preferenza_alloggio_operatore,deleted_at"
    )
    .is("deleted_at", null)
    .order("cognome", { ascending: true })
    .order("nome", { ascending: true });

  if (participantError) throw new Error(participantError.message);
  const participants = (participantData ?? []) as ParticipantRow[];
  if (participants.length === 0) return [];

  const participantIds = participants.map((participant) => participant.id);
  const groupIds = [
    ...new Set(participants.map((participant) => participant.gruppo_id).filter(Boolean)),
  ] as string[];

  const [arrivalRows, assignmentRows, groupNamesById, leaderProfilesResult] =
    await Promise.all([
      loadInBatches<ArrivalRow>(participantIds, (batch) =>
        service
          .from("participant_event_arrivals")
          .select("participant_id,arrived_at")
          .in("participant_id", batch)
      ),
      loadInBatches<AssignmentRow>(participantIds, (batch) =>
        service
          .from("partecipanti_stanze")
          .select("partecipante_id,stanza_id")
          .in("partecipante_id", batch)
      ),
      loadGroupDisplayNamesById(service, groupIds),
      service
        .from("profili")
        .select("id,nome,cognome,email")
        .eq("ruolo", "capogruppo"),
    ]);

  if (leaderProfilesResult.error) {
    throw new Error(leaderProfilesResult.error.message);
  }

  const leaderProfiles = (leaderProfilesResult.data ?? []) as LeaderProfileRow[];
  const leaderProfileIds = leaderProfiles.map((profile) => profile.id);
  const leaderLinks = await loadInBatches<LeaderLinkRow>(leaderProfileIds, (batch) =>
    service
      .from("profili_gruppi")
      .select("profilo_id,gruppo_id")
      .in("profilo_id", batch)
  );

  const roomIds = [...new Set(assignmentRows.map((row) => row.stanza_id).filter(Boolean))];
  const roomRows = await loadInBatches<RoomRow>(roomIds, (batch) =>
    service.from("stanze").select("id,albergo_id").in("id", batch)
  );
  const hotelIds = [...new Set(roomRows.map((row) => row.albergo_id).filter(Boolean))];
  const hotelRows = await loadInBatches<HotelRow>(hotelIds, (batch) =>
    service.from("alberghi").select("id,nome").in("id", batch)
  );

  const arrivedAtByParticipant = new Map(
    arrivalRows.map((row) => [row.participant_id, row.arrived_at] as const)
  );
  const roomById = new Map(roomRows.map((room) => [room.id, room] as const));
  const hotelById = new Map(hotelRows.map((hotel) => [hotel.id, hotel.nome] as const));
  const hotelByParticipant = new Map<string, string>();
  for (const assignment of assignmentRows) {
    const room = roomById.get(assignment.stanza_id);
    const hotelName = room ? hotelById.get(room.albergo_id) : null;
    if (hotelName) hotelByParticipant.set(assignment.partecipante_id, hotelName);
  }

  const leaderById = new Map(leaderProfiles.map((profile) => [profile.id, profile] as const));
  const leadersByGroup = new Map<string, string[]>();
  for (const link of leaderLinks) {
    const profile = leaderById.get(link.profilo_id);
    if (!profile) continue;
    const current = leadersByGroup.get(link.gruppo_id) ?? [];
    current.push(leaderLabel(profile));
    leadersByGroup.set(link.gruppo_id, current);
  }

  return participants.map((participant) => {
    const group =
      groupDisplayName(
        participant.gruppo_id,
        groupNamesById,
        participant.gruppo_label
      ) ?? "-";
    const linkedLeaders = participant.gruppo_id
      ? leadersByGroup.get(participant.gruppo_id) ?? []
      : [];
    const fallbackLeader = participant.gruppo_leader?.trim();

    return {
      id: participant.id,
      personalCode: text(participant.personal_code),
      firstName: text(participant.nome),
      lastName: text(participant.cognome),
      country: text(participant.paese_residenza ?? participant.nazione),
      group,
      groupLeaders: [
        ...new Set(
          (linkedLeaders.length > 0
            ? linkedLeaders
            : fallbackLeader
              ? [fallbackLeader]
              : [])
            .map((leader) => leader.trim())
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
      arrivalDate: participant.data_arrivo,
      accommodationType: resolveArrivalAccommodationType({
        accommodation: participant.alloggio,
        accommodationShort: participant.alloggio_short,
        registrationType: participant.tipo_iscrizione,
        operatorAccommodationPreference: participant.preferenza_alloggio_operatore,
      }),
      accommodationLocation: hotelByParticipant.get(participant.id) ?? null,
      arrivedAt: arrivedAtByParticipant.get(participant.id) ?? null,
    };
  });
}

export async function loadArrivalDashboardData(service: SupabaseClient): Promise<{
  participants: ArrivalParticipant[];
  groups: ArrivalGroupSummaryRow[];
}> {
  const participants = await loadArrivalParticipants(service);
  return {
    participants,
    groups: buildArrivalGroupSummary(participants),
  };
}

export async function loadParticipantArrivalStatuses(
  service: SupabaseClient,
  participantIds: string[]
): Promise<Map<string, string | null>> {
  const uniqueIds = [...new Set(participantIds.map((id) => id.trim()).filter(Boolean))];
  const rows = await loadInBatches<ArrivalRow>(uniqueIds, (batch) =>
    service
      .from("participant_event_arrivals")
      .select("participant_id,arrived_at")
      .in("participant_id", batch)
  );
  return new Map(rows.map((row) => [row.participant_id, row.arrived_at] as const));
}
