import assert from "node:assert/strict";
import test from "node:test";
import { matchesParticipantFilterSelection } from "../lib/email/participant-campaign-filters.ts";

test("an empty group selection includes every participant", () => {
  assert.equal(matchesParticipantFilterSelection("Rome", new Set()), true);
  assert.equal(matchesParticipantFilterSelection(null, new Set()), true);
});

test("multiple selected groups use OR matching", () => {
  const selectedGroups = new Set(["Rome", "Brussels"]);

  assert.equal(matchesParticipantFilterSelection("Rome", selectedGroups), true);
  assert.equal(matchesParticipantFilterSelection("Brussels", selectedGroups), true);
  assert.equal(matchesParticipantFilterSelection("Madrid", selectedGroups), false);
});

test("group matching is exact, trimmed, and case insensitive", () => {
  const selectedGroups = new Set(["  Rome Centre  "]);

  assert.equal(matchesParticipantFilterSelection("rome centre", selectedGroups), true);
  assert.equal(matchesParticipantFilterSelection("Rome", selectedGroups), false);
});

test("multiple registration types use the same OR matching", () => {
  const selectedRegistrationTypes = new Set(["Driver - Autista", "Operator - Operatore"]);

  assert.equal(
    matchesParticipantFilterSelection("Driver - Autista", selectedRegistrationTypes),
    true
  );
  assert.equal(
    matchesParticipantFilterSelection("Operator - Operatore", selectedRegistrationTypes),
    true
  );
  assert.equal(
    matchesParticipantFilterSelection("Higher student", selectedRegistrationTypes),
    false
  );
});
