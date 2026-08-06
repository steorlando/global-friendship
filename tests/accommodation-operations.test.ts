import { strict as assert } from "node:assert";
import test from "node:test";
import { buildAccommodationOperationalRosters } from "../lib/alloggi/operations.ts";
import {
  buildAccommodationHotelRosterColumns,
  buildAccommodationHotelRosterCsv,
  buildAccommodationHotelRosterRows,
  buildAccommodationHotelRosterXlsxColumns,
  buildAccommodationHotelRosterXlsxRows,
  buildAccommodationRoomRosterColumns,
  buildAccommodationRoomRosterCsv,
  buildAccommodationRoomRosterRows,
  buildOperationalRosterPdfHtml,
  matchesOperationalRosterParticipantSearch,
} from "../lib/alloggi/operations-presentation.ts";

test("buildAccommodationOperationalRosters groups assigned participants by hotel and room", () => {
  const rosters = buildAccommodationOperationalRosters({
    groups: [
      { id: "g1", name: "Roma Centro" },
      { id: "g2", name: "Madrid" },
    ],
    rooms: [
      {
        id: "r1",
        hotelId: "h1",
        hotel: {
          id: "h1",
          name: "Wombat's",
          address: "Budapest",
          googleMapsUrl: null,
          createdAt: "",
          roomCount: 2,
        },
        legacyName: "WO-04-A",
        internalCode: "WO-04-A",
        realRoomNumber: "101",
        capacity: 4,
        genderPolicy: "mixed",
        availableFrom: "2026-08-27",
        availableTo: "2026-08-31",
        createdAt: "",
        updatedAt: "",
        assignedGroupCount: 2,
        assignedParticipantCount: 2,
      },
      {
        id: "r2",
        hotelId: "h2",
        hotel: {
          id: "h2",
          name: "Equity Point",
          address: null,
          googleMapsUrl: null,
          createdAt: "",
          roomCount: 1,
        },
        legacyName: "EQ-02-A",
        internalCode: "EQ-02-A",
        realRoomNumber: null,
        capacity: 2,
        genderPolicy: "female_only",
        availableFrom: "2026-08-27",
        availableTo: "2026-08-30",
        createdAt: "",
        updatedAt: "",
        assignedGroupCount: 1,
        assignedParticipantCount: 1,
      },
      {
        id: "r3",
        hotelId: "h1",
        hotel: {
          id: "h1",
          name: "Wombat's",
          address: "Budapest",
          googleMapsUrl: null,
          createdAt: "",
          roomCount: 2,
        },
        legacyName: "WO-04-B",
        internalCode: "WO-04-B",
        realRoomNumber: "102",
        capacity: 4,
        genderPolicy: "mixed",
        availableFrom: "2026-08-27",
        availableTo: "2026-08-31",
        createdAt: "",
        updatedAt: "",
        assignedGroupCount: 1,
        assignedParticipantCount: 0,
      },
    ],
    participants: [
      {
        id: "p1",
        nome: "Anna",
        cognome: "Rossi",
        email: "anna@example.com",
        gruppo_id: "g1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        sesso: "Female",
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-30",
      },
      {
        id: "p2",
        nome: "Luca",
        cognome: "Bianchi",
        email: "luca@example.com",
        gruppo_id: "g1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        sesso: "Male",
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-31",
      },
      {
        id: "p3",
        nome: "Marta",
        cognome: "Lopez",
        email: "marta@example.com",
        gruppo_id: "g2",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        sesso: "Female",
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-29",
      },
      {
        id: "p4",
        nome: "Marco",
        cognome: "Verdi",
        email: "marco@example.com",
        gruppo_id: "g2",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Autonomous",
        sesso: "Male",
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-29",
      },
    ],
    assignments: [
      { id: "a1", partecipante_id: "p1", stanza_id: "r1" },
      { id: "a2", partecipante_id: "p2", stanza_id: "r1" },
      { id: "a3", partecipante_id: "p3", stanza_id: "r2" },
    ],
    roomScopes: [
      { stanza_id: "r1", gruppo_id: "g1" },
      { stanza_id: "r1", gruppo_id: "g2" },
      { stanza_id: "r2", gruppo_id: "g2" },
    ],
  });

  assert.equal(rosters.summary.hotelCount, 2);
  assert.equal(rosters.summary.roomCount, 2);
  assert.equal(rosters.summary.sharedRoomCount, 1);
  assert.equal(rosters.summary.assignedParticipantCount, 3);
  assert.equal(rosters.summary.unassignedEligibleParticipantCount, 0);

  assert.equal(rosters.hotels.length, 2);
  assert.equal(rosters.rooms.length, 2);

  const wombats = rosters.hotels.find((hotel) => hotel.hotelId === "h1");
  assert.ok(wombats);
  assert.equal(wombats.participantCount, 2);
  assert.equal(wombats.roomCount, 2);
  assert.equal(wombats.sharedRoomCount, 1);
  assert.equal(wombats.rooms[0]?.assignedGroups.join(", "), "Madrid, Roma Centro");
  assert.equal(wombats.rooms[1]?.internalCode, "WO-04-B");
  assert.equal(wombats.rooms[1]?.occupancyCount, 0);

  const room = rosters.rooms.find((item) => item.roomId === "r1");
  assert.ok(room);
  assert.equal(room.occupancyCount, 2);
  assert.equal(room.participants[0]?.fullName, "Luca Bianchi");
});

test("matchesOperationalRosterParticipantSearch checks participant, group, room, and hotel fields", () => {
  const participant = {
    participantId: "p1",
    assignmentId: "a1",
    firstName: "Anna",
    lastName: "Rossi",
    fullName: "Anna Rossi",
    email: "anna@example.com",
    groupId: "g1",
    groupName: "Roma Centro",
    sex: "Female",
    arrivalDate: "2026-08-27",
    departureDate: "2026-08-30",
    hotelId: "h1",
    hotelName: "Wombat's",
    roomId: "r1",
    roomInternalCode: "WO-04-A",
    realRoomNumber: "101",
  };

  assert.equal(matchesOperationalRosterParticipantSearch(participant, "anna"), true);
  assert.equal(matchesOperationalRosterParticipantSearch(participant, "roma"), true);
  assert.equal(matchesOperationalRosterParticipantSearch(participant, "wombat"), true);
  assert.equal(matchesOperationalRosterParticipantSearch(participant, "wo-04"), true);
  assert.equal(matchesOperationalRosterParticipantSearch(participant, "madrid"), false);
});

test("roster CSV builders flatten filtered hotel and room sections", () => {
  const hotels = [
    {
      hotelId: "h1",
      hotelName: "Wombat's",
      address: null,
      googleMapsUrl: null,
      participantCount: 1,
      roomCount: 1,
      sharedRoomCount: 0,
      rooms: [],
      participants: [
        {
          participantId: "p1",
          assignmentId: "a1",
          firstName: "Anna",
          lastName: "Rossi",
          fullName: "Anna Rossi",
          email: "anna@example.com",
          groupId: "g1",
          groupName: "Roma Centro",
          sex: "Female",
          arrivalDate: "2026-08-27",
          departureDate: "2026-08-30",
          hotelId: "h1",
          hotelName: "Wombat's",
          roomId: "r1",
          roomInternalCode: "WO-04-A",
          realRoomNumber: "101",
        },
      ],
    },
  ];

  const rooms = [
    {
      roomId: "r1",
      hotelId: "h1",
      hotelName: "Wombat's",
      address: null,
      googleMapsUrl: null,
      internalCode: "WO-04-A",
      realRoomNumber: "101",
      capacity: 4,
      genderPolicy: "mixed" as const,
      availableFrom: "2026-08-27",
      availableTo: "2026-08-31",
      occupancyCount: 1,
      assignedGroups: ["Roma Centro"],
      participants: hotels[0].participants,
    },
  ];

  const hotelCsv = buildAccommodationHotelRosterCsv({
    hotels,
    headers: {
      hotel: "Hotel",
      room: "Room",
      realRoom: "Real room",
      group: "Group",
      participant: "Participant",
      sex: "Sex",
      arrival: "Arrival",
      departure: "Departure",
      email: "Email",
    },
  });

  const roomCsv = buildAccommodationRoomRosterCsv({
    rooms,
    headers: {
      hotel: "Hotel",
      room: "Room",
      realRoom: "Real room",
      capacity: "Capacity",
      groups: "Groups",
      participant: "Participant",
      sex: "Sex",
      arrival: "Arrival",
      departure: "Departure",
      email: "Email",
    },
  });

  assert.match(hotelCsv, /Wombat's,WO-04-A,101,Roma Centro,Anna Rossi/);
  assert.match(roomCsv, /Wombat's,WO-04-A,101,4,Roma Centro,Anna Rossi/);
});

test("PDF export builder renders landscape document with flat rows", () => {
  const hotelRows = buildAccommodationHotelRosterRows({
    hotels: [
      {
        hotelId: "h1",
        hotelName: "Wombat's",
        address: null,
        googleMapsUrl: null,
        participantCount: 1,
        roomCount: 1,
        sharedRoomCount: 0,
        rooms: [],
        participants: [
          {
            participantId: "p1",
            assignmentId: "a1",
            firstName: "Anna",
            lastName: "Rossi",
            fullName: "Anna Rossi",
            email: "anna@example.com",
            groupId: "g1",
            groupName: "Roma Centro",
            sex: "Female",
            arrivalDate: "2026-08-27",
            departureDate: "2026-08-30",
            hotelId: "h1",
            hotelName: "Wombat's",
            roomId: "r1",
            roomInternalCode: "WO-04-A",
            realRoomNumber: "101",
          },
        ],
      },
    ],
  });

  const pdfHtml = buildOperationalRosterPdfHtml({
    documentTitle: "hotel-roster",
    title: "Hotel roster",
    subtitle: "Operational list",
    generatedAtLabel: "Generated at",
    generatedAtValue: "2026-03-22 10:00",
    note: "1 participant still unassigned.",
    summary: [
      { label: "Hotels", value: "1" },
      { label: "Rooms", value: "1" },
      { label: "Participants", value: "1" },
      { label: "Unassigned", value: "1" },
    ],
    columns: buildAccommodationHotelRosterColumns({
      hotel: "Hotel",
      room: "Room",
      realRoom: "Real room",
      group: "Group",
      participant: "Participant",
      sex: "Sex",
      arrival: "Arrival",
      departure: "Departure",
      email: "Email",
    }),
    rows: hotelRows,
    emptyLabel: "No rows",
  });

  assert.match(pdfHtml, /size:\s*A4 landscape/);
  assert.match(pdfHtml, /Anna Rossi/);
  assert.match(pdfHtml, /WO-04-A/);
  assert.match(pdfHtml, /Generated at/);
});

test("hotel XLSX rows include room availability, participant age, empty beds, and empty rooms", () => {
  const columns = buildAccommodationHotelRosterXlsxColumns({
    hotel: "Hotel",
    room: "Stanza",
    availableFrom: "Disponibile dal",
    availableTo: "Disponibile al",
    realRoom: "Numero reale",
    group: "Gruppo",
    participant: "Partecipante",
    sex: "Sesso",
    age: "Età",
    arrival: "Arrivo",
    departure: "Partenza",
    email: "Email",
  });
  const rows = buildAccommodationHotelRosterXlsxRows({
    emptyBedLabel: "Posto vuoto",
    hotels: [
      {
        hotelId: "h1",
        hotelName: "Wombat's",
        address: null,
        googleMapsUrl: null,
        participantCount: 1,
        roomCount: 2,
        sharedRoomCount: 0,
        rooms: [
          {
            roomId: "r1",
            internalCode: "WO-04-A",
            realRoomNumber: "101",
            capacity: 2,
            genderPolicy: "mixed",
            availableFrom: "2026-08-27",
            availableTo: "2026-08-31",
            occupancyCount: 1,
            assignedGroups: ["Roma Centro"],
          },
          {
            roomId: "r2",
            internalCode: "WO-04-B",
            realRoomNumber: "102",
            capacity: 2,
            genderPolicy: "mixed",
            availableFrom: "2026-08-28",
            availableTo: "2026-08-30",
            occupancyCount: 0,
            assignedGroups: ["Madrid"],
          },
        ],
        participants: [
          {
            participantId: "p1",
            assignmentId: "a1",
            firstName: "Anna",
            lastName: "Rossi",
            fullName: "Anna Rossi",
            email: "anna@example.com",
            groupId: "g1",
            groupName: "Roma Centro",
            sex: "Female",
            age: 22,
            arrivalDate: "2026-08-27",
            departureDate: "2026-08-30",
            hotelId: "h1",
            hotelName: "Wombat's",
            roomId: "r1",
            roomInternalCode: "WO-04-A",
            realRoomNumber: "101",
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    columns.map((column) => column.key),
    [
      "hotel",
      "room",
      "availableFrom",
      "availableTo",
      "realRoom",
      "group",
      "participant",
      "sex",
      "age",
      "arrival",
      "departure",
      "email",
    ]
  );
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[0], {
    hotel: "Wombat's",
    room: "WO-04-A",
    availableFrom: "2026-08-27",
    availableTo: "2026-08-31",
    realRoom: "101",
    group: "Roma Centro",
    participant: "Anna Rossi",
    sex: "Female",
    age: "22",
    arrival: "2026-08-27",
    departure: "2026-08-30",
    email: "anna@example.com",
  });
  assert.equal(rows[1]?.participant, "Posto vuoto");
  assert.equal(rows[2]?.room, "WO-04-B");
  assert.equal(rows[2]?.participant, "Posto vuoto");
  assert.equal(rows[3]?.room, "WO-04-B");
  assert.equal(rows[3]?.participant, "Posto vuoto");
});

test("room roster row builder includes group list and capacity", () => {
  const rows = buildAccommodationRoomRosterRows({
    rooms: [
      {
        roomId: "r1",
        hotelId: "h1",
        hotelName: "Wombat's",
        address: null,
        googleMapsUrl: null,
        internalCode: "WO-04-A",
        realRoomNumber: "101",
        capacity: 4,
        genderPolicy: "mixed",
        availableFrom: "2026-08-27",
        availableTo: "2026-08-31",
        occupancyCount: 1,
        assignedGroups: ["Roma Centro", "Madrid"],
        participants: [
          {
            participantId: "p1",
            assignmentId: "a1",
            firstName: "Anna",
            lastName: "Rossi",
            fullName: "Anna Rossi",
            email: "anna@example.com",
            groupId: "g1",
            groupName: "Roma Centro",
            sex: "Female",
            arrivalDate: "2026-08-27",
            departureDate: "2026-08-30",
            hotelId: "h1",
            hotelName: "Wombat's",
            roomId: "r1",
            roomInternalCode: "WO-04-A",
            realRoomNumber: "101",
          },
        ],
      },
    ],
  });

  assert.deepEqual(
    Object.keys(rows[0] ?? {}),
    buildAccommodationRoomRosterColumns({
      hotel: "Hotel",
      room: "Room",
      realRoom: "Real room",
      capacity: "Capacity",
      groups: "Groups",
      participant: "Participant",
      sex: "Sex",
      arrival: "Arrival",
      departure: "Departure",
      email: "Email",
    }).map((column) => column.key)
  );
  assert.equal(rows[0]?.capacity, "4");
  assert.equal(rows[0]?.groups, "Roma Centro; Madrid");
});
