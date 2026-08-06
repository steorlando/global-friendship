import type { AccommodationRoom } from "../alloggi/inventory.ts";
import type {
  GroupLeaderParticipant,
  GroupLeaderVisibleRoomOccupant,
} from "./room-assignments.ts";

export type RoomAvailabilityFilter = "all" | "available" | "empty";
export type RoomAvailabilityWarningFilter =
  | "all"
  | "extend"
  | "shorten"
  | "any"
  | "both";

export function getGroupLeaderRoomOccupancy(
  room: AccommodationRoom,
  visibleOccupantCount: number
): number {
  return Math.max(room.assignedParticipantCount, visibleOccupantCount);
}

export function getGroupLeaderRoomFreeBedCount(
  room: AccommodationRoom,
  visibleOccupantCount: number
): number {
  return Math.max(
    0,
    room.capacity - getGroupLeaderRoomOccupancy(room, visibleOccupantCount)
  );
}

export function getGroupLeaderRoomBedRowCount(
  room: AccommodationRoom,
  visibleOccupantCount: number
): number {
  return Math.max(
    1,
    room.capacity,
    getGroupLeaderRoomOccupancy(room, visibleOccupantCount)
  );
}

export function matchesGroupLeaderRoomAvailabilityFilter(
  room: AccommodationRoom,
  visibleOccupantCount: number,
  filter: RoomAvailabilityFilter
): boolean {
  if (filter === "all") return true;

  const occupancy = getGroupLeaderRoomOccupancy(room, visibleOccupantCount);
  if (filter === "empty") return occupancy === 0;
  return occupancy < room.capacity;
}

export function matchesGroupLeaderRoomAvailabilityWarningFilter(
  hasExtensionWarning: boolean,
  hasShorteningWarning: boolean,
  filter: RoomAvailabilityWarningFilter
): boolean {
  if (filter === "extend") return hasExtensionWarning;
  if (filter === "shorten") return hasShorteningWarning;
  if (filter === "any") return hasExtensionWarning || hasShorteningWarning;
  if (filter === "both") return hasExtensionWarning && hasShorteningWarning;
  return true;
}

export function matchesGroupLeaderRoomCodeFilter(
  room: AccommodationRoom,
  searchTerm: string
): boolean {
  const normalized = searchTerm.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return room.internalCode.toLocaleLowerCase().includes(normalized);
}

export function buildGroupLeaderRoomOptionLabel(room: AccommodationRoom): string {
  return [room.internalCode, room.hotel?.name ?? ""].filter(Boolean).join(" · ");
}

export function getGroupLeaderSharedRooms(
  participantIds: string[],
  roomsByParticipantId: Map<string, AccommodationRoom[]>
): AccommodationRoom[] {
  const [firstParticipantId, ...otherParticipantIds] = participantIds;
  if (!firstParticipantId) return [];

  const firstParticipantRooms = roomsByParticipantId.get(firstParticipantId) ?? [];
  if (otherParticipantIds.length === 0) return firstParticipantRooms;

  const otherRoomIds = otherParticipantIds.map(
    (participantId) =>
      new Set((roomsByParticipantId.get(participantId) ?? []).map((room) => room.id))
  );

  return firstParticipantRooms.filter((room) =>
    otherRoomIds.every((roomIds) => roomIds.has(room.id))
  );
}

export function formatGroupLeaderRoomAvailability(room: AccommodationRoom): string {
  if (room.availableFrom && room.availableTo) {
    return `${room.availableFrom} -> ${room.availableTo}`;
  }
  if (room.availableFrom) {
    return `${room.availableFrom} ->`;
  }
  if (room.availableTo) {
    return `-> ${room.availableTo}`;
  }
  return "-";
}

function isDateOnly(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function getGroupLeaderRoomEarlyArrivalOccupants(
  room: Pick<AccommodationRoom, "availableFrom">,
  occupants: GroupLeaderVisibleRoomOccupant[]
): GroupLeaderVisibleRoomOccupant[] {
  if (!isDateOnly(room.availableFrom)) return [];
  const availableFrom = room.availableFrom;

  return occupants.filter(
    (occupant) =>
      isDateOnly(occupant.arrivalDate) && occupant.arrivalDate < availableFrom
  );
}

export function getGroupLeaderRoomRequiredAvailableFrom(
  room: Pick<AccommodationRoom, "availableFrom">,
  occupants: GroupLeaderVisibleRoomOccupant[]
): string | null {
  const earlyArrivals = getGroupLeaderRoomEarlyArrivalOccupants(room, occupants);
  let requiredAvailableFrom: string | null = null;

  for (const occupant of earlyArrivals) {
    if (
      isDateOnly(occupant.arrivalDate) &&
      (requiredAvailableFrom === null || occupant.arrivalDate < requiredAvailableFrom)
    ) {
      requiredAvailableFrom = occupant.arrivalDate;
    }
  }

  return requiredAvailableFrom;
}

export type GroupLeaderRoomShorteningSuggestion = {
  availableFrom: string | null;
  availableTo: string | null;
};

export function getGroupLeaderRoomShorteningSuggestion(
  room: Pick<
    AccommodationRoom,
    "assignedParticipantCount" | "availableFrom" | "availableTo"
  >,
  occupants: GroupLeaderVisibleRoomOccupant[]
): GroupLeaderRoomShorteningSuggestion | null {
  const knownOccupantCount = occupants.length;
  const totalOccupantCount = Math.max(
    room.assignedParticipantCount,
    knownOccupantCount
  );
  if (totalOccupantCount === 0 || knownOccupantCount < totalOccupantCount) {
    return null;
  }

  const arrivalDates = occupants.map((occupant) => occupant.arrivalDate);
  const departureDates = occupants.map((occupant) => occupant.departureDate);
  if (!arrivalDates.every(isDateOnly) || !departureDates.every(isDateOnly)) {
    return null;
  }

  const validArrivalDates = arrivalDates as string[];
  const validDepartureDates = departureDates as string[];
  const earliestArrival = validArrivalDates.reduce((earliest, date) =>
    date < earliest ? date : earliest
  );
  const latestDeparture = validDepartureDates.reduce((latest, date) =>
    date > latest ? date : latest
  );

  const availableFrom =
    isDateOnly(room.availableFrom) &&
    earliestArrival > room.availableFrom
      ? earliestArrival
      : null;
  const availableTo =
    isDateOnly(room.availableTo) &&
    latestDeparture < room.availableTo
      ? latestDeparture
      : null;

  return availableFrom || availableTo ? { availableFrom, availableTo } : null;
}

export function matchesGroupLeaderParticipantSearch(
  participant: GroupLeaderParticipant,
  searchTerm: string
): boolean {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [
    participant.firstName ?? "",
    participant.lastName ?? "",
    participant.email ?? "",
    participant.displayGroup,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function matchesGroupLeaderRoomOccupantSearch(
  occupant: GroupLeaderVisibleRoomOccupant,
  searchTerm: string
): boolean {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;

  return [occupant.firstName ?? "", occupant.lastName ?? "", occupant.displayGroup]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function matchesGroupLeaderRoomOccupantGroup(
  occupant: Pick<GroupLeaderVisibleRoomOccupant, "groupId" | "groupLabel">,
  groupId: string
): boolean {
  return occupant.groupId === groupId || occupant.groupLabel === groupId;
}

export function isGroupLeaderRomeCity(city: string | null | undefined): boolean {
  const normalized = (city ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
  return normalized === "roma" || normalized === "rome";
}
