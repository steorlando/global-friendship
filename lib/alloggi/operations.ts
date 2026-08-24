import type { SupabaseClient } from "@supabase/supabase-js";
import { alloggioLongToShort } from "../partecipante/constants.ts";
import {
  loadAccommodationGroups,
  type AccommodationGroup,
} from "./group-allocations.ts";
import {
  isOrganizationProvidedAccommodation,
  loadAccommodationRooms,
  type AccommodationRoom,
} from "./inventory.ts";
import {
  isMissingHostelCheckInTable,
  type HostelCheckInInput,
} from "./check-in.ts";

type ServiceClient = SupabaseClient;

type OperationalParticipantRow = {
  id: string;
  personal_code?: string | null;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  nazione?: string | null;
  data_nascita?: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  sesso: string | null;
  eta?: number | null;
  data_arrivo: string | null;
  data_partenza: string | null;
};

type ParticipantRoomAssignmentRow = {
  id: string;
  partecipante_id: string | null;
  stanza_id: string | null;
};

type RoomScopeRow = {
  stanza_id: string | null;
  gruppo_id: string | null;
};

type ParticipantHostelCheckInRow = {
  participant_id: string | null;
  identity_document_type: HostelCheckInInput["identityDocumentType"] | null;
  identity_document_number: string | null;
  identity_document_country: string | null;
  identity_document_issuing_city: string | null;
  identity_document_issue_date: string | null;
  identity_document_expiration_date: string | null;
};

export type AccommodationOperationalParticipant = {
  participantId: string;
  personalCode?: string | null;
  assignmentId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  email: string | null;
  nationality?: string | null;
  dateOfBirth?: string | null;
  groupId: string | null;
  groupName: string;
  sex: string | null;
  age?: number | null;
  arrivalDate: string | null;
  departureDate: string | null;
  hotelId: string;
  hotelName: string;
  roomId: string;
  roomInternalCode: string;
  realRoomNumber: string | null;
  hostelCheckIn?: HostelCheckInInput | null;
};

export type AccommodationRosterRoomSummary = {
  roomId: string;
  internalCode: string;
  realRoomNumber: string | null;
  capacity: number;
  genderPolicy: AccommodationRoom["genderPolicy"];
  availableFrom: string | null;
  availableTo: string | null;
  occupancyCount: number;
  assignedGroups: string[];
};

export type AccommodationHotelRosterSection = {
  hotelId: string;
  hotelName: string;
  address: string | null;
  googleMapsUrl: string | null;
  participantCount: number;
  roomCount: number;
  sharedRoomCount: number;
  participants: AccommodationOperationalParticipant[];
  rooms: AccommodationRosterRoomSummary[];
};

export type AccommodationRoomRosterSection = {
  roomId: string;
  hotelId: string;
  hotelName: string;
  address: string | null;
  googleMapsUrl: string | null;
  internalCode: string;
  realRoomNumber: string | null;
  capacity: number;
  genderPolicy: AccommodationRoom["genderPolicy"];
  availableFrom: string | null;
  availableTo: string | null;
  occupancyCount: number;
  assignedGroups: string[];
  participants: AccommodationOperationalParticipant[];
};

export type AccommodationOperationalSummary = {
  hotelCount: number;
  roomCount: number;
  sharedRoomCount: number;
  assignedParticipantCount: number;
  unassignedEligibleParticipantCount: number;
};

export type AccommodationOperationalRosters = {
  summary: AccommodationOperationalSummary;
  hotels: AccommodationHotelRosterSection[];
  rooms: AccommodationRoomRosterSection[];
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

function getParticipantAccommodationShort(
  participant: OperationalParticipantRow
): string | null {
  return participant.alloggio_short ?? alloggioLongToShort(participant.alloggio);
}

function buildGroupAliasMap(groups: AccommodationGroup[]): Map<string, string> {
  const aliases = new Map<string, string>();

  for (const group of groups) {
    const idKey = normalizeForMatching(group.id);
    const nameKey = normalizeForMatching(group.name);

    if (idKey) aliases.set(idKey, group.name);
    if (nameKey) aliases.set(nameKey, group.name);
  }

  return aliases;
}

function resolveGroupName(
  participant: Pick<OperationalParticipantRow, "gruppo_id" | "gruppo_label">,
  groupAliasMap: Map<string, string>
): string {
  const groupId = normalizeText(participant.gruppo_id);
  const groupLabel = normalizeText(participant.gruppo_label);

  for (const candidate of [groupId, groupLabel]) {
    const key = normalizeForMatching(candidate);
    if (key && groupAliasMap.has(key)) {
      return groupAliasMap.get(key) ?? candidate ?? "-";
    }
  }

  return groupLabel ?? groupId ?? "-";
}

function resolveAssignedGroupNames(
  roomId: string,
  roomScopeRows: RoomScopeRow[],
  groupAliasMap: Map<string, string>
): string[] {
  const names = new Set<string>();

  for (const row of roomScopeRows) {
    if ((row.stanza_id ?? "").trim() !== roomId) continue;

    const rawGroupId = normalizeText(row.gruppo_id);
    if (!rawGroupId) continue;

    const groupName = groupAliasMap.get(normalizeForMatching(rawGroupId)) ?? rawGroupId;
    names.add(groupName);
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

function sortParticipants(
  participants: AccommodationOperationalParticipant[],
  mode: "hotel" | "room"
): AccommodationOperationalParticipant[] {
  return [...participants].sort((a, b) => {
    if (mode === "hotel") {
      const byRoom = a.roomInternalCode.localeCompare(b.roomInternalCode);
      if (byRoom !== 0) return byRoom;
    }

    const byGroup = a.groupName.localeCompare(b.groupName);
    if (byGroup !== 0) return byGroup;

    const byLastName = (a.lastName ?? "").localeCompare(b.lastName ?? "");
    if (byLastName !== 0) return byLastName;

    const byFirstName = (a.firstName ?? "").localeCompare(b.firstName ?? "");
    if (byFirstName !== 0) return byFirstName;

    return a.fullName.localeCompare(b.fullName);
  });
}

export function buildAccommodationOperationalRosters(args: {
  groups: AccommodationGroup[];
  rooms: AccommodationRoom[];
  participants: OperationalParticipantRow[];
  assignments: ParticipantRoomAssignmentRow[];
  roomScopes: RoomScopeRow[];
  checkIns?: ParticipantHostelCheckInRow[];
}): AccommodationOperationalRosters {
  const groupAliasMap = buildGroupAliasMap(args.groups);
  const roomById = new Map(
    args.rooms
      .filter((room) => room.hotel?.id)
      .map((room) => [room.id, room] as const)
  );

  const eligibleParticipants = args.participants.filter((participant) =>
    isOrganizationProvidedAccommodation(getParticipantAccommodationShort(participant))
  );
  const participantById = new Map(
    eligibleParticipants
      .map((participant) => {
        const participantId = normalizeText(participant.id);
        if (!participantId) return null;
        return [participantId, participant] as const;
      })
      .filter(Boolean) as Array<readonly [string, OperationalParticipantRow]>
  );
  const checkInByParticipantId = new Map(
    (args.checkIns ?? [])
      .map((checkIn) => {
        const participantId = normalizeText(checkIn.participant_id);
        const identityDocumentType = checkIn.identity_document_type;
        const identityDocumentNumber = normalizeText(checkIn.identity_document_number);
        const identityDocumentCountry = normalizeText(checkIn.identity_document_country);
        const identityDocumentIssuingCity = normalizeText(
          checkIn.identity_document_issuing_city
        );
        const identityDocumentIssueDate = normalizeText(
          checkIn.identity_document_issue_date
        );
        const identityDocumentExpirationDate = normalizeText(
          checkIn.identity_document_expiration_date
        );

        if (
          !participantId ||
          !identityDocumentType ||
          !identityDocumentNumber ||
          !identityDocumentCountry ||
          !identityDocumentIssuingCity ||
          !identityDocumentIssueDate ||
          !identityDocumentExpirationDate
        ) {
          return null;
        }

        return [
          participantId,
          {
            identityDocumentType,
            identityDocumentNumber,
            identityDocumentCountry,
            identityDocumentIssuingCity,
            identityDocumentIssueDate,
            identityDocumentExpirationDate,
          },
        ] as const;
      })
      .filter(Boolean) as Array<readonly [string, HostelCheckInInput]>
  );

  const hotelMap = new Map<string, AccommodationHotelRosterSection>();
  const roomMap = new Map<string, AccommodationRoomRosterSection>();
  const assignedEligibleParticipantIds = new Set<string>();

  for (const room of args.rooms) {
    const hotel = room.hotel;
    if (!hotel || hotelMap.has(hotel.id)) continue;

    hotelMap.set(hotel.id, {
      hotelId: hotel.id,
      hotelName: hotel.name,
      address: hotel.address,
      googleMapsUrl: hotel.googleMapsUrl,
      participantCount: 0,
      roomCount: 0,
      sharedRoomCount: 0,
      participants: [],
      rooms: [],
    });
  }

  for (const assignment of args.assignments) {
    const participantId = normalizeText(assignment.partecipante_id);
    const roomId = normalizeText(assignment.stanza_id);
    if (!participantId || !roomId) continue;

    const participant = participantById.get(participantId);
    const room = roomById.get(roomId);
    const hotel = room?.hotel;
    if (!participant || !room || !hotel) continue;

    assignedEligibleParticipantIds.add(participantId);

    const hotelSection =
      hotelMap.get(hotel.id) ??
      {
        hotelId: hotel.id,
        hotelName: hotel.name,
        address: hotel.address,
        googleMapsUrl: hotel.googleMapsUrl,
        participantCount: 0,
        roomCount: 0,
        sharedRoomCount: 0,
        participants: [],
        rooms: [],
      };
    if (!hotelMap.has(hotel.id)) {
      hotelMap.set(hotel.id, hotelSection);
    }

    const assignedGroups = resolveAssignedGroupNames(room.id, args.roomScopes, groupAliasMap);

    const roomSection =
      roomMap.get(room.id) ??
      {
        roomId: room.id,
        hotelId: hotel.id,
        hotelName: hotel.name,
        address: hotel.address,
        googleMapsUrl: hotel.googleMapsUrl,
        internalCode: room.internalCode,
        realRoomNumber: room.realRoomNumber,
        capacity: room.capacity,
        genderPolicy: room.genderPolicy,
        availableFrom: room.availableFrom,
        availableTo: room.availableTo,
        occupancyCount: 0,
        assignedGroups,
        participants: [],
      };
    if (!roomMap.has(room.id)) {
      roomMap.set(room.id, roomSection);
    }

    const rosterParticipant: AccommodationOperationalParticipant = {
      participantId,
      ...(participant.personal_code !== undefined
        ? { personalCode: normalizeText(participant.personal_code) }
        : {}),
      assignmentId: assignment.id,
      firstName: normalizeText(participant.nome),
      lastName: normalizeText(participant.cognome),
      fullName:
        [normalizeText(participant.nome), normalizeText(participant.cognome)]
          .filter(Boolean)
          .join(" ") || participant.email?.trim() || participantId,
      email: normalizeText(participant.email),
      ...(participant.nazione !== undefined
        ? { nationality: normalizeText(participant.nazione) }
        : {}),
      ...(participant.data_nascita !== undefined
        ? { dateOfBirth: normalizeText(participant.data_nascita) }
        : {}),
      groupId: normalizeText(participant.gruppo_id),
      groupName: resolveGroupName(participant, groupAliasMap),
      sex: normalizeText(participant.sesso),
      age: participant.eta ?? null,
      arrivalDate: normalizeText(participant.data_arrivo),
      departureDate: normalizeText(participant.data_partenza),
      hotelId: hotel.id,
      hotelName: hotel.name,
      roomId: room.id,
      roomInternalCode: room.internalCode,
      realRoomNumber: room.realRoomNumber,
      hostelCheckIn: checkInByParticipantId.get(participantId) ?? null,
    };

    hotelSection.participants.push(rosterParticipant);
    roomSection.participants.push(rosterParticipant);
  }

  const roomSections = [...roomMap.values()]
    .map((roomSection) => ({
      ...roomSection,
      occupancyCount: roomSection.participants.length,
      participants: sortParticipants(roomSection.participants, "room"),
    }))
    .sort((a, b) => {
      const byHotel = a.hotelName.localeCompare(b.hotelName);
      if (byHotel !== 0) return byHotel;
      return a.internalCode.localeCompare(b.internalCode);
    });

  const occupiedRoomById = new Map(
    roomSections.map((roomSection) => [roomSection.roomId, roomSection] as const)
  );
  const roomSummaries = args.rooms
    .filter((room) => room.hotel?.id)
    .map((room): AccommodationRosterRoomSummary => {
      const occupiedRoom = occupiedRoomById.get(room.id);
      return {
        roomId: room.id,
        internalCode: room.internalCode,
        realRoomNumber: room.realRoomNumber,
        capacity: room.capacity,
        genderPolicy: room.genderPolicy,
        availableFrom: room.availableFrom,
        availableTo: room.availableTo,
        occupancyCount: occupiedRoom?.occupancyCount ?? 0,
        assignedGroups: resolveAssignedGroupNames(
          room.id,
          args.roomScopes,
          groupAliasMap
        ),
      };
    });

  const hotels = [...hotelMap.values()]
    .map((hotelSection) => {
      const roomsForHotel = roomSummaries.filter(
        (roomSummary) => roomById.get(roomSummary.roomId)?.hotel?.id === hotelSection.hotelId
      );

      return {
        ...hotelSection,
        participantCount: hotelSection.participants.length,
        roomCount: roomsForHotel.length,
        sharedRoomCount: roomsForHotel.filter((room) => room.assignedGroups.length > 1).length,
        participants: sortParticipants(hotelSection.participants, "hotel"),
        rooms: roomsForHotel.sort((a, b) => a.internalCode.localeCompare(b.internalCode)),
      };
    })
    .sort((a, b) => a.hotelName.localeCompare(b.hotelName));

  const summary: AccommodationOperationalSummary = {
    hotelCount: hotels.length,
    roomCount: roomSections.length,
    sharedRoomCount: roomSections.filter((room) => room.assignedGroups.length > 1).length,
    assignedParticipantCount: assignedEligibleParticipantIds.size,
    unassignedEligibleParticipantCount: Math.max(
      eligibleParticipants.length - assignedEligibleParticipantIds.size,
      0
    ),
  };

  return {
    summary,
    hotels,
    rooms: roomSections,
  };
}

export async function loadAccommodationOperationalRosters(
  service: ServiceClient,
  options: {
    includeCheckInDocuments?: boolean;
    includeMaverickExportFields?: boolean;
  } = {}
): Promise<AccommodationOperationalRosters> {
  const participantFields = [
    "id,nome,cognome,email,gruppo_id,gruppo_label,alloggio,alloggio_short,sesso,eta,data_arrivo,data_partenza",
    options.includeMaverickExportFields
      ? "personal_code,nazione,data_nascita"
      : null,
  ]
    .filter(Boolean)
    .join(",");
  const [groups, rooms, participantsRes, assignmentsRes, roomScopesRes] =
    await Promise.all([
      loadAccommodationGroups(service),
      loadAccommodationRooms(service),
      service
        .from("partecipanti")
        .select(participantFields)
        .is("deleted_at", null),
      service.from("partecipanti_stanze").select("id,partecipante_id,stanza_id"),
      service.from("stanze_gruppi").select("stanza_id,gruppo_id"),
    ]);

  if (participantsRes.error) {
    throw new Error(participantsRes.error.message);
  }
  if (assignmentsRes.error) {
    throw new Error(assignmentsRes.error.message);
  }
  if (roomScopesRes.error) {
    throw new Error(roomScopesRes.error.message);
  }
  let checkIns: ParticipantHostelCheckInRow[] = [];
  if (options.includeCheckInDocuments) {
    const checkInsRes = await service
      .from("participant_hostel_check_ins")
      .select(
        "participant_id,identity_document_type,identity_document_number,identity_document_country,identity_document_issuing_city,identity_document_issue_date,identity_document_expiration_date"
      )
      .not("completed_at", "is", null);

    if (checkInsRes.error && !isMissingHostelCheckInTable(checkInsRes.error)) {
      throw new Error(checkInsRes.error.message);
    }
    checkIns = (checkInsRes.error ? [] : checkInsRes.data ?? []) as ParticipantHostelCheckInRow[];
  }

  return buildAccommodationOperationalRosters({
    groups,
    rooms,
    participants: (participantsRes.data ?? []) as unknown as OperationalParticipantRow[],
    assignments: (assignmentsRes.data ?? []) as ParticipantRoomAssignmentRow[],
    roomScopes: (roomScopesRes.data ?? []) as RoomScopeRow[],
    checkIns,
  });
}
