import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildGroupLeaderRoomOptionLabel,
  formatGroupLeaderRoomAvailability,
  matchesGroupLeaderParticipantSearch,
} from "../lib/capogruppo/room-assignment-presentation.ts";
import type { GroupLeaderParticipant } from "../lib/capogruppo/room-assignments.ts";

test("buildGroupLeaderRoomOptionLabel uses code, hotel name, and availability", () => {
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
    "WO-04-A · Wombat's · 2026-08-28 -> 2026-08-31"
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
