import { strict as assert } from "node:assert";
import test from "node:test";
import { buildAccommodationHotelOverview } from "../lib/alloggi/hotel-overview.ts";

test("buildAccommodationHotelOverview counts unassigned and hotel allocations by group", () => {
  const overview = buildAccommodationHotelOverview({
    groups: [
      { id: "g1", name: "Roma Centro" },
      { id: "g2", name: "Milano" },
    ],
    hotels: [
      {
        id: "h1",
        name: "Wombat's",
        address: null,
        googleMapsUrl: null,
        createdAt: "",
        roomCount: 4,
      },
      {
        id: "h2",
        name: "Equity Point",
        address: null,
        googleMapsUrl: null,
        createdAt: "",
        roomCount: 3,
      },
    ],
    participants: [
      {
        id: "p1",
        personal_code: "12",
        nome: "Anna",
        cognome: "Rossi",
        email: "anna@example.com",
        gruppo_id: "g1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        citta: "Roma",
      },
      {
        id: "p2",
        gruppo_id: "g1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        citta: "Rome",
      },
      {
        id: "p3",
        gruppo_id: "g1",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Autonomous",
        citta: "Roma",
      },
      {
        id: "p4",
        gruppo_id: "g2",
        gruppo_label: null,
        alloggio: null,
        alloggio_short: "Provided by organization",
        citta: "Milano",
      },
    ],
    assignments: [
      { partecipante_id: "p1", stanza_id: "r1" },
      { partecipante_id: "p4", stanza_id: "r2" },
    ],
    roomAllocations: [
      { gruppo_id: "g1", stanza_id: "r1" },
      { gruppo_id: "g1", stanza_id: "r3" },
      { gruppo_id: "g2", stanza_id: "r2" },
    ],
    rooms: [
      { id: "r1", albergo_id: "h1", capienza: 4, numero_reale: "101" },
      { id: "r2", albergo_id: "h2", capienza: 2 },
      { id: "r3", albergo_id: "h1", capienza: 3 },
    ],
  });

  assert.equal(overview.hotels.length, 2);
  assert.equal(overview.rows.length, 2);
  assert.deepEqual(overview.hotelAvailability, {
    h1: { emptyRoomCount: 1, emptyBedCount: 6 },
    h2: { emptyRoomCount: 0, emptyBedCount: 1 },
  });

  const romaRow = overview.rows.find((row) => row.groupId === "g1");
  const milanoRow = overview.rows.find((row) => row.groupId === "g2");

  assert.ok(romaRow);
  assert.ok(milanoRow);

  assert.equal(romaRow.needsAccommodationCount, 2);
  assert.equal(romaRow.unassignedCount, 1);
  assert.equal(romaRow.hotelCounts.h1, 1);
  assert.equal(romaRow.hotelCounts.h2, 0);
  assert.equal(romaRow.assignedBedCount, 7);
  assert.equal(romaRow.unassignedBedCount, 0);
  assert.equal(romaRow.hotelBedCounts.h1, 7);
  assert.equal(romaRow.hotelBedCounts.h2, 0);
  assert.equal(romaRow.isRomeGroup, true);

  assert.equal(milanoRow.needsAccommodationCount, 1);
  assert.equal(milanoRow.unassignedCount, 0);
  assert.equal(milanoRow.hotelCounts.h1, 0);
  assert.equal(milanoRow.hotelCounts.h2, 1);
  assert.equal(milanoRow.assignedBedCount, 2);
  assert.equal(milanoRow.unassignedBedCount, 0);
  assert.equal(milanoRow.hotelBedCounts.h1, 0);
  assert.equal(milanoRow.hotelBedCounts.h2, 2);
  assert.equal(milanoRow.isRomeGroup, false);

  assert.equal(overview.totals.needsAccommodationCount, 3);
  assert.equal(overview.totals.unassignedCount, 1);
  assert.equal(overview.totals.hotelCounts.h1, 1);
  assert.equal(overview.totals.hotelCounts.h2, 1);
  assert.equal(overview.totals.assignedBedCount, 9);
  assert.equal(overview.totals.unassignedBedCount, 0);
  assert.equal(overview.totals.hotelBedCounts.h1, 7);
  assert.equal(overview.totals.hotelBedCounts.h2, 2);

  assert.equal(overview.participants.length, 3);
  assert.deepEqual(
    overview.participants.find((participant) => participant.id === "p1"),
    {
      id: "p1",
      personalCode: "0012",
      firstName: "Anna",
      lastName: "Rossi",
      email: "anna@example.com",
      groupId: "g1",
      groupName: "Roma Centro",
      assignedHotelId: "h1",
      assignedHotelName: "Wombat's",
      roomNumber: "101",
    }
  );
  assert.equal(
    overview.participants.find((participant) => participant.id === "p2")
      ?.assignedHotelId,
    null
  );
});
