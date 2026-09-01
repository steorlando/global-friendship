import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRegistrationCityLabel,
  registrationCitiesMatch,
  registrationCityKey,
} from "../lib/statistics/registration-cities.ts";

test("normalizes Liège spelling, accents, and casing", () => {
  for (const value of ["Liege", "LIEGE", "Liége", "Liège"]) {
    assert.equal(registrationCityKey(value), "liege");
    assert.equal(normalizeRegistrationCityLabel(value), "Liège");
  }
});

test("normalizes the dotted-capital Innsbruck variant", () => {
  assert.equal(registrationCityKey("Innsbruck"), "innsbruck");
  assert.equal(registrationCityKey("İnnsbruck"), "innsbruck");
  assert.equal(normalizeRegistrationCityLabel("İnnsbruck"), "Innsbruck");
});

test("uses Kyiv as the canonical label for Kiev and Kyiv", () => {
  assert.equal(normalizeRegistrationCityLabel("Kiev"), "Kyiv");
  assert.equal(normalizeRegistrationCityLabel("Kyiv"), "Kyiv");
  assert.equal(registrationCitiesMatch("Kiev", "Kyiv"), true);
});

test("preserves distinct accented city labels", () => {
  assert.equal(normalizeRegistrationCityLabel("  Banská   Bystrica  "), "Banská Bystrica");
  assert.equal(registrationCitiesMatch("Pécs", "Pecs"), true);
  assert.equal(registrationCitiesMatch("Roma", "Budapest"), false);
});
