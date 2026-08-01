import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_IN_FILTER_BATCH_SIZE,
  batchInFilterValues,
} from "../lib/supabase/query-batching.ts";

test("splits large PostgREST in-filter value lists into URL-safe batches", () => {
  const ids = Array.from({ length: 262 }, (_, index) => `recipient-${index + 1}`);
  const batches = batchInFilterValues(ids);

  assert.equal(batches.length, 6);
  assert.deepEqual(
    batches.map((batch) => batch.length),
    [50, 50, 50, 50, 50, 12]
  );
  assert.deepEqual(batches.flat(), ids);
  assert.ok(batches.every((batch) => batch.length <= DEFAULT_IN_FILTER_BATCH_SIZE));
});

test("returns no batches for an empty list", () => {
  assert.deepEqual(batchInFilterValues([]), []);
});

test("rejects invalid batch sizes", () => {
  assert.throws(() => batchInFilterValues(["one"], 0), /positive integer/);
});
