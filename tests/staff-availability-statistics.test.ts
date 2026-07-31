import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStaffAvailabilitySummary,
  describeStaffAvailability,
  type StaffAvailabilityStatRow,
} from "../lib/statistics/staff-availability.ts";

const rows: StaffAvailabilityStatRow[] = [
  {
    participant_id: "one",
    areas: ["band", "choir"],
    band_role: "vocals",
    band_instrument: null,
    social_media_tasks: [],
    social_media_other: null,
  },
  {
    participant_id: "two",
    areas: ["band", "social_media"],
    band_role: "instrument",
    band_instrument: "Chitarra",
    social_media_tasks: ["capture", "short_posts"],
    social_media_other: null,
  },
  {
    participant_id: "three",
    areas: ["social_media"],
    band_role: null,
    band_instrument: null,
    social_media_tasks: ["post_production", "long_articles", "other"],
    social_media_other: "Interviste",
  },
];

test("builds staff response and availability counters", () => {
  assert.deepEqual(buildStaffAvailabilitySummary(rows), {
    responses: 3,
    band: 2,
    choir: 1,
    socialMedia: 2,
    bandVocals: 1,
    bandInstrument: 1,
    socialCapture: 1,
    socialPostProduction: 1,
    socialShortPosts: 1,
    socialLongArticles: 1,
    socialOther: 1,
  });
});

test("describes all selected availability details for the Excel export", () => {
  assert.equal(
    describeStaffAvailability(rows[1]),
    "Band - strumento: Chitarra; Social media - foto o video, post per i social",
  );
  assert.equal(
    describeStaffAvailability(rows[2]),
    "Social media - montaggio foto o video, articoli lunghi, altro: Interviste",
  );
});
