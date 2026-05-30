import type { SupabaseClient } from "@supabase/supabase-js";
import { alloggioLongToShort } from "../partecipante/constants.ts";
import {
  isOrganizationProvidedAccommodation,
  loadAccommodationRoomById,
  loadAccommodationRooms,
  type AccommodationRoom,
} from "./inventory.ts";

type ServiceClient = SupabaseClient;

type GroupRow = {
  id: string;
  nome: string | null;
};

type ParticipantGroupPresenceRow = {
  gruppo_id: string | null;
  gruppo_label: string | null;
};

type RoomGroupAllocationRow = {
  stanza_id: string | null;
  gruppo_id: string | null;
  created_at: string | null;
  created_by: string | null;
};

type SummaryParticipantRow = {
  id: string;
  gruppo_id: string | null;
  gruppo_label: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  sesso: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
};

export type AccommodationGroup = {
  id: string;
  name: string;
};

export type AccommodationGroupRoomAllocation = {
  groupId: string;
  roomId: string;
  createdAt: string | null;
  createdBy: string | null;
  room: AccommodationRoom | null;
};

export type AccommodationGroupSummaryWarning = {
  code:
    | "missing_room_assignments"
    | "nominal_capacity_shortage"
    | "room_shared_across_groups"
    | "room_availability_starts_late"
    | "room_availability_ends_early"
    | "daily_capacity_shortage"
    | "participants_missing_stay_dates";
  message: string;
  severity: "warning";
  meta?: Record<string, number | string | string[] | null>;
};

export type AccommodationGroupSummaryStatus =
  | "unassigned"
  | "under_allocated"
  | "exactly_allocated"
  | "over_allocated";

export type AccommodationGroupSummary = {
  groupId: string;
  groupName: string;
  needsAccommodationCount: number;
  maleNeedCount: number;
  femaleNeedCount: number;
  unknownNeedCount: number;
  assignedCapacity: number;
  assignedRoomCount: number;
  status: AccommodationGroupSummaryStatus;
  warnings: AccommodationGroupSummaryWarning[];
  shortageDates: string[];
  maxDailyShortage: number;
  participantsMissingStayDates: number;
  earliestArrival: string | null;
  latestDeparture: string | null;
};

type GroupSummaryRoomInput = {
  id: string;
  capacity: number;
  availableFrom: string | null;
  availableTo: string | null;
  sharedGroupCount: number;
};

type GroupSummaryParticipantInput = {
  id: string;
  arrivalDate: string | null;
  departureDate: string | null;
  sexCategory: "male" | "female" | null;
};

type GroupSummaryInput = {
  groupId: string;
  groupName: string;
  participants: GroupSummaryParticipantInput[];
  rooms: GroupSummaryRoomInput[];
};

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

function normalizeForMatching(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseDateOnly(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeParticipantSexCategory(
  value: string | null | undefined
): "male" | "female" | null {
  const normalized = normalizeForMatching(value);
  if (!normalized) return null;

  if (
    ["male", "m", "man", "maschio", "maschile", "uomo", "boy"].includes(normalized)
  ) {
    return "male";
  }

  if (
    [
      "female",
      "f",
      "woman",
      "female ",
      "femmina",
      "femminile",
      "donna",
      "girl",
    ].includes(normalized)
  ) {
    return "female";
  }

  return null;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function eachStayDate(arrivalDate: string, departureDate: string): string[] {
  const arrival = parseDateOnly(arrivalDate);
  const departure = parseDateOnly(departureDate);
  if (!arrival || !departure || departure.getTime() <= arrival.getTime()) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(arrival.getTime());
  while (cursor.getTime() < departure.getTime()) {
    dates.push(formatDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function roomIsAvailableOnDate(room: GroupSummaryRoomInput, date: string): boolean {
  if (room.availableFrom && date < room.availableFrom) return false;
  if (room.availableTo && date >= room.availableTo) return false;
  return true;
}

function getParticipantAccommodationShort(row: SummaryParticipantRow): string | null {
  return row.alloggio_short ?? alloggioLongToShort(row.alloggio);
}

function participantBelongsToGroup(
  participant: SummaryParticipantRow,
  group: AccommodationGroup
): boolean {
  const aliases = new Set([group.id, group.name].map((value) => value.trim()).filter(Boolean));
  const participantGroupId = (participant.gruppo_id ?? "").trim();
  const participantGroupLabel = (participant.gruppo_label ?? "").trim();
  return aliases.has(participantGroupId) || aliases.has(participantGroupLabel);
}

function toGroupSummary(input: GroupSummaryInput): AccommodationGroupSummary {
  const needsAccommodationCount = input.participants.length;
  const maleNeedCount = input.participants.filter(
    (participant) => participant.sexCategory === "male"
  ).length;
  const femaleNeedCount = input.participants.filter(
    (participant) => participant.sexCategory === "female"
  ).length;
  const unknownNeedCount =
    needsAccommodationCount - maleNeedCount - femaleNeedCount;
  const assignedCapacity = input.rooms.reduce((sum, room) => sum + room.capacity, 0);
  const assignedRoomCount = input.rooms.length;
  const participantsWithDates = input.participants.filter((participant) => {
    const arrival = normalizeText(participant.arrivalDate);
    const departure = normalizeText(participant.departureDate);
    return Boolean(arrival && departure && eachStayDate(arrival, departure).length > 0);
  });
  const participantsMissingStayDates =
    needsAccommodationCount - participantsWithDates.length;

  const earliestArrival =
    participantsWithDates
      .map((participant) => participant.arrivalDate ?? "")
      .filter(Boolean)
      .sort()[0] ?? null;
  const latestDeparture =
    participantsWithDates
      .map((participant) => participant.departureDate ?? "")
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  const warnings: AccommodationGroupSummaryWarning[] = [];

  let status: AccommodationGroupSummaryStatus = "exactly_allocated";
  if (needsAccommodationCount > 0 && assignedRoomCount === 0) {
    status = "unassigned";
  } else if (assignedCapacity < needsAccommodationCount) {
    status = "under_allocated";
  } else if (assignedCapacity > needsAccommodationCount) {
    status = "over_allocated";
  }

  if (needsAccommodationCount > 0 && assignedRoomCount === 0) {
    warnings.push({
      code: "missing_room_assignments",
      severity: "warning",
      message: "No rooms are assigned to this group yet.",
    });
  }

  if (assignedCapacity < needsAccommodationCount) {
    warnings.push({
      code: "nominal_capacity_shortage",
      severity: "warning",
      message: `Assigned room capacity is short by ${needsAccommodationCount - assignedCapacity} beds.`,
      meta: {
        assignedCapacity,
        needsAccommodationCount,
        shortage: needsAccommodationCount - assignedCapacity,
      },
    });
  }

  const sharedRooms = input.rooms.filter((room) => room.sharedGroupCount > 1);
  if (sharedRooms.length > 0) {
    warnings.push({
      code: "room_shared_across_groups",
      severity: "warning",
      message: `${sharedRooms.length} assigned room(s) are shared with other groups.`,
      meta: {
        sharedRoomCount: sharedRooms.length,
      },
    });
  }

  if (participantsMissingStayDates > 0) {
    warnings.push({
      code: "participants_missing_stay_dates",
      severity: "warning",
      message: `${participantsMissingStayDates} participant(s) are missing valid arrival/departure dates and are excluded from day-by-day checks.`,
      meta: {
        participantsMissingStayDates,
      },
    });
  }

  const boundedRoomStarts = input.rooms
    .map((room) => room.availableFrom)
    .filter((value): value is string => Boolean(value))
    .sort();
  if (earliestArrival && boundedRoomStarts[0] && boundedRoomStarts[0] > earliestArrival) {
    warnings.push({
      code: "room_availability_starts_late",
      severity: "warning",
      message: `The earliest assigned room becomes available on ${boundedRoomStarts[0]}, after some participants arrive on ${earliestArrival}.`,
      meta: {
        earliestArrival,
        earliestRoomAvailableFrom: boundedRoomStarts[0],
      },
    });
  }

  const boundedRoomEnds = input.rooms
    .map((room) => room.availableTo)
    .filter((value): value is string => Boolean(value))
    .sort();
  const latestRoomEnd = boundedRoomEnds.at(-1) ?? null;
  if (latestDeparture && latestRoomEnd && latestRoomEnd < latestDeparture) {
    warnings.push({
      code: "room_availability_ends_early",
      severity: "warning",
      message: `The latest assigned room ends on ${latestRoomEnd}, before some participants leave on ${latestDeparture}.`,
      meta: {
        latestDeparture,
        latestRoomAvailableTo: latestRoomEnd,
      },
    });
  }

  const demandByDate = new Map<string, number>();
  for (const participant of participantsWithDates) {
    for (const date of eachStayDate(
      participant.arrivalDate ?? "",
      participant.departureDate ?? ""
    )) {
      demandByDate.set(date, (demandByDate.get(date) ?? 0) + 1);
    }
  }

  const shortageDates: string[] = [];
  let maxDailyShortage = 0;
  for (const [date, demand] of [...demandByDate.entries()].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const supply = input.rooms.reduce(
      (sum, room) => sum + (roomIsAvailableOnDate(room, date) ? room.capacity : 0),
      0
    );
    if (demand > supply) {
      shortageDates.push(date);
      maxDailyShortage = Math.max(maxDailyShortage, demand - supply);
    }
  }

  if (shortageDates.length > 0) {
    warnings.push({
      code: "daily_capacity_shortage",
      severity: "warning",
      message: `Assigned rooms are short on ${shortageDates.length} day(s), with a maximum shortage of ${maxDailyShortage} bed(s).`,
      meta: {
        shortageDays: shortageDates.length,
        maxDailyShortage,
        shortageDates,
      },
    });
  }

  return {
    groupId: input.groupId,
    groupName: input.groupName,
    needsAccommodationCount,
    maleNeedCount,
    femaleNeedCount,
    unknownNeedCount,
    assignedCapacity,
    assignedRoomCount,
    status,
    warnings,
    shortageDates,
    maxDailyShortage,
    participantsMissingStayDates,
    earliestArrival,
    latestDeparture,
  };
}

export function buildAccommodationGroupSummaries(args: {
  groups: AccommodationGroup[];
  allocations: AccommodationGroupRoomAllocation[];
  participants: SummaryParticipantRow[];
}): AccommodationGroupSummary[] {
  const allocationsByGroupId = new Map<string, AccommodationGroupRoomAllocation[]>();
  for (const allocation of args.allocations) {
    const current = allocationsByGroupId.get(allocation.groupId) ?? [];
    current.push(allocation);
    allocationsByGroupId.set(allocation.groupId, current);
  }

  return args.groups.map((group) => {
    const participantInputs = args.participants
      .filter(
        (participant) =>
          participantBelongsToGroup(participant, group) &&
          isOrganizationProvidedAccommodation(getParticipantAccommodationShort(participant))
      )
      .map((participant) => ({
        id: participant.id,
        arrivalDate: normalizeText(participant.data_arrivo),
        departureDate: normalizeText(participant.data_partenza),
        sexCategory: normalizeParticipantSexCategory(participant.sesso),
      }));

    const roomInputs = (allocationsByGroupId.get(group.id) ?? [])
      .map((allocation) => allocation.room)
      .filter((room): room is AccommodationRoom => Boolean(room))
      .map((room) => ({
        id: room.id,
        capacity: room.capacity,
        availableFrom: room.availableFrom,
        availableTo: room.availableTo,
        sharedGroupCount: room.assignedGroupCount,
      }));

    return toGroupSummary({
      groupId: group.id,
      groupName: group.name,
      participants: participantInputs,
      rooms: roomInputs,
    });
  });
}

async function ensureGroupExists(service: ServiceClient, groupId: string) {
  const { data, error } = await service
    .from("gruppi")
    .select("id")
    .eq("id", groupId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Group not found");
  }
}

export async function loadAccommodationGroups(
  service: ServiceClient
): Promise<AccommodationGroup[]> {
  const [groupsRes, participantsRes] = await Promise.all([
    service.from("gruppi").select("id,nome").order("id", { ascending: true }),
    service.from("partecipanti").select("gruppo_id,gruppo_label").is("deleted_at", null),
  ]);

  if (groupsRes.error) {
    throw new Error(groupsRes.error.message);
  }
  if (participantsRes.error) {
    throw new Error(participantsRes.error.message);
  }

  const participantGroupLabels = [
    ...new Set(
      ((participantsRes.data ?? []) as ParticipantGroupPresenceRow[])
        .map((row) => normalizeText(row.gruppo_id) ?? normalizeText(row.gruppo_label))
        .filter((value): value is string => Boolean(value))
    ),
  ];

  if (participantGroupLabels.length === 0) {
    return [];
  }

  const remainingParticipantGroups = new Map(
    participantGroupLabels.map((label) => [normalizeForMatching(label), label])
  );

  const groups: AccommodationGroup[] = [];
  for (const row of (groupsRes.data ?? []) as GroupRow[]) {
    const id = normalizeText(row.id);
    if (!id) continue;

    const name = normalizeText(row.nome) ?? id;
    const normalizedId = normalizeForMatching(id);
    const normalizedName = normalizeForMatching(name);
    const matchesParticipantGroup =
      remainingParticipantGroups.has(normalizedId) ||
      remainingParticipantGroups.has(normalizedName);

    if (!matchesParticipantGroup) continue;

    groups.push({ id, name });
    remainingParticipantGroups.delete(normalizedId);
    remainingParticipantGroups.delete(normalizedName);
  }

  for (const label of remainingParticipantGroups.values()) {
    groups.push({ id: label, name: label });
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadAccommodationGroupRoomAllocations(
  service: ServiceClient,
  filters: { groupId?: string | null } = {}
): Promise<AccommodationGroupRoomAllocation[]> {
  let query = service
    .from("stanze_gruppi")
    .select("stanza_id,gruppo_id,created_at,created_by");

  if (filters.groupId) {
    query = query.eq("gruppo_id", filters.groupId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as RoomGroupAllocationRow[];
  const roomIds = [...new Set(rows.map((row) => row.stanza_id ?? "").filter(Boolean))];
  const rooms =
    roomIds.length > 0 ? await loadAccommodationRooms(service, { roomIds }) : [];
  const roomById = new Map(rooms.map((room) => [room.id, room]));

  return rows
    .filter((row) => row.stanza_id && row.gruppo_id)
    .map((row) => ({
      groupId: String(row.gruppo_id),
      roomId: String(row.stanza_id),
      createdAt: row.created_at,
      createdBy: row.created_by,
      room: roomById.get(String(row.stanza_id)) ?? null,
    }))
    .sort((a, b) => {
      const byGroup = a.groupId.localeCompare(b.groupId);
      if (byGroup !== 0) return byGroup;
      return (a.room?.internalCode ?? "").localeCompare(b.room?.internalCode ?? "");
    });
}

export async function assignAccommodationRoomToGroup(
  service: ServiceClient,
  args: { groupId: string; roomId: string; actorId?: string | null }
): Promise<AccommodationGroupRoomAllocation> {
  const groupId = args.groupId.trim();
  const roomId = args.roomId.trim();

  if (!groupId) {
    throw new Error("groupId is required");
  }
  if (!roomId) {
    throw new Error("roomId is required");
  }

  await Promise.all([
    ensureGroupExists(service, groupId),
    loadAccommodationRoomById(service, roomId).then((room) => {
      if (!room) throw new Error("Room not found");
    }),
  ]);

  const { error } = await service.from("stanze_gruppi").upsert(
    {
      stanza_id: roomId,
      gruppo_id: groupId,
      created_by: args.actorId ?? null,
    },
    {
      onConflict: "stanza_id,gruppo_id",
      ignoreDuplicates: true,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  const allocations = await loadAccommodationGroupRoomAllocations(service, { groupId });
  const allocation = allocations.find(
    (item) => item.groupId === groupId && item.roomId === roomId
  );
  if (!allocation) {
    throw new Error("Room-group allocation saved but reload failed");
  }
  return allocation;
}

export async function unassignAccommodationRoomFromGroup(
  service: ServiceClient,
  args: { groupId: string; roomId: string }
): Promise<{ groupId: string; roomId: string }> {
  const groupId = args.groupId.trim();
  const roomId = args.roomId.trim();

  if (!groupId) {
    throw new Error("groupId is required");
  }
  if (!roomId) {
    throw new Error("roomId is required");
  }

  const { error } = await service
    .from("stanze_gruppi")
    .delete()
    .eq("gruppo_id", groupId)
    .eq("stanza_id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  return { groupId, roomId };
}

export async function loadAccommodationGroupSummaries(
  service: ServiceClient,
  filters: { groupId?: string | null } = {}
): Promise<AccommodationGroupSummary[]> {
  const [groups, allocations, participantsRes] = await Promise.all([
    loadAccommodationGroups(service),
    loadAccommodationGroupRoomAllocations(service, filters),
    service
      .from("partecipanti")
      .select("id,gruppo_id,gruppo_label,alloggio,alloggio_short,sesso,data_arrivo,data_partenza")
      .is("deleted_at", null),
  ]);

  if (participantsRes.error) {
    throw new Error(participantsRes.error.message);
  }

  const filteredGroups = filters.groupId
    ? groups.filter((group) => group.id === filters.groupId)
    : groups;

  return buildAccommodationGroupSummaries({
    groups: filteredGroups,
    allocations,
    participants: (participantsRes.data ?? []) as SummaryParticipantRow[],
  }).sort((a, b) => a.groupName.localeCompare(b.groupName));
}
