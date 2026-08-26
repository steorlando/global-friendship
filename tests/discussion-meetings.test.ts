import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildDiscussionMeetingDashboard,
  discussionRegistrationBucket,
  splitDiscussionMeetingOperators,
  type DiscussionMeetingAssignment,
  type DiscussionParticipantSource,
} from "../lib/admin/discussion-meetings.ts";
import {
  buildDiscussionMeetingsReport,
  buildDiscussionMeetingUnassignedAllocations,
} from "../lib/admin/discussion-meetings-report.ts";

const GROUPS = [
  { id: "alpha", name: "Comunità Alpha" },
  { id: "beta", name: "Comunità Beta" },
  { id: "5a9d2db0-245b-5d63-998b-cdc15a0a2777", name: "Gruppo vuoto" },
  { id: "marconi", name: "Marconi" },
];

function participantsFor(
  groupId: string,
  registrationType: string,
  count: number,
): DiscussionParticipantSource[] {
  return Array.from({ length: count }, () => ({
    groupId,
    groupLabel: null,
    registrationType,
  }));
}

const ALPHA_PARTICIPANTS = [
  ...participantsFor(
    "alpha",
    "Higher student - liceale (14-18 years old)",
    3,
  ),
  ...participantsFor(
    "alpha",
    "Undergraduate - universitario(18-25 years old)",
    5,
  ),
  ...participantsFor("alpha", "Worker - lavoratore (18-25 years old)", 2),
  ...participantsFor("alpha", "Operator - Operatore", 3),
  ...participantsFor("alpha", "Driver - Autista", 1),
];

function assignment(
  higherMeetingNumber: number | null,
  universityWorkerMeetingNumber: number | null,
): DiscussionMeetingAssignment {
  return {
    groupId: "alpha",
    higherMeetingNumber,
    universityWorkerMeetingNumber,
    updatedAt: null,
  };
}

test("uses the agreed registration buckets and excludes drivers", () => {
  assert.equal(
    discussionRegistrationBucket("Higher student - liceale (14-18 years old)"),
    "higher",
  );
  assert.equal(
    discussionRegistrationBucket("Undergraduate - universitario(18-25 years old)"),
    "university-worker",
  );
  assert.equal(
    discussionRegistrationBucket("Worker - lavoratore (18-25 years old)"),
    "university-worker",
  );
  assert.equal(discussionRegistrationBucket("Operator - Operatore"), "operator");
  assert.equal(discussionRegistrationBucket("Driver - Autista"), null);
});

test("rounds proportional operators while preserving their total", () => {
  assert.deepEqual(splitDiscussionMeetingOperators(3, 7, 3), {
    higher: 1,
    universityWorker: 2,
  });
  assert.deepEqual(splitDiscussionMeetingOperators(1, 1, 1), {
    higher: 1,
    universityWorker: 0,
  });
  const split = splitDiscussionMeetingOperators(17, 4, 9);
  assert.equal(split.higher + split.universityWorker, 9);
});

test("excludes Marconi and every empty group, then splits one group across two meetings", () => {
  const dashboard = buildDiscussionMeetingDashboard(
    GROUPS,
    [
      ...ALPHA_PARTICIPANTS,
      ...participantsFor("marconi", "Operator - Operatore", 2),
    ],
    [assignment(1, 2)],
  );

  assert.deepEqual(
    dashboard.groups.map((group) => group.id),
    ["alpha"],
  );
  assert.equal(dashboard.totals.groupCount, 1);
  const alpha = dashboard.groups[0];
  assert.equal(alpha.higherStudents, 3);
  assert.equal(alpha.universityWorkers, 7);
  assert.equal(alpha.operators, 3);
  assert.equal(alpha.total, 13);
  assert.deepEqual(alpha.operatorDistribution, { higher: 1, universityWorker: 2 });
  assert.equal(alpha.assignmentStatus, "assigned");

  assert.deepEqual(dashboard.meetings[0].allocations, [
    {
      groupId: "alpha",
      groupName: "Comunità Alpha",
      scope: "higher",
      higherStudents: 3,
      universityWorkers: 0,
      operators: 1,
      total: 4,
    },
  ]);
  assert.equal(dashboard.meetings[1].participantCount, 9);
  assert.equal(dashboard.totals.participants, 13);
  assert.equal(dashboard.totals.assignedParticipants, 13);
});

test("keeps the unassigned component visible after a partial assignment", () => {
  const dashboard = buildDiscussionMeetingDashboard(
    GROUPS,
    ALPHA_PARTICIPANTS,
    [assignment(4, null)],
  );
  const alpha = dashboard.groups[0];

  assert.equal(alpha.assignmentStatus, "partial");
  assert.equal(alpha.assignedParticipants, 4);
  assert.equal(alpha.unassignedParticipants, 9);
  assert.equal(dashboard.totals.unassignedParticipants, 9);
  assert.equal(dashboard.meetings[3].participantCount, 4);
});

test("builds report rows for whole and partially unassigned groups", () => {
  const dashboard = buildDiscussionMeetingDashboard(
    GROUPS,
    [
      ...ALPHA_PARTICIPANTS,
      ...participantsFor("beta", "Operator - Operatore", 20),
    ],
    [assignment(4, null)],
  );
  const unassigned = buildDiscussionMeetingUnassignedAllocations(dashboard.groups);

  assert.deepEqual(unassigned, [
    {
      groupId: "beta",
      groupName: "Comunità Beta",
      scope: "whole",
      higherStudents: 0,
      universityWorkers: 0,
      operators: 20,
      total: 20,
    },
    {
      groupId: "alpha",
      groupName: "Comunità Alpha",
      scope: "university-worker",
      higherStudents: 0,
      universityWorkers: 7,
      operators: 2,
      total: 9,
    },
  ]);
  assert.equal(
    unassigned.reduce((total, allocation) => total + allocation.total, 0),
    dashboard.totals.unassignedParticipants,
  );
});

test("orders groups from the largest to the smallest", () => {
  const dashboard = buildDiscussionMeetingDashboard(
    GROUPS,
    [
      ...ALPHA_PARTICIPANTS,
      ...participantsFor("beta", "Operator - Operatore", 20),
    ],
    [],
  );

  assert.deepEqual(
    dashboard.groups.map((group) => [group.id, group.total]),
    [
      ["beta", 20],
      ["alpha", 13],
    ],
  );
});

test("combines both components into one whole-group meeting", () => {
  const dashboard = buildDiscussionMeetingDashboard(
    GROUPS,
    ALPHA_PARTICIPANTS,
    [assignment(7, 7)],
  );
  const meeting = dashboard.meetings[6];

  assert.equal(meeting.allocations.length, 1);
  assert.equal(meeting.allocations[0].scope, "whole");
  assert.equal(meeting.allocations[0].total, 13);
  assert.equal(meeting.participantCount, 13);
  assert.equal(meeting.groupCount, 1);
});

test("matches a participant through the canonical group name when the id is absent", () => {
  const dashboard = buildDiscussionMeetingDashboard(
    GROUPS,
    [
      {
        groupId: null,
        groupLabel: "  comunità alpha ",
        registrationType: "Operator - Operatore",
      },
    ],
    [assignment(2, 2)],
  );

  assert.equal(dashboard.groups[0].operators, 1);
  assert.equal(dashboard.meetings[1].participantCount, 1);
});

test("creates a non-empty Word document from assigned meetings", async () => {
  const dashboard = buildDiscussionMeetingDashboard(
    GROUPS,
    ALPHA_PARTICIPANTS,
    [assignment(1, 2)],
  );
  const report = await buildDiscussionMeetingsReport(dashboard);

  assert.equal(report.subarray(0, 2).toString("ascii"), "PK");
  assert.ok(report.length > 5_000);
});

test("creates the Word report before any meeting has been assigned", async () => {
  const dashboard = buildDiscussionMeetingDashboard(
    GROUPS,
    ALPHA_PARTICIPANTS,
    [],
  );
  const report = await buildDiscussionMeetingsReport(dashboard);

  assert.equal(report.subarray(0, 2).toString("ascii"), "PK");
  assert.ok(report.length > 5_000);
});

test("migration protects the assignment table behind the service-role API", async () => {
  const migration = await readFile(
    new URL("../supabase/discussion_meeting_assignments_migration.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /higher_meeting_number between 1 and 25/);
  assert.match(migration, /university_worker_meeting_number between 1 and 25/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all[\s\S]*from anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete[\s\S]*to service_role/);
});
