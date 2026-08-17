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
    data_arrivo: "2026-08-27",
    data_partenza: "2026-08-29",
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
  );

  assert.deepEqual(
    matrix.rows.slice(0, 2).map((row) => [row.label, row.counts]),
    [
      ["Configured Hostel", [0, 0, 0]],
      ["Unexpected Hostel", [1, 1, 1]],
    ],
  );
});
