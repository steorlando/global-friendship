import assert from "node:assert/strict";
import test from "node:test";

import { STATISTICS_GROUP_LEADER_ROLES } from "../lib/statistics/group-leader-associations.ts";

test("statistics count broader operational profiles with group-leader responsibilities", () => {
  assert.deepEqual(STATISTICS_GROUP_LEADER_ROLES, [
    "capogruppo",
    "manager",
    "admin",
  ]);
  assert.equal(STATISTICS_GROUP_LEADER_ROLES.includes("admin"), true);
});
