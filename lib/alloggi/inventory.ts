import type { SupabaseClient } from "@supabase/supabase-js";

export const PROVIDED_BY_ORGANIZATION_ALLOGGIO = "Provided by organization";

export const ROOM_GENDER_POLICIES = [
  "male_only",
  "female_only",
  "mixed",
] as const;

export type RoomGenderPolicy = (typeof ROOM_GENDER_POLICIES)[number];

export type AccommodationHotel = {
  id: string;
  name: string;
  address: string | null;
  googleMapsUrl: string | null;
  createdAt: string;
  roomCount: number;
};

export type AccommodationHotelMutationInput = {
  name: string;
  address: string | null;
  googleMapsUrl: string | null;
};

export type AccommodationRoom = {
  id: string;
  hotelId: string;
  hotel: AccommodationHotel | null;
  legacyName: string;
  internalCode: string;
  realRoomNumber: string | null;
  capacity: number;
  genderPolicy: RoomGenderPolicy;
  availableFrom: string | null;
  availableTo: string | null;
  createdAt: string;
  updatedAt: string;
  assignedGroupCount: number;
  assignedParticipantCount: number;
};

export type AccommodationRoomOccupant = {
  participantId: string;
  firstName: string | null;
  lastName: string | null;
  groupName: string | null;
};

export type AccommodationRoomMutationInput = {
  hotelId: string;
  realRoomNumber: string | null;
  capacity: number;
  genderPolicy: RoomGenderPolicy;
  availableFrom: string | null;
  availableTo: string | null;
};

export type AccommodationRoomImportRowInput = {
  realRoomNumber: string | null;
  capacity: number;
  availableFrom: string | null;
  availableTo: string | null;
};

type ServiceClient = SupabaseClient;

type HotelRow = {
  id: string;
  nome: string | null;
  città: string | null;
  nazione: string | null;
  indirizzo: string | null;
  google_maps_url: string | null;
  created_at: string;
};

type RoomRow = {
  id: string;
  albergo_id: string;
  nome: string | null;
  codice_interno: string | null;
  numero_reale: string | null;
  capienza: number | null;
  gender_policy: RoomGenderPolicy | null;
  available_from: string | null;
  available_to: string | null;
  created_at: string;
  updated_at: string;
};

type RoomGroupRow = {
  stanza_id: string | null;
  gruppo_id: string | null;
};

type ParticipantRoomAssignmentRow = {
  partecipante_id?: string | null;
  stanza_id: string | null;
};

type OccupantParticipantRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
};

const HOTEL_SELECT_FIELDS = "*";
const ROOM_SELECT_FIELDS =
  "id,albergo_id,nome,codice_interno,numero_reale,capienza,gender_policy,available_from,available_to,created_at,updated_at";
const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DAY_FIRST_DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalDate(
  value: unknown,
  fieldName: string
): { value: string | null; error: string | null } {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      value: value.toISOString().slice(0, 10),
      error: null,
    };
  }

  const normalized = normalizeText(value);
  if (!normalized) return { value: null, error: null };
  if (!DATE_ONLY_REGEX.test(normalized)) {
    const dayFirstMatch = normalized.match(DAY_FIRST_DATE_REGEX);
    if (dayFirstMatch) {
      const [, dayRaw, monthRaw, yearRaw] = dayFirstMatch;
      const day = Number(dayRaw);
      const month = Number(monthRaw);
      const year = Number(yearRaw);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (
        parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day
      ) {
        return {
          value: `${yearRaw}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
          error: null,
        };
      }
    }

    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime()) && normalized.includes("T")) {
      return {
        value: parsed.toISOString().slice(0, 10),
        error: null,
      };
    }

    return {
      value: null,
      error: `${fieldName} must be a valid date (YYYY-MM-DD or DD/MM/YYYY)`,
    };
  }
  return { value: normalized, error: null };
}

function normalizePositiveInteger(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 1) {
    return null;
  }
  return numeric;
}

function normalizeOptionalUrl(
  value: unknown,
  fieldName: string
): { value: string | null; error: string | null } {
  const normalized = normalizeText(value);
  if (!normalized) return { value: null, error: null };

  try {
    const url = new URL(normalized);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { value: null, error: `${fieldName} must start with http:// or https://` };
    }
    return { value: normalized, error: null };
  } catch {
    return { value: null, error: `${fieldName} must be a valid URL` };
  }
}

function normalizeRoomGenderPolicy(value: unknown): RoomGenderPolicy | null {
  if (value === "male_only") return "male_only";
  if (value === "female_only") return "female_only";
  if (value === "mixed") return "mixed";
  return null;
}

const ROOM_CODE_REGEX = /^([A-Z]{2})-(\d{2})-([A-Z]+)$/;

export function buildHotelRoomCodePrefix(hotelName: string): string {
  const asciiLetters = hotelName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase();

  return (asciiLetters.slice(0, 2) || "XX").padEnd(2, "X");
}

function formatCapacityCode(capacity: number): string {
  return String(capacity).padStart(2, "0");
}

export function formatRoomSequenceLabel(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Room sequence index must be a non-negative integer");
  }

  let current = index + 1;
  let label = "";
  while (current > 0) {
    current -= 1;
    label = String.fromCharCode(65 + (current % 26)) + label;
    current = Math.floor(current / 26);
  }

  return label;
}

function parseRoomSequenceLabel(label: string): number | null {
  const normalized = label.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return null;

  let value = 0;
  for (const char of normalized) {
    value = value * 26 + (char.charCodeAt(0) - 64);
  }
  return value - 1;
}

export function buildNextInternalRoomCode(args: {
  hotelName: string;
  capacity: number;
  existingCodes: Iterable<string>;
}): string {
  const prefix = buildHotelRoomCodePrefix(args.hotelName);
  const capacityCode = formatCapacityCode(args.capacity);
  const roomCodeStem = `${prefix}-${capacityCode}-`;
  const usedIndexes = new Set<number>();

  for (const existingCode of args.existingCodes) {
    const match = existingCode.trim().toUpperCase().match(ROOM_CODE_REGEX);
    if (!match) continue;
    const [, existingPrefix, existingCapacity, sequenceLabel] = match;
    if (existingPrefix !== prefix || existingCapacity !== capacityCode) continue;
    const index = parseRoomSequenceLabel(sequenceLabel);
    if (index === null) continue;
    usedIndexes.add(index);
  }

  let nextIndex = 0;
  while (usedIndexes.has(nextIndex)) {
    nextIndex += 1;
  }

  return `${roomCodeStem}${formatRoomSequenceLabel(nextIndex)}`;
}

function buildRoomLegacyName(internalCode: string): string {
  return internalCode;
}

function roomRowToMutationDefaults(row: RoomRow): AccommodationRoomMutationInput {
  return {
    hotelId: row.albergo_id,
    realRoomNumber: row.numero_reale,
    capacity: row.capienza ?? 1,
    genderPolicy: row.gender_policy ?? "mixed",
    availableFrom: row.available_from,
    availableTo: row.available_to,
  };
}

function getObjectValue(
  value: Record<string, unknown>,
  keys: string[]
): unknown {
  for (const key of keys) {
    if (key in value) return value[key];
  }
  return undefined;
}

export function isOrganizationProvidedAccommodation(
  value: string | null | undefined
): boolean {
  return (value ?? "").trim().toLowerCase() ===
    PROVIDED_BY_ORGANIZATION_ALLOGGIO.toLowerCase();
}

export function normalizeAccommodationHotelInput(
  value: Record<string, unknown>,
  current: Partial<AccommodationHotelMutationInput> = {}
):
  | { data: AccommodationHotelMutationInput; error: null }
  | { data: null; error: string } {
  const name =
    normalizeText(getObjectValue(value, ["name", "nome"])) ?? current.name ?? null;
  if (!name) {
    return { data: null, error: "name is required" };
  }

  const addressRaw = getObjectValue(value, ["address", "indirizzo"]);
  const googleMapsUrlRaw = getObjectValue(value, [
    "googleMapsUrl",
    "google_maps_url",
    "googleMapsLink",
  ]);

  const googleMapsUrlResult =
    googleMapsUrlRaw === undefined
      ? { value: current.googleMapsUrl ?? null, error: null }
      : normalizeOptionalUrl(googleMapsUrlRaw, "googleMapsUrl");
  if (googleMapsUrlResult.error) {
    return { data: null, error: googleMapsUrlResult.error };
  }

  return {
    data: {
      name,
      address:
        addressRaw === undefined ? current.address ?? null : normalizeText(addressRaw),
      googleMapsUrl: googleMapsUrlResult.value,
    },
    error: null,
  };
}

export function normalizeAccommodationRoomInput(
  value: Record<string, unknown>,
  current: Partial<AccommodationRoomMutationInput> = {}
):
  | { data: AccommodationRoomMutationInput; error: null }
  | { data: null; error: string } {
  const hotelId =
    normalizeText(getObjectValue(value, ["hotelId", "albergoId", "albergo_id"])) ??
    current.hotelId ??
    null;
  if (!hotelId) {
    return { data: null, error: "hotelId is required" };
  }

  const realRoomNumberRaw = getObjectValue(value, [
    "realRoomNumber",
    "numeroReale",
    "numero_reale",
  ]);
  const realRoomNumber =
    realRoomNumberRaw === undefined
      ? current.realRoomNumber ?? null
      : normalizeText(realRoomNumberRaw);

  const capacityRaw = getObjectValue(value, ["capacity", "capienza"]);
  const capacity =
    capacityRaw === undefined
      ? current.capacity ?? null
      : normalizePositiveInteger(capacityRaw);
  if (!capacity) {
    return { data: null, error: "capacity must be a positive integer" };
  }

  const genderPolicyRaw = getObjectValue(value, ["genderPolicy", "gender_policy"]);
  const genderPolicy =
    genderPolicyRaw === undefined
      ? current.genderPolicy ?? "mixed"
      : normalizeRoomGenderPolicy(genderPolicyRaw);
  if (!genderPolicy) {
    return {
      data: null,
      error: "genderPolicy must be one of male_only, female_only, mixed",
    };
  }

  const availableFromRaw = getObjectValue(value, ["availableFrom", "available_from"]);
  const availableFromResult =
    availableFromRaw === undefined
      ? { value: current.availableFrom ?? null, error: null }
      : normalizeOptionalDate(availableFromRaw, "availableFrom");
  if (availableFromResult.error) {
    return { data: null, error: availableFromResult.error };
  }

  const availableToRaw = getObjectValue(value, ["availableTo", "available_to"]);
  const availableToResult =
    availableToRaw === undefined
      ? { value: current.availableTo ?? null, error: null }
      : normalizeOptionalDate(availableToRaw, "availableTo");
  if (availableToResult.error) {
    return { data: null, error: availableToResult.error };
  }

  if (
    availableFromResult.value &&
    availableToResult.value &&
    availableToResult.value <= availableFromResult.value
  ) {
    return {
      data: null,
      error: "availableTo must be after availableFrom",
    };
  }

  return {
    data: {
      hotelId,
      realRoomNumber,
      capacity,
      genderPolicy,
      availableFrom: availableFromResult.value,
      availableTo: availableToResult.value,
    },
    error: null,
  };
}

function mapInventoryErrorMessage(
  error: { code?: string | null; message?: string | null },
  fallback: string
): string {
  const message = error.message ?? fallback;

  if (error.code === "23505") {
    const lowered = message.toLowerCase();
    if (lowered.includes("codice_interno")) {
      return "A room with this internalCode already exists";
    }
    if (lowered.includes("numero_reale")) {
      return "This realRoomNumber is already used for the selected hotel";
    }
    return "A room with the same identifying data already exists";
  }

  if (error.code === "23503") {
    return "The selected hotel does not exist";
  }

  if (error.code === "23514") {
    return "The room data failed validation";
  }

  return message;
}

function mapHotelRow(row: HotelRow, roomCount: number): AccommodationHotel {
  return {
    id: row.id,
    name: row.nome ?? "",
    address: row.indirizzo,
    googleMapsUrl: row.google_maps_url,
    createdAt: row.created_at,
    roomCount,
  };
}

function mapRoomRow(args: {
  row: RoomRow;
  hotel: AccommodationHotel | null;
  assignedGroupCount: number;
  assignedParticipantCount: number;
}): AccommodationRoom {
  return {
    id: args.row.id,
    hotelId: args.row.albergo_id,
    hotel: args.hotel,
    legacyName: args.row.nome ?? "",
    internalCode: args.row.codice_interno ?? args.row.nome ?? "",
    realRoomNumber: args.row.numero_reale,
    capacity: args.row.capienza ?? 0,
    genderPolicy: args.row.gender_policy ?? "mixed",
    availableFrom: args.row.available_from,
    availableTo: args.row.available_to,
    createdAt: args.row.created_at,
    updatedAt: args.row.updated_at,
    assignedGroupCount: args.assignedGroupCount,
    assignedParticipantCount: args.assignedParticipantCount,
  };
}

async function ensureHotelExists(service: ServiceClient, hotelId: string) {
  const { data, error } = await service
    .from("alberghi")
    .select("id")
    .eq("id", hotelId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.id) {
    throw new Error("Hotel not found");
  }
}

async function loadHotelRowById(
  service: ServiceClient,
  hotelId: string
): Promise<HotelRow | null> {
  const { data, error } = await service
    .from("alberghi")
    .select(HOTEL_SELECT_FIELDS)
    .eq("id", hotelId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as HotelRow | null) ?? null;
}

async function loadRoomRowById(
  service: ServiceClient,
  roomId: string
): Promise<RoomRow | null> {
  const { data, error } = await service
    .from("stanze")
    .select(ROOM_SELECT_FIELDS)
    .eq("id", roomId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as RoomRow | null) ?? null;
}

async function loadInternalCodesForHotel(
  service: ServiceClient,
  hotelId: string,
  excludeRoomId?: string
): Promise<string[]> {
  let query = service
    .from("stanze")
    .select("id,codice_interno")
    .eq("albergo_id", hotelId);

  if (excludeRoomId) {
    query = query.neq("id", excludeRoomId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) =>
      typeof row.codice_interno === "string" ? row.codice_interno.trim() : ""
    )
    .filter(Boolean);
}

async function buildGeneratedInternalCode(
  service: ServiceClient,
  hotelId: string,
  capacity: number,
  options: { excludeRoomId?: string } = {}
): Promise<string> {
  const [hotelRow, existingCodes] = await Promise.all([
    loadHotelRowById(service, hotelId),
    loadInternalCodesForHotel(service, hotelId, options.excludeRoomId),
  ]);

  if (!hotelRow?.id) {
    throw new Error("Hotel not found");
  }

  return buildNextInternalRoomCode({
    hotelName: hotelRow.nome ?? "",
    capacity,
    existingCodes,
  });
}

function canReuseExistingInternalCode(
  existingRoom: RoomRow,
  nextHotelName: string,
  nextCapacity: number
): boolean {
  const existingCode = (existingRoom.codice_interno ?? "").trim();
  const existingCapacity = existingRoom.capienza ?? 0;
  if (!existingCode || existingRoom.albergo_id === "" || existingCapacity < 1) {
    return false;
  }

  const match = existingCode.toUpperCase().match(ROOM_CODE_REGEX);
  if (!match) {
    return false;
  }

  const [, existingPrefix, existingCapacityCode] = match;
  return (
    existingPrefix === buildHotelRoomCodePrefix(nextHotelName) &&
    existingCapacityCode === formatCapacityCode(nextCapacity)
  );
}

export async function loadAccommodationHotels(
  service: ServiceClient
): Promise<AccommodationHotel[]> {
  const [hotelsRes, roomsRes] = await Promise.all([
    service.from("alberghi").select(HOTEL_SELECT_FIELDS).order("nome", { ascending: true }),
    service.from("stanze").select("albergo_id"),
  ]);

  if (hotelsRes.error) {
    throw new Error(hotelsRes.error.message);
  }

  if (roomsRes.error) {
    throw new Error(roomsRes.error.message);
  }

  const roomCountByHotelId = new Map<string, number>();
  for (const row of roomsRes.data ?? []) {
    const hotelId =
      typeof row.albergo_id === "string" ? row.albergo_id.trim() : "";
    if (!hotelId) continue;
    roomCountByHotelId.set(hotelId, (roomCountByHotelId.get(hotelId) ?? 0) + 1);
  }

  return ((hotelsRes.data ?? []) as HotelRow[]).map((row) =>
    mapHotelRow(row, roomCountByHotelId.get(row.id) ?? 0)
  );
}

export async function loadAccommodationHotelById(
  service: ServiceClient,
  hotelId: string
): Promise<AccommodationHotel | null> {
  const [hotelRow, roomsRes] = await Promise.all([
    loadHotelRowById(service, hotelId),
    service.from("stanze").select("id", { count: "exact", head: true }).eq("albergo_id", hotelId),
  ]);

  if (roomsRes.error) {
    throw new Error(roomsRes.error.message);
  }

  if (!hotelRow) {
    return null;
  }

  return mapHotelRow(hotelRow, roomsRes.count ?? 0);
}

export async function loadAccommodationRooms(
  service: ServiceClient,
  filters: { hotelId?: string | null; roomIds?: string[] } = {}
): Promise<AccommodationRoom[]> {
  let roomsQuery = service
    .from("stanze")
    .select(ROOM_SELECT_FIELDS)
    .order("codice_interno", { ascending: true });

  if (filters.hotelId) {
    roomsQuery = roomsQuery.eq("albergo_id", filters.hotelId);
  }

  if (filters.roomIds && filters.roomIds.length > 0) {
    roomsQuery = roomsQuery.in("id", filters.roomIds);
  }

  const roomsRes = await roomsQuery;
  if (roomsRes.error) {
    throw new Error(roomsRes.error.message);
  }

  const roomRows = (roomsRes.data ?? []) as RoomRow[];
  if (roomRows.length === 0) return [];

  const hotelIds = [...new Set(roomRows.map((row) => row.albergo_id).filter(Boolean))];
  const roomIds = roomRows.map((row) => row.id);

  const [hotelsRes, roomCountsRes, roomGroupsRes, assignmentsRes] = await Promise.all([
    hotelIds.length > 0
      ? service.from("alberghi").select(HOTEL_SELECT_FIELDS).in("id", hotelIds)
      : Promise.resolve({
          data: [] as HotelRow[],
          error: null,
        }),
    hotelIds.length > 0
      ? service.from("stanze").select("albergo_id").in("albergo_id", hotelIds)
      : Promise.resolve({
          data: [] as Array<{ albergo_id: string | null }>,
          error: null,
        }),
    roomIds.length > 0
      ? service.from("stanze_gruppi").select("stanza_id,gruppo_id").in("stanza_id", roomIds)
      : Promise.resolve({
          data: [] as RoomGroupRow[],
          error: null,
        }),
    roomIds.length > 0
      ? service.from("partecipanti_stanze").select("stanza_id").in("stanza_id", roomIds)
      : Promise.resolve({
          data: [] as ParticipantRoomAssignmentRow[],
          error: null,
        }),
  ]);

  if (hotelsRes.error) {
    throw new Error(hotelsRes.error.message);
  }

  if (roomCountsRes.error) {
    throw new Error(roomCountsRes.error.message);
  }

  if (roomGroupsRes.error) {
    throw new Error(roomGroupsRes.error.message);
  }

  if (assignmentsRes.error) {
    throw new Error(assignmentsRes.error.message);
  }

  const roomCountByHotelId = new Map<string, number>();
  for (const row of roomCountsRes.data ?? []) {
    const hotelId =
      typeof row.albergo_id === "string" ? row.albergo_id.trim() : "";
    if (!hotelId) continue;
    roomCountByHotelId.set(hotelId, (roomCountByHotelId.get(hotelId) ?? 0) + 1);
  }

  const hotelById = new Map(
    ((hotelsRes.data ?? []) as HotelRow[]).map((row) => [
      row.id,
      mapHotelRow(row, roomCountByHotelId.get(row.id) ?? 0),
    ])
  );

  const groupCountByRoomId = new Map<string, number>();
  const groupIdsByRoomId = new Map<string, Set<string>>();
  for (const row of (roomGroupsRes.data ?? []) as RoomGroupRow[]) {
    const roomId = (row.stanza_id ?? "").trim();
    const groupId = (row.gruppo_id ?? "").trim();
    if (!roomId || !groupId) continue;
    const current = groupIdsByRoomId.get(roomId) ?? new Set<string>();
    current.add(groupId);
    groupIdsByRoomId.set(roomId, current);
    groupCountByRoomId.set(roomId, current.size);
  }

  const assignmentCountByRoomId = new Map<string, number>();
  for (const row of (assignmentsRes.data ?? []) as ParticipantRoomAssignmentRow[]) {
    const roomId = (row.stanza_id ?? "").trim();
    if (!roomId) continue;
    assignmentCountByRoomId.set(roomId, (assignmentCountByRoomId.get(roomId) ?? 0) + 1);
  }

  return roomRows
    .map((row) =>
      mapRoomRow({
        row,
        hotel: hotelById.get(row.albergo_id) ?? null,
        assignedGroupCount: groupCountByRoomId.get(row.id) ?? 0,
        assignedParticipantCount: assignmentCountByRoomId.get(row.id) ?? 0,
      })
    )
    .sort((a, b) => {
      const byHotel = (a.hotel?.name ?? "").localeCompare(b.hotel?.name ?? "");
      if (byHotel !== 0) return byHotel;
      return a.internalCode.localeCompare(b.internalCode);
    });
}

export async function loadAccommodationRoomById(
  service: ServiceClient,
  roomId: string
): Promise<AccommodationRoom | null> {
  const rooms = await loadAccommodationRooms(service, { roomIds: [roomId] });
  return rooms[0] ?? null;
}

export async function loadAccommodationRoomOccupants(
  service: ServiceClient,
  roomId: string
): Promise<AccommodationRoomOccupant[]> {
  const normalizedRoomId = normalizeText(roomId);
  if (!normalizedRoomId) {
    throw new Error("roomId is required");
  }

  const { data: assignments, error: assignmentsError } = await service
    .from("partecipanti_stanze")
    .select("partecipante_id,stanza_id")
    .eq("stanza_id", normalizedRoomId);

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  const participantIds = [...new Set(
    ((assignments ?? []) as ParticipantRoomAssignmentRow[])
      .map((row) => normalizeText(row.partecipante_id))
      .filter((value): value is string => Boolean(value))
  )];

  if (participantIds.length === 0) {
    return [];
  }

  const { data: participants, error: participantsError } = await service
    .from("partecipanti")
    .select("id,nome,cognome,gruppo_id,gruppo_label")
    .is("deleted_at", null)
    .in("id", participantIds);

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  return ((participants ?? []) as OccupantParticipantRow[])
    .map((participant) => ({
      participantId: participant.id,
      firstName: participant.nome,
      lastName: participant.cognome,
      groupName: normalizeText(participant.gruppo_label) ?? normalizeText(participant.gruppo_id),
    }))
    .sort((a, b) => {
      const bySurname = (a.lastName ?? "").localeCompare(b.lastName ?? "");
      if (bySurname !== 0) return bySurname;
      return (a.firstName ?? "").localeCompare(b.firstName ?? "");
    });
}

export async function createAccommodationRoom(
  service: ServiceClient,
  value: Record<string, unknown>
): Promise<AccommodationRoom> {
  const normalized = normalizeAccommodationRoomInput(value);
  if (normalized.error || !normalized.data) {
    throw new Error(normalized.error);
  }
  const roomInput = normalized.data;

  await ensureHotelExists(service, roomInput.hotelId);
  const internalCode = await buildGeneratedInternalCode(
    service,
    roomInput.hotelId,
    roomInput.capacity
  );

  const { data, error } = await service
    .from("stanze")
    .insert({
      albergo_id: roomInput.hotelId,
      nome: buildRoomLegacyName(internalCode),
      codice_interno: internalCode,
      numero_reale: roomInput.realRoomNumber,
      capienza: roomInput.capacity,
      gender_policy: roomInput.genderPolicy,
      available_from: roomInput.availableFrom,
      available_to: roomInput.availableTo,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(mapInventoryErrorMessage(error, "Failed to create room"));
  }

  const room = await loadAccommodationRoomById(service, data.id);
  if (!room) {
    throw new Error("Room created but reload failed");
  }

  return room;
}

export function normalizeAccommodationRoomImportRow(
  value: Record<string, unknown>
):
  | { data: AccommodationRoomImportRowInput; error: null }
  | { data: null; error: string } {
  const realRoomNumber = normalizeText(
    getObjectValue(value, ["numero_reale", "real_room_number", "realRoomNumber"])
  );

  const capacity = normalizePositiveInteger(
    getObjectValue(value, ["capienza", "capacity"])
  );
  if (!capacity) {
    return { data: null, error: "capienza is required and must be a positive integer" };
  }

  const availableFromResult = normalizeOptionalDate(
    getObjectValue(value, ["available_from", "availableFrom", "available_at", "availableAt"]),
    "available_from"
  );
  if (availableFromResult.error) {
    return { data: null, error: availableFromResult.error };
  }

  const availableToResult = normalizeOptionalDate(
    getObjectValue(value, ["available_to", "availableTo"]),
    "available_to"
  );
  if (availableToResult.error) {
    return { data: null, error: availableToResult.error };
  }

  if (
    availableFromResult.value &&
    availableToResult.value &&
    availableToResult.value <= availableFromResult.value
  ) {
    return {
      data: null,
      error: "available_to must be after available_from",
    };
  }

  return {
    data: {
      realRoomNumber,
      capacity,
      availableFrom: availableFromResult.value,
      availableTo: availableToResult.value,
    },
    error: null,
  };
}

export async function importAccommodationRooms(
  service: ServiceClient,
  args: {
    hotelId: string;
    genderPolicy: RoomGenderPolicy;
    rows: Record<string, unknown>[];
  }
): Promise<AccommodationRoom[]> {
  const hotelId = args.hotelId.trim();
  if (!hotelId) {
    throw new Error("hotelId is required");
  }
  if (!args.rows.length) {
    throw new Error("The Excel file does not contain any room rows");
  }
  if (!normalizeRoomGenderPolicy(args.genderPolicy)) {
    throw new Error("genderPolicy must be one of male_only, female_only, mixed");
  }

  const hotelRow = await loadHotelRowById(service, hotelId);
  if (!hotelRow?.id) {
    throw new Error("Hotel not found");
  }

  const normalizedRows = args.rows.map((row, index) => {
    const normalized = normalizeAccommodationRoomImportRow(row);
    if (normalized.error || !normalized.data) {
      throw new Error(`Row ${index + 2}: ${normalized.error}`);
    }
    return normalized.data;
  });

  const existingCodes = new Set(await loadInternalCodesForHotel(service, hotelId));
  const rowsToInsert = normalizedRows.map((row) => {
    const internalCode = buildNextInternalRoomCode({
      hotelName: hotelRow.nome ?? "",
      capacity: row.capacity,
      existingCodes,
    });
    existingCodes.add(internalCode);

    return {
      albergo_id: hotelId,
      nome: buildRoomLegacyName(internalCode),
      codice_interno: internalCode,
      numero_reale: row.realRoomNumber,
      capienza: row.capacity,
      gender_policy: args.genderPolicy,
      available_from: row.availableFrom,
      available_to: row.availableTo,
    };
  });

  const { data, error } = await service
    .from("stanze")
    .insert(rowsToInsert)
    .select("id");

  if (error) {
    throw new Error(mapInventoryErrorMessage(error, "Failed to import rooms"));
  }

  const roomIds = (data ?? [])
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean);

  return loadAccommodationRooms(service, { roomIds });
}

export async function createAccommodationHotel(
  service: ServiceClient,
  value: Record<string, unknown>
): Promise<AccommodationHotel> {
  const normalized = normalizeAccommodationHotelInput(value);
  if (normalized.error || !normalized.data) {
    throw new Error(normalized.error);
  }
  const hotelInput = normalized.data;

  const { data, error } = await service
    .from("alberghi")
    .insert({
      nome: hotelInput.name,
      indirizzo: hotelInput.address,
      google_maps_url: hotelInput.googleMapsUrl,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const hotel = await loadAccommodationHotelById(service, data.id);
  if (!hotel) {
    throw new Error("Hotel created but reload failed");
  }

  return hotel;
}

export async function updateAccommodationHotel(
  service: ServiceClient,
  hotelId: string,
  value: Record<string, unknown>
): Promise<AccommodationHotel> {
  const existing = await loadHotelRowById(service, hotelId);
  if (!existing) {
    throw new Error("Hotel not found");
  }

  const normalized = normalizeAccommodationHotelInput(value, {
    name: existing.nome ?? "",
    address: existing.indirizzo,
    googleMapsUrl: existing.google_maps_url,
  });
  if (normalized.error || !normalized.data) {
    throw new Error(normalized.error);
  }
  const hotelInput = normalized.data;

  const { error } = await service
    .from("alberghi")
    .update({
      nome: hotelInput.name,
      indirizzo: hotelInput.address,
      google_maps_url: hotelInput.googleMapsUrl,
    })
    .eq("id", hotelId);

  if (error) {
    throw new Error(error.message);
  }

  const hotel = await loadAccommodationHotelById(service, hotelId);
  if (!hotel) {
    throw new Error("Hotel updated but reload failed");
  }

  return hotel;
}

export async function updateAccommodationRoom(
  service: ServiceClient,
  roomId: string,
  value: Record<string, unknown>
): Promise<AccommodationRoom> {
  const existing = await loadRoomRowById(service, roomId);
  if (!existing) {
    throw new Error("Room not found");
  }

  const normalized = normalizeAccommodationRoomInput(
    value,
    roomRowToMutationDefaults(existing)
  );
  if (normalized.error || !normalized.data) {
    throw new Error(normalized.error);
  }
  const roomInput = normalized.data;

  const hotelRow = await loadHotelRowById(service, roomInput.hotelId);
  if (!hotelRow?.id) {
    throw new Error("Hotel not found");
  }

  const internalCode = canReuseExistingInternalCode(
    existing,
    hotelRow.nome ?? "",
    roomInput.capacity
  )
    ? existing.codice_interno ?? existing.nome ?? ""
    : await buildGeneratedInternalCode(service, roomInput.hotelId, roomInput.capacity, {
        excludeRoomId: roomId,
      });

  const { error } = await service
    .from("stanze")
    .update({
      albergo_id: roomInput.hotelId,
      nome: buildRoomLegacyName(internalCode),
      codice_interno: internalCode,
      numero_reale: roomInput.realRoomNumber,
      capienza: roomInput.capacity,
      gender_policy: roomInput.genderPolicy,
      available_from: roomInput.availableFrom,
      available_to: roomInput.availableTo,
    })
    .eq("id", roomId);

  if (error) {
    throw new Error(mapInventoryErrorMessage(error, "Failed to update room"));
  }

  const room = await loadAccommodationRoomById(service, roomId);
  if (!room) {
    throw new Error("Room updated but reload failed");
  }

  return room;
}

export async function deleteAccommodationRoom(
  service: ServiceClient,
  roomId: string
) {
  const existing = await loadRoomRowById(service, roomId);
  if (!existing) {
    throw new Error("Room not found");
  }

  const { count, error: assignmentsError } = await service
    .from("partecipanti_stanze")
    .select("id", { count: "exact", head: true })
    .eq("stanza_id", roomId);

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error(
      "Cannot delete a room that already has participant assignments"
    );
  }

  const { error } = await service.from("stanze").delete().eq("id", roomId);

  if (error) {
    throw new Error(mapInventoryErrorMessage(error, "Failed to delete room"));
  }

  return { id: roomId };
}

export async function deleteAccommodationHotel(
  service: ServiceClient,
  hotelId: string
) {
  const existing = await loadHotelRowById(service, hotelId);
  if (!existing) {
    throw new Error("Hotel not found");
  }

  const { count, error: roomsError } = await service
    .from("stanze")
    .select("id", { count: "exact", head: true })
    .eq("albergo_id", hotelId);

  if (roomsError) {
    throw new Error(roomsError.message);
  }

  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete a hotel that still has rooms");
  }

  const { error } = await service.from("alberghi").delete().eq("id", hotelId);

  if (error) {
    throw new Error(error.message);
  }

  return { id: hotelId };
}
