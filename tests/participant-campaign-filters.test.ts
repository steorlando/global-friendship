import assert from "node:assert/strict";
import test from "node:test";
import {
  matchesParticipantFilterSelection,
  matchesParticipantHostelCheckInFilter,
} from "../lib/email/participant-campaign-filters.ts";

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

test("multiple assigned hostels use OR matching", () => {
  const selectedHostels = new Set(["Maverick Athenaeum", "Wombat's City Hostel"]);

  assert.equal(
    matchesParticipantFilterSelection("Maverick Athenaeum", selectedHostels),
    true,
  );
  assert.equal(
    matchesParticipantFilterSelection("wombat's city hostel", selectedHostels),
    true,
  );
  assert.equal(
    matchesParticipantFilterSelection("Equity Point Budapest", selectedHostels),
    false,
  );
  assert.equal(matchesParticipantFilterSelection(null, selectedHostels), false);
});

test("hostel check-in filter includes only assigned participants with missing information", () => {
  assert.equal(matchesParticipantHostelCheckInFilter("pending", "pending"), true);
  assert.equal(matchesParticipantHostelCheckInFilter("completed", "pending"), false);
  assert.equal(matchesParticipantHostelCheckInFilter("not_applicable", "pending"), false);
  assert.equal(matchesParticipantHostelCheckInFilter("completed", "all"), true);
});
