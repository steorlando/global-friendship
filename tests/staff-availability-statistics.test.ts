import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  buildStaffAvailabilitySummary,
  describeStaffAvailability,
  matchesStaffAvailabilityFilter,
  matchesStaffAvailabilityAreas,
  parseStaffAvailabilityFilter,
  type StaffAvailabilityStatRow,
} from "../lib/statistics/staff-availability.ts";
import { buildStaffAvailabilityWorkbook } from "../lib/statistics/staff-availability-export.ts";

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

test("parses only supported staff availability filters", () => {
  assert.equal(parseStaffAvailabilityFilter("band_instrument"), "band_instrument");
  assert.equal(parseStaffAvailabilityFilter("unknown"), null);
  assert.equal(parseStaffAvailabilityFilter(null), null);
});

test("matches every dashboard staff availability metric", () => {
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "responses")).map((row) => row.participant_id),
    ["one", "two", "three"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "band")).map((row) => row.participant_id),
    ["one", "two"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "choir")).map((row) => row.participant_id),
    ["one"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "social_media")).map((row) => row.participant_id),
    ["two", "three"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "band_vocals")).map((row) => row.participant_id),
    ["one"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "band_instrument")).map((row) => row.participant_id),
    ["two"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "social_capture")).map((row) => row.participant_id),
    ["two"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "social_post_production")).map((row) => row.participant_id),
    ["three"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "social_short_posts")).map((row) => row.participant_id),
    ["two"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "social_long_articles")).map((row) => row.participant_id),
    ["three"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityFilter(row, "social_other")).map((row) => row.participant_id),
    ["three"],
  );
});

test("combines staff area filters with OR logic and shows all without filters", () => {
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityAreas(row, [])).map((row) => row.participant_id),
    ["one", "two", "three"],
  );
  assert.deepEqual(
    rows
      .filter((row) => matchesStaffAvailabilityAreas(row, ["choir", "social_media"]))
      .map((row) => row.participant_id),
    ["one", "two", "three"],
  );
  assert.deepEqual(
    rows.filter((row) => matchesStaffAvailabilityAreas(row, ["choir"])).map((row) => row.participant_id),
    ["one"],
  );
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

test("creates a readable Excel export with contacts and four-digit ID", () => {
  const file = buildStaffAvailabilityWorkbook([
    {
      id: "participant-two",
      personal_code: "16",
      email: "maria@example.org",
      telefono: "+39 333 1234567",
      nome: "Maria",
      cognome: "Rossi",
      gruppo_label: "Roma",
      gruppo_id: null,
      deleted_at: null,
      availability: {
        ...rows[1],
        updated_at: "2026-07-31T15:30:00.000Z",
      },
    },
  ]);
  const workbook = XLSX.read(file, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    raw: false,
  });

  assert.deepEqual(matrix[0], [
    "ID",
    "Email",
    "Telefono",
    "Nome",
    "Cognome",
    "Gruppo",
    "Disponibilità",
    "Ultimo aggiornamento",
  ]);
  assert.deepEqual(matrix[1].slice(0, 7), [
    "0016",
    "maria@example.org",
    "+39 333 1234567",
    "Maria",
    "Rossi",
    "Roma",
    "Band - strumento: Chitarra; Social media - foto o video, post per i social",
  ]);
});
