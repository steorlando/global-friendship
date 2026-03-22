import { strict as assert } from "node:assert";
import test from "node:test";
import { buildAccommodationGroupSummaries } from "../lib/alloggi/group-allocations.ts";

test("buildAccommodationGroupSummaries reports exact allocation without warnings", () => {
  const summaries = buildAccommodationGroupSummaries({
    groups: [{ id: "G1", name: "Group One" }],
    allocations: [
      {
        groupId: "G1",
        roomId: "room-1",
        createdAt: null,
        createdBy: null,
        room: {
          id: "room-1",
          hotelId: "hotel-1",
          hotel: null,
          legacyName: "WO-02-A",
          internalCode: "WO-02-A",
          realRoomNumber: null,
          capacity: 2,
          genderPolicy: "mixed",
          availableFrom: "2026-08-27",
          availableTo: "2026-08-31",
          createdAt: "",
          updatedAt: "",
          assignedGroupCount: 1,
          assignedParticipantCount: 0,
        },
      },
    ],
    participants: [
      {
        id: "p-1",
        gruppo_id: "G1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-29",
      },
      {
        id: "p-2",
        gruppo_id: "G1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-29",
      },
    ],
  });

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.status, "exactly_allocated");
  assert.equal(summaries[0]?.needsAccommodationCount, 2);
  assert.equal(summaries[0]?.assignedCapacity, 2);
  assert.deepEqual(summaries[0]?.warnings, []);
});

test("buildAccommodationGroupSummaries flags late room start and daily shortage", () => {
  const summaries = buildAccommodationGroupSummaries({
    groups: [{ id: "G1", name: "Group One" }],
    allocations: [
      {
        groupId: "G1",
        roomId: "room-1",
        createdAt: null,
        createdBy: null,
        room: {
          id: "room-1",
          hotelId: "hotel-1",
          hotel: null,
          legacyName: "WO-02-A",
          internalCode: "WO-02-A",
          realRoomNumber: null,
          capacity: 2,
          genderPolicy: "mixed",
          availableFrom: "2026-08-28",
          availableTo: "2026-08-31",
          createdAt: "",
          updatedAt: "",
          assignedGroupCount: 1,
          assignedParticipantCount: 0,
        },
      },
    ],
    participants: [
      {
        id: "p-1",
        gruppo_id: "G1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-30",
      },
      {
        id: "p-2",
        gruppo_id: "G1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-30",
      },
    ],
  });

  const warningCodes = summaries[0]?.warnings.map((warning) => warning.code) ?? [];
  assert.equal(summaries[0]?.status, "exactly_allocated");
  assert.deepEqual(warningCodes, [
    "room_availability_starts_late",
    "daily_capacity_shortage",
  ]);
  assert.deepEqual(summaries[0]?.shortageDates, ["2026-08-27"]);
  assert.equal(summaries[0]?.maxDailyShortage, 2);
});

test("buildAccommodationGroupSummaries flags shared rooms, missing dates, and nominal shortage", () => {
  const summaries = buildAccommodationGroupSummaries({
    groups: [{ id: "G1", name: "Group One" }],
    allocations: [
      {
        groupId: "G1",
        roomId: "room-1",
        createdAt: null,
        createdBy: null,
        room: {
          id: "room-1",
          hotelId: "hotel-1",
          hotel: null,
          legacyName: "WO-02-A",
          internalCode: "WO-02-A",
          realRoomNumber: null,
          capacity: 2,
          genderPolicy: "mixed",
          availableFrom: null,
          availableTo: null,
          createdAt: "",
          updatedAt: "",
          assignedGroupCount: 2,
          assignedParticipantCount: 0,
        },
      },
    ],
    participants: [
      {
        id: "p-1",
        gruppo_id: null,
        gruppo_label: "Group One",
        alloggio: null,
        alloggio_short: "Provided by organization",
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-30",
      },
      {
        id: "p-2",
        gruppo_id: "G1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        data_arrivo: null,
        data_partenza: null,
      },
      {
        id: "p-3",
        gruppo_id: "G1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        data_arrivo: "2026-08-27",
        data_partenza: "2026-08-30",
      },
    ],
  });

  const warningCodes = summaries[0]?.warnings.map((warning) => warning.code) ?? [];
  assert.equal(summaries[0]?.status, "under_allocated");
  assert.deepEqual(warningCodes, [
    "nominal_capacity_shortage",
    "room_shared_across_groups",
    "participants_missing_stay_dates",
  ]);
  assert.equal(summaries[0]?.participantsMissingStayDates, 1);
});
