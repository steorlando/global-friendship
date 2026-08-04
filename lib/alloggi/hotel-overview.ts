import type { SupabaseClient } from "@supabase/supabase-js";
import {
  alloggioLongToShort,
  isOperatorRegistrationType,
  normalizeOperatorAccommodationPreference,
} from "../partecipante/constants.ts";
import { loadAccommodationGroups, type AccommodationGroup } from "./group-allocations.ts";
import {
  isOrganizationProvidedAccommodation,
  loadAccommodationHotels,
  type AccommodationHotel,
} from "./inventory.ts";

type ServiceClient = SupabaseClient;

type OverviewParticipantRow = {
  id: string;
  personal_code?: string | number | null;
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
  tipo_iscrizione?: string | null;
  preferenza_alloggio_operatore?: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  citta: string | null;
};

type RawOverviewParticipantRow = {
  id?: string | null;
  personal_code?: string | number | null;
  nome?: string | null;
  cognome?: string | null;
  email?: string | null;
  tipo_iscrizione?: string | null;
  preferenza_alloggio_operatore?: string | null;
  gruppo_id?: string | null;
  gruppo_label?: string | null;
  alloggio?: string | null;
  alloggio_short?: string | null;
  città?: string | null;
};

type ParticipantRoomAssignmentRow = {
  partecipante_id: string | null;
  stanza_id: string | null;
};

type RoomGroupAllocationRow = {
  stanza_id: string | null;
  gruppo_id: string | null;
};

type OverviewRoomRow = {
  id: string;
  albergo_id: string | null;
  capienza: number | null;
  numero_reale?: string | null;
  nome?: string | null;
  codice_interno?: string | null;
};

export type AccommodationHotelOverviewParticipant = {
  id: string;
  personalCode: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  groupId: string | null;
  groupName: string;
  assignedHotelId: string | null;
  assignedHotelName: string | null;
  roomNumber: string | null;
  assignmentType: "room" | "operator_hotel" | "unassigned";
};

export type AccommodationHotelAvailability = {
  emptyRoomCount: number;
  emptyBedCount: number;
};

export type AccommodationHotelOverviewRow = {
  groupId: string;
  groupName: string;
  needsAccommodationCount: number;
  unassignedCount: number;
  hotelCounts: Record<string, number>;
  assignedBedCount: number;
  unassignedBedCount: number;
  hotelBedCounts: Record<string, number>;
  isRomeGroup: boolean;
};

export type AccommodationHotelOverview = {
  hotels: AccommodationHotel[];
  hotelAvailability: Record<string, AccommodationHotelAvailability>;
  rows: AccommodationHotelOverviewRow[];
  participants: AccommodationHotelOverviewParticipant[];
  totals: {
    needsAccommodationCount: number;
    unassignedCount: number;
    hotelCounts: Record<string, number>;
    assignedBedCount: number;
    unassignedBedCount: number;
    hotelBedCounts: Record<string, number>;
  };
};

function getParticipantAccommodationShort(row: OverviewParticipantRow): string | null {
  return row.alloggio_short ?? alloggioLongToShort(row.alloggio);
}

function normalizeForMatching(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isRomeCity(value: string | null | undefined): boolean {
  const normalized = normalizeForMatching(value);
  return normalized === "roma" || normalized === "rome";
}

function isOperatorHotelAccommodation(participant: OverviewParticipantRow): boolean {
  return (
    isOperatorRegistrationType(participant.tipo_iscrizione) &&
    normalizeOperatorAccommodationPreference(
      participant.preferenza_alloggio_operatore
    ) === "Hotel"
  );
}

function participantBelongsToGroup(
  participant: OverviewParticipantRow,
  group: AccommodationGroup
): boolean {
  const aliases = new Set([group.id, group.name].map((value) => value.trim()).filter(Boolean));
  const participantGroupId = (participant.gruppo_id ?? "").trim();
  const participantGroupLabel = (participant.gruppo_label ?? "").trim();
  return aliases.has(participantGroupId) || aliases.has(participantGroupLabel);
}

export function buildAccommodationHotelOverview(args: {
  groups: AccommodationGroup[];
  hotels: AccommodationHotel[];
  participants: OverviewParticipantRow[];
  assignments: ParticipantRoomAssignmentRow[];
  roomAllocations: RoomGroupAllocationRow[];
  rooms: OverviewRoomRow[];
}): AccommodationHotelOverview {
  const roomHotelByRoomId = new Map<string, string>();
  const roomCapacityByRoomId = new Map<string, number>();
  const roomLabelByRoomId = new Map<string, string>();
  for (const room of args.rooms) {
    const roomId = String(room.id ?? "").trim();
    const hotelId = String(room.albergo_id ?? "").trim();
    const capacity = room.capienza ?? 0;
    if (!roomId || !hotelId) continue;
    roomHotelByRoomId.set(roomId, hotelId);
    roomCapacityByRoomId.set(roomId, capacity > 0 ? capacity : 0);
    const roomLabel = String(
      room.numero_reale ?? room.nome ?? room.codice_interno ?? ""
    ).trim();
    if (roomLabel) roomLabelByRoomId.set(roomId, roomLabel);
  }

  const assignmentHotelByParticipantId = new Map<string, string>();
  const assignmentRoomByParticipantId = new Map<string, string>();
  for (const assignment of args.assignments) {
    const participantId = String(assignment.partecipante_id ?? "").trim();
    const roomId = String(assignment.stanza_id ?? "").trim();
    const hotelId = roomHotelByRoomId.get(roomId);
    if (!participantId || !hotelId) continue;
    assignmentHotelByParticipantId.set(participantId, hotelId);
    assignmentRoomByParticipantId.set(participantId, roomId);
  }

  const hotelNameById = new Map(args.hotels.map((hotel) => [hotel.id, hotel.name]));
  const activeParticipantIds = new Set(args.participants.map((participant) => participant.id));
  const occupantIdsByRoomId = new Map<string, Set<string>>();

  for (const assignment of args.assignments) {
    const participantId = String(assignment.partecipante_id ?? "").trim();
    const roomId = String(assignment.stanza_id ?? "").trim();
    if (!participantId || !roomId || !activeParticipantIds.has(participantId)) continue;

    const occupantIds = occupantIdsByRoomId.get(roomId) ?? new Set<string>();
    occupantIds.add(participantId);
    occupantIdsByRoomId.set(roomId, occupantIds);
  }

  const hotelAvailability: Record<string, AccommodationHotelAvailability> =
    Object.fromEntries(
      args.hotels.map((hotel) => [
        hotel.id,
        { emptyRoomCount: 0, emptyBedCount: 0 },
      ])
    );

  for (const room of args.rooms) {
    const roomId = String(room.id ?? "").trim();
    const hotelId = String(room.albergo_id ?? "").trim();
    const availability = hotelAvailability[hotelId];
    if (!roomId || !availability) continue;

    const occupantCount = occupantIdsByRoomId.get(roomId)?.size ?? 0;
    const capacity = Math.max(room.capienza ?? 0, 0);
    if (occupantCount === 0) availability.emptyRoomCount += 1;
    availability.emptyBedCount += Math.max(capacity - occupantCount, 0);
  }

  const rows = args.groups.map((group) => {
    const hotelCounts: Record<string, number> = Object.fromEntries(
      args.hotels.map((hotel) => [hotel.id, 0])
    );
    const hotelBedCounts: Record<string, number> = Object.fromEntries(
      args.hotels.map((hotel) => [hotel.id, 0])
    );

    let needsAccommodationCount = 0;
    let hostelBedNeedCount = 0;
    let unassignedCount = 0;
    let assignedBedCount = 0;
    let hasRomeParticipant = false;
    let hasNonRomeParticipant = false;

    for (const allocation of args.roomAllocations) {
      const allocationGroupId = String(allocation.gruppo_id ?? "").trim();
      const roomId = String(allocation.stanza_id ?? "").trim();
      const hotelId = roomHotelByRoomId.get(roomId);
      const capacity = roomCapacityByRoomId.get(roomId) ?? 0;
      if (allocationGroupId !== group.id || !hotelId || !(hotelId in hotelBedCounts)) {
        continue;
      }

      hotelBedCounts[hotelId] += capacity;
      assignedBedCount += capacity;
    }

    for (const participant of args.participants) {
      if (!participantBelongsToGroup(participant, group)) continue;
      if (!isOrganizationProvidedAccommodation(getParticipantAccommodationShort(participant))) {
        continue;
      }

      needsAccommodationCount += 1;
      const isHotelOperator = isOperatorHotelAccommodation(participant);
      if (!isHotelOperator) {
        hostelBedNeedCount += 1;
      }
      if (isRomeCity(participant.citta)) {
        hasRomeParticipant = true;
      } else {
        hasNonRomeParticipant = true;
      }

      const assignedHotelId = assignmentHotelByParticipantId.get(participant.id);
      if (assignedHotelId && assignedHotelId in hotelCounts) {
        hotelCounts[assignedHotelId] += 1;
      } else if (!isHotelOperator) {
        unassignedCount += 1;
      }
    }

    return {
      groupId: group.id,
      groupName: group.name,
      needsAccommodationCount,
      unassignedCount,
      hotelCounts,
      assignedBedCount,
      unassignedBedCount: Math.max(hostelBedNeedCount - assignedBedCount, 0),
      hotelBedCounts,
      isRomeGroup: hasRomeParticipant && !hasNonRomeParticipant,
    };
  });

  const totals = {
    needsAccommodationCount: rows.reduce(
      (sum, row) => sum + row.needsAccommodationCount,
      0
    ),
    unassignedCount: rows.reduce((sum, row) => sum + row.unassignedCount, 0),
    hotelCounts: Object.fromEntries(args.hotels.map((hotel) => [hotel.id, 0])),
    assignedBedCount: rows.reduce((sum, row) => sum + row.assignedBedCount, 0),
    unassignedBedCount: rows.reduce((sum, row) => sum + row.unassignedBedCount, 0),
    hotelBedCounts: Object.fromEntries(args.hotels.map((hotel) => [hotel.id, 0])),
  };

  for (const row of rows) {
    for (const hotel of args.hotels) {
      totals.hotelCounts[hotel.id] += row.hotelCounts[hotel.id] ?? 0;
      totals.hotelBedCounts[hotel.id] += row.hotelBedCounts[hotel.id] ?? 0;
    }
  }

  const participants = args.participants
    .map((participant) => ({
      participant,
      group: args.groups.find((group) => participantBelongsToGroup(participant, group)),
    }))
    .filter(
      ({ participant, group }) =>
        Boolean(group) &&
        isOrganizationProvidedAccommodation(getParticipantAccommodationShort(participant))
    )
    .map(({ participant, group }) => {
      const rawAssignedHotelId =
        assignmentHotelByParticipantId.get(participant.id) ?? null;
      const assignedHotelId =
        rawAssignedHotelId && hotelNameById.has(rawAssignedHotelId)
          ? rawAssignedHotelId
          : null;
      const assignedRoomId = assignmentRoomByParticipantId.get(participant.id) ?? null;
      const assignmentType: AccommodationHotelOverviewParticipant["assignmentType"] =
        assignedHotelId
          ? "room"
          : isOperatorHotelAccommodation(participant)
            ? "operator_hotel"
            : "unassigned";
      const groupId = group?.id ?? null;
      const groupName = group?.name ?? "";

      return {
        id: participant.id,
        personalCode:
          participant.personal_code == null
            ? null
            : String(participant.personal_code).padStart(4, "0"),
        firstName: participant.nome ?? null,
        lastName: participant.cognome ?? null,
        email: participant.email ?? null,
        groupId,
        groupName,
        assignedHotelId,
        assignedHotelName: assignedHotelId
          ? hotelNameById.get(assignedHotelId) ?? null
          : null,
        roomNumber: assignedRoomId
          ? roomLabelByRoomId.get(assignedRoomId) ?? null
          : null,
        assignmentType,
      };
    })
    .sort((a, b) => {
      const byGroup = a.groupName.localeCompare(b.groupName);
      if (byGroup !== 0) return byGroup;
      return `${a.lastName ?? ""} ${a.firstName ?? ""}`.localeCompare(
        `${b.lastName ?? ""} ${b.firstName ?? ""}`
      );
    });

  return { hotels: args.hotels, hotelAvailability, rows, totals, participants };
}

export async function loadAccommodationHotelOverview(
  service: ServiceClient
): Promise<AccommodationHotelOverview> {
  const [groups, hotels, participantsRes, assignmentsRes, roomAllocationsRes, roomsRes] =
    await Promise.all([
    loadAccommodationGroups(service),
    loadAccommodationHotels(service),
    service.from("partecipanti").select("*").is("deleted_at", null),
    service.from("partecipanti_stanze").select("partecipante_id,stanza_id"),
    service.from("stanze_gruppi").select("stanza_id,gruppo_id"),
    service
      .from("stanze")
      .select("id,albergo_id,capienza,numero_reale,nome,codice_interno"),
    ]);

  if (participantsRes.error) {
    throw new Error(participantsRes.error.message);
  }
  if (assignmentsRes.error) {
    throw new Error(assignmentsRes.error.message);
  }
  if (roomAllocationsRes.error) {
    throw new Error(roomAllocationsRes.error.message);
  }
  if (roomsRes.error) {
    throw new Error(roomsRes.error.message);
  }

  const participants = ((participantsRes.data ?? []) as RawOverviewParticipantRow[]).map(
    (row) => ({
      id: row.id ?? "",
      personal_code: row.personal_code ?? null,
      nome: row.nome ?? null,
      cognome: row.cognome ?? null,
      email: row.email ?? null,
      tipo_iscrizione: row.tipo_iscrizione ?? null,
      preferenza_alloggio_operatore:
        row.preferenza_alloggio_operatore ?? null,
      gruppo_id: row.gruppo_id ?? null,
      gruppo_label: row.gruppo_label ?? null,
      alloggio: row.alloggio ?? null,
      alloggio_short: row.alloggio_short ?? null,
      citta: row.città ?? null,
    })
  );

  return buildAccommodationHotelOverview({
    groups,
    hotels,
    participants,
    assignments: (assignmentsRes.data ?? []) as ParticipantRoomAssignmentRow[],
    roomAllocations: (roomAllocationsRes.data ?? []) as RoomGroupAllocationRow[],
    rooms: (roomsRes.data ?? []) as OverviewRoomRow[],
  });
}
