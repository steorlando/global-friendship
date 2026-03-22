import type { AccommodationRoom } from "../alloggi/inventory.ts";
import type { GroupLeaderParticipant } from "./room-assignments.ts";

export function buildGroupLeaderRoomOptionLabel(room: AccommodationRoom): string {
  const availability = formatGroupLeaderRoomAvailability(room);
  return [room.internalCode, room.hotel?.name ?? "", availability === "-" ? "" : availability]
    .filter(Boolean)
    .join(" · ");
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
