import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as XLSX from "xlsx";

import type {
  AccommodationHotelRosterSection,
  AccommodationOperationalParticipant,
  AccommodationRosterRoomSummary,
} from "../lib/alloggi/operations.ts";
import {
  WOMBAT_RESERVATION_BOOKINGS,
  WOMBAT_RESERVATION_COLUMNS,
  buildWombatReservationMatrix,
  buildWombatReservationRows,
  buildWombatReservationWorksheet,
  dateOnlyToWombatExcelSerial,
  matchWombatRoomsToBookings,
  normalizeWombatCountryCode,
} from "../lib/alloggi/wombat-reservations-export.ts";

const FULL_FROM = "2026-08-27";
const FULL_TO = "2026-08-31";

function room(
  internalCode: string,
  capacity: number,
  options: {
    availableFrom?: string;
    availableTo?: string;
    realRoomNumber?: string | null;
    genderPolicy?: "male_only" | "female_only" | "mixed";
  } = {}
): AccommodationRosterRoomSummary {
  return {
    roomId: `room-${internalCode}`,
    internalCode,
    realRoomNumber: options.realRoomNumber ?? null,
    capacity,
    genderPolicy: options.genderPolicy ?? "mixed",
    availableFrom: options.availableFrom ?? FULL_FROM,
    availableTo: options.availableTo ?? FULL_TO,
    occupancyCount: 0,
    assignedGroups: [],
  };
}

function liveWombatRooms(): AccommodationRosterRoomSummary[] {
  return [
    room("WO-01-A", 1),
    room("WO-01-B", 1),
    room("WO-01-C", 1, {
      availableFrom: "2026-08-28",
      realRoomNumber: "324",
      genderPolicy: "female_only",
    }),
    room("WO-01-D", 1, { availableTo: "2026-08-30" }),
    room("WO-01-E", 1, { availableTo: "2026-08-30" }),
    room("WO-01-F", 1),
    room("WO-01-G", 2, { realRoomNumber: "224" }),
    room("WO-01-H", 2, { realRoomNumber: "407" }),
    room("WO-01-I", 2, { realRoomNumber: "421" }),
    room("WO-02-A", 2, { genderPolicy: "female_only" }),
    room("WO-02-B", 2, { genderPolicy: "female_only" }),
    ...["G", "J", "N", "S"].map((suffix) =>
      room(`WO-04-${suffix}`, 4, {
        availableTo: "2026-08-30",
        genderPolicy: "female_only",
      })
    ),
    ...["A", "B", "C", "D", "E", "F", "H", "I", "K", "L", "M", "O", "P", "Q", "R", "T", "U", "V", "W"].map(
      (suffix) =>
        room(`WO-04-${suffix}`, 4, {
          realRoomNumber:
            suffix === "A" ? "427" : suffix === "W" ? "304" : null,
          genderPolicy: suffix === "W" ? "female_only" : "mixed",
        })
    ),
    room("WO-06-E", 6, { availableTo: "2026-08-30" }),
    room("WO-06-O", 6, { availableTo: "2026-08-30" }),
    ...["A", "B", "C", "D", "F", "G", "H", "I", "J", "K", "L", "M", "N", "P", "Q"].map(
      (suffix) =>
        room(`WO-06-${suffix}`, 6, {
          realRoomNumber: suffix === "Q" ? "327" : null,
          genderPolicy: ["I", "J", "K", "L", "M", "Q"].includes(suffix)
            ? "female_only"
            : "mixed",
        })
    ),
  ];
}

function participant(
  internalCode: string,
  overrides: Partial<AccommodationOperationalParticipant> = {}
): AccommodationOperationalParticipant {
  return {
    participantId: `participant-${internalCode}`,
    assignmentId: `assignment-${internalCode}`,
    firstName: "Anna",
    lastName: "Rossi",
    fullName: "Anna Rossi",
    email: "anna@example.com",
    nationality: "Italian",
    dateOfBirth: "2001-02-03",
    groupId: "group-1",
    groupName: "Roma",
    sex: "Female",
    age: 25,
    arrivalDate: "2026-08-27",
    departureDate: "2026-08-31",
    hotelId: "wombat",
    hotelName: "Wombat's City Hostel",
    roomId: `room-${internalCode}`,
    roomInternalCode: internalCode,
    realRoomNumber: null,
    hostelCheckIn: {
      identityDocumentType: "national_id",
      identityDocumentNumber: "CA123456",
      identityDocumentCountry: "Italia",
      identityDocumentIssuingCity: "Roma",
      identityDocumentIssueDate: "2022-04-05",
      identityDocumentExpirationDate: "2032-04-05",
    },
    ...overrides,
  };
}

function hotel(
  participants: AccommodationOperationalParticipant[] = []
): AccommodationHotelRosterSection {
  const rooms = liveWombatRooms();
  return {
    hotelId: "wombat",
    hotelName: "Wombat's City Hostel",
    address: null,
    googleMapsUrl: null,
    participantCount: participants.length,
    roomCount: rooms.length,
    sharedRoomCount: 0,
    participants,
    rooms,
  };
}

test("Wombat export preserves the definitive 51-booking and 210-bed contract", () => {
  assert.equal(WOMBAT_RESERVATION_BOOKINGS.length, 51);
  assert.equal(
    WOMBAT_RESERVATION_BOOKINGS.reduce((sum, booking) => sum + booking.capacity, 0),
    210
  );
  assert.equal(new Set(WOMBAT_RESERVATION_BOOKINGS.map((booking) => booking.confirmationNumber)).size, 51);
  assert.deepEqual(
    WOMBAT_RESERVATION_COLUMNS.map((column) => column.label),
    [
      "Confirmation number",
      "Space category",
      "Room",
      "Arrival date",
      "Departure date",
      "Customer identification",
      "Role",
      "Email",
      "Last name",
      "First name",
      "Sex",
      "Nationality",
      "Date of birth",
      "Identity document",
      "Identity document number",
      "Identity document country",
      "Identity document issuing city",
      "Identity document issue date",
      "Identity document expiration",
    ]
  );
});

test("Wombat matching preserves known physical rooms and safely fills compatible groups", () => {
  const matches = matchWombatRoomsToBookings(liveWombatRooms());

  assert.equal(matches.size, 51);
  assert.equal(matches.get("WO-01-C")?.room, "324");
  assert.equal(matches.get("WO-01-G")?.room, "224");
  assert.equal(matches.get("WO-01-H")?.room, "407");
  assert.equal(matches.get("WO-01-I")?.room, "421");
  assert.equal(matches.get("WO-04-A")?.room, "427");
  assert.equal(matches.get("WO-04-W")?.room, "304");
  assert.equal(matches.get("WO-06-Q")?.room, "327");

  for (const [internalCode, booking] of matches) {
    const liveRoom = liveWombatRooms().find((candidate) => candidate.internalCode === internalCode);
    assert.ok(liveRoom);
    assert.equal(liveRoom.capacity, booking.capacity);
    assert.equal(liveRoom.availableFrom, booking.arrivalDate);
    assert.equal(liveRoom.availableTo, booking.departureDate);
  }
});

test("Wombat export fills requested guest fields, alpha-2 countries and blank beds", () => {
  const rows = buildWombatReservationRows([
    hotel([
      participant("WO-04-W"),
      participant("WO-01-G", {
        participantId: "participant-2",
        assignmentId: "assignment-2",
        firstName: "Taras",
        lastName: "Shevchenko",
        fullName: "Taras Shevchenko",
        sex: "Male",
        nationality: "Ukrainian",
        roomId: "room-WO-01-G",
        realRoomNumber: "224",
        hostelCheckIn: {
          identityDocumentType: "passport",
          identityDocumentNumber: "UA123",
          identityDocumentCountry: "Ucraina",
          identityDocumentIssuingCity: "Kyiv",
          identityDocumentIssueDate: "2020-01-02",
          identityDocumentExpirationDate: "2030-01-02",
        },
      }),
      participant("WO-01-A", {
        participantId: "participant-driver",
        assignmentId: "assignment-driver",
        firstName: "Driver",
        lastName: "Test",
        fullName: "Driver Test",
        hostelCheckIn: {
          identityDocumentType: "driving_license",
          identityDocumentNumber: "DL123",
          identityDocumentCountry: "Italia",
          identityDocumentIssuingCity: "Roma",
          identityDocumentIssueDate: "2021-03-04",
          identityDocumentExpirationDate: "2031-03-04",
        },
      }),
    ]),
  ]);

  assert.equal(rows.length, 210);
  const room304Rows = rows.filter((row) => row.room === "304");
  assert.equal(room304Rows.length, 4);
  assert.deepEqual(
    {
      firstName: room304Rows[0].firstName,
      lastName: room304Rows[0].lastName,
      sex: room304Rows[0].sex,
      nationality: room304Rows[0].nationality,
      dateOfBirth: room304Rows[0].dateOfBirth,
      identityDocument: room304Rows[0].identityDocument,
      identityDocumentNumber: room304Rows[0].identityDocumentNumber,
      identityDocumentCountry: room304Rows[0].identityDocumentCountry,
      identityDocumentIssuingCity: room304Rows[0].identityDocumentIssuingCity,
      identityDocumentIssueDate: room304Rows[0].identityDocumentIssueDate,
      identityDocumentExpiration: room304Rows[0].identityDocumentExpiration,
    },
    {
      firstName: "Anna",
      lastName: "Rossi",
      sex: "Female",
      nationality: "IT",
      dateOfBirth: dateOnlyToWombatExcelSerial("2001-02-03"),
      identityDocument: "IdentityCard",
      identityDocumentNumber: "CA123456",
      identityDocumentCountry: "IT",
      identityDocumentIssuingCity: "Roma",
      identityDocumentIssueDate: dateOnlyToWombatExcelSerial("2022-04-05"),
      identityDocumentExpiration: dateOnlyToWombatExcelSerial("2032-04-05"),
    }
  );
  assert.equal(room304Rows[1].firstName, "");
  assert.equal(room304Rows[1].identityDocument, "");

  const room224Rows = rows.filter((row) => row.room === "224");
  assert.equal(room224Rows.length, 2);
  assert.equal(room224Rows[0].firstName, "Taras");
  assert.equal(room224Rows[0].nationality, "UA");
  assert.equal(room224Rows[0].identityDocumentCountry, "UA");
  assert.equal(room224Rows[0].identityDocumentIssuingCity, "Kyiv");
  assert.equal(
    room224Rows[0].identityDocumentIssueDate,
    dateOnlyToWombatExcelSerial("2020-01-02")
  );
  assert.equal(room224Rows[1].firstName, "");

  const drivingLicenseRow = rows.find((row) => row.firstName === "Driver");
  assert.ok(drivingLicenseRow);
  assert.equal(drivingLicenseRow.identityDocument, "");
  assert.equal(drivingLicenseRow.identityDocumentIssuingCity, "");
  assert.equal(drivingLicenseRow.identityDocumentIssueDate, null);
});

test("Wombat country conversion supports all current live roster values", () => {
  const expected = {
    Afghan: "AF",
    Albanian: "AL",
    Austrian: "AT",
    Belgian: "BE",
    Belgie: "BE",
    België: "BE",
    Bélgica: "BE",
    Burkinan: "BF",
    "Congolese (DRC)": "CD",
    Czech: "CZ",
    Dutch: "NL",
    Egyptian: "EG",
    English: "GB",
    German: "DE",
    Ireland: "IE",
    Italian: "IT",
    Italiana: "IT",
    Malian: "ML",
    Moldovan: "MD",
    Nigerian: "NG",
    Nederland: "NL",
    Pakistani: "PK",
    Portuguese: "PT",
    Slovak: "SK",
    "Slovakia (SVK)": "SK",
    Spanish: "ES",
    Surinamese: "SR",
    Ukrainian: "UA",
    Venezuelan: "VE",
  };

  for (const [country, code] of Object.entries(expected)) {
    assert.equal(normalizeWombatCountryCode(country), code);
  }
  assert.throws(
    () => normalizeWombatCountryCode("Unknownland"),
    /country code mapping missing/
  );
});

test("Wombat worksheet uses supplier booking formats and DD/MM/YYYY guest dates", () => {
  const rows = buildWombatReservationRows([hotel([participant("WO-04-W")])]);
  const matrix = buildWombatReservationMatrix(rows);
  const worksheet = buildWombatReservationWorksheet(XLSX, rows);
  const room304RowIndex = rows.findIndex((row) => row.room === "304") + 2;

  assert.equal(matrix.length, 211);
  assert.equal(matrix[0].length, 19);
  assert.equal(worksheet.D2.t, "n");
  assert.equal(worksheet.D2.z, "yyyy\. mm\. dd\.");
  assert.equal(worksheet[`M${room304RowIndex}`].t, "n");
  assert.equal(worksheet[`M${room304RowIndex}`].z, "dd/mm/yyyy");
  assert.equal(worksheet[`Q${room304RowIndex}`].v, "Roma");
  assert.equal(worksheet[`R${room304RowIndex}`].t, "n");
  assert.equal(worksheet[`R${room304RowIndex}`].z, "dd/mm/yyyy");
  assert.equal(worksheet[`S${room304RowIndex}`].t, "n");
  assert.equal(worksheet[`S${room304RowIndex}`].z, "dd/mm/yyyy");
});

test("Wombat export fails closed when live inventory no longer matches the template", () => {
  const rooms = liveWombatRooms();
  rooms.find((candidate) => candidate.internalCode === "WO-04-W")!.capacity = 5;
  assert.throws(
    () => matchWombatRoomsToBookings(rooms),
    /booking dates\/capacity do not match WO-04-W \/ 304/
  );
});

test("Hotel roster exposes the Wombat export and requests protected document fields", () => {
  const componentSource = readFileSync(
    new URL(
      "../app/dashboard/_components/accommodation-hotel-roster-manager.tsx",
      import.meta.url
    ),
    "utf8"
  );
  const routeSource = readFileSync(
    new URL("../app/api/alloggi/operational-rosters/route.ts", import.meta.url),
    "utf8"
  );

  assert.match(componentSource, /includeWombatExportFields=1/);
  assert.match(componentSource, /exportWombat/);
  assert.match(routeSource, /includeWombatExportFields/);
  assert.match(routeSource, /includeCheckInDocuments:[\s\S]*includeWombatExportFields/);
});
