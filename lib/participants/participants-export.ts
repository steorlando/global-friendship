import * as XLSX from "xlsx";
import {
  isAutonomousAccommodation,
  isOperatorRegistrationType,
  normalizeOperatorAccommodationPreference,
} from "../partecipante/constants.ts";

export type ParticipantListExportRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  gruppo_label: string | null;
  gruppo_id: string | null;
  tipo_iscrizione: string | null;
  eta: number | null;
  sesso: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  preferenza_alloggio_operatore: string | null;
  assigned_hostel_name: string | null;
  assigned_room_name: string | null;
  has_room_assignment: boolean;
};

export type ParticipantRoomAssignmentExportRow = {
  partecipante_id: string | null;
  stanza_id: string | null;
};

export type ParticipantRoomExportRow = {
  id: string;
  albergo_id: string | null;
  numero_reale: string | null;
  nome: string | null;
  codice_interno: string | null;
};

export type ParticipantHotelExportRow = {
  id: string;
  nome: string | null;
};

export type ParticipantAssignmentExportDetails = {
  hostelName: string | null;
  roomName: string | null;
  hasRoomAssignment: boolean;
};

export type ParticipantAccommodationType = "Hotel" | "Ostello" | "Propria" | "";

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function participantRegistrationTypeLabel(
  value: string | null | undefined,
): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  if (lower.includes("higher student")) return "Higher student";
  if (lower.includes("undergraduate") || lower.includes("worker - lavoratore")) {
    return "University";
  }
  if (lower.includes("operator") || lower.includes("operatore")) return "Operator";
  if (lower.includes("driver") || lower.includes("autista")) return "Driver";
  return normalized;
}

export function participantAccommodationType(
  row: Pick<
    ParticipantListExportRow,
    | "alloggio"
    | "alloggio_short"
    | "tipo_iscrizione"
    | "preferenza_alloggio_operatore"
    | "has_room_assignment"
  >,
): ParticipantAccommodationType {
  const accommodationValues = [row.alloggio_short, row.alloggio]
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));

  if (accommodationValues.some((value) => isAutonomousAccommodation(value))) {
    return "Propria";
  }

  const normalizedAccommodation = accommodationValues.join(" ").toLowerCase();
  if (
    normalizedAccommodation.includes("own accommodation") ||
    normalizedAccommodation.includes("autonom") ||
    normalizedAccommodation.includes("atonoumous")
  ) {
    return "Propria";
  }

  const operatorPreference = normalizeOperatorAccommodationPreference(
    row.preferenza_alloggio_operatore,
  );
  if (
    isOperatorRegistrationType(row.tipo_iscrizione) &&
    operatorPreference === "Hotel"
  ) {
    return "Hotel";
  }
  if (
    normalizedAccommodation.includes("hotel") ||
    normalizedAccommodation.includes("albergo")
  ) {
    return "Hotel";
  }

  if (
    row.has_room_assignment ||
    normalizedAccommodation.includes("provided by organization") ||
    normalizedAccommodation.includes("fornita dall'organizzazione") ||
    normalizedAccommodation.includes("fornita dall’organizzazione") ||
    operatorPreference === "Hostel with group"
  ) {
    return "Ostello";
  }

  return "";
}

export function buildParticipantAssignmentExportDetails(
  assignments: readonly ParticipantRoomAssignmentExportRow[],
  rooms: readonly ParticipantRoomExportRow[],
  hotels: readonly ParticipantHotelExportRow[],
): Map<string, ParticipantAssignmentExportDetails> {
  const hotelNameById = new Map(
    hotels.map((hotel) => [hotel.id, normalizeText(hotel.nome)] as const),
  );
  const roomById = new Map(rooms.map((room) => [room.id, room] as const));
  const detailsByParticipantId = new Map<string, ParticipantAssignmentExportDetails>();

  for (const assignment of assignments) {
    const participantId = normalizeText(assignment.partecipante_id);
    const roomId = normalizeText(assignment.stanza_id);
    if (!participantId || !roomId) continue;

    const room = roomById.get(roomId);
    const details: ParticipantAssignmentExportDetails = {
      hostelName: room?.albergo_id
        ? hotelNameById.get(room.albergo_id) ?? null
        : null,
      roomName:
        normalizeText(room?.numero_reale) ??
        normalizeText(room?.nome) ??
        normalizeText(room?.codice_interno),
      hasRoomAssignment: true,
    };
    const current = detailsByParticipantId.get(participantId);
    if (
      current &&
      (current.hostelName !== details.hostelName || current.roomName !== details.roomName)
    ) {
      throw new Error(`Participant ${participantId} has multiple room assignments`);
    }
    detailsByParticipantId.set(participantId, details);
  }

  return detailsByParticipantId;
}

function toExcelDate(value: string | null): Date | string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value ?? "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? value : date;
}

export function buildParticipantListWorkbook(rows: ParticipantListExportRow[]): Buffer {
  const matrix: Array<Array<string | number | boolean | Date>> = [
    [
      "Nome",
      "Cognome",
      "Email",
      "Gruppo di appartenenza",
      "Tipo iscrizione",
      "Età",
      "Sesso",
      "Data di arrivo",
      "Data di partenza",
      "Tipo sistemazione",
      "Ostello assegnato",
      "Stanza assegnata",
      "Da assegnare",
    ],
    ...rows.map((row) => {
      const accommodationType = participantAccommodationType(row);
      return [
        row.nome?.trim() ?? "",
        row.cognome?.trim() ?? "",
        row.email?.trim() ?? "",
        row.gruppo_label?.trim() ?? row.gruppo_id?.trim() ?? "",
        participantRegistrationTypeLabel(row.tipo_iscrizione),
        row.eta ?? "",
        row.sesso?.trim() ?? "",
        toExcelDate(row.data_arrivo),
        toExcelDate(row.data_partenza),
        accommodationType,
        row.assigned_hostel_name?.trim() ?? "",
        row.assigned_room_name?.trim() ?? "",
        accommodationType === "Ostello" && !row.has_room_assignment,
      ];
    }),
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(matrix, {
    cellDates: false,
    dateNF: "dd/mm/yyyy",
  });
  for (let rowNumber = 2; rowNumber <= matrix.length; rowNumber += 1) {
    for (const column of ["H", "I"]) {
      const cell = worksheet[`${column}${rowNumber}`];
      if (cell?.t === "d" || cell?.t === "n") cell.z = "dd/mm/yyyy";
    }
  }
  worksheet["!autofilter"] = { ref: `A1:M${Math.max(1, matrix.length)}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 24 },
    { wch: 32 },
    { wch: 30 },
    { wch: 18 },
    { wch: 8 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 30 },
    { wch: 20 },
    { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Partecipanti");
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
    cellDates: false,
  });
}
