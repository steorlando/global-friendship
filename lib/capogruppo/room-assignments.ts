import type { SupabaseClient } from "@supabase/supabase-js";
import { computeParticipantCalculatedFields } from "../tally/calculated-fields.ts";
import { alloggioLongToShort } from "../partecipante/constants.ts";
import {
  isOrganizationProvidedAccommodation,
  loadAccommodationRooms,
  type AccommodationRoom,
  type RoomGenderPolicy,
} from "../alloggi/inventory.ts";
import { loadAccommodationGroups } from "../alloggi/group-allocations.ts";

type ServiceClient = SupabaseClient;

type ParticipantRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  data_nascita: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  sesso: string | null;
  eta: number | null;
};

type RoomScopeRow = {
  stanza_id: string | null;
  gruppo_id: string | null;
};

type ParticipantAssignmentRow = {
  id: string;
  partecipante_id: string | null;
  stanza_id: string | null;
  gruppo_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
};

export type GroupLeaderRoomAssignmentGroup = {
  id: string;
  name: string;
};

export type GroupLeaderParticipant = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  groupId: string | null;
  groupLabel: string | null;
  displayGroup: string;
  accommodation: string | null;
  arrivalDate: string | null;
  departureDate: string | null;
  sex: string | null;
  sexCategory: GroupLeaderParticipantSexCategory;
  age: number | null;
};

export type GroupLeaderRoomScope = {
  groupId: string;
  roomId: string;
};

export type GroupLeaderParticipantRoomAssignment = {
  id: string;
  participantId: string;
  roomId: string;
  groupId: string;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
};

export type GroupLeaderRoomAssignmentData = {
  groups: GroupLeaderRoomAssignmentGroup[];
  showGroupColumn: boolean;
  participants: GroupLeaderParticipant[];
  rooms: AccommodationRoom[];
  roomScopes: GroupLeaderRoomScope[];
  assignments: GroupLeaderParticipantRoomAssignment[];
};

export type GroupLeaderParticipantSexCategory = "male" | "female" | null;

export type GroupLeaderRoomAssignmentWarning = {
  code: "participant_sex_unknown" | "existing_occupant_sex_unknown";
  message: string;
  meta?: Record<string, string | number | null>;
};

export type GroupLeaderRoomAssignmentValidationInput = {
  allowedGroupIds: string[];
  participant: {
    id: string;
    groupId: string | null;
    groupLabel: string | null;
    accommodation: string | null;
    accommodationShort: string | null;
    arrivalDate: string | null;
    departureDate: string | null;
    sex: string | null;
  };
  room: {
    id: string;
    capacity: number;
    genderPolicy: RoomGenderPolicy;
    availableFrom: string | null;
    availableTo: string | null;
  };
  roomScopeGroupIds: string[];
  existingOccupants: Array<{
    participantId: string;
    arrivalDate: string | null;
    departureDate: string | null;
    sex: string | null;
  }>;
};

export type LegacyParticipantRoomFields = {
  stanza_id: string | null;
  albergo_id: string | null;
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

function eachStayDate(arrivalDate: string, departureDate: string): string[] {
  const arrival = parseDateOnly(arrivalDate);
  const departure = parseDateOnly(departureDate);
  if (!arrival || !departure || departure.getTime() <= arrival.getTime()) {
    return [];
  }

  const dates: string[] = [];
  const cursor = new Date(arrival.getTime());
  while (cursor.getTime() < departure.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function getParticipantAccommodationShort(row: {
  alloggio: string | null;
  alloggio_short: string | null;
}): string | null {
  return row.alloggio_short ?? alloggioLongToShort(row.alloggio);
}

function buildDisplayGroup(row: {
  gruppo_id: string | null;
  gruppo_label: string | null;
}): string {
  return normalizeText(row.gruppo_label) ?? normalizeText(row.gruppo_id) ?? "-";
}

function resolveAuthorizedGroupId(
  allowedGroupIds: string[],
  participant: { groupId: string | null; groupLabel: string | null }
): string | null {
  const allowed = new Set(allowedGroupIds.map((value) => value.trim()).filter(Boolean));
  const candidateGroupId = normalizeText(participant.groupId);
  const candidateGroupLabel = normalizeText(participant.groupLabel);

  if (candidateGroupId && allowed.has(candidateGroupId)) {
    return candidateGroupId;
  }
  if (candidateGroupLabel && allowed.has(candidateGroupLabel)) {
    return candidateGroupLabel;
  }
  return null;
}

export function normalizeParticipantSexCategory(
  value: string | null | undefined
): GroupLeaderParticipantSexCategory {
  const normalized = normalizeForMatching(value);
  if (!normalized) return null;

  if (
    [
      "male",
      "m",
      "man",
      "maschio",
      "maschile",
      "uomo",
      "boy",
    ].includes(normalized)
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

export function buildLegacyParticipantRoomFields(args: {
  roomId: string | null;
  hotelId: string | null;
}): LegacyParticipantRoomFields {
  return {
    stanza_id: normalizeText(args.roomId),
    albergo_id: normalizeText(args.hotelId),
  };
}

export async function syncLegacyParticipantRoomFields(
  service: ServiceClient,
  args: {
    participantId: string;
    roomId: string | null;
    hotelId: string | null;
  }
) {
  const participantId = normalizeText(args.participantId);
  if (!participantId) {
    throw new Error("participantId is required");
  }

  const { error } = await service
    .from("partecipanti")
    .update(buildLegacyParticipantRoomFields({
      roomId: args.roomId,
      hotelId: args.hotelId,
    }))
    .eq("id", participantId);

  if (error) {
    throw new Error(error.message);
  }
}

export function validateGroupLeaderRoomAssignment(
  input: GroupLeaderRoomAssignmentValidationInput
): { warnings: GroupLeaderRoomAssignmentWarning[]; resolvedGroupId: string } {
  const resolvedGroupId = resolveAuthorizedGroupId(input.allowedGroupIds, {
    groupId: input.participant.groupId,
    groupLabel: input.participant.groupLabel,
  });

  if (!resolvedGroupId) {
    throw new Error("Participant is outside the authorized groups");
  }

  if (
    !isOrganizationProvidedAccommodation(
      input.participant.accommodationShort ?? input.participant.accommodation
    )
  ) {
    throw new Error("Participant is not eligible for organization-provided accommodation");
  }

  if (!input.roomScopeGroupIds.includes(resolvedGroupId)) {
    throw new Error("Room is not assigned to the participant group");
  }

  const stayDates = eachStayDate(
    normalizeText(input.participant.arrivalDate) ?? "",
    normalizeText(input.participant.departureDate) ?? ""
  );

  if (stayDates.length === 0) {
    throw new Error("Participant must have valid arrival and departure dates");
  }

  const firstStayDate = stayDates[0] ?? null;
  const lastStayDate = stayDates.at(-1) ?? null;
  if (!firstStayDate || !lastStayDate) {
    throw new Error("Participant must have valid arrival and departure dates");
  }

  if (input.room.availableFrom && firstStayDate < input.room.availableFrom) {
    throw new Error("Room availability starts after the participant arrival");
  }
  if (input.room.availableTo && lastStayDate >= input.room.availableTo) {
    throw new Error("Room availability ends before the participant departure");
  }

  const warnings: GroupLeaderRoomAssignmentWarning[] = [];
  const participantSexCategory = normalizeParticipantSexCategory(input.participant.sex);
  if (!participantSexCategory) {
    warnings.push({
      code: "participant_sex_unknown",
      message: "Participant sex/gender is missing or ambiguous.",
      meta: { participantId: input.participant.id },
    });
  }

  if (input.room.genderPolicy === "male_only" && participantSexCategory === "female") {
    throw new Error("Female participants cannot be assigned to a male-only room");
  }
  if (input.room.genderPolicy === "female_only" && participantSexCategory === "male") {
    throw new Error("Male participants cannot be assigned to a female-only room");
  }

  const occupancyByDate = new Map<string, number>();

  for (const occupant of input.existingOccupants) {
    const occupantStayDates = eachStayDate(
      normalizeText(occupant.arrivalDate) ?? "",
      normalizeText(occupant.departureDate) ?? ""
    );

    if (occupantStayDates.length === 0) {
      throw new Error(
        "Cannot validate room capacity because an assigned participant has incomplete stay dates"
      );
    }

    const occupantSexCategory = normalizeParticipantSexCategory(occupant.sex);
    if (!occupantSexCategory) {
      warnings.push({
        code: "existing_occupant_sex_unknown",
        message: "An already assigned participant has missing or ambiguous sex/gender data.",
        meta: { participantId: occupant.participantId },
      });
    }

    if (input.room.genderPolicy === "male_only" && occupantSexCategory === "female") {
      throw new Error("Room already contains occupants incompatible with a male-only policy");
    }
    if (input.room.genderPolicy === "female_only" && occupantSexCategory === "male") {
      throw new Error("Room already contains occupants incompatible with a female-only policy");
    }

    for (const date of occupantStayDates) {
      occupancyByDate.set(date, (occupancyByDate.get(date) ?? 0) + 1);
    }
  }

  for (const date of stayDates) {
    const nextOccupancy = (occupancyByDate.get(date) ?? 0) + 1;
    if (nextOccupancy > input.room.capacity) {
      throw new Error("Room capacity would be exceeded for overlapping stay dates");
    }
  }

  return {
    warnings,
    resolvedGroupId,
  };
}

async function loadParticipantsForGroups(
  service: ServiceClient,
  groupIds: string[]
): Promise<ParticipantRow[]> {
  if (groupIds.length === 0) return [];

  const [byGroupId, byGroupLabel] = await Promise.all([
    service
      .from("partecipanti")
      .select(
        "id,nome,cognome,email,gruppo_id,gruppo_label,alloggio,alloggio_short,data_nascita,data_arrivo,data_partenza,sesso,eta"
      )
      .is("deleted_at", null)
      .in("gruppo_id", groupIds),
    service
      .from("partecipanti")
      .select(
        "id,nome,cognome,email,gruppo_id,gruppo_label,alloggio,alloggio_short,data_nascita,data_arrivo,data_partenza,sesso,eta"
      )
      .is("deleted_at", null)
      .in("gruppo_label", groupIds),
  ]);

  if (byGroupId.error) {
    throw new Error(byGroupId.error.message);
  }
  if (byGroupLabel.error) {
    throw new Error(byGroupLabel.error.message);
  }

  const merged = new Map<string, ParticipantRow>();
  for (const row of [...(byGroupId.data ?? []), ...(byGroupLabel.data ?? [])]) {
    if (!row.id) continue;
    merged.set(row.id, row as ParticipantRow);
  }

  return [...merged.values()].sort((a, b) => {
    const bySurname = (a.cognome ?? "").localeCompare(b.cognome ?? "");
    if (bySurname !== 0) return bySurname;
    return (a.nome ?? "").localeCompare(b.nome ?? "");
  });
}

function toGroupLeaderParticipant(row: ParticipantRow): GroupLeaderParticipant {
  const calculated = computeParticipantCalculatedFields({
    arrival: parseDateOnly(row.data_arrivo),
    departure: parseDateOnly(row.data_partenza),
    dataNascita: row.data_nascita,
  });

  return {
    id: row.id,
    firstName: row.nome,
    lastName: row.cognome,
    email: row.email,
    groupId: normalizeText(row.gruppo_id),
    groupLabel: normalizeText(row.gruppo_label),
    displayGroup: buildDisplayGroup(row),
    accommodation: getParticipantAccommodationShort(row),
    arrivalDate: row.data_arrivo,
    departureDate: row.data_partenza,
    sex: normalizeText(row.sesso),
    sexCategory: normalizeParticipantSexCategory(row.sesso),
    age: row.eta ?? calculated.eta,
  };
}

export async function loadGroupLeaderRoomAssignmentData(
  service: ServiceClient,
  allowedGroupIds: string[],
  filters: { groupId?: string | null } = {}
): Promise<GroupLeaderRoomAssignmentData> {
  const scopedGroupIds = filters.groupId
    ? allowedGroupIds.filter((groupId) => groupId === filters.groupId)
    : allowedGroupIds;

  const [allGroups, participantRows, roomScopesRes] = await Promise.all([
    loadAccommodationGroups(service),
    loadParticipantsForGroups(service, scopedGroupIds),
    scopedGroupIds.length > 0
      ? service.from("stanze_gruppi").select("stanza_id,gruppo_id").in("gruppo_id", scopedGroupIds)
      : Promise.resolve({ data: [] as RoomScopeRow[], error: null }),
  ]);

  if (roomScopesRes.error) {
    throw new Error(roomScopesRes.error.message);
  }

  const groups = allGroups.filter((group) => scopedGroupIds.includes(group.id));
  const participants = participantRows
    .filter((row) => isOrganizationProvidedAccommodation(getParticipantAccommodationShort(row)))
    .map(toGroupLeaderParticipant);

  const roomScopes = ((roomScopesRes.data ?? []) as RoomScopeRow[])
    .filter((row) => row.stanza_id && row.gruppo_id)
    .map((row) => ({
      groupId: String(row.gruppo_id),
      roomId: String(row.stanza_id),
    }))
    .sort((a, b) => {
      const byGroup = a.groupId.localeCompare(b.groupId);
      if (byGroup !== 0) return byGroup;
      return a.roomId.localeCompare(b.roomId);
    });

  const roomIds = [...new Set(roomScopes.map((row) => row.roomId))];
  const participantIds = participants.map((participant) => participant.id);

  const [rooms, assignmentsRes] = await Promise.all([
    roomIds.length > 0 ? loadAccommodationRooms(service, { roomIds }) : Promise.resolve([]),
    participantIds.length > 0
      ? service
          .from("partecipanti_stanze")
          .select("id,partecipante_id,stanza_id,gruppo_id,created_at,updated_at,created_by,updated_by")
          .in("partecipante_id", participantIds)
      : Promise.resolve({ data: [] as ParticipantAssignmentRow[], error: null }),
  ]);

  if (assignmentsRes.error) {
    throw new Error(assignmentsRes.error.message);
  }

  const assignments = ((assignmentsRes.data ?? []) as ParticipantAssignmentRow[])
    .filter((row) => row.partecipante_id && row.stanza_id && row.gruppo_id)
    .map((row) => ({
      id: row.id,
      participantId: String(row.partecipante_id),
      roomId: String(row.stanza_id),
      groupId: String(row.gruppo_id),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    }))
    .sort((a, b) => a.participantId.localeCompare(b.participantId));

  return {
    groups,
    showGroupColumn: groups.length > 1,
    participants,
    rooms,
    roomScopes,
    assignments,
  };
}
