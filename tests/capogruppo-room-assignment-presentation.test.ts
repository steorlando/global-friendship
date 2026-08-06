import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildGroupLeaderRoomOptionLabel,
  formatGroupLeaderRoomAvailability,
  getGroupLeaderRoomBedRowCount,
  getGroupLeaderRoomEarlyArrivalOccupants,
  getGroupLeaderRoomFreeBedCount,
  getGroupLeaderRoomOccupancy,
  getGroupLeaderRoomRequiredAvailableFrom,
  getGroupLeaderRoomShorteningSuggestion,
  getGroupLeaderSharedRooms,
  isGroupLeaderRomeCity,
  matchesGroupLeaderParticipantSearch,
  matchesGroupLeaderRoomAvailabilityFilter,
  matchesGroupLeaderRoomAvailabilityWarningFilter,
  matchesGroupLeaderRoomCodeFilter,
  matchesGroupLeaderRoomOccupantGroup,
  matchesGroupLeaderRoomOccupantSearch,
} from "../lib/capogruppo/room-assignment-presentation.ts";

const room = {
  id: "room-1",
  hotelId: "hotel-1",
  internalCode: "ROOM-1",
  legacyName: "Room 1",
  realRoomNumber: null,
  capacity: 4,
  genderPolicy: "mixed" as const,
  availableFrom: null,
  availableTo: null,
  notes: null,
  active: true,
  assignedParticipantCount: 0,
  assignedGroupCount: 0,
  createdAt: "2026-08-05T00:00:00.000Z",
  updatedAt: "2026-08-05T00:00:00.000Z",
  hotel: null,
};

test("room availability filters distinguish free beds from completely empty rooms", () => {
  assert.equal(matchesGroupLeaderRoomAvailabilityFilter(room, 0, "all"), true);
  assert.equal(matchesGroupLeaderRoomAvailabilityFilter(room, 0, "available"), true);
  assert.equal(matchesGroupLeaderRoomAvailabilityFilter(room, 0, "empty"), true);

  assert.equal(matchesGroupLeaderRoomAvailabilityFilter(room, 2, "available"), true);
  assert.equal(matchesGroupLeaderRoomAvailabilityFilter(room, 2, "empty"), false);
  assert.equal(matchesGroupLeaderRoomAvailabilityFilter(room, 4, "available"), false);
});

test("room warning filter supports individual, any, and combined warning states", () => {
  assert.equal(matchesGroupLeaderRoomAvailabilityWarningFilter(false, false, "all"), true);
  assert.equal(matchesGroupLeaderRoomAvailabilityWarningFilter(true, false, "extend"), true);
  assert.equal(matchesGroupLeaderRoomAvailabilityWarningFilter(false, true, "extend"), false);
  assert.equal(matchesGroupLeaderRoomAvailabilityWarningFilter(false, true, "shorten"), true);
  assert.equal(matchesGroupLeaderRoomAvailabilityWarningFilter(true, false, "shorten"), false);
  assert.equal(matchesGroupLeaderRoomAvailabilityWarningFilter(true, false, "any"), true);
  assert.equal(matchesGroupLeaderRoomAvailabilityWarningFilter(false, true, "any"), true);
  assert.equal(matchesGroupLeaderRoomAvailabilityWarningFilter(false, false, "any"), false);
  assert.equal(matchesGroupLeaderRoomAvailabilityWarningFilter(true, true, "both"), true);
  assert.equal(matchesGroupLeaderRoomAvailabilityWarningFilter(true, false, "both"), false);
});

test("room occupancy uses the most complete active-occupant count", () => {
  assert.equal(getGroupLeaderRoomOccupancy({ ...room, assignedParticipantCount: 3 }, 2), 3);
  assert.equal(getGroupLeaderRoomOccupancy(room, 2), 2);
});

test("desktop room rack exposes one row per bed without marking unresolved occupants as free", () => {
  assert.equal(getGroupLeaderRoomFreeBedCount(room, 0), 4);
  assert.equal(getGroupLeaderRoomFreeBedCount(room, 3), 1);
  assert.equal(getGroupLeaderRoomFreeBedCount(room, 5), 0);
  assert.equal(
    getGroupLeaderRoomFreeBedCount({ ...room, assignedParticipantCount: 3 }, 2),
    1
  );

  assert.equal(getGroupLeaderRoomBedRowCount(room, 0), 4);
  assert.equal(getGroupLeaderRoomBedRowCount(room, 5), 5);
  assert.equal(getGroupLeaderRoomBedRowCount({ ...room, capacity: 0 }, 0), 1);
});

test("multi-person assignment keeps only rooms shared by every selected participant", () => {
  const secondRoom = { ...room, id: "room-2", internalCode: "ROOM-2" };
  const thirdRoom = { ...room, id: "room-3", internalCode: "ROOM-3" };
  const roomsByParticipantId = new Map([
    ["p1", [room, secondRoom]],
    ["p2", [secondRoom, thirdRoom]],
    ["p3", [secondRoom]],
  ]);

  assert.deepEqual(
    getGroupLeaderSharedRooms(["p1", "p2", "p3"], roomsByParticipantId).map(
      (candidate) => candidate.id
    ),
    ["room-2"]
  );
  assert.deepEqual(getGroupLeaderSharedRooms([], roomsByParticipantId), []);
});

test("room code filter supports partial, case-insensitive matches", () => {
  const maverickDouble = { ...room, internalCode: "MA-02-A" };

  assert.equal(matchesGroupLeaderRoomCodeFilter(maverickDouble, "MA-02"), true);
  assert.equal(matchesGroupLeaderRoomCodeFilter(maverickDouble, "ma-02"), true);
  assert.equal(matchesGroupLeaderRoomCodeFilter(maverickDouble, " 02 "), true);
  assert.equal(matchesGroupLeaderRoomCodeFilter(maverickDouble, "06"), false);
  assert.equal(matchesGroupLeaderRoomCodeFilter(maverickDouble, ""), true);
});
import type { GroupLeaderParticipant } from "../lib/capogruppo/room-assignments.ts";

test("buildGroupLeaderRoomOptionLabel keeps room selectors compact", () => {
  assert.equal(
    buildGroupLeaderRoomOptionLabel({
      id: "r1",
      hotelId: "h1",
      hotel: {
        id: "h1",
        name: "Wombat's",
        address: null,
        googleMapsUrl: null,
        createdAt: "",
        roomCount: 10,
      },
      legacyName: "WO-04-A",
      internalCode: "WO-04-A",
      realRoomNumber: null,
      capacity: 4,
      genderPolicy: "mixed",
      availableFrom: "2026-08-28",
      availableTo: "2026-08-31",
      createdAt: "",
      updatedAt: "",
      assignedGroupCount: 1,
      assignedParticipantCount: 0,
    }),
    "WO-04-A · Wombat's"
  );
});

test("formatGroupLeaderRoomAvailability handles bounded and open ranges", () => {
  assert.equal(
    formatGroupLeaderRoomAvailability({
      id: "r1",
      hotelId: "h1",
      hotel: null,
      legacyName: "WO-04-A",
      internalCode: "WO-04-A",
      realRoomNumber: null,
      capacity: 4,
      genderPolicy: "mixed",
      availableFrom: "2026-08-27",
      availableTo: "2026-08-31",
      createdAt: "",
      updatedAt: "",
      assignedGroupCount: 1,
      assignedParticipantCount: 0,
    }),
    "2026-08-27 -> 2026-08-31"
  );
});

test("early-arrival warning identifies only occupants arriving before room availability", () => {
  const earlyArrivals = getGroupLeaderRoomEarlyArrivalOccupants(
    { availableFrom: "2026-08-28" },
    [
      {
        participantId: "early",
        roomId: "r1",
        firstName: "Anna",
        lastName: "Rossi",
        groupId: "G1",
        groupLabel: "Roma",
        displayGroup: "Roma",
        arrivalDate: "2026-08-27",
        departureDate: "2026-08-31",
        sex: "Female",
        sexCategory: "female",
        age: 22,
        canManage: true,
      },
      {
        participantId: "on-time",
        roomId: "r1",
        firstName: "Luca",
        lastName: "Bianchi",
        groupId: "G2",
        groupLabel: "Milano",
        displayGroup: "Milano",
        arrivalDate: "2026-08-28",
        departureDate: "2026-08-31",
        sex: "Male",
        sexCategory: "male",
        age: 24,
        canManage: false,
      },
      {
        participantId: "missing-date",
        roomId: "r1",
        firstName: "Marta",
        lastName: "Verdi",
        groupId: "G3",
        groupLabel: "Napoli",
        displayGroup: "Napoli",
        arrivalDate: null,
        departureDate: "2026-08-31",
        sex: "Female",
        sexCategory: "female",
        age: 21,
        canManage: true,
      },
    ]
  );

  assert.deepEqual(
    earlyArrivals.map((occupant) => occupant.participantId),
    ["early"]
  );
  assert.deepEqual(
    getGroupLeaderRoomEarlyArrivalOccupants(
      { availableFrom: null },
      earlyArrivals
    ),
    []
  );
});

test("room availability extension uses the earliest assigned arrival", () => {
  const occupants = [
    {
      participantId: "arrival-27",
      roomId: "r1",
      firstName: "Anna",
      lastName: "Rossi",
      groupId: "G1",
      groupLabel: "Roma",
      displayGroup: "Roma",
      arrivalDate: "2026-08-27",
      departureDate: "2026-08-31",
      sex: "Female",
      sexCategory: "female" as const,
      age: 22,
      canManage: true,
    },
    {
      participantId: "arrival-26",
      roomId: "r1",
      firstName: "Luca",
      lastName: "Bianchi",
      groupId: "G2",
      groupLabel: "Milano",
      displayGroup: "Milano",
      arrivalDate: "2026-08-26",
      departureDate: "2026-08-31",
      sex: "Male",
      sexCategory: "male" as const,
      age: 24,
      canManage: true,
    },
  ];

  assert.equal(
    getGroupLeaderRoomRequiredAvailableFrom(
      { availableFrom: "2026-08-28" },
      occupants
    ),
    "2026-08-26"
  );
  assert.equal(
    getGroupLeaderRoomRequiredAvailableFrom(
      { availableFrom: "2026-08-26" },
      occupants
    ),
    null
  );
});

test("room shortening suggests later arrival and earlier departure only from complete occupancy data", () => {
  const occupants = [
    {
      participantId: "p1",
      roomId: "room-1",
      firstName: "Anna",
      lastName: "Rossi",
      groupId: "G1",
      groupLabel: "Roma Centro",
      displayGroup: "Roma Centro",
      arrivalDate: "2026-08-28",
      departureDate: "2026-08-30",
      city: "Roma",
      sex: "Female",
      sexCategory: "female" as const,
      age: 23,
      canManage: true,
    },
    {
      participantId: "p2",
      roomId: "room-1",
      firstName: "Luca",
      lastName: "Bianchi",
      groupId: "G1",
      groupLabel: "Roma Centro",
      displayGroup: "Roma Centro",
      arrivalDate: "2026-08-28",
      departureDate: "2026-08-30",
      city: "Roma",
      sex: "Male",
      sexCategory: "male" as const,
      age: 24,
      canManage: true,
    },
  ];

  assert.deepEqual(
    getGroupLeaderRoomShorteningSuggestion(
      {
        assignedParticipantCount: 2,
        availableFrom: "2026-08-27",
        availableTo: "2026-08-31",
      },
      occupants
    ),
    {
      availableFrom: "2026-08-28",
      availableTo: "2026-08-30",
    }
  );
  assert.deepEqual(
    getGroupLeaderRoomShorteningSuggestion(
      {
        assignedParticipantCount: 2,
        availableFrom: "2026-08-27",
        availableTo: "2026-08-31",
      },
      occupants.map((occupant) => ({
        ...occupant,
        arrivalDate: "2026-08-27",
      }))
    ),
    {
      availableFrom: null,
      availableTo: "2026-08-30",
    }
  );

  assert.equal(
    getGroupLeaderRoomShorteningSuggestion(
      {
        assignedParticipantCount: 3,
        availableFrom: "2026-08-27",
        availableTo: "2026-08-31",
      },
      occupants
    ),
    null
  );
  assert.equal(
    getGroupLeaderRoomShorteningSuggestion(
      {
        assignedParticipantCount: 2,
        availableFrom: "2026-08-27",
        availableTo: "2026-08-31",
      },
      [{ ...occupants[0], arrivalDate: null }, occupants[1]]
    ),
    null
  );
});

test("matchesGroupLeaderParticipantSearch matches name, email, and group", () => {
  const participant: GroupLeaderParticipant = {
    id: "p1",
    firstName: "Anna",
    lastName: "Rossi",
    email: "anna@example.com",
    groupId: "G1",
    groupLabel: "Roma Centro",
    displayGroup: "Roma Centro",
    accommodation: "Provided by organization",
    arrivalDate: "2026-08-27",
    departureDate: "2026-08-30",
    sex: "Female",
    sexCategory: "female",
    age: 23,
  };

  assert.equal(matchesGroupLeaderParticipantSearch(participant, "anna"), true);
  assert.equal(matchesGroupLeaderParticipantSearch(participant, "example.com"), true);
  assert.equal(matchesGroupLeaderParticipantSearch(participant, "roma"), true);
  assert.equal(matchesGroupLeaderParticipantSearch(participant, "milano"), false);
});

test("matchesGroupLeaderRoomOccupantSearch finds read-only occupants and their group", () => {
  const occupant = {
    participantId: "p2",
    roomId: "r1",
    firstName: "Luca",
    lastName: "Bianchi",
    groupId: "G2",
    groupLabel: "Milano Centro",
    displayGroup: "Milano Centro",
    arrivalDate: "2026-08-27",
    departureDate: "2026-08-31",
    sex: "Male",
    sexCategory: "male" as const,
    age: 24,
    canManage: false,
  };

  assert.equal(matchesGroupLeaderRoomOccupantSearch(occupant, "luca"), true);
  assert.equal(matchesGroupLeaderRoomOccupantSearch(occupant, "milano"), true);
  assert.equal(matchesGroupLeaderRoomOccupantSearch(occupant, "roma"), false);
});

test("matchesGroupLeaderRoomOccupantGroup filters rooms by their actual occupants", () => {
  const occupant = {
    groupId: "G2",
    groupLabel: "Milano Centro",
  };

  assert.equal(matchesGroupLeaderRoomOccupantGroup(occupant, "G2"), true);
  assert.equal(matchesGroupLeaderRoomOccupantGroup(occupant, "Milano Centro"), true);
  assert.equal(matchesGroupLeaderRoomOccupantGroup(occupant, "G1"), false);
});

test("Rome aggregation recognizes the localized city names only", () => {
  assert.equal(isGroupLeaderRomeCity("Roma"), true);
  assert.equal(isGroupLeaderRomeCity(" Rome "), true);
  assert.equal(isGroupLeaderRomeCity("ROMA"), true);
  assert.equal(isGroupLeaderRomeCity("Romania"), false);
  assert.equal(isGroupLeaderRomeCity(null), false);
});
