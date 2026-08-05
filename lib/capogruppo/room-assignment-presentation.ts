import type { AccommodationRoom } from "../alloggi/inventory.ts";
import type {
  GroupLeaderParticipant,
  GroupLeaderVisibleRoomOccupant,
} from "./room-assignments.ts";

export type RoomAvailabilityFilter = "all" | "available" | "empty";

export function getGroupLeaderRoomOccupancy(
  room: AccommodationRoom,
  visibleOccupantCount: number
): number {
  return Math.max(room.assignedParticipantCount, visibleOccupantCount);
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
