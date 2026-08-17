import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildAccommodationRoomOptionLabel,
  getAccommodationGroupStatusTone,
  matchesAccommodationGroupSearch,
  sortAccommodationGroupSummaries,
} from "../lib/alloggi/group-allocation-presentation.ts";
import type { AccommodationGroupSummary } from "../lib/alloggi/group-allocations.ts";

test("getAccommodationGroupStatusTone maps statuses to stable UI tones", () => {
  assert.equal(getAccommodationGroupStatusTone("unassigned"), "neutral");
  assert.equal(getAccommodationGroupStatusTone("under_allocated"), "warning");
  assert.equal(getAccommodationGroupStatusTone("exactly_allocated"), "success");
  assert.equal(getAccommodationGroupStatusTone("over_allocated"), "info");
});

test("matchesAccommodationGroupSearch matches group name and id", () => {
  const summary: AccommodationGroupSummary = {
    groupId: "IT-ROMA",
    groupName: "Roma Centro",
    needsAccommodationCount: 10,
    maleNeedCount: 4,
    femaleNeedCount: 6,
    unknownNeedCount: 0,
    assignedCapacity: 8,
    assignedRoomCount: 2,
    status: "under_allocated",
    warnings: [],
    shortageDates: [],
    maxDailyShortage: 0,
    participantsMissingStayDates: 0,
    earliestArrival: null,
    latestDeparture: null,
  };

  assert.equal(matchesAccommodationGroupSearch(summary, "roma"), true);
  assert.equal(matchesAccommodationGroupSearch(summary, "it-roma"), true);
  assert.equal(matchesAccommodationGroupSearch(summary, "napoli"), false);
});

test("sortAccommodationGroupSummaries prioritizes action-needed groups", () => {
  const sorted = sortAccommodationGroupSummaries([
    {
      groupId: "A",
      groupName: "Exact",
      needsAccommodationCount: 5,
      maleNeedCount: 2,
      femaleNeedCount: 3,
      unknownNeedCount: 0,
      assignedCapacity: 5,
      assignedRoomCount: 2,
      status: "exactly_allocated",
      warnings: [],
      shortageDates: [],
      maxDailyShortage: 0,
      participantsMissingStayDates: 0,
      earliestArrival: null,
      latestDeparture: null,
    },
    {
      groupId: "B",
      groupName: "Under",
      needsAccommodationCount: 8,
      maleNeedCount: 3,
      femaleNeedCount: 5,
      unknownNeedCount: 0,
      assignedCapacity: 4,
      assignedRoomCount: 1,
      status: "under_allocated",
      warnings: [],
      shortageDates: [],
      maxDailyShortage: 0,
      participantsMissingStayDates: 0,
      earliestArrival: null,
      latestDeparture: null,
    },
  ]);

  assert.deepEqual(
    sorted.map((summary) => summary.groupId),
    ["B", "A"]
  );
});

test("buildAccommodationRoomOptionLabel includes room code, hotel, and sharing info", () => {
  const label = buildAccommodationRoomOptionLabel({
    id: "room-1",
    hotelId: "hotel-1",
    hotel: {
      id: "hotel-1",
      name: "Wombat's",
      address: null,
      googleMapsUrl: null,
      createdAt: "",
      roomCount: 10,
    },
    legacyName: "WO-04-A",
    internalCode: "WO-04-A",
    realRoomNumber: null,
    hasEnsuiteBathroom: null,
    capacity: 4,
    genderPolicy: "mixed",
    availableFrom: null,
    availableTo: null,
    createdAt: "",
    updatedAt: "",
    assignedGroupCount: 2,
    assignedParticipantCount: 0,
  });

  assert.equal(label, "WO-04-A · Wombat's · 2 groups");
});
