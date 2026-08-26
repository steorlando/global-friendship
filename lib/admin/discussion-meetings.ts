export const DISCUSSION_MEETING_COUNT = 25;

export type DiscussionMeetingNumber = number;

export type DiscussionGroupSource = {
  id: string | null;
  name: string | null;
};

export type DiscussionParticipantSource = {
  groupId: string | null;
  groupLabel: string | null;
  registrationType: string | null;
};

export type DiscussionMeetingAssignment = {
  groupId: string;
  higherMeetingNumber: DiscussionMeetingNumber | null;
  universityWorkerMeetingNumber: DiscussionMeetingNumber | null;
  updatedAt: string | null;
};

export type DiscussionMeetingAllocationScope =
  | "whole"
  | "higher"
  | "university-worker";

export type DiscussionMeetingAllocation = {
  groupId: string;
  groupName: string;
  scope: DiscussionMeetingAllocationScope;
  higherStudents: number;
  universityWorkers: number;
  operators: number;
  total: number;
};

export type DiscussionGroupAssignmentStatus =
  | "unassigned"
  | "partial"
  | "assigned";

export type DiscussionGroupSummary = {
  id: string;
  name: string;
  higherStudents: number;
  universityWorkers: number;
  operators: number;
  total: number;
  operatorDistribution: {
    higher: number;
    universityWorker: number;
  };
  assignment: DiscussionMeetingAssignment;
  assignedParticipants: number;
  unassignedParticipants: number;
  assignmentStatus: DiscussionGroupAssignmentStatus;
};

export type DiscussionMeetingSummary = {
  number: DiscussionMeetingNumber;
  allocations: DiscussionMeetingAllocation[];
  groupCount: number;
  participantCount: number;
};

export type DiscussionMeetingDashboard = {
  groups: DiscussionGroupSummary[];
  meetings: DiscussionMeetingSummary[];
  totals: {
    groupCount: number;
    fullyAssignedGroups: number;
    partiallyAssignedGroups: number;
    unassignedGroups: number;
    participants: number;
    assignedParticipants: number;
    unassignedParticipants: number;
  };
};

type RegistrationBucket = "higher" | "university-worker" | "operator";

type GroupCounts = {
  higherStudents: number;
  universityWorkers: number;
  operators: number;
};

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeForMatching(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLocaleLowerCase("it")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function isExcludedDiscussionGroup(
  group: Pick<DiscussionGroupSource, "id" | "name">,
): boolean {
  return (
    normalizeForMatching(group.id) === "marconi" ||
    normalizeForMatching(group.name) === "marconi"
  );
}

export function discussionRegistrationBucket(
  rawType: string | null | undefined,
): RegistrationBucket | null {
  const value = normalizeForMatching(rawType);
  if (!value || value.includes("driver - autista")) return null;
  if (value.includes("higher student")) return "higher";
  if (value.includes("undergraduate")) return "university-worker";
  if (value.includes("worker - lavoratore")) return "university-worker";
  if (value.includes("operator - operatore")) return "operator";
  return null;
}

export function splitDiscussionMeetingOperators(
  higherStudents: number,
  universityWorkers: number,
  operators: number,
): { higher: number; universityWorker: number } {
  const studentTotal = higherStudents + universityWorkers;
  if (studentTotal <= 0 || operators <= 0) {
    return { higher: 0, universityWorker: 0 };
  }

  const higher = Math.round((operators * higherStudents) / studentTotal);
  return {
    higher,
    universityWorker: operators - higher,
  };
}

export function isDiscussionMeetingNumber(
  value: unknown,
): value is DiscussionMeetingNumber {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= DISCUSSION_MEETING_COUNT
  );
}

function emptyCounts(): GroupCounts {
  return {
    higherStudents: 0,
    universityWorkers: 0,
    operators: 0,
  };
}

function emptyAssignment(groupId: string): DiscussionMeetingAssignment {
  return {
    groupId,
    higherMeetingNumber: null,
    universityWorkerMeetingNumber: null,
    updatedAt: null,
  };
}

function addAllocation(
  target: Map<number, DiscussionMeetingAllocation[]>,
  meetingNumber: number | null,
  allocation: DiscussionMeetingAllocation,
) {
  if (!meetingNumber || allocation.total <= 0) return;
  const current = target.get(meetingNumber) ?? [];
  current.push(allocation);
  target.set(meetingNumber, current);
}

function mergeGroupAllocations(
  allocations: DiscussionMeetingAllocation[],
  groupTotal: number,
): DiscussionMeetingAllocation[] {
  if (allocations.length <= 1) {
    return allocations.map((allocation) => ({
      ...allocation,
      scope: allocation.total === groupTotal ? "whole" : allocation.scope,
    }));
  }

  const total = allocations.reduce((sum, allocation) => sum + allocation.total, 0);
  return [
    {
      groupId: allocations[0].groupId,
      groupName: allocations[0].groupName,
      scope: total === groupTotal ? "whole" : allocations[0].scope,
      higherStudents: allocations.reduce(
        (sum, allocation) => sum + allocation.higherStudents,
        0,
      ),
      universityWorkers: allocations.reduce(
        (sum, allocation) => sum + allocation.universityWorkers,
        0,
      ),
      operators: allocations.reduce((sum, allocation) => sum + allocation.operators, 0),
      total,
    },
  ];
}

export function buildDiscussionMeetingDashboard(
  groupRows: DiscussionGroupSource[],
  participantRows: DiscussionParticipantSource[],
  assignmentRows: DiscussionMeetingAssignment[],
): DiscussionMeetingDashboard {
  const groups = groupRows
    .map((row) => {
      const id = normalizeText(row.id);
      if (!id) return null;
      return {
        id,
        name: normalizeText(row.name) ?? id,
      };
    })
    .filter((group): group is { id: string; name: string } => {
      if (!group) return false;
      return !isExcludedDiscussionGroup(group);
    })
    .sort((left, right) =>
      left.name.localeCompare(right.name, "it", { sensitivity: "base" }),
    );

  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const groupIdsByMatchKey = new Map<string, string>();
  for (const group of groups) {
    groupIdsByMatchKey.set(normalizeForMatching(group.id), group.id);
    const nameKey = normalizeForMatching(group.name);
    if (!groupIdsByMatchKey.has(nameKey)) {
      groupIdsByMatchKey.set(nameKey, group.id);
    }
  }

  const countsByGroupId = new Map(groups.map((group) => [group.id, emptyCounts()]));
  for (const participant of participantRows) {
    const bucket = discussionRegistrationBucket(participant.registrationType);
    if (!bucket) continue;

    const directGroupId = normalizeText(participant.groupId);
    const groupId =
      (directGroupId && groupsById.has(directGroupId) ? directGroupId : null) ??
      groupIdsByMatchKey.get(normalizeForMatching(participant.groupId)) ??
      groupIdsByMatchKey.get(normalizeForMatching(participant.groupLabel));
    if (!groupId) continue;

    const counts = countsByGroupId.get(groupId) ?? emptyCounts();
    if (bucket === "higher") counts.higherStudents += 1;
    if (bucket === "university-worker") counts.universityWorkers += 1;
    if (bucket === "operator") counts.operators += 1;
    countsByGroupId.set(groupId, counts);
  }

  const groupsWithParticipants = groups.filter((group) => {
    const counts = countsByGroupId.get(group.id) ?? emptyCounts();
    return counts.higherStudents + counts.universityWorkers + counts.operators > 0;
  });
  const groupIdsWithParticipants = new Set(
    groupsWithParticipants.map((group) => group.id),
  );

  const assignmentsByGroupId = new Map(
    assignmentRows
      .filter((assignment) => groupIdsWithParticipants.has(assignment.groupId))
      .map((assignment) => [assignment.groupId, assignment]),
  );
  const allocationsByMeeting = new Map<number, DiscussionMeetingAllocation[]>();
  const groupSummaries: DiscussionGroupSummary[] = [];

  for (const group of groupsWithParticipants) {
    const counts = countsByGroupId.get(group.id) ?? emptyCounts();
    const total = counts.higherStudents + counts.universityWorkers + counts.operators;
    const assignment = assignmentsByGroupId.get(group.id) ?? emptyAssignment(group.id);
    const operatorDistribution = splitDiscussionMeetingOperators(
      counts.higherStudents,
      counts.universityWorkers,
      counts.operators,
    );
    const allocationsForGroup = new Map<number, DiscussionMeetingAllocation[]>();

    if (counts.higherStudents + counts.universityWorkers === 0) {
      const operatorMeeting =
        assignment.higherMeetingNumber === assignment.universityWorkerMeetingNumber
          ? assignment.higherMeetingNumber
          : assignment.higherMeetingNumber ?? assignment.universityWorkerMeetingNumber;
      if (operatorMeeting && counts.operators > 0) {
        addAllocation(allocationsForGroup, operatorMeeting, {
          groupId: group.id,
          groupName: group.name,
          scope: "whole",
          higherStudents: 0,
          universityWorkers: 0,
          operators: counts.operators,
          total: counts.operators,
        });
      }
    } else {
      addAllocation(allocationsForGroup, assignment.higherMeetingNumber, {
        groupId: group.id,
        groupName: group.name,
        scope: "higher",
        higherStudents: counts.higherStudents,
        universityWorkers: 0,
        operators: operatorDistribution.higher,
        total: counts.higherStudents + operatorDistribution.higher,
      });
      addAllocation(allocationsForGroup, assignment.universityWorkerMeetingNumber, {
        groupId: group.id,
        groupName: group.name,
        scope: "university-worker",
        higherStudents: 0,
        universityWorkers: counts.universityWorkers,
        operators: operatorDistribution.universityWorker,
        total: counts.universityWorkers + operatorDistribution.universityWorker,
      });
    }

    let assignedParticipants = 0;
    for (const [meetingNumber, rawAllocations] of allocationsForGroup) {
      const merged = mergeGroupAllocations(rawAllocations, total);
      for (const allocation of merged) {
        addAllocation(allocationsByMeeting, meetingNumber, allocation);
        assignedParticipants += allocation.total;
      }
    }

    const unassignedParticipants = Math.max(0, total - assignedParticipants);
    const assignmentStatus: DiscussionGroupAssignmentStatus =
      assignedParticipants === 0
        ? "unassigned"
        : unassignedParticipants > 0
          ? "partial"
          : "assigned";

    groupSummaries.push({
      id: group.id,
      name: group.name,
      ...counts,
      total,
      operatorDistribution,
      assignment,
      assignedParticipants,
      unassignedParticipants,
      assignmentStatus,
    });
  }

  groupSummaries.sort(
    (left, right) =>
      right.total - left.total ||
      left.name.localeCompare(right.name, "it", { sensitivity: "base" }),
  );

  const meetings = Array.from({ length: DISCUSSION_MEETING_COUNT }, (_, index) => {
    const number = index + 1;
    const allocations = (allocationsByMeeting.get(number) ?? []).sort((left, right) =>
      left.groupName.localeCompare(right.groupName, "it", { sensitivity: "base" }),
    );
    return {
      number,
      allocations,
      groupCount: new Set(allocations.map((allocation) => allocation.groupId)).size,
      participantCount: allocations.reduce(
        (sum, allocation) => sum + allocation.total,
        0,
      ),
    };
  });

  return {
    groups: groupSummaries,
    meetings,
    totals: {
      groupCount: groupSummaries.length,
      fullyAssignedGroups: groupSummaries.filter(
        (group) => group.assignmentStatus === "assigned",
      ).length,
      partiallyAssignedGroups: groupSummaries.filter(
        (group) => group.assignmentStatus === "partial",
      ).length,
      unassignedGroups: groupSummaries.filter(
        (group) => group.assignmentStatus === "unassigned",
      ).length,
      participants: groupSummaries.reduce((sum, group) => sum + group.total, 0),
      assignedParticipants: groupSummaries.reduce(
        (sum, group) => sum + group.assignedParticipants,
        0,
      ),
      unassignedParticipants: groupSummaries.reduce(
        (sum, group) => sum + group.unassignedParticipants,
        0,
      ),
    },
  };
}
