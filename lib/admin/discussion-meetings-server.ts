import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDiscussionMeetingDashboard,
  type DiscussionGroupSource,
  type DiscussionMeetingAssignment,
  type DiscussionMeetingDashboard,
  type DiscussionParticipantSource,
} from "@/lib/admin/discussion-meetings";

type DiscussionGroupRow = {
  id: string | null;
  nome: string | null;
};

type DiscussionParticipantRow = {
  gruppo_id: string | null;
  gruppo_label: string | null;
  tipo_iscrizione: string | null;
};

type DiscussionAssignmentRow = {
  group_id: string;
  higher_meeting_number: number | null;
  university_worker_meeting_number: number | null;
  updated_at: string | null;
};

export type DiscussionMeetingPersistence = "database" | "local-preview";

export type DiscussionMeetingDashboardResponse = DiscussionMeetingDashboard & {
  persistence: DiscussionMeetingPersistence;
};

const ASSIGNMENTS_TABLE = "discussion_meeting_group_assignments";
const LOCAL_STORE_PATH = path.join(
  process.cwd(),
  ".next",
  "cache",
  "discussion-meeting-assignments.local.json",
);

let localPreviewActive = false;

function isMissingAssignmentsTable(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    ["42P01", "PGRST204", "PGRST205"].includes(error.code ?? "") ||
    (message.includes(ASSIGNMENTS_TABLE) &&
      (message.includes("could not find") || message.includes("does not exist")))
  );
}

function canUseLocalPreview(): boolean {
  return process.env.NODE_ENV !== "production";
}

function toAssignment(row: DiscussionAssignmentRow): DiscussionMeetingAssignment {
  return {
    groupId: row.group_id,
    higherMeetingNumber: row.higher_meeting_number,
    universityWorkerMeetingNumber: row.university_worker_meeting_number,
    updatedAt: row.updated_at,
  };
}

async function readLocalAssignments(): Promise<DiscussionMeetingAssignment[]> {
  try {
    const raw = await readFile(LOCAL_STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((row): row is DiscussionMeetingAssignment => {
      if (!row || typeof row !== "object") return false;
      const record = row as Record<string, unknown>;
      return (
        typeof record.groupId === "string" &&
        (record.higherMeetingNumber === null ||
          typeof record.higherMeetingNumber === "number") &&
        (record.universityWorkerMeetingNumber === null ||
          typeof record.universityWorkerMeetingNumber === "number")
      );
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw error;
  }
}

async function writeLocalAssignments(assignments: DiscussionMeetingAssignment[]) {
  const directory = path.dirname(LOCAL_STORE_PATH);
  await mkdir(directory, { recursive: true });
  const temporaryPath = `${LOCAL_STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(
      assignments.sort((left, right) => left.groupId.localeCompare(right.groupId)),
      null,
      2,
    )}\n`,
    "utf8",
  );
  await rename(temporaryPath, LOCAL_STORE_PATH);
}

async function loadDiscussionMeetingSources(service: SupabaseClient): Promise<{
  groups: DiscussionGroupSource[];
  participants: DiscussionParticipantSource[];
}> {
  const [groupsResult, participantsResult] = await Promise.all([
    service.from("gruppi").select("id,nome").order("nome", { ascending: true }),
    service
      .from("partecipanti")
      .select("gruppo_id,gruppo_label,tipo_iscrizione")
      .is("deleted_at", null),
  ]);

  if (groupsResult.error) throw new Error(groupsResult.error.message);
  if (participantsResult.error) throw new Error(participantsResult.error.message);

  return {
    groups: ((groupsResult.data ?? []) as DiscussionGroupRow[]).map((row) => ({
      id: row.id,
      name: row.nome,
    })),
    participants: ((participantsResult.data ?? []) as DiscussionParticipantRow[]).map(
      (row) => ({
        groupId: row.gruppo_id,
        groupLabel: row.gruppo_label,
        registrationType: row.tipo_iscrizione,
      }),
    ),
  };
}

async function loadAssignments(service: SupabaseClient): Promise<{
  assignments: DiscussionMeetingAssignment[];
  persistence: DiscussionMeetingPersistence;
}> {
  if (localPreviewActive && canUseLocalPreview()) {
    return {
      assignments: await readLocalAssignments(),
      persistence: "local-preview",
    };
  }

  const result = await service
    .from(ASSIGNMENTS_TABLE)
    .select(
      "group_id,higher_meeting_number,university_worker_meeting_number,updated_at",
    )
    .order("group_id", { ascending: true });

  if (result.error) {
    if (isMissingAssignmentsTable(result.error) && canUseLocalPreview()) {
      localPreviewActive = true;
      return {
        assignments: await readLocalAssignments(),
        persistence: "local-preview",
      };
    }
    throw new Error(result.error.message);
  }

  return {
    assignments: ((result.data ?? []) as DiscussionAssignmentRow[]).map(toAssignment),
    persistence: "database",
  };
}

export async function loadDiscussionMeetingDashboard(
  service: SupabaseClient,
): Promise<DiscussionMeetingDashboardResponse> {
  const [sources, assignmentResult] = await Promise.all([
    loadDiscussionMeetingSources(service),
    loadAssignments(service),
  ]);
  return {
    ...buildDiscussionMeetingDashboard(
      sources.groups,
      sources.participants,
      assignmentResult.assignments,
    ),
    persistence: assignmentResult.persistence,
  };
}

export async function saveDiscussionMeetingAssignment(
  service: SupabaseClient,
  assignment: Omit<DiscussionMeetingAssignment, "updatedAt">,
  userId: string,
): Promise<DiscussionMeetingPersistence> {
  const shouldDelete =
    assignment.higherMeetingNumber === null &&
    assignment.universityWorkerMeetingNumber === null;

  if (!localPreviewActive) {
    const result = shouldDelete
      ? await service.from(ASSIGNMENTS_TABLE).delete().eq("group_id", assignment.groupId)
      : await service.from(ASSIGNMENTS_TABLE).upsert(
          {
            group_id: assignment.groupId,
            higher_meeting_number: assignment.higherMeetingNumber,
            university_worker_meeting_number: assignment.universityWorkerMeetingNumber,
            updated_by: userId,
          },
          { onConflict: "group_id" },
        );

    if (!result.error) return "database";
    if (!isMissingAssignmentsTable(result.error) || !canUseLocalPreview()) {
      throw new Error(result.error.message);
    }
    localPreviewActive = true;
  }

  const assignments = await readLocalAssignments();
  const remaining = assignments.filter((row) => row.groupId !== assignment.groupId);
  if (!shouldDelete) {
    remaining.push({
      ...assignment,
      updatedAt: new Date().toISOString(),
    });
  }
  await writeLocalAssignments(remaining);
  return "local-preview";
}
