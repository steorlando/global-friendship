import assert from "node:assert/strict";
import test from "node:test";
import {
  matchPersonalCode,
  parseBankDate,
  parseBankStatementRows,
} from "../lib/participation-fees/bank-statement.ts";

const knownCodes = new Set(["0016", "1008", "1119", "1295"]);

test("normalizes explicit IDs without leading zeros", () => {
  const result = matchPersonalCode("Global Budapest Mario Rossi ID 16", knownCodes);
  assert.equal(result.matchStatus, "matched");
  assert.equal(result.personalCode, "0016");
});

test("matches a bare known four-digit code and ignores the event year", () => {
  const result = matchPersonalCode(
    "Global Budapest agosto 2026 Sofia Marinucci 1119 Bonifico a Vostro favore",
    knownCodes
  );
  assert.equal(result.matchStatus, "matched");
  assert.equal(result.personalCode, "1119");
});

test("reports an explicit but unknown ID", () => {
  const result = matchPersonalCode("Global Budapest Mario Rossi ID 9999", knownCodes);
  assert.equal(result.matchStatus, "unknown_code");
  assert.equal(result.personalCode, "9999");
});

test("does not treat a short bare number as an ID when the ID label is missing", () => {
  const result = matchPersonalCode("Global Budapest gruppo 16", knownCodes);
  assert.equal(result.matchStatus, "missing_code");
});

test("parses Excel serial dates without carrying the time fraction", () => {
  assert.equal(parseBankDate(46206.166666666664), "2026-07-03");
});

test("keeps only credit rows whose description contains Global or Budapest", () => {
  const rows = [
    ["Data contabile", "Data valuta", "Descrizione", "Accrediti", "Addebiti", "Descrizione estesa"],
    [46206.16, null, "ACCREDITO", 200, null, "Global Budapest Hanin - ID 1295"],
    [46206.16, null, "ACCREDITO", 235, null, "Global Budapest Sofia 1119"],
    [46206.16, null, "ACCREDITO", 235, null, "Altro movimento ID 1008"],
    [46206.16, null, "ACCREDITO", 235, null, "Global Budapest gruppo senza codice"],
  ];

  const payments = parseBankStatementRows(rows, knownCodes);
  assert.equal(payments.length, 3);
  assert.deepEqual(
    payments.map((payment) => payment.matchStatus),
    ["matched", "matched", "missing_code"]
  );
});
