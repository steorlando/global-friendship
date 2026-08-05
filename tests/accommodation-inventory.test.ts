import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildActiveAssignmentCountByRoomId,
  buildHotelRoomCodePrefix,
  buildNextInternalRoomCode,
  chunkQueryValues,
  formatRoomSequenceLabel,
  normalizeAccommodationHotelInput,
  normalizeAccommodationRoomImportRow,
  isOrganizationProvidedAccommodation,
  normalizeAccommodationRoomInput,
} from "../lib/alloggi/inventory.ts";

test("room occupancy counts only active participants", () => {
  const counts = buildActiveAssignmentCountByRoomId(
    [
      { partecipante_id: "active-1", stanza_id: "room-1" },
      { partecipante_id: "active-2", stanza_id: "room-1" },
      { partecipante_id: "deleted-1", stanza_id: "room-1" },
      { partecipante_id: "active-3", stanza_id: "room-2" },
      { partecipante_id: null, stanza_id: "room-2" },
    ],
    new Set(["active-1", "active-2", "active-3"])
  );

  assert.equal(counts.get("room-1"), 2);
  assert.equal(counts.get("room-2"), 1);
});

test("chunkQueryValues keeps large Supabase filters below the URL limit", () => {
  const roomIds = Array.from({ length: 226 }, (_, index) => `room-${index + 1}`);
  const batches = chunkQueryValues(roomIds);

  assert.deepEqual(
    batches.map((batch) => batch.length),
    [50, 50, 50, 50, 26]
  );
  assert.deepEqual(batches.flat(), roomIds);
});

test("isOrganizationProvidedAccommodation matches the canonical short value", () => {
  assert.equal(isOrganizationProvidedAccommodation("Provided by organization"), true);
  assert.equal(isOrganizationProvidedAccommodation(" provided by organization "), true);
  assert.equal(isOrganizationProvidedAccommodation("Atonoumous"), false);
});

test("normalizeAccommodationRoomInput parses a valid room payload", () => {
  const result = normalizeAccommodationRoomInput({
    hotelId: "hotel-1",
    realRoomNumber: "203",
    capacity: "4",
    genderPolicy: "mixed",
    availableFrom: "2026-08-27",
    availableTo: "2026-08-31",
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    hotelId: "hotel-1",
    realRoomNumber: "203",
    capacity: 4,
    genderPolicy: "mixed",
    availableFrom: "2026-08-27",
    availableTo: "2026-08-31",
  });
});

test("normalizeAccommodationRoomInput rejects inverted availability dates", () => {
  const result = normalizeAccommodationRoomInput({
    hotelId: "hotel-1",
    capacity: 4,
    genderPolicy: "mixed",
    availableFrom: "2026-08-31",
    availableTo: "2026-08-27",
  });

  assert.equal(result.data, null);
  assert.equal(result.error, "availableTo must be after availableFrom");
});

test("normalizeAccommodationRoomInput can merge partial updates with current data", () => {
  const result = normalizeAccommodationRoomInput(
    {
      capacity: 6,
      realRoomNumber: "",
    },
    {
      hotelId: "hotel-1",
      realRoomNumber: "301",
      capacity: 4,
      genderPolicy: "female_only",
      availableFrom: "2026-08-27",
      availableTo: "2026-08-31",
    }
  );

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    hotelId: "hotel-1",
    realRoomNumber: null,
    capacity: 6,
    genderPolicy: "female_only",
    availableFrom: "2026-08-27",
    availableTo: "2026-08-31",
  });
});

test("normalizeAccommodationRoomInput rejects invalid gender policy", () => {
  const result = normalizeAccommodationRoomInput({
    hotelId: "hotel-1",
    capacity: 4,
    genderPolicy: "coed",
  });

  assert.equal(result.data, null);
  assert.equal(
    result.error,
    "genderPolicy must be one of male_only, female_only, mixed"
  );
});

test("buildHotelRoomCodePrefix keeps the first two significant letters", () => {
  assert.equal(buildHotelRoomCodePrefix("Wombat's City Hostel"), "WO");
  assert.equal(buildHotelRoomCodePrefix("Å&O Hostel"), "AO");
  assert.equal(buildHotelRoomCodePrefix("1"), "XX");
});

test("formatRoomSequenceLabel creates alphabetical suffixes", () => {
  assert.equal(formatRoomSequenceLabel(0), "A");
  assert.equal(formatRoomSequenceLabel(1), "B");
  assert.equal(formatRoomSequenceLabel(25), "Z");
  assert.equal(formatRoomSequenceLabel(26), "AA");
});

test("buildNextInternalRoomCode increments within the same hotel prefix and capacity", () => {
  const roomCode = buildNextInternalRoomCode({
    hotelName: "Wombat's City Hostel",
    capacity: 4,
    existingCodes: ["WO-04-A", "WO-04-B", "WO-02-A", "XX-04-A"],
  });

  assert.equal(roomCode, "WO-04-C");
});

test("normalizeAccommodationRoomImportRow validates Excel rows", () => {
  const result = normalizeAccommodationRoomImportRow({
    capienza: "8",
    numero_reale: "",
    available_at: "27/08/2026",
    available_to: "31/08/2026",
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    realRoomNumber: null,
    capacity: 8,
    availableFrom: "2026-08-27",
    availableTo: "2026-08-31",
  });
});

test("normalizeAccommodationRoomImportRow rejects missing capacity", () => {
  const result = normalizeAccommodationRoomImportRow({
    numero_reale: "203",
  });

  assert.equal(result.data, null);
  assert.equal(
    result.error,
    "capienza is required and must be a positive integer"
  );
});

test("normalizeAccommodationRoomImportRow accepts ISO-like datetime strings", () => {
  const result = normalizeAccommodationRoomImportRow({
    capienza: 4,
    available_from: "2026-08-27T00:00:00.000Z",
    available_to: "2026-08-31T00:00:00.000Z",
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    realRoomNumber: null,
    capacity: 4,
    availableFrom: "2026-08-27",
    availableTo: "2026-08-31",
  });
});

test("normalizeAccommodationHotelInput parses a valid hotel payload", () => {
  const result = normalizeAccommodationHotelInput({
    name: "Hotel Roma Centro",
    address: "Via Example 10, Budapest",
    googleMapsUrl: "https://maps.google.com/?q=Hotel+Roma+Centro",
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    name: "Hotel Roma Centro",
    address: "Via Example 10, Budapest",
    googleMapsUrl: "https://maps.google.com/?q=Hotel+Roma+Centro",
  });
});

test("normalizeAccommodationHotelInput merges partial updates", () => {
  const result = normalizeAccommodationHotelInput(
    {
      address: "",
    },
    {
      name: "Hotel Roma Centro",
      address: "Via Example 10, Budapest",
      googleMapsUrl: "https://maps.google.com/?q=Hotel+Roma+Centro",
    }
  );

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    name: "Hotel Roma Centro",
    address: null,
    googleMapsUrl: "https://maps.google.com/?q=Hotel+Roma+Centro",
  });
});

test("normalizeAccommodationHotelInput requires a name", () => {
  const result = normalizeAccommodationHotelInput({
    address: "Via Example 10, Budapest",
  });

  assert.equal(result.data, null);
  assert.equal(result.error, "name is required");
});

test("normalizeAccommodationHotelInput rejects an invalid Google Maps url", () => {
  const result = normalizeAccommodationHotelInput({
    name: "Hotel Roma Centro",
    googleMapsUrl: "maps.google.com/hotel",
  });

  assert.equal(result.data, null);
  assert.equal(result.error, "googleMapsUrl must be a valid URL");
});
