import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import {
  buildTourBookingsWorkbook,
  chunkTourParticipantIds,
} from "../lib/tours/bookings-export.ts";

test("splits participant IDs into bounded queries to avoid oversized Supabase URLs", () => {
  const participantIds = Array.from({ length: 205 }, (_, index) => `participant-${index + 1}`);

  const chunks = chunkTourParticipantIds(participantIds);

  assert.deepEqual(chunks.map((chunk) => chunk.length), [100, 100, 5]);
  assert.deepEqual(chunks.flat(), participantIds);
});

test("creates the tour bookings Excel export with the requested columns", () => {
  const file = buildTourBookingsWorkbook([
    {
      firstName: "Maria",
      lastName: "Rossi",
      phone: "+39 333 1234567",
      group: "Roma",
      tourNumber: 2,
      tourTitle: "Buda Castle",
    },
  ]);
  const workbook = XLSX.read(file, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    raw: false,
  });

  assert.equal(workbook.SheetNames[0], "Prenotazioni tour");
  assert.deepEqual(matrix, [
    ["Nome", "Cognome", "Telefono", "Gruppo", "Tour"],
    ["Maria", "Rossi", "+39 333 1234567", "Roma", "Tour 2 · Buda Castle"],
  ]);
  assert.deepEqual(worksheet["!autofilter"], { ref: "A1:E2" });
});

test("creates a valid header-only workbook when there are no bookings", () => {
  const file = buildTourBookingsWorkbook([]);
  const workbook = XLSX.read(file, { type: "buffer" });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    raw: false,
  });

  assert.deepEqual(matrix, [["Nome", "Cognome", "Telefono", "Gruppo", "Tour"]]);
  assert.deepEqual(worksheet["!autofilter"], { ref: "A1:E1" });
});
