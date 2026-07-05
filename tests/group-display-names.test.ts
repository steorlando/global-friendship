import assert from "node:assert/strict";
import test from "node:test";

import { groupDisplayName, groupDisplayNames } from "../lib/groups/display-names.ts";

test("groupDisplayName replaces a technical group id with its canonical name", () => {
  const namesById = new Map([
    ["9326fccb-a933-58be-9f45-e3a823deabb6", "Russian Federation"],
  ]);

  assert.equal(
    groupDisplayName("9326fccb-a933-58be-9f45-e3a823deabb6", namesById),
    "Russian Federation"
  );
});

test("groupDisplayNames deduplicates and sorts resolved names", () => {
  const namesById = new Map([
    ["uuid-russia", "Russian Federation"],
    ["uuid-foggia", "Foggia"],
  ]);

  assert.deepEqual(
    groupDisplayNames(["uuid-russia", "uuid-foggia", "uuid-russia"], namesById),
    ["Foggia", "Russian Federation"]
  );
});

test("groupDisplayName preserves legacy text ids when no separate name exists", () => {
  assert.equal(groupDisplayName("Germany", new Map()), "Germany");
  assert.equal(groupDisplayName(null, new Map(), "Spain"), "Spain");
});
