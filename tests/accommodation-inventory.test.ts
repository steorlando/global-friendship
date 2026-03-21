import { strict as assert } from "node:assert";
import test from "node:test";
import {
  normalizeAccommodationHotelInput,
  isOrganizationProvidedAccommodation,
  normalizeAccommodationRoomInput,
} from "../lib/alloggi/inventory.ts";

test("isOrganizationProvidedAccommodation matches the canonical short value", () => {
  assert.equal(isOrganizationProvidedAccommodation("Provided by organization"), true);
  assert.equal(isOrganizationProvidedAccommodation(" provided by organization "), true);
  assert.equal(isOrganizationProvidedAccommodation("Atonoumous"), false);
});

test("normalizeAccommodationRoomInput parses a valid room payload", () => {
  const result = normalizeAccommodationRoomInput({
    hotelId: "hotel-1",
    internalCode: "GF-A12",
    realRoomNumber: "203",
    capacity: "4",
    genderPolicy: "mixed",
    availableFrom: "2026-08-27",
    availableTo: "2026-08-31",
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    hotelId: "hotel-1",
    internalCode: "GF-A12",
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
    internalCode: "GF-A12",
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
      internalCode: "GF-A12",
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
    internalCode: "GF-A12",
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
    internalCode: "GF-A12",
    capacity: 4,
    genderPolicy: "coed",
  });

  assert.equal(result.data, null);
  assert.equal(
    result.error,
    "genderPolicy must be one of male_only, female_only, mixed"
  );
});

test("normalizeAccommodationHotelInput parses a valid hotel payload", () => {
  const result = normalizeAccommodationHotelInput({
    name: "Hotel Roma Centro",
    city: "Rome",
    country: "Italy",
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    name: "Hotel Roma Centro",
    city: "Rome",
    country: "Italy",
  });
});

test("normalizeAccommodationHotelInput merges partial updates", () => {
  const result = normalizeAccommodationHotelInput(
    {
      city: "",
    },
    {
      name: "Hotel Roma Centro",
      city: "Rome",
      country: "Italy",
    }
  );

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    name: "Hotel Roma Centro",
    city: null,
    country: "Italy",
  });
});

test("normalizeAccommodationHotelInput requires a name", () => {
  const result = normalizeAccommodationHotelInput({
    city: "Rome",
  });

  assert.equal(result.data, null);
  assert.equal(result.error, "name is required");
});
