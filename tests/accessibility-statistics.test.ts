import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  buildAccessibilitySummary,
  describeAccessibility,
  hasAccessibilityDeclaration,
  matchesAccessibilityFilter,
  parseAccessibilityFilter,
} from "../lib/statistics/accessibility.ts";
import { buildAccessibilityWorkbook } from "../lib/statistics/accessibility-export.ts";

const rows = [
  {
    disabilita_accessibilita: true,
    difficolta_accessibilita:
      "Difficulty seeing, even when wearing glasses, Difficulty seeing, even when wearing glasses",
  },
  {
    disabilita_accessibilita: true,
    difficolta_accessibilita:
      "Difficulty walking or climbing steps, I use a wheelchair or mobility aid, I need accessible accommodation",
  },
  {
    disabilita_accessibilita: true,
    difficolta_accessibilita: "Difficulty walking or climbing steps",
  },
];

test("counts each participant once per accessibility type", () => {
  assert.deepEqual(buildAccessibilitySummary(rows), {
    seeing: 1,
    hearing: 0,
    walking: 2,
    self_care: 0,
    concentration: 0,
    communicating: 0,
    wheelchair: 1,
    accessible_accommodation: 1,
    assistance: 0,
  });
});

test("parses supported filters and matches participants", () => {
  assert.equal(parseAccessibilityFilter("wheelchair"), "wheelchair");
  assert.equal(parseAccessibilityFilter("unknown"), null);
  assert.equal(matchesAccessibilityFilter(rows[1], "wheelchair"), true);
  assert.equal(matchesAccessibilityFilter(rows[0], "wheelchair"), false);
});

test("recognizes declarations and removes repeated category text", () => {
  assert.equal(hasAccessibilityDeclaration(rows[0]), true);
  assert.equal(
    hasAccessibilityDeclaration({
      disabilita_accessibilita: false,
      difficolta_accessibilita: null,
    }),
    false,
  );
  assert.equal(
    describeAccessibility(rows[0]),
    "Difficulty seeing, even when wearing glasses",
  );
});

test("creates an Excel accessibility list with contacts and readable needs", () => {
  const file = buildAccessibilityWorkbook([
    {
      id: "participant-one",
      personal_code: "16",
      email: "maria@example.org",
      telefono: "+39 333 1234567",
      nome: "Maria",
      cognome: "Rossi",
      gruppo_label: "Roma",
      gruppo_id: null,
      deleted_at: null,
      ...rows[1],
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
    "Disabilità / Accessibilità",
  ]);
  assert.deepEqual(matrix[1], [
    "0016",
    "maria@example.org",
    "+39 333 1234567",
    "Maria",
    "Rossi",
    "Roma",
    "Difficulty walking or climbing steps; I use a wheelchair or mobility aid; I need accessible accommodation",
  ]);
});
