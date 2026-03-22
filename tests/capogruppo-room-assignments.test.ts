import { strict as assert } from "node:assert";
import test from "node:test";
import {
  normalizeParticipantSexCategory,
  validateGroupLeaderRoomAssignment,
} from "../lib/capogruppo/room-assignments.ts";

test("normalizeParticipantSexCategory recognizes common male and female values", () => {
  assert.equal(normalizeParticipantSexCategory("Male"), "male");
  assert.equal(normalizeParticipantSexCategory("maschio"), "male");
  assert.equal(normalizeParticipantSexCategory("Female"), "female");
  assert.equal(normalizeParticipantSexCategory("Donna"), "female");
  assert.equal(normalizeParticipantSexCategory(""), null);
});

test("validateGroupLeaderRoomAssignment blocks secure gender mismatch", () => {
  assert.throws(
    () =>
      validateGroupLeaderRoomAssignment({
        allowedGroupIds: ["G1"],
        participant: {
          id: "p1",
          groupId: "G1",
          groupLabel: null,
          accommodation: "Provided by organization",
          accommodationShort: "Provided by organization",
          arrivalDate: "2026-08-27",
          departureDate: "2026-08-30",
          sex: "Female",
        },
        room: {
          id: "r1",
          capacity: 4,
          genderPolicy: "male_only",
          availableFrom: "2026-08-27",
          availableTo: "2026-08-31",
        },
        roomScopeGroupIds: ["G1"],
        existingOccupants: [],
      }),
    /male-only/
  );
});

test("validateGroupLeaderRoomAssignment blocks room-date incompatibility", () => {
  assert.throws(
    () =>
      validateGroupLeaderRoomAssignment({
        allowedGroupIds: ["G1"],
        participant: {
          id: "p1",
          groupId: "G1",
          groupLabel: null,
          accommodation: "Provided by organization",
          accommodationShort: "Provided by organization",
          arrivalDate: "2026-08-27",
          departureDate: "2026-08-30",
          sex: "Male",
        },
        room: {
          id: "r1",
          capacity: 4,
          genderPolicy: "mixed",
          availableFrom: "2026-08-28",
          availableTo: "2026-08-31",
        },
        roomScopeGroupIds: ["G1"],
        existingOccupants: [],
      }),
    /starts after/
  );
});

test("validateGroupLeaderRoomAssignment blocks overlapping over-capacity assignments", () => {
  assert.throws(
    () =>
      validateGroupLeaderRoomAssignment({
        allowedGroupIds: ["G1"],
        participant: {
          id: "p1",
          groupId: "G1",
          groupLabel: null,
          accommodation: "Provided by organization",
          accommodationShort: "Provided by organization",
          arrivalDate: "2026-08-27",
          departureDate: "2026-08-30",
          sex: "Male",
        },
        room: {
          id: "r1",
          capacity: 2,
          genderPolicy: "mixed",
          availableFrom: "2026-08-27",
          availableTo: "2026-08-31",
        },
        roomScopeGroupIds: ["G1"],
        existingOccupants: [
          {
            participantId: "p2",
            arrivalDate: "2026-08-27",
            departureDate: "2026-08-30",
            sex: "Male",
          },
          {
            participantId: "p3",
            arrivalDate: "2026-08-27",
            departureDate: "2026-08-29",
            sex: "Female",
          },
        ],
      }),
    /capacity would be exceeded/i
  );
});

test("validateGroupLeaderRoomAssignment returns warnings for ambiguous sex data", () => {
  const result = validateGroupLeaderRoomAssignment({
    allowedGroupIds: ["G1"],
    participant: {
      id: "p1",
      groupId: "G1",
      groupLabel: null,
      accommodation: "Provided by organization",
      accommodationShort: "Provided by organization",
      arrivalDate: "2026-08-27",
      departureDate: "2026-08-30",
      sex: null,
    },
    room: {
      id: "r1",
      capacity: 3,
      genderPolicy: "mixed",
      availableFrom: "2026-08-27",
      availableTo: "2026-08-31",
    },
    roomScopeGroupIds: ["G1"],
    existingOccupants: [],
  });

  assert.equal(result.resolvedGroupId, "G1");
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, "participant_sex_unknown");
});
