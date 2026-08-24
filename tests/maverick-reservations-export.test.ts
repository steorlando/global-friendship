import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as XLSX from "xlsx";

import type {
  AccommodationHotelRosterSection,
  AccommodationOperationalParticipant,
} from "../lib/alloggi/operations.ts";
import {
  MAVERICK_RESERVATION_BY_ROOM,
  MAVERICK_RESERVATION_COLUMNS,
  buildMaverickReservationMatrix,
  buildMaverickReservationRows,
  buildMaverickReservationWorksheet,
  dateOnlyToExcelSerial,
} from "../lib/alloggi/maverick-reservations-export.ts";

function participant(
  overrides: Partial<AccommodationOperationalParticipant> = {}
): AccommodationOperationalParticipant {
  return {
    participantId: "participant-1",
    personalCode: "0042",
    assignmentId: "assignment-1",
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
    arrivalDate: "2026-08-29",
    departureDate: "2026-08-30",
    hotelId: "maverick",
    hotelName: "Maverick Atheneum",
    roomId: "room-310",
    roomInternalCode: "MA-10-A",
    realRoomNumber: "310",
    hostelCheckIn: {
      identityDocumentType: "national_id",
      identityDocumentNumber: "CA123456",
      identityDocumentCountry: "Italy",
      identityDocumentIssuingCity: "Rome",
      identityDocumentIssueDate: "2022-04-05",
      identityDocumentExpirationDate: "2032-04-05",
    },
    ...overrides,
  };
}

function hotel(args: {
  name?: string;
  participants?: AccommodationOperationalParticipant[];
} = {}): AccommodationHotelRosterSection {
  const participants = args.participants ?? [participant()];
  return {
    hotelId: "maverick",
    hotelName: args.name ?? "Maverick Atheneum",
    address: null,
    googleMapsUrl: null,
    participantCount: participants.length,
    roomCount: 1,
    sharedRoomCount: 0,
    participants,
    rooms: [],
  };
}

test("Maverick export keeps the supplier's 19-column contract and all 70 room bookings", () => {
  assert.equal(Object.keys(MAVERICK_RESERVATION_BY_ROOM).length, 70);
  assert.deepEqual(
    MAVERICK_RESERVATION_COLUMNS.map((column) => column.label),
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
  assert.deepEqual(MAVERICK_RESERVATION_BY_ROOM["310"], {
    confirmationNumber: "24198",
    spaceCategory: "10 Bed Mixed Dorm",
  });
  assert.deepEqual(MAVERICK_RESERVATION_BY_ROOM["209"], {
    confirmationNumber: "24931",
    spaceCategory: "Budget Quadrouple Room Ensuite",
  });
});

test("Maverick export maps participant, stay and check-in fields into supplier values", () => {
  const rows = buildMaverickReservationRows([
    hotel(),
    hotel({ name: "Baroque Hostel", participants: [participant()] }),
  ]);

  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], {
    confirmationNumber: "24198",
    spaceCategory: "10 Bed Mixed Dorm",
    room: "310",
    arrivalDate: (dateOnlyToExcelSerial("2026-08-27") ?? 0) + 15 / 24,
    departureDate: (dateOnlyToExcelSerial("2026-08-31") ?? 0) + 11 / 24,
    customerIdentification: "0042",
    role: "Guest",
    email: "anna@example.com",
    lastName: "Rossi",
    firstName: "Anna",
    sex: "Female",
    nationality: "Italian",
    dateOfBirth: dateOnlyToExcelSerial("2001-02-03"),
    identityDocument: "IdentityCard",
    identityDocumentNumber: "CA123456",
    identityDocumentCountry: "Italy",
    identityDocumentIssuingCity: "Rome",
    identityDocumentIssueDate: dateOnlyToExcelSerial("2022-04-05"),
    identityDocumentExpiration: dateOnlyToExcelSerial("2032-04-05"),
  });
});

test("Maverick export fails closed when a physical room has no supplier booking", () => {
  assert.throws(
    () =>
      buildMaverickReservationRows([
        hotel({ participants: [participant({ realRoomNumber: "999" })] }),
      ]),
    /mapping missing for: 999/
  );
});

test("Maverick export preserves the exceptional booking dates for room 113", () => {
  const rows = buildMaverickReservationRows([
    hotel({
      participants: [
        participant({
          roomId: "room-113",
          roomInternalCode: "MA-02-U",
          realRoomNumber: "113",
        }),
      ],
    }),
  ]);

  assert.equal(
    rows[0].arrivalDate,
    (dateOnlyToExcelSerial("2026-08-28") ?? 0) + 15 / 24
  );
  assert.equal(
    rows[0].departureDate,
    (dateOnlyToExcelSerial("2026-08-30") ?? 0) + 11 / 24
  );
});

test("Maverick worksheet uses real Excel date cells and the Reservations layout", () => {
  const rows = buildMaverickReservationRows([hotel()]);
  const matrix = buildMaverickReservationMatrix(rows);
  const worksheet = buildMaverickReservationWorksheet(XLSX, rows);

  assert.equal(matrix.length, 2);
  assert.equal(matrix[0].length, 19);
  assert.equal(worksheet.D2.t, "n");
  assert.equal(
    worksheet.D2.v,
    (dateOnlyToExcelSerial("2026-08-27") ?? 0) + 15 / 24
  );
  assert.equal(worksheet.D2.z, "yyyy\\. mm\\. dd\\.");
  assert.equal(worksheet.M2.t, "n");
  assert.deepEqual(worksheet["!autofilter"], { ref: "A1:S2" });
});

test("Hotel roster exposes a deliberately small temporary Maverick button", () => {
  const source = readFileSync(
    new URL(
      "../app/dashboard/_components/accommodation-hotel-roster-manager.tsx",
      import.meta.url
    ),
    "utf8"
  );

  assert.match(source, /includeMaverickExportFields=1/);
  assert.match(
    source,
    /exportMaverick[\s\S]*px-2\.5 py-1\.5 text-xs[\s\S]*exportMaverick/
  );
});
