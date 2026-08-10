import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArrivalGroupSummary,
  buildArrivalQrPayload,
  parseArrivalQrPayload,
  resolveArrivalAccommodationType,
} from "../lib/accoglienza/arrivals.ts";

const TOKEN = "8a6101db-4c19-4e38-bf2d-46ddf17249e1";

test("arrival QR payload uses an opaque UUID and rejects unrelated content", () => {
  const payload = buildArrivalQrPayload(TOKEN.toUpperCase());
  assert.equal(payload, `gf-arrival:${TOKEN}`);
  assert.equal(parseArrivalQrPayload(payload), TOKEN);
  assert.equal(parseArrivalQrPayload(TOKEN), TOKEN);
  assert.equal(parseArrivalQrPayload("https://example.com/participant/0016"), null);
  assert.equal(parseArrivalQrPayload("gf-arrival:0016"), null);
});

test("arrival accommodation classification follows autonomous and operator-hotel rules", () => {
  assert.equal(
    resolveArrivalAccommodationType({
      accommodation: "I arranged my own accommodation / Ho trovato un alloggio autonomamente",
      accommodationShort: null,
      registrationType: "Worker - lavoratore (18-25 years old)",
      operatorAccommodationPreference: null,
    }),
    "Autonomo"
  );
  assert.equal(
    resolveArrivalAccommodationType({
      accommodation: "Provided by organization",
      accommodationShort: "Provided by organization",
      registrationType: "Operator - Operatore",
      operatorAccommodationPreference: "Hotel",
    }),
    "Hotel"
  );
  assert.equal(
    resolveArrivalAccommodationType({
      accommodation: "Provided by organization",
      accommodationShort: "Provided by organization",
      registrationType: "Higher student - liceale (14-18 years old)",
      operatorAccommodationPreference: null,
    }),
    "Ostello"
  );
});

test("arrival group summary counts arrived, pending, and total participants", () => {
  assert.deepEqual(
    buildArrivalGroupSummary([
      { group: "Padova", arrivedAt: "2026-08-28T08:00:00.000Z" },
      { group: "Padova", arrivedAt: null },
      { group: "Budapest", arrivedAt: null },
      { group: "", arrivedAt: null },
    ]),
    [
      { group: "Budapest", arrived: 0, notArrived: 1, total: 1 },
      { group: "Padova", arrived: 1, notArrived: 1, total: 2 },
      { group: "-", arrived: 0, notArrived: 1, total: 1 },
    ]
  );
});
