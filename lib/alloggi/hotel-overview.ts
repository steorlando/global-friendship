import type { SupabaseClient } from "@supabase/supabase-js";
import { alloggioLongToShort } from "../partecipante/constants.ts";
import { loadAccommodationGroups, type AccommodationGroup } from "./group-allocations.ts";
import {
  isOrganizationProvidedAccommodation,
  loadAccommodationHotels,
  type AccommodationHotel,
} from "./inventory.ts";

type ServiceClient = SupabaseClient;

type OverviewParticipantRow = {
  id: string;
  gruppo_id: string | null;
  gruppo_label: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  citta: string | null;
};

type RawOverviewParticipantRow = {
  id?: string | null;
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
  rows: AccommodationHotelOverviewRow[];
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
  for (const room of args.rooms) {
    const roomId = String(room.id ?? "").trim();
    const hotelId = String(room.albergo_id ?? "").trim();
    const capacity = room.capienza ?? 0;
    if (!roomId || !hotelId) continue;
    roomHotelByRoomId.set(roomId, hotelId);
    roomCapacityByRoomId.set(roomId, capacity > 0 ? capacity : 0);
  }

  const assignmentHotelByParticipantId = new Map<string, string>();
  for (const assignment of args.assignments) {
    const participantId = String(assignment.partecipante_id ?? "").trim();
    const roomId = String(assignment.stanza_id ?? "").trim();
    const hotelId = roomHotelByRoomId.get(roomId);
    if (!participantId || !hotelId) continue;
    assignmentHotelByParticipantId.set(participantId, hotelId);
  }

  const rows = args.groups.map((group) => {
    const hotelCounts: Record<string, number> = Object.fromEntries(
      args.hotels.map((hotel) => [hotel.id, 0])
    );
    const hotelBedCounts: Record<string, number> = Object.fromEntries(
      args.hotels.map((hotel) => [hotel.id, 0])
    );

    let needsAccommodationCount = 0;
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
      if (isRomeCity(participant.citta)) {
        hasRomeParticipant = true;
      } else {
        hasNonRomeParticipant = true;
      }

      const assignedHotelId = assignmentHotelByParticipantId.get(participant.id);
      if (assignedHotelId && assignedHotelId in hotelCounts) {
        hotelCounts[assignedHotelId] += 1;
      } else {
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
      unassignedBedCount: Math.max(needsAccommodationCount - assignedBedCount, 0),
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

  return { hotels: args.hotels, rows, totals };
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
    service.from("stanze").select("id,albergo_id,capienza"),
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
