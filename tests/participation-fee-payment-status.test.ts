import assert from "node:assert/strict";
import test from "node:test";
import { hasOutstandingParticipationFee } from "../lib/participation-fees/payment-status.ts";

test("treats an unpaid or partially paid positive fee as outstanding", () => {
  assert.equal(hasOutstandingParticipationFee({ quota_totale: 235, fee_paid: null }), true);
  assert.equal(hasOutstandingParticipationFee({ quota_totale: 235, fee_paid: 100 }), true);
});

test("does not treat a fully paid, overpaid, missing, or zero fee as outstanding", () => {
  assert.equal(hasOutstandingParticipationFee({ quota_totale: 235, fee_paid: 235 }), false);
  assert.equal(hasOutstandingParticipationFee({ quota_totale: 235, fee_paid: 250 }), false);
  assert.equal(hasOutstandingParticipationFee({ quota_totale: null, fee_paid: 0 }), false);
  assert.equal(hasOutstandingParticipationFee({ quota_totale: 0, fee_paid: 0 }), false);
});
