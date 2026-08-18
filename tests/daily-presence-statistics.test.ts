import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDailyPresenceMatrix,
  type DailyPresenceParticipant,
} from "../lib/statistics/daily-presence.ts";

function participant(
  overrides: Partial<DailyPresenceParticipant>,
): DailyPresenceParticipant {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    citta: null,
    data_arrivo: "2026-08-27",
    data_partenza: "2026-08-29",
    partecipa_intero_evento: null,
    presenza_dettaglio: null,
    alloggio_short: "Provided by organization",
    alloggio:
      "I'm staying at the accommodation provided by the organization / Alloggero presso la struttura fornita dall'organizzazione",
    tipo_iscrizione: "Higher student - liceale (14-18 years old)",
    preferenza_alloggio_operatore: null,
    assigned_hostel_name: null,
    ...overrides,
  };
}

test("builds the daily accommodation matrix with requested rows and coherent totals", () => {
  const matrix = buildDailyPresenceMatrix(
    [
      participant({ id: "hostel-a", assigned_hostel_name: "Hostel A" }),
      participant({
        id: "hostel-b",
        assigned_hostel_name: "Hostel B",
        data_arrivo: "2026-08-28",
      }),
      participant({
        id: "autonomous",
        alloggio_short: "Atonoumous",
        alloggio:
          "I arranged my own accommodation / Ho trovato un alloggio autonomamente",
        data_arrivo: "2026-08-28",
        data_partenza: "2026-08-28",
      }),
      participant({
        id: "operator-hotel",
        tipo_iscrizione: "Operator - Operatore",
        preferenza_alloggio_operatore: "Hotel",
        data_partenza: "2026-08-28",
      }),
      participant({
        id: "hostel-unassigned",
        data_arrivo: "2026-08-29",
        data_partenza: "2026-08-29",
      }),
      participant({
        id: "missing-accommodation",
        alloggio_short: null,
        alloggio: null,
        data_partenza: "2026-08-27",
      }),
      participant({
        id: "invalid-dates",
        data_arrivo: "2026-08-29",
        data_partenza: "2026-08-27",
      }),
    ],
    ["Hostel A", "Hostel B"],
    {
      eventStartDate: "2026-08-28",
      eventEndDate: "2026-08-30",
      hostCity: "Budapest",
    },
  );

  assert.deepEqual(matrix.days, ["2026-08-27", "2026-08-28", "2026-08-29"]);
  assert.deepEqual(
    matrix.rows.map((row) => [row.key, row.counts]),
    [
      ["hostel:Hostel A", [1, 1, 1]],
      ["hostel:Hostel B", [0, 1, 1]],
      ["external", [1, 2, 0]],
      ["unassigned", [1, 0, 1]],
      ["total", [3, 4, 3]],
    ],
  );

  const categoryRows = matrix.rows.filter((row) => row.kind !== "total");
  const totalRow = matrix.rows.find((row) => row.kind === "total");
  assert.ok(totalRow);
  for (let index = 0; index < matrix.days.length; index += 1) {
    assert.equal(
      totalRow.counts[index],
      categoryRows.reduce((sum, row) => sum + row.counts[index], 0),
    );
  }
});

test("keeps an assigned hostel visible even when it is missing from inventory input", () => {
  const matrix = buildDailyPresenceMatrix(
    [participant({ assigned_hostel_name: "Unexpected Hostel" })],
    ["Configured Hostel"],
    {
      eventStartDate: "2026-08-28",
      eventEndDate: "2026-08-30",
      hostCity: "Budapest",
    },
  );

  assert.deepEqual(
    matrix.rows.slice(0, 2).map((row) => [row.label, row.counts]),
    [
      ["Configured Hostel", [0, 0, 0]],
      ["Unexpected Hostel", [1, 1, 1]],
    ],
  );
});

test("counts host-city participants without travel dates as external on declared event days", () => {
  const matrix = buildDailyPresenceMatrix(
    [
      participant({
        id: "host-city-full-event",
        citta: "Budapest",
        data_arrivo: null,
        data_partenza: null,
        partecipa_intero_evento: true,
        assigned_hostel_name: "Hostel A",
      }),
      participant({
        id: "host-city-selected-days",
        citta: " BUDAPEST ",
        data_arrivo: null,
        data_partenza: null,
        presenza_dettaglio: {
          "(Opening ceremony Friday 28th August)": true,
          "(Lunch – August 29)": false,
          "Dinner and party – August 30": "yes",
          general: false,
        },
      }),
      participant({
        id: "other-city-without-dates",
        citta: "Rome",
        data_arrivo: null,
        data_partenza: null,
        partecipa_intero_evento: true,
      }),
    ],
    ["Hostel A"],
    {
      eventStartDate: "2026-08-28",
      eventEndDate: "2026-08-30",
      hostCity: "Budapest",
    },
  );

  assert.deepEqual(matrix.days, ["2026-08-28", "2026-08-29", "2026-08-30"]);
  assert.deepEqual(
    matrix.rows.map((row) => [row.key, row.counts]),
    [
      ["hostel:Hostel A", [0, 0, 0]],
      ["external", [2, 1, 2]],
      ["unassigned", [0, 0, 0]],
      ["total", [2, 1, 2]],
    ],
  );
});
