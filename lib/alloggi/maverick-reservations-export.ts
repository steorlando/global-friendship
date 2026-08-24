import type { AccommodationHotelRosterSection } from "./operations.ts";

type XlsxModule = typeof import("xlsx");

type MaverickReservationBooking = {
  confirmationNumber: string;
  spaceCategory: string;
};

export type MaverickReservationCell = string | number | null;

export type MaverickReservationRow = {
  confirmationNumber: string;
  spaceCategory: string;
  room: string;
  arrivalDate: number | null;
  departureDate: number | null;
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

export const MAVERICK_RESERVATION_COLUMNS = [
  { key: "confirmationNumber", label: "Confirmation number", width: 23.55 },
  { key: "spaceCategory", label: "Space category", width: 34.33 },
  { key: "room", label: "Room", width: 9.11 },
  { key: "arrivalDate", label: "Arrival date", width: 13, date: true },
  { key: "departureDate", label: "Departure date", width: 16.89, date: true },
  {
    key: "customerIdentification",
    label: "Customer identification",
    width: 25.44,
  },
  { key: "role", label: "Role", width: 9.11 },
  { key: "email", label: "Email", width: 9.11 },
  { key: "lastName", label: "Last name", width: 11.55 },
  { key: "firstName", label: "First name", width: 11.89 },
  { key: "sex", label: "Sex", width: 9.11 },
  { key: "nationality", label: "Nationality", width: 12.33 },
  { key: "dateOfBirth", label: "Date of birth", width: 14.11, date: true },
  { key: "identityDocument", label: "Identity document", width: 20.33 },
  {
    key: "identityDocumentNumber",
    label: "Identity document number",
    width: 29.33,
  },
  {
    key: "identityDocumentCountry",
    label: "Identity document country",
    width: 29.33,
  },
  {
    key: "identityDocumentIssuingCity",
    label: "Identity document issuing city",
    width: 32.55,
  },
  {
    key: "identityDocumentIssueDate",
    label: "Identity document issue date",
    width: 31.44,
    date: true,
  },
  {
    key: "identityDocumentExpiration",
    label: "Identity document expiration",
    width: 31.33,
    date: true,
  },
] as const satisfies ReadonlyArray<{
  key: keyof MaverickReservationRow;
  label: string;
  width: number;
  date?: boolean;
}>;

// Temporary 2026 event mapping supplied in Maverick workbook GC-1391259.
// It is intentionally isolated here so the whole event-specific export can be removed later.
export const MAVERICK_RESERVATION_BY_ROOM: Readonly<
  Record<string, MaverickReservationBooking>
> = {
  "310": { confirmationNumber: "24198", spaceCategory: "10 Bed Mixed Dorm" },
  "508": { confirmationNumber: "24195", spaceCategory: "10 Bed Mixed Dorm" },
  "408": { confirmationNumber: "24197", spaceCategory: "10 Bed Mixed Dorm" },
  "410": { confirmationNumber: "24196", spaceCategory: "10 Bed Mixed Dorm" },
  "308": { confirmationNumber: "24199", spaceCategory: "10 Bed Mixed Dorm" },
  "102": { confirmationNumber: "24202", spaceCategory: "10 Bed Mixed Dorm" },
  "208": { confirmationNumber: "24201", spaceCategory: "10 Bed Mixed Dorm" },
  "210": { confirmationNumber: "24200", spaceCategory: "10 Bed Mixed Dorm" },
  "114": { confirmationNumber: "24203", spaceCategory: "8 Bed Mixed Dorm" },
  "109": { confirmationNumber: "24204", spaceCategory: "8 Bed Mixed Dorm" },
  "105": { confirmationNumber: "24207", spaceCategory: "6 Bed Mixed Dorm" },
  "106": { confirmationNumber: "24206", spaceCategory: "6 Bed Mixed Dorm" },
  "107": { confirmationNumber: "24205", spaceCategory: "6 Bed Mixed Dorm" },
  "419": { confirmationNumber: "24211", spaceCategory: "4 Bed Mixed Dorm" },
  "515": { confirmationNumber: "24209", spaceCategory: "4 Bed Mixed Dorm" },
  "415": { confirmationNumber: "24212", spaceCategory: "4 Bed Mixed Dorm" },
  "519": { confirmationNumber: "24208", spaceCategory: "4 Bed Mixed Dorm" },
  "514": { confirmationNumber: "24210", spaceCategory: "4 Bed Mixed Dorm" },
  "315": { confirmationNumber: "24214", spaceCategory: "4 Bed Mixed Dorm" },
  "414": { confirmationNumber: "24213", spaceCategory: "4 Bed Mixed Dorm" },
  "215": { confirmationNumber: "24216", spaceCategory: "4 Bed Mixed Dorm" },
  "314": { confirmationNumber: "24215", spaceCategory: "4 Bed Mixed Dorm" },
  "313": {
    confirmationNumber: "24217",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "506": {
    confirmationNumber: "24218",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "214": { confirmationNumber: "24886", spaceCategory: "4 Bed Mixed Dorm" },
  "219": { confirmationNumber: "24888", spaceCategory: "5 Bed Mixed Dorm" },
  "319": { confirmationNumber: "24887", spaceCategory: "5 Bed Mixed Dorm" },
  "108": { confirmationNumber: "24889", spaceCategory: "5 Bed Mixed Dorm" },
  "417": {
    confirmationNumber: "24891",
    spaceCategory: "Quadrouple Room Ensuite",
  },
  "112": {
    confirmationNumber: "24894",
    spaceCategory: "Quadrouple Room Ensuite",
  },
  "217": {
    confirmationNumber: "24893",
    spaceCategory: "Quadrouple Room Ensuite",
  },
  "317": {
    confirmationNumber: "24892",
    spaceCategory: "Quadrouple Room Ensuite",
  },
  "517": {
    confirmationNumber: "24890",
    spaceCategory: "Quadrouple Room Ensuite",
  },
  "403": { confirmationNumber: "24897", spaceCategory: "4 Bed Female Dorm" },
  "501": { confirmationNumber: "24895", spaceCategory: "4 Bed Female Dorm" },
  "303": { confirmationNumber: "24899", spaceCategory: "4 Bed Female Dorm" },
  "503": { confirmationNumber: "24896", spaceCategory: "4 Bed Female Dorm" },
  "401": { confirmationNumber: "24898", spaceCategory: "4 Bed Female Dorm" },
  "301": { confirmationNumber: "24900", spaceCategory: "4 Bed Female Dorm" },
  "201": { confirmationNumber: "24902", spaceCategory: "4 Bed Female Dorm" },
  "203": { confirmationNumber: "24901", spaceCategory: "4 Bed Female Dorm" },
  "405": { confirmationNumber: "24903", spaceCategory: "Triple Room Ensuite" },
  "305": { confirmationNumber: "24904", spaceCategory: "Triple Room Ensuite" },
  "307": {
    confirmationNumber: "24905",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "306": {
    confirmationNumber: "24907",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "206": {
    confirmationNumber: "24906",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "110": {
    confirmationNumber: "24908",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "318": {
    confirmationNumber: "24912",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "406": {
    confirmationNumber: "24911",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "407": {
    confirmationNumber: "24910",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "413": {
    confirmationNumber: "24909",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "218": {
    confirmationNumber: "24917",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "513": {
    confirmationNumber: "24916",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "416": {
    confirmationNumber: "24914",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "507": {
    confirmationNumber: "24913",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "418": {
    confirmationNumber: "24915",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "207": {
    confirmationNumber: "24920",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "213": {
    confirmationNumber: "24919",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "216": {
    confirmationNumber: "24918",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "516": {
    confirmationNumber: "24922",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "316": {
    confirmationNumber: "24921",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "113": {
    confirmationNumber: "24923",
    spaceCategory: "Standard Double Room Ensuite",
  },
  "409": {
    confirmationNumber: "24927",
    spaceCategory: "Budget Quadrouple Room Ensuite",
  },
  "511": {
    confirmationNumber: "24924",
    spaceCategory: "Budget Quadrouple Room Ensuite",
  },
  "509": {
    confirmationNumber: "24925",
    spaceCategory: "Budget Quadrouple Room Ensuite",
  },
  "411": {
    confirmationNumber: "24926",
    spaceCategory: "Budget Quadrouple Room Ensuite",
  },
  "311": {
    confirmationNumber: "24928",
    spaceCategory: "Budget Quadrouple Room Ensuite",
  },
  "211": {
    confirmationNumber: "24930",
    spaceCategory: "Budget Quadrouple Room Ensuite",
  },
  "309": {
    confirmationNumber: "24929",
    spaceCategory: "Budget Quadrouple Room Ensuite",
  },
  "209": {
    confirmationNumber: "24931",
    spaceCategory: "Budget Quadrouple Room Ensuite",
  },
};

const MAVERICK_ROOM_ORDER = new Map(
  Object.keys(MAVERICK_RESERVATION_BY_ROOM).map((room, index) => [room, index])
);

// Booking dates/times are reservation metadata from the supplier workbook.
// They must not be replaced with each participant's travel dates.
const MAVERICK_AUGUST_28_ARRIVAL_ROOMS = new Set([
  "403",
  "303",
  "401",
  "301",
  "201",
  "203",
  "218",
  "513",
  "416",
  "507",
  "418",
  "207",
  "213",
  "216",
  "516",
  "316",
  "113",
]);
const MAVERICK_AUGUST_30_DEPARTURE_ROOMS = new Set(["113"]);

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function isMaverickHotelName(value: string): boolean {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("maverick");
}

function normalizeMaverickSex(value: string | null | undefined): string {
  const normalized = normalizeText(value).toLowerCase();
  if (["male", "m", "maschio"].includes(normalized)) return "Male";
  if (["female", "f", "femmina"].includes(normalized)) return "Female";
  return normalizeText(value);
}

function normalizeMaverickDocumentType(
  value: "passport" | "driving_license" | "national_id" | undefined
): string {
  if (value === "passport") return "Passport";
  if (value === "driving_license") return "DriversLicense";
  if (value === "national_id") return "IdentityCard";
  return "";
}

export function dateOnlyToExcelSerial(value: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizeText(value));
  if (!match) return null;

  const [, year, month, day] = match;
  const utcDate = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const excelEpoch = Date.UTC(1899, 11, 30);
  return (utcDate - excelEpoch) / 86_400_000;
}

function maverickBookingArrivalSerial(room: string): number {
  const date = MAVERICK_AUGUST_28_ARRIVAL_ROOMS.has(room)
    ? "2026-08-28"
    : "2026-08-27";
  return (dateOnlyToExcelSerial(date) ?? 0) + 15 / 24;
}

function maverickBookingDepartureSerial(room: string): number {
  const date = MAVERICK_AUGUST_30_DEPARTURE_ROOMS.has(room)
    ? "2026-08-30"
    : "2026-08-31";
  return (dateOnlyToExcelSerial(date) ?? 0) + 11 / 24;
}

export function buildMaverickReservationRows(
  hotels: AccommodationHotelRosterSection[]
): MaverickReservationRow[] {
  const participants = hotels
    .filter((hotel) => isMaverickHotelName(hotel.hotelName))
    .flatMap((hotel) => hotel.participants);

  const missingRoomMappings = [
    ...new Set(
      participants
        .map((participant) => normalizeText(participant.realRoomNumber))
        .filter((room) => !room || !MAVERICK_RESERVATION_BY_ROOM[room])
        .map((room) => room || "(missing room number)")
    ),
  ];

  if (missingRoomMappings.length > 0) {
    throw new Error(
      `Maverick reservation mapping missing for: ${missingRoomMappings.join(", ")}`
    );
  }

  return participants
    .map((participant) => {
      const room = normalizeText(participant.realRoomNumber);
      const booking = MAVERICK_RESERVATION_BY_ROOM[room];
      const checkIn = participant.hostelCheckIn ?? null;

      return {
        confirmationNumber: booking.confirmationNumber,
        spaceCategory: booking.spaceCategory,
        room,
        arrivalDate: maverickBookingArrivalSerial(room),
        departureDate: maverickBookingDepartureSerial(room),
        customerIdentification: normalizeText(participant.personalCode),
        role: "Guest" as const,
        email: normalizeText(participant.email),
        lastName: normalizeText(participant.lastName),
        firstName: normalizeText(participant.firstName),
        sex: normalizeMaverickSex(participant.sex),
        nationality: normalizeText(participant.nationality),
        dateOfBirth: dateOnlyToExcelSerial(participant.dateOfBirth),
        identityDocument: normalizeMaverickDocumentType(
          checkIn?.identityDocumentType
        ),
        identityDocumentNumber: normalizeText(checkIn?.identityDocumentNumber),
        identityDocumentCountry: normalizeText(checkIn?.identityDocumentCountry),
        identityDocumentIssuingCity: normalizeText(
          checkIn?.identityDocumentIssuingCity
        ),
        identityDocumentIssueDate: dateOnlyToExcelSerial(
          checkIn?.identityDocumentIssueDate
        ),
        identityDocumentExpiration: dateOnlyToExcelSerial(
          checkIn?.identityDocumentExpirationDate
        ),
      };
    })
    .sort((a, b) => {
      const roomOrder =
        (MAVERICK_ROOM_ORDER.get(a.room) ?? Number.MAX_SAFE_INTEGER) -
        (MAVERICK_ROOM_ORDER.get(b.room) ?? Number.MAX_SAFE_INTEGER);
      if (roomOrder !== 0) return roomOrder;

      const byLastName = a.lastName.localeCompare(b.lastName);
      return byLastName !== 0 ? byLastName : a.firstName.localeCompare(b.firstName);
    });
}

export function buildMaverickReservationMatrix(
  rows: MaverickReservationRow[]
): MaverickReservationCell[][] {
  return [
    MAVERICK_RESERVATION_COLUMNS.map((column) => column.label),
    ...rows.map((row) =>
      MAVERICK_RESERVATION_COLUMNS.map((column) => row[column.key])
    ),
  ];
}

export function buildMaverickReservationWorksheet(
  XLSX: XlsxModule,
  rows: MaverickReservationRow[]
) {
  const worksheet = XLSX.utils.aoa_to_sheet(buildMaverickReservationMatrix(rows));
  const lastRow = rows.length + 1;
  const lastColumn = XLSX.utils.encode_col(MAVERICK_RESERVATION_COLUMNS.length - 1);

  worksheet["!cols"] = MAVERICK_RESERVATION_COLUMNS.map((column) => {
    const contentWidth = Math.max(
      column.label.length,
      ...rows.map((row) => String(row[column.key] ?? "").length)
    );
    return {
      wch: Math.max(column.width, Math.min(contentWidth + 2, 40)),
    };
  });
  worksheet["!autofilter"] = { ref: `A1:${lastColumn}${lastRow}` };

  for (const [columnIndex, column] of MAVERICK_RESERVATION_COLUMNS.entries()) {
    if (!("date" in column && column.date)) continue;

    for (let rowIndex = 2; rowIndex <= lastRow; rowIndex += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex - 1, c: columnIndex })];
      if (cell) cell.z = "yyyy\\. mm\\. dd\\.";
    }
  }

  return worksheet;
}

export async function exportMaverickReservationsToXlsx(args: {
  fileName: string;
  rows: MaverickReservationRow[];
}) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    buildMaverickReservationWorksheet(XLSX, args.rows),
    "Reservations"
  );
  XLSX.writeFile(workbook, args.fileName);
}
