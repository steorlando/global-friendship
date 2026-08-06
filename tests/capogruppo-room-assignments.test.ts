import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildGroupLeaderVisibleRoomOccupants,
  buildLegacyParticipantRoomFields,
  canManageRoomAssignmentsAcrossGroups,
  getGroupLeaderRoomAssignmentExclusionReason,
  normalizeParticipantSexCategory,
  validateGroupLeaderRoomAssignment,
} from "../lib/capogruppo/room-assignments.ts";

test("only manager and admin can bypass room group scope", () => {
  assert.equal(canManageRoomAssignmentsAcrossGroups("manager"), true);
  assert.equal(canManageRoomAssignmentsAcrossGroups("admin"), true);
  assert.equal(canManageRoomAssignmentsAcrossGroups("alloggi"), false);
  assert.equal(canManageRoomAssignmentsAcrossGroups("capogruppo"), false);
  assert.equal(canManageRoomAssignmentsAcrossGroups(null), false);
});

test("visible room occupants include external participants as read-only", () => {
  const occupants = buildGroupLeaderVisibleRoomOccupants({
    assignmentRows: [
      {
        id: "a1",
        partecipante_id: "managed",
        stanza_id: "room-1",
        gruppo_id: "G1",
        created_at: null,
        updated_at: null,
        created_by: null,
        updated_by: null,
      },
      {
        id: "a2",
        partecipante_id: "external",
        stanza_id: "room-1",
        gruppo_id: "G2",
        created_at: null,
        updated_at: null,
        created_by: null,
        updated_by: null,
      },
    ],
    participantRows: [
      {
        id: "managed",
        nome: "Anna",
        cognome: "Rossi",
        email: null,
        gruppo_id: "G1",
        gruppo_label: "Gruppo Uno",
        alloggio: "Provided by organization",
        alloggio_short: "Provided by organization",
        tipo_iscrizione: null,
        preferenza_alloggio_operatore: null,
        data_nascita: null,
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-31",
        sesso: "Female",
        eta: 23,
      },
      {
        id: "external",
        nome: "Luca",
        cognome: "Bianchi",
        email: null,
        gruppo_id: "G2",
        gruppo_label: "Gruppo Due",
        alloggio: "Provided by organization",
        alloggio_short: "Provided by organization",
        tipo_iscrizione: null,
        preferenza_alloggio_operatore: null,
        data_nascita: null,
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-31",
        sesso: "Male",
        eta: 24,
      },
    ],
    manageableParticipantIds: new Set(["managed"]),
  });

  assert.equal(occupants.length, 2);
  assert.equal(occupants.find((occupant) => occupant.participantId === "managed")?.canManage, true);
  assert.equal(occupants.find((occupant) => occupant.participantId === "external")?.canManage, false);
  assert.equal(
    occupants.find((occupant) => occupant.participantId === "external")?.displayGroup,
    "Gruppo Due"
  );
  assert.equal(
    occupants.find((occupant) => occupant.participantId === "external")?.groupId,
    "G2"
  );
});

test("operator hotel and autonomous participants stay outside hostel room assignment", () => {
  assert.equal(
    getGroupLeaderRoomAssignmentExclusionReason({
      alloggio: "Accommodation provided by the organization",
      alloggio_short: "Provided by organization",
      tipo_iscrizione: "Operator - Operatore",
      preferenza_alloggio_operatore: "Hotel",
    }),
    "operator_hotel"
  );

  assert.equal(
    getGroupLeaderRoomAssignmentExclusionReason({
      alloggio: "Accommodation provided by the organization",
      alloggio_short: "Provided by organization",
      tipo_iscrizione: "Operator - Operatore",
      preferenza_alloggio_operatore: "Hostel with group",
    }),
    null
  );

  assert.equal(
    getGroupLeaderRoomAssignmentExclusionReason({
      alloggio: "I arranged my own accommodation / Ho trovato un alloggio autonomamente",
      alloggio_short: "Atonoumous",
      tipo_iscrizione: "Operator - Operatore",
      preferenza_alloggio_operatore: "Hotel",
    }),
    "autonomous"
  );
});

test("normalizeParticipantSexCategory recognizes common male and female values", () => {
  assert.equal(normalizeParticipantSexCategory("Male"), "male");
  assert.equal(normalizeParticipantSexCategory("maschio"), "male");
  assert.equal(normalizeParticipantSexCategory("Female"), "female");
  assert.equal(normalizeParticipantSexCategory("Donna"), "female");
  assert.equal(normalizeParticipantSexCategory(""), null);
});

test("buildLegacyParticipantRoomFields keeps legacy participant room fields in sync", () => {
  assert.deepEqual(
    buildLegacyParticipantRoomFields({
      roomId: "room-1",
      hotelId: "hotel-1",
    }),
    {
      stanza_id: "room-1",
      albergo_id: "hotel-1",
    }
  );

  assert.deepEqual(
    buildLegacyParticipantRoomFields({
      roomId: null,
      hotelId: "",
    }),
    {
      stanza_id: null,
      albergo_id: null,
    }
  );
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

test("validateGroupLeaderRoomAssignment allows early arrivals with a warning", () => {
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
  });

  assert.equal(result.resolvedGroupId, "G1");
  assert.equal(result.warnings.length, 1);
  assert.equal(result.warnings[0]?.code, "room_availability_starts_after_arrival");
  assert.deepEqual(result.warnings[0]?.meta, {
    participantId: "p1",
    arrivalDate: "2026-08-27",
    availableFrom: "2026-08-28",
  });
});

test("validateGroupLeaderRoomAssignment still blocks departures after room availability", () => {
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
          arrivalDate: "2026-08-28",
          departureDate: "2026-09-01",
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
    /ends before the participant departure/i
  );
});

test("validateGroupLeaderRoomAssignment lets privileged managers bypass only room group scope", () => {
  const result = validateGroupLeaderRoomAssignment({
    allowedGroupIds: ["G1"],
    allowCrossGroupAssignment: true,
    participant: {
      id: "p1",
      groupId: "G1",
      groupLabel: null,
      accommodation: "Provided by organization",
      accommodationShort: "Provided by organization",
      arrivalDate: "2026-08-28",
      departureDate: "2026-08-31",
      sex: "Female",
    },
    room: {
      id: "r1",
      capacity: 2,
      genderPolicy: "female_only",
      availableFrom: "2026-08-28",
      availableTo: "2026-08-31",
    },
    roomScopeGroupIds: ["G2"],
    existingOccupants: [
      {
        participantId: "p2",
        arrivalDate: "2026-08-28",
        departureDate: "2026-08-31",
        sex: "Female",
      },
    ],
  });

  assert.equal(result.resolvedGroupId, "G1");
  assert.deepEqual(result.warnings, []);
});

test("manager and admin receive the same early-arrival warning", () => {
  const result = validateGroupLeaderRoomAssignment({
    allowedGroupIds: ["G1"],
    allowCrossGroupAssignment: true,
    participant: {
      id: "p1",
      groupId: "G1",
      groupLabel: null,
      accommodation: "Provided by organization",
      accommodationShort: "Provided by organization",
      arrivalDate: "2026-08-27",
      departureDate: "2026-08-31",
      sex: "Female",
    },
    room: {
      id: "r1",
      capacity: 2,
      genderPolicy: "female_only",
      availableFrom: "2026-08-28",
      availableTo: "2026-08-31",
    },
    roomScopeGroupIds: ["G2"],
    existingOccupants: [],
  });

  assert.equal(result.resolvedGroupId, "G1");
  assert.equal(result.warnings[0]?.code, "room_availability_starts_after_arrival");
});

test("manager and admin still cannot bypass room gender policy", () => {
  assert.throws(
    () =>
      validateGroupLeaderRoomAssignment({
        allowedGroupIds: ["G1"],
        allowCrossGroupAssignment: true,
        participant: {
          id: "p1",
          groupId: "G1",
          groupLabel: null,
          accommodation: "Provided by organization",
          accommodationShort: "Provided by organization",
          arrivalDate: "2026-08-28",
          departureDate: "2026-08-31",
          sex: "Female",
        },
        room: {
          id: "r1",
          capacity: 2,
          genderPolicy: "male_only",
          availableFrom: "2026-08-28",
          availableTo: "2026-08-31",
        },
        roomScopeGroupIds: ["G2"],
        existingOccupants: [],
      }),
    /male-only/i
  );
});

test("manager and admin still cannot bypass room capacity", () => {
  assert.throws(
    () =>
      validateGroupLeaderRoomAssignment({
        allowedGroupIds: ["G1"],
        allowCrossGroupAssignment: true,
        participant: {
          id: "p1",
          groupId: "G1",
          groupLabel: null,
          accommodation: "Provided by organization",
          accommodationShort: "Provided by organization",
          arrivalDate: "2026-08-28",
          departureDate: "2026-08-31",
          sex: "Female",
        },
        room: {
          id: "r1",
          capacity: 1,
          genderPolicy: "female_only",
          availableFrom: "2026-08-28",
          availableTo: "2026-08-31",
        },
        roomScopeGroupIds: ["G2"],
        existingOccupants: [
          {
            participantId: "p2",
            arrivalDate: "2026-08-28",
            departureDate: "2026-08-31",
            sex: "Female",
          },
        ],
      }),
    /capacity would be exceeded/i
  );
});

test("manager and admin still cannot bypass hostel eligibility", () => {
  assert.throws(
    () =>
      validateGroupLeaderRoomAssignment({
        allowedGroupIds: ["G1"],
        allowCrossGroupAssignment: true,
        participant: {
          id: "p1",
          groupId: "G1",
          groupLabel: null,
          accommodation: "Autonomous",
          accommodationShort: "Atonoumous",
          arrivalDate: "2026-08-28",
          departureDate: "2026-08-31",
          sex: "Female",
        },
        room: {
          id: "r1",
          capacity: 2,
          genderPolicy: "female_only",
          availableFrom: "2026-08-28",
          availableTo: "2026-08-31",
        },
        roomScopeGroupIds: ["G2"],
        existingOccupants: [],
      }),
    /not eligible for organization-provided accommodation/i
  );
});

test("validateGroupLeaderRoomAssignment still blocks group scope for capogruppo", () => {
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
          arrivalDate: "2026-08-28",
          departureDate: "2026-08-31",
          sex: "Female",
        },
        room: {
          id: "r1",
          capacity: 2,
          genderPolicy: "female_only",
          availableFrom: "2026-08-28",
          availableTo: "2026-08-31",
        },
        roomScopeGroupIds: ["G2"],
        existingOccupants: [],
      }),
    /not assigned to the participant group/i
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
