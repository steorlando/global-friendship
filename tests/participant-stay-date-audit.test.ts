import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStayDateAuditFields,
  withoutStayDateAuditFields,
} from "../lib/participants/stay-date-audit.ts";

test("does not add audit metadata when stay dates are unchanged", () => {
  assert.deepEqual(
    buildStayDateAuditFields({
      previousArrival: "2026-08-27",
      previousDeparture: "2026-08-31",
      nextArrival: "2026-08-27",
      nextDeparture: "2026-08-31",
      actorId: "user-id",
      actorEmail: "manager@example.com",
      actorRole: "manager",
    }),
    {}
  );
});

test("captures previous values and actor when either stay date changes", () => {
  assert.deepEqual(
    buildStayDateAuditFields({
      previousArrival: "2026-08-27",
      previousDeparture: "2026-08-31",
      nextArrival: "2026-08-28",
      nextDeparture: null,
      actorId: "user-id",
      actorEmail: "manager@example.com",
      actorRole: "manager",
      changedAt: "2026-08-23T12:00:00.000Z",
    }),
    {
      stay_dates_changed_at: "2026-08-23T12:00:00.000Z",
      stay_dates_changed_by: "user-id",
      stay_dates_changed_by_email: "manager@example.com",
      stay_dates_changed_by_role: "manager",
      previous_data_arrivo: "2026-08-27",
      previous_data_partenza: "2026-08-31",
    }
  );
});

test("removes audit fields for compatibility before the migration is applied", () => {
  assert.deepEqual(
    withoutStayDateAuditFields({
      nome: "Ada",
      stay_dates_changed_at: "2026-08-23T12:00:00.000Z",
      previous_data_arrivo: "2026-08-27",
    }),
    { nome: "Ada" }
  );
});
