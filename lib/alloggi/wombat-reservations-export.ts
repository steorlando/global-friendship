import type {
  AccommodationHotelRosterSection,
  AccommodationOperationalParticipant,
  AccommodationRosterRoomSummary,
} from "./operations.ts";

type XlsxModule = typeof import("xlsx");

export type WombatReservationBooking = {
  confirmationNumber: string;
  spaceCategory: string;
  room: string;
  arrivalDate: string;
  departureDate: string;
  capacity: number;
};

export type WombatReservationCell = string | number | null;

export type WombatReservationRow = {
  confirmationNumber: string;
  spaceCategory: string;
  room: string;
  arrivalDate: number;
  departureDate: number;
  customerIdentification: string;
  role: "Guest";
  email: string;
  lastName: string;
  firstName: string;
  sex: string;
  nationality: string;
  dateOfBirth: number | null;
  identityDocument: string;
  identityDocumentNumber: string;
  identityDocumentCountry: string;
  identityDocumentIssuingCity: string;
  identityDocumentIssueDate: number | null;
  identityDocumentExpiration: number | null;
};

export const WOMBAT_RESERVATION_COLUMNS = [
  { key: "confirmationNumber", label: "Confirmation number", width: 23.57 },
  { key: "spaceCategory", label: "Space category", width: 29.57 },
  { key: "room", label: "Room", width: 9.14 },
  {
    key: "arrivalDate",
    label: "Arrival date",
    width: 13,
    dateFormat: "yyyy\. mm\. dd\.",
  },
  {
    key: "departureDate",
    label: "Departure date",
    width: 16.86,
    dateFormat: "yyyy\. mm\. dd\.",
  },
  {
    key: "customerIdentification",
    label: "Customer identification",
    width: 39,
  },
  { key: "role", label: "Role", width: 9.14 },
  { key: "email", label: "Email", width: 9.14 },
  { key: "lastName", label: "Last name", width: 24.57 },
  { key: "firstName", label: "First name", width: 11.86 },
  { key: "sex", label: "Sex", width: 9.14 },
  { key: "nationality", label: "Nationality", width: 12.29 },
  {
    key: "dateOfBirth",
    label: "Date of birth",
    width: 14.14,
    dateFormat: "dd/mm/yyyy",
  },
  { key: "identityDocument", label: "Identity document", width: 20.29 },
  {
    key: "identityDocumentNumber",
    label: "Identity document number",
    width: 29.29,
  },
  {
    key: "identityDocumentCountry",
    label: "Identity document country",
    width: 29.29,
  },
  {
    key: "identityDocumentIssuingCity",
    label: "Identity document issuing city",
    width: 32.57,
  },
  {
    key: "identityDocumentIssueDate",
    label: "Identity document issue date",
    width: 31.43,
    dateFormat: "dd/mm/yyyy",
  },
  {
    key: "identityDocumentExpiration",
    label: "Identity document expiration",
    width: 31.29,
    dateFormat: "dd/mm/yyyy",
  },
] as const satisfies ReadonlyArray<{
  key: keyof WombatReservationRow;
  label: string;
  width: number;
  dateFormat?: string;
}>;

const FULL_ARRIVAL = "2026-08-27";
const FULL_DEPARTURE = "2026-08-31";

function booking(
  confirmationNumber: string,
  spaceCategory: string,
  room: string,
  capacity: number,
  arrivalDate = FULL_ARRIVAL,
  departureDate = FULL_DEPARTURE
): WombatReservationBooking {
  return {
    confirmationNumber,
    spaceCategory,
    room,
    arrivalDate,
    departureDate,
    capacity,
  };
}

// Definitive supplier order from GC-1342693, received on 25 August 2026.
// The rows intentionally include every booked bed, including currently empty beds.
export const WOMBAT_RESERVATION_BOOKINGS: readonly WombatReservationBooking[] = [
  booking("WBU-473500", "PRIVATE 4-Bed Room", "206", 4),
  booking("WBU-473520", "PRIVATE 6-Bed FEMALE Room", "213", 6),
  booking("WBU-473507", "PRIVATE 4-Bed Room", "119", 4),
  booking("WBU-473514", "PRIVATE 6-Bed Room", "202", 6),
  booking("WBU-473494", "PRIVATE 4-Bed Room", "222", 4),
  booking("WBU-473495", "PRIVATE 4-Bed Room", "220", 4),
  booking("WBU-473498", "PRIVATE 4-Bed Room", "211", 4),
  booking("WBU-473517", "PRIVATE 6-Bed Room", "103", 6),
  booking("WBU-473509", "PRIVATE 6-Bed QUIET Room", "230", 6),
  booking("WBU-473505", "PRIVATE 4-Bed Room", "122", 4),
  booking("WBU-473511", "PRIVATE 6-Bed Room", "303", 6),
  booking("WBU-473496", "PRIVATE 4-Bed Room", "217", 4),
  booking("WBU-473503", "PRIVATE 4-Bed Room", "125", 4),
  booking("WBU-473502", "PRIVATE 4-Bed Room", "126", 4),
  booking("WBU-473508", "PRIVATE 4-Bed Room", "118", 4),
  booking("WBU-473518", "PRIVATE 6-Bed Room", "102", 6),
  booking("WBU-473510", "PRIVATE 6-Bed Room", "308", 6),
  booking("WBU-473501", "PRIVATE 4-Bed Room", "204", 4),
  booking("WBU-473519", "PRIVATE 6-Bed FEMALE Room", "203", 6),
  booking("WBU-473512", "PRIVATE 6-Bed Room", "-", 6),
  booking("WBU-473504", "PRIVATE 4-Bed Room", "123", 4),
  booking("WBU-473499", "PRIVATE 4-Bed Room", "209", 4),
  booking("WBU-473522", "PRIVATE 6-Bed SOCIAL Room", "201", 6),
  booking("WBU-473492", "PRIVATE 4-Bed Room", "218", 4),
  booking("WBU-473516", "PRIVATE 6-Bed Room", "108", 6),
  booking("WBU-473493", "PRIVATE 4-Bed Room", "225", 4),
  booking("WBU-473506", "PRIVATE 4-Bed Room", "121", 4),
  booking("WBU-473521", "PRIVATE 6-Bed SOCIAL Room", "313", 6),
  booking("WBU-473515", "PRIVATE 6-Bed Room", "214 BF", 6),
  booking("WBU-473497", "PRIVATE 4-Bed Room", "212", 4),
  booking("WBU-473513", "PRIVATE 6-Bed Room", "208", 6),
  booking("WBU-473540", "PRIVATE 4-Bed Room", "311", 4, FULL_ARRIVAL, "2026-08-30"),
  booking("WBU-473534", "PRIVATE 4-Bed Room", "309", 4, FULL_ARRIVAL, "2026-08-30"),
  booking("WBU-473529", "PRIVATE Double Room", "305", 1),
  booking("WBU-473533", "PRIVATE Twin Room", "423", 2),
  booking("WBU-473526", "PRIVATE Double Room", "205", 1, FULL_ARRIVAL, "2026-08-30"),
  booking("WBU-473528", "PRIVATE Double Room", "307", 1),
  booking("WBU-473535", "PRIVATE 6-Bed FEMALE Room", "327", 6),
  booking("WBU-473541", "PRIVATE 4-Bed Room", "427", 4),
  booking("WBU-473531", "PRIVATE Double Room", "207", 1, FULL_ARRIVAL, "2026-08-30"),
  booking("WBU-473537", "PRIVATE 6-Bed Room", "128", 6, FULL_ARRIVAL, "2026-08-30"),
  booking("WBU-473538", "PRIVATE 4-Bed Room", "117", 4, FULL_ARRIVAL, "2026-08-30"),
  booking("WBU-473532", "PRIVATE Twin Room", "120", 2),
  booking("WBU-473539", "PRIVATE 4-Bed Room", "416", 4, FULL_ARRIVAL, "2026-08-30"),
  booking("WBU-473530", "PRIVATE Double Room", "324", 1, "2026-08-28"),
  booking("WBU-473536", "PRIVATE 6-Bed Room", "114 BF", 6, FULL_ARRIVAL, "2026-08-30"),
  booking("WBU-473527", "PRIVATE Double Room", "424", 1),
  booking("WBU-478234", "PRIVATE Double Room", "224", 2),
  booking("WBU-478235", "PRIVATE Double Room", "407", 2),
  booking("WBU-478236", "PRIVATE Double Room", "421", 2),
  booking("WBU-478386", "PRIVATE 4-Bed FEMALE Room", "304", 4),
];

const COUNTRY_CODE_ALIASES: Readonly<Record<string, string>> = {
  af: "AF",
  afghan: "AF",
  afghanistan: "AF",
  al: "AL",
  albania: "AL",
  albanian: "AL",
  at: "AT",
  austria: "AT",
  austrian: "AT",
  be: "BE",
  belgica: "BE",
  belgian: "BE",
  belgie: "BE",
  belgique: "BE",
  belgium: "BE",
  bf: "BF",
  burkina: "BF",
  "burkina faso": "BF",
  burkinan: "BF",
  cd: "CD",
  congo: "CD",
  "congo drc": "CD",
  "congolese drc": "CD",
  "democratic republic of the congo": "CD",
  cz: "CZ",
  czech: "CZ",
  "czech republic": "CZ",
  de: "DE",
  german: "DE",
  germany: "DE",
  eg: "EG",
  egypt: "EG",
  egyptian: "EG",
  es: "ES",
  spain: "ES",
  spanish: "ES",
  gb: "GB",
  english: "GB",
  "great britain": "GB",
  uk: "GB",
  "united kingdom": "GB",
  ie: "IE",
  ireland: "IE",
  irish: "IE",
  it: "IT",
  italia: "IT",
  italiana: "IT",
  italian: "IT",
  italiano: "IT",
  italy: "IT",
  md: "MD",
  moldova: "MD",
  moldovan: "MD",
  ml: "ML",
  mali: "ML",
  malian: "ML",
  ng: "NG",
  nigeria: "NG",
  nigerian: "NG",
  nl: "NL",
  dutch: "NL",
  nederland: "NL",
  netherlands: "NL",
  pk: "PK",
  pakistan: "PK",
  pakistani: "PK",
  pt: "PT",
  portugal: "PT",
  portuguese: "PT",
  sk: "SK",
  slovak: "SK",
  slovakia: "SK",
  "slovakia svk": "SK",
  sr: "SR",
  suriname: "SR",
  surinamese: "SR",
  ua: "UA",
  ucraina: "UA",
  ukraine: "UA",
  ukrainian: "UA",
  ve: "VE",
  venezuela: "VE",
  venezuelan: "VE",
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeForMatching(value: string | null | undefined): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isWombatHotelName(value: string): boolean {
  return normalizeForMatching(value).includes("wombat");
}

export function normalizeWombatCountryCode(
  value: string | null | undefined
): string {
  const normalized = normalizeForMatching(value);
  if (!normalized) return "";

  const code = COUNTRY_CODE_ALIASES[normalized];
  if (!code) {
    throw new Error(`Wombat country code mapping missing for: ${normalizeText(value)}`);
  }
  return code;
}

function normalizeWombatSex(value: string | null | undefined): string {
  const normalized = normalizeForMatching(value);
  if (["male", "m", "man", "maschio", "maschile", "uomo", "boy"].includes(normalized)) {
    return "Male";
  }
  if (
    ["female", "f", "woman", "femmina", "femminile", "donna", "girl"].includes(
      normalized
    )
  ) {
    return "Female";
  }
  if (!normalized) return "";
  throw new Error(`Wombat sex mapping missing for: ${normalizeText(value)}`);
}

function normalizeWombatDocumentType(
  value: "passport" | "driving_license" | "national_id" | undefined
): string {
  if (value === "passport") return "Passport";
  if (value === "national_id") return "IdentityCard";
  return "";
}

export function dateOnlyToWombatExcelSerial(
  value: string | null | undefined
): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizeText(value));
  if (!match) return null;

  const [, year, month, day] = match;
  const utcDate = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const excelEpoch = Date.UTC(1899, 11, 30);
  return (utcDate - excelEpoch) / 86_400_000;
}

function bookingArrivalSerial(bookingRow: WombatReservationBooking): number {
  return (dateOnlyToWombatExcelSerial(bookingRow.arrivalDate) ?? 0) + 14 / 24;
}

function bookingDepartureSerial(bookingRow: WombatReservationBooking): number {
  return (dateOnlyToWombatExcelSerial(bookingRow.departureDate) ?? 0) + 10 / 24;
}

function roomGroupKey(room: AccommodationRosterRoomSummary): string {
  return [room.capacity, room.availableFrom ?? "", room.availableTo ?? ""].join("|");
}

function bookingGroupKey(bookingRow: WombatReservationBooking): string {
  return [bookingRow.capacity, bookingRow.arrivalDate, bookingRow.departureDate].join("|");
}

function compareNatural(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

function isFemaleBooking(bookingRow: WombatReservationBooking): boolean {
  return bookingRow.spaceCategory.includes("FEMALE");
}

export function matchWombatRoomsToBookings(
  rooms: AccommodationRosterRoomSummary[]
): Map<string, WombatReservationBooking> {
  const roomByInternalCode = new Map(rooms.map((room) => [room.internalCode, room]));
  if (roomByInternalCode.size !== rooms.length) {
    throw new Error("Wombat internal room codes are not unique");
  }
  if (rooms.length !== WOMBAT_RESERVATION_BOOKINGS.length) {
    throw new Error(
      `Wombat inventory mismatch: expected ${WOMBAT_RESERVATION_BOOKINGS.length} rooms, found ${rooms.length}`
    );
  }

  const bookingByPhysicalRoom = new Map(
    WOMBAT_RESERVATION_BOOKINGS.filter((bookingRow) => bookingRow.room !== "-").map(
      (bookingRow) => [bookingRow.room, bookingRow] as const
    )
  );
  const matched = new Map<string, WombatReservationBooking>();
  const usedConfirmations = new Set<string>();

  for (const room of rooms) {
    const realRoomNumber = normalizeText(room.realRoomNumber);
    if (!realRoomNumber) continue;

    const bookingRow = bookingByPhysicalRoom.get(realRoomNumber);
    if (!bookingRow) {
      throw new Error(`Wombat booking missing for physical room: ${realRoomNumber}`);
    }
    if (roomGroupKey(room) !== bookingGroupKey(bookingRow)) {
      throw new Error(
        `Wombat booking dates/capacity do not match ${room.internalCode} / ${realRoomNumber}`
      );
    }

    matched.set(room.internalCode, bookingRow);
    usedConfirmations.add(bookingRow.confirmationNumber);
  }

  const remainingRoomsByGroup = new Map<string, AccommodationRosterRoomSummary[]>();
  for (const room of rooms) {
    if (matched.has(room.internalCode)) continue;
    const key = roomGroupKey(room);
    const current = remainingRoomsByGroup.get(key) ?? [];
    current.push(room);
    remainingRoomsByGroup.set(key, current);
  }

  const remainingBookingsByGroup = new Map<string, WombatReservationBooking[]>();
  for (const bookingRow of WOMBAT_RESERVATION_BOOKINGS) {
    if (usedConfirmations.has(bookingRow.confirmationNumber)) continue;
    const key = bookingGroupKey(bookingRow);
    const current = remainingBookingsByGroup.get(key) ?? [];
    current.push(bookingRow);
    remainingBookingsByGroup.set(key, current);
  }

  const groupKeys = new Set([
    ...remainingRoomsByGroup.keys(),
    ...remainingBookingsByGroup.keys(),
  ]);

  for (const key of groupKeys) {
    const groupRooms = [...(remainingRoomsByGroup.get(key) ?? [])];
    const groupBookings = [...(remainingBookingsByGroup.get(key) ?? [])];
    if (groupRooms.length !== groupBookings.length) {
      throw new Error(
        `Wombat capacity/date group mismatch for ${key}: ${groupRooms.length} live rooms / ${groupBookings.length} bookings`
      );
    }

    groupRooms.sort((a, b) => compareNatural(a.internalCode, b.internalCode));
    groupBookings.sort((a, b) => compareNatural(a.room, b.room));

    for (const femaleBooking of groupBookings.filter(isFemaleBooking)) {
      const femaleRoomIndex = groupRooms.findIndex(
        (room) => room.genderPolicy === "female_only"
      );
      if (femaleRoomIndex < 0) {
        throw new Error(
          `Wombat female booking ${femaleBooking.confirmationNumber} has no female room match`
        );
      }
      const [femaleRoom] = groupRooms.splice(femaleRoomIndex, 1);
      matched.set(femaleRoom.internalCode, femaleBooking);
    }

    const genericBookings = groupBookings.filter((bookingRow) => !isFemaleBooking(bookingRow));
    if (genericBookings.length !== groupRooms.length) {
      throw new Error(`Wombat room matching failed for ${key}`);
    }
    groupRooms.forEach((room, index) => {
      matched.set(room.internalCode, genericBookings[index]);
    });
  }

  if (matched.size !== WOMBAT_RESERVATION_BOOKINGS.length) {
    throw new Error(
      `Wombat matching incomplete: ${matched.size}/${WOMBAT_RESERVATION_BOOKINGS.length} rooms`
    );
  }
  return matched;
}

function participantToReservationFields(
  participant: AccommodationOperationalParticipant | undefined
): Pick<
  WombatReservationRow,
  | "lastName"
  | "firstName"
  | "sex"
  | "nationality"
  | "dateOfBirth"
  | "identityDocument"
  | "identityDocumentNumber"
  | "identityDocumentCountry"
  | "identityDocumentExpiration"
> {
  if (!participant) {
    return {
      lastName: "",
      firstName: "",
      sex: "",
      nationality: "",
      dateOfBirth: null,
      identityDocument: "",
      identityDocumentNumber: "",
      identityDocumentCountry: "",
      identityDocumentExpiration: null,
    };
  }

  const checkIn = participant.hostelCheckIn ?? null;
  const identityDocument = normalizeWombatDocumentType(
    checkIn?.identityDocumentType
  );
  const hasSupportedDocument = Boolean(identityDocument);

  return {
    lastName: normalizeText(participant.lastName),
    firstName: normalizeText(participant.firstName),
    sex: normalizeWombatSex(participant.sex),
    nationality: normalizeWombatCountryCode(participant.nationality),
    dateOfBirth: dateOnlyToWombatExcelSerial(participant.dateOfBirth),
    identityDocument,
    identityDocumentNumber: hasSupportedDocument
      ? normalizeText(checkIn?.identityDocumentNumber)
      : "",
    identityDocumentCountry: hasSupportedDocument
      ? normalizeWombatCountryCode(checkIn?.identityDocumentCountry)
      : "",
    identityDocumentExpiration: hasSupportedDocument
      ? dateOnlyToWombatExcelSerial(checkIn?.identityDocumentExpirationDate)
      : null,
  };
}

export function buildWombatReservationRows(
  hotels: AccommodationHotelRosterSection[]
): WombatReservationRow[] {
  const wombatHotels = hotels.filter((hotel) => isWombatHotelName(hotel.hotelName));
  if (wombatHotels.length === 0) return [];
  if (wombatHotels.length !== 1) {
    throw new Error(`Expected one Wombat hotel, found ${wombatHotels.length}`);
  }

  const [wombatHotel] = wombatHotels;
  const bookingByInternalCode = matchWombatRoomsToBookings(wombatHotel.rooms);
  const internalCodeByConfirmation = new Map(
    [...bookingByInternalCode.entries()].map(([internalCode, bookingRow]) => [
      bookingRow.confirmationNumber,
      internalCode,
    ])
  );
  const participantsByInternalCode = new Map<string, AccommodationOperationalParticipant[]>();
  for (const participant of wombatHotel.participants) {
    const internalCode = normalizeText(participant.roomInternalCode);
    if (!bookingByInternalCode.has(internalCode)) {
      throw new Error(`Wombat booking mapping missing for: ${internalCode || "(missing code)"}`);
    }
    const current = participantsByInternalCode.get(internalCode) ?? [];
    current.push(participant);
    participantsByInternalCode.set(internalCode, current);
  }

  return WOMBAT_RESERVATION_BOOKINGS.flatMap((bookingRow) => {
    const internalCode = internalCodeByConfirmation.get(bookingRow.confirmationNumber);
    if (!internalCode) {
      throw new Error(`Wombat internal room match missing for ${bookingRow.confirmationNumber}`);
    }
    const participants = [...(participantsByInternalCode.get(internalCode) ?? [])].sort(
      (a, b) => {
        const byLastName = normalizeText(a.lastName).localeCompare(
          normalizeText(b.lastName)
        );
        return byLastName !== 0
          ? byLastName
          : normalizeText(a.firstName).localeCompare(normalizeText(b.firstName));
      }
    );
    if (participants.length > bookingRow.capacity) {
      throw new Error(
        `Wombat room ${internalCode} exceeds booking capacity ${bookingRow.capacity}`
      );
    }

    return Array.from({ length: bookingRow.capacity }, (_, index) => {
      const participantFields = participantToReservationFields(participants[index]);
      return {
        confirmationNumber: bookingRow.confirmationNumber,
        spaceCategory: bookingRow.spaceCategory,
        room: bookingRow.room,
        arrivalDate: bookingArrivalSerial(bookingRow),
        departureDate: bookingDepartureSerial(bookingRow),
        customerIdentification: "",
        role: "Guest" as const,
        email: "",
        ...participantFields,
        identityDocumentIssuingCity: "",
        identityDocumentIssueDate: null,
      };
    });
  });
}

export function buildWombatReservationMatrix(
  rows: WombatReservationRow[]
): WombatReservationCell[][] {
  return [
    WOMBAT_RESERVATION_COLUMNS.map((column) => column.label),
    ...rows.map((row) => WOMBAT_RESERVATION_COLUMNS.map((column) => row[column.key])),
  ];
}

export function buildWombatReservationWorksheet(
  XLSX: XlsxModule,
  rows: WombatReservationRow[]
) {
  const worksheet = XLSX.utils.aoa_to_sheet(buildWombatReservationMatrix(rows));
  const lastRow = rows.length + 1;

  worksheet["!cols"] = WOMBAT_RESERVATION_COLUMNS.map((column) => ({
    width: column.width,
  }));

  for (const [columnIndex, column] of WOMBAT_RESERVATION_COLUMNS.entries()) {
    if (!("dateFormat" in column)) continue;
    for (let rowIndex = 2; rowIndex <= lastRow; rowIndex += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex - 1, c: columnIndex })];
      if (cell) cell.z = column.dateFormat;
    }
  }

  return worksheet;
}

export async function exportWombatReservationsToXlsx(args: {
  fileName: string;
  rows: WombatReservationRow[];
}) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    buildWombatReservationWorksheet(XLSX, args.rows),
    "Reservations"
  );
  XLSX.writeFile(workbook, args.fileName);
}
