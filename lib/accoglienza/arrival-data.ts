import type { SupabaseClient } from "@supabase/supabase-js";
import { groupDisplayName, loadGroupDisplayNamesById } from "@/lib/groups/display-names";
import {
  buildArrivalGroupSummary,
  isReceptionRomeCity,
  isReceptionRomeSubgroupContact,
  resolveReceptionGroupName,
  resolveArrivalAccommodationType,
  type ArrivalGroupSummaryRow,
  type ArrivalParticipant,
  type ReceptionGroupLeaderContact,
} from "./arrivals";

type ParticipantRow = {
  id: string;
  personal_code: string | null;
  nome: string | null;
  cognome: string | null;
  paese_residenza: string | null;
  nazione: string | null;
  citta: string | null;
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
  telefono: string | null;
  roma: boolean | null;
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

async function loadArrivalDashboardSource(
  service: SupabaseClient
): Promise<{
  participants: ArrivalParticipant[];
  groupLeaders: ReceptionGroupLeaderContact[];
}> {
  const { data: participantData, error: participantError } = await service
    .from("partecipanti")
    .select(
      "id,personal_code,nome,cognome,paese_residenza,nazione,citta:città,gruppo_id,gruppo_label,gruppo_leader,data_arrivo,alloggio,alloggio_short,tipo_iscrizione,preferenza_alloggio_operatore,deleted_at"
    )
    .is("deleted_at", null)
    .order("cognome", { ascending: true })
    .order("nome", { ascending: true });

  if (participantError) throw new Error(participantError.message);
  const participants = (participantData ?? []) as unknown as ParticipantRow[];

  const participantIds = participants.map((participant) => participant.id);
  const participantGroupIds = [
    ...new Set(participants.map((participant) => participant.gruppo_id).filter(Boolean)),
  ] as string[];

  const [arrivalRows, assignmentRows, leaderProfilesResult] = await Promise.all([
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
    service
      .from("profili")
      .select("id,nome,cognome,email,telefono,roma")
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
  const allGroupIds = [
    ...new Set([
      ...participantGroupIds,
      ...leaderLinks.map((link) => link.gruppo_id).filter(Boolean),
    ]),
  ];
  const [hotelRows, groupNamesById] = await Promise.all([
    loadInBatches<HotelRow>(hotelIds, (batch) =>
      service.from("alberghi").select("id,nome").in("id", batch)
    ),
    loadGroupDisplayNamesById(service, allGroupIds),
  ]);

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
  const romeGroupIds = new Set(
    participants
      .filter((participant) => isReceptionRomeCity(participant.citta))
      .map((participant) => participant.gruppo_id)
      .filter((groupId): groupId is string => Boolean(groupId))
  );
  const leadersByGroup = new Map<string, string[]>();
  const groupsByLeader = new Map<string, string[]>();
  const groupIdsByLeader = new Map<string, string[]>();
  const romeSubgroupsByLeader = new Map<string, string[]>();
  for (const link of leaderLinks) {
    const profile = leaderById.get(link.profilo_id);
    if (!profile) continue;
    const current = leadersByGroup.get(link.gruppo_id) ?? [];
    current.push(leaderLabel(profile));
    leadersByGroup.set(link.gruppo_id, current);

    const linkedGroupIds = groupIdsByLeader.get(link.profilo_id) ?? [];
    linkedGroupIds.push(link.gruppo_id);
    groupIdsByLeader.set(link.profilo_id, linkedGroupIds);

    if (profile.roma === true || romeGroupIds.has(link.gruppo_id)) {
      const originalGroupName = groupDisplayName(link.gruppo_id, groupNamesById);
      if (originalGroupName) {
        const subgroups = romeSubgroupsByLeader.get(link.profilo_id) ?? [];
        subgroups.push(originalGroupName);
        romeSubgroupsByLeader.set(link.profilo_id, subgroups);
      }
    }

    const groupName =
      profile.roma === true || romeGroupIds.has(link.gruppo_id)
        ? "Roma"
        : groupDisplayName(link.gruppo_id, groupNamesById);
    if (groupName) {
      const linkedGroups = groupsByLeader.get(link.profilo_id) ?? [];
      linkedGroups.push(groupName);
      groupsByLeader.set(link.profilo_id, linkedGroups);
    }
  }

  const arrivalParticipants = participants.map((participant) => {
    const storedGroup =
      groupDisplayName(
        participant.gruppo_id,
        groupNamesById,
        participant.gruppo_label
      ) ?? "-";
    const group = resolveReceptionGroupName({
      group: storedGroup,
      city: participant.citta,
    });
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

  const groupLeaders = leaderProfiles
    .map((profile) => ({
      id: profile.id,
      firstName: text(profile.nome, ""),
      lastName: text(profile.cognome, ""),
      email: text(profile.email, ""),
      phone: text(profile.telefono, ""),
      groups: [...new Set(groupsByLeader.get(profile.id) ?? [])].sort((a, b) =>
        a.localeCompare(b)
      ),
      isRomeSubgroup: isReceptionRomeSubgroupContact({
        profileRoma: profile.roma,
        linkedGroupIds: groupIdsByLeader.get(profile.id) ?? [],
        romeGroupIds,
      }),
      romeSubgroups: [...new Set(romeSubgroupsByLeader.get(profile.id) ?? [])].sort((a, b) =>
        a.localeCompare(b)
      ),
    }))
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName) ||
        a.firstName.localeCompare(b.firstName) ||
        a.email.localeCompare(b.email)
    );

  return { participants: arrivalParticipants, groupLeaders };
}

export async function loadArrivalParticipants(
  service: SupabaseClient
): Promise<ArrivalParticipant[]> {
  const data = await loadArrivalDashboardSource(service);
  return data.participants;
}

export async function loadArrivalDashboardData(service: SupabaseClient): Promise<{
  participants: ArrivalParticipant[];
  groups: ArrivalGroupSummaryRow[];
  groupLeaders: ReceptionGroupLeaderContact[];
}> {
  const { participants, groupLeaders } = await loadArrivalDashboardSource(service);
  return {
    participants,
    groups: buildArrivalGroupSummary(participants),
    groupLeaders,
  };
}

export async function loadParticipantArrivalStatuses(
  service: SupabaseClient,
  participantIds: string[]
): Promise<Map<string, string | null>> {
  const uniqueIds = [...new Set(participantIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length > BATCH_SIZE * 4) {
    const activeIds = new Set(uniqueIds);
    const { data, error } = await service
      .from("participant_event_arrivals")
      .select("participant_id,arrived_at");
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as ArrivalRow[]).filter((row) =>
      activeIds.has(row.participant_id)
    );
    return new Map(rows.map((row) => [row.participant_id, row.arrived_at] as const));
  }
  const rows = await loadInBatches<ArrivalRow>(uniqueIds, (batch) =>
    service
      .from("participant_event_arrivals")
      .select("participant_id,arrived_at")
      .in("participant_id", batch)
  );
  return new Map(rows.map((row) => [row.participant_id, row.arrived_at] as const));
}
