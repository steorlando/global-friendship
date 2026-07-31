import { strict as assert } from "node:assert";
import test from "node:test";
import { normalizeParticipantStaffAvailabilityInput } from "../lib/partecipante/staff-availability.ts";

test("normalizes a multi-area staff availability response", () => {
  const result = normalizeParticipantStaffAvailabilityInput({
    areas: ["band", "choir", "social_media", "band"],
    bandRole: "instrument",
    bandInstrument: "  Guitar  ",
    socialMediaTasks: ["capture", "short_posts", "other", "capture"],
    socialMediaOther: "  Live updates  ",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      areas: ["band", "choir", "social_media"],
      bandRole: "instrument",
      bandInstrument: "Guitar",
      socialMediaTasks: ["capture", "short_posts", "other"],
      socialMediaOther: "Live updates",
    },
  });
});

test("clears conditional answers for unselected staff areas", () => {
  const result = normalizeParticipantStaffAvailabilityInput({
    areas: ["choir"],
    bandRole: "instrument",
    bandInstrument: "Piano",
    socialMediaTasks: ["capture"],
    socialMediaOther: "Ignored",
  });

  assert.deepEqual(result, {
    ok: true,
    value: {
      areas: ["choir"],
      bandRole: null,
      bandInstrument: null,
      socialMediaTasks: [],
      socialMediaOther: null,
    },
  });
});

test("requires at least one staff area", () => {
  const result = normalizeParticipantStaffAvailabilityInput({
    areas: [],
    bandRole: null,
    bandInstrument: null,
    socialMediaTasks: [],
    socialMediaOther: null,
  });

  assert.equal(result.ok, false);
});

test("requires a band role and instrument details when applicable", () => {
  const missingRole = normalizeParticipantStaffAvailabilityInput({
    areas: ["band"],
    bandRole: null,
    bandInstrument: null,
    socialMediaTasks: [],
    socialMediaOther: null,
  });
  const missingInstrument = normalizeParticipantStaffAvailabilityInput({
    areas: ["band"],
    bandRole: "instrument",
    bandInstrument: " ",
    socialMediaTasks: [],
    socialMediaOther: null,
  });

  assert.equal(missingRole.ok, false);
  assert.equal(missingInstrument.ok, false);
});

test("requires social tasks and a description for the other option", () => {
  const missingTasks = normalizeParticipantStaffAvailabilityInput({
    areas: ["social_media"],
    bandRole: null,
    bandInstrument: null,
    socialMediaTasks: [],
    socialMediaOther: null,
  });
  const missingOther = normalizeParticipantStaffAvailabilityInput({
    areas: ["social_media"],
    bandRole: null,
    bandInstrument: null,
    socialMediaTasks: ["other"],
    socialMediaOther: "",
  });

  assert.equal(missingTasks.ok, false);
  assert.equal(missingOther.ok, false);
});

test("rejects unsupported staff and social values", () => {
  const badArea = normalizeParticipantStaffAvailabilityInput({
    areas: ["security"],
    bandRole: null,
    bandInstrument: null,
    socialMediaTasks: [],
    socialMediaOther: null,
  });
  const badSocialTask = normalizeParticipantStaffAvailabilityInput({
    areas: ["social_media"],
    bandRole: null,
    bandInstrument: null,
    socialMediaTasks: ["influencer"],
    socialMediaOther: null,
  });

  assert.equal(badArea.ok, false);
  assert.equal(badSocialTask.ok, false);
});
