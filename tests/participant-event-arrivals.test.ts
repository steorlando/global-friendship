import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArrivalGroupSummary,
  buildArrivalQrPayload,
  buildReceptionGroupHostelRows,
  buildReceptionHostelArrivalDayRows,
  isReceptionRomeSubgroupContact,
  parseArrivalQrPayload,
  resolveArrivalAccommodationType,
  resolveReceptionGroupName,
} from "../lib/accoglienza/arrivals.ts";

const TOKEN = "8a6101db-4c19-4e38-bf2d-46ddf17249e1";

test("arrival QR payload uses an opaque UUID and rejects unrelated content", () => {
  const payload = buildArrivalQrPayload(TOKEN.toUpperCase());
  assert.equal(payload, `gf-arrival:${TOKEN}`);
  assert.equal(parseArrivalQrPayload(payload), TOKEN);
  assert.equal(parseArrivalQrPayload(TOKEN), TOKEN);
  assert.equal(parseArrivalQrPayload("https://example.com/participant/0016"), null);
  assert.equal(parseArrivalQrPayload("gf-arrival:0016"), null);
});

test("arrival accommodation classification follows autonomous and operator-hotel rules", () => {
  assert.equal(
    resolveArrivalAccommodationType({
      accommodation: "I arranged my own accommodation / Ho trovato un alloggio autonomamente",
      accommodationShort: null,
      registrationType: "Worker - lavoratore (18-25 years old)",
      operatorAccommodationPreference: null,
    }),
    "Autonomo"
  );
  assert.equal(
    resolveArrivalAccommodationType({
      accommodation: "Provided by organization",
      accommodationShort: "Provided by organization",
      registrationType: "Operator - Operatore",
      operatorAccommodationPreference: "Hotel",
    }),
    "Hotel"
  );
  assert.equal(
    resolveArrivalAccommodationType({
      accommodation: "Provided by organization",
      accommodationShort: "Provided by organization",
      registrationType: "Higher student - liceale (14-18 years old)",
      operatorAccommodationPreference: null,
    }),
    "Ostello"
  );
});

test("reception always combines Rome participants into one Roma group", () => {
  assert.equal(
    resolveReceptionGroupName({ group: "Trastevere", city: "Roma" }),
    "Roma"
  );
  assert.equal(
    resolveReceptionGroupName({ group: "Primavalle liceali", city: " Rome " }),
    "Roma"
  );
  assert.equal(
    resolveReceptionGroupName({ group: "Nomentano", city: "ROMA" }),
    "Roma"
  );
  assert.equal(
    resolveReceptionGroupName({ group: "Romania", city: "Bucharest" }),
    "Romania"
  );
});

test("reception hides Rome subgroup contacts by default", () => {
  const romeGroupIds = new Set(["roma-trastevere", "roma-primavalle"]);
  assert.equal(
    isReceptionRomeSubgroupContact({
      profileRoma: false,
      linkedGroupIds: ["roma-trastevere"],
      romeGroupIds,
    }),
    true
  );
  assert.equal(
    isReceptionRomeSubgroupContact({
      profileRoma: true,
      linkedGroupIds: ["roma-trastevere"],
      romeGroupIds,
    }),
    true
  );
  assert.equal(
    isReceptionRomeSubgroupContact({
      profileRoma: false,
      linkedGroupIds: ["roma-trastevere", "padova"],
      romeGroupIds,
    }),
    false
  );
  assert.equal(
    isReceptionRomeSubgroupContact({
      profileRoma: true,
      linkedGroupIds: [],
      romeGroupIds,
    }),
    true
  );
});

test("arrival group summary counts arrived, pending, and total participants", () => {
  assert.deepEqual(
    buildArrivalGroupSummary([
      { group: "Padova", arrivedAt: "2026-08-28T08:00:00.000Z" },
      { group: "Padova", arrivedAt: null },
      { group: "Budapest", arrivedAt: null },
      { group: "", arrivedAt: null },
    ]),
    [
      { group: "Budapest", arrived: 0, notArrived: 1, total: 1 },
      { group: "Padova", arrived: 1, notArrived: 1, total: 2 },
      { group: "-", arrived: 0, notArrived: 1, total: 1 },
    ]
  );
});

test("reception group hostel rows show only used hostels and preserve unassigned counts", () => {
  assert.deepEqual(
    buildReceptionGroupHostelRows([
      { group: "Padova", accommodationType: "Ostello", accommodationLocation: "Wombat" },
      { group: "Padova", accommodationType: "Ostello", accommodationLocation: "Wombat" },
      { group: "Padova", accommodationType: "Ostello", accommodationLocation: null },
      { group: "Padova", accommodationType: "Autonomo", accommodationLocation: null },
      { group: "Roma", accommodationType: "Hotel", accommodationLocation: null },
      { group: "", accommodationType: "Ostello", accommodationLocation: "Baroque" },
    ]),
    [
      {
        group: "Padova",
        hostels: [{ name: "Wombat", count: 2 }],
        assignedCount: 2,
        unassignedCount: 1,
        hostelParticipantCount: 3,
      },
      {
        group: "Roma",
        hostels: [],
        assignedCount: 0,
        unassignedCount: 0,
        hostelParticipantCount: 0,
      },
      {
        group: "-",
        hostels: [{ name: "Baroque", count: 1 }],
        assignedCount: 1,
        unassignedCount: 0,
        hostelParticipantCount: 1,
      },
    ]
  );
});

test("reception hostel arrival rows omit zero cells and keep missing dates separate", () => {
  assert.deepEqual(
    buildReceptionHostelArrivalDayRows([
      { arrivalDate: "2026-08-27", accommodationType: "Ostello", accommodationLocation: "Wombat" },
      { arrivalDate: "2026-08-27", accommodationType: "Ostello", accommodationLocation: "Wombat" },
      { arrivalDate: "2026-08-27", accommodationType: "Ostello", accommodationLocation: null },
      { arrivalDate: "2026-08-28", accommodationType: "Ostello", accommodationLocation: "Baroque" },
      { arrivalDate: "2026-08-28", accommodationType: "Autonomo", accommodationLocation: null },
      { arrivalDate: null, accommodationType: "Ostello", accommodationLocation: "Wombat" },
    ]),
    [
      {
        arrivalDate: "2026-08-27",
        hostels: [{ name: "Wombat", count: 2 }],
        assignedCount: 2,
        unassignedCount: 1,
        total: 3,
      },
      {
        arrivalDate: "2026-08-28",
        hostels: [{ name: "Baroque", count: 1 }],
        assignedCount: 1,
        unassignedCount: 0,
        total: 1,
      },
      {
        arrivalDate: null,
        hostels: [{ name: "Wombat", count: 1 }],
        assignedCount: 1,
        unassignedCount: 0,
        total: 1,
      },
    ]
  );
});
