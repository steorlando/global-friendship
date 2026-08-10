import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAutonomousAccommodation,
  isOperatorRegistrationType,
  normalizeOperatorAccommodationPreference,
} from "../partecipante/constants.ts";

export const HOSTEL_IDENTITY_DOCUMENT_TYPES = [
  "passport",
  "driving_license",
  "national_id",
] as const;

export type HostelIdentityDocumentType =
  (typeof HOSTEL_IDENTITY_DOCUMENT_TYPES)[number];

export type HostelCheckInStatus = "completed" | "pending" | "not_applicable";

export type HostelCheckInInput = {
  identityDocumentType: HostelIdentityDocumentType;
  identityDocumentNumber: string;
  identityDocumentCountry: string;
  identityDocumentIssuingCity: string;
  identityDocumentIssueDate: string;
  identityDocumentExpirationDate: string;
};

export type HostelCheckInGroupRow = {
  group: string;
  completed: number;
  pending: number;
  total: number;
};

type MaybeSupabaseError = {
  code?: string | null;
  message?: string | null;
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const PARTICIPANT_BATCH_SIZE = 100;
const DOCUMENT_TYPE_SET = new Set<string>(HOSTEL_IDENTITY_DOCUMENT_TYPES);

export function participantMayNeedHostelCheckIn(participant: {
  alloggio?: string | null;
  alloggio_short?: string | null;
  tipo_iscrizione?: string | null;
  preferenza_alloggio_operatore?: string | null;
}): boolean {
  if (isAutonomousAccommodation(participant.alloggio_short ?? participant.alloggio)) {
    return false;
  }

  return !(
    isOperatorRegistrationType(participant.tipo_iscrizione) &&
    normalizeOperatorAccommodationPreference(
      participant.preferenza_alloggio_operatore
    ) === "Hotel"
  );
}

function normalizeRequiredText(
  value: unknown,
  label: string,
  maxLength: number
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string") {
    return { ok: false, error: `${label} is required` };
  }

  const normalized = value.trim();
  if (!normalized) {
    return { ok: false, error: `${label} is required` };
  }
  if (normalized.length > maxLength) {
    return { ok: false, error: `${label} is too long` };
  }

  return { ok: true, value: normalized };
}

function normalizeDateOnly(
  value: unknown,
  label: string
): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof value !== "string" || !DATE_ONLY_REGEX.test(value)) {
    return { ok: false, error: `${label} is required` };
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { ok: false, error: `${label} is invalid` };
  }

  return { ok: true, value };
}

export function normalizeHostelCheckInInput(
  input: unknown
): { ok: true; value: HostelCheckInInput } | { ok: false; error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "Invalid check-in data" };
  }

  const record = input as Record<string, unknown>;
  const rawDocumentType =
    typeof record.identityDocumentType === "string"
      ? record.identityDocumentType.trim()
      : "";
  if (!DOCUMENT_TYPE_SET.has(rawDocumentType)) {
    return { ok: false, error: "Identity document type is invalid" };
  }

  const documentNumber = normalizeRequiredText(
    record.identityDocumentNumber,
    "Identity document number",
    80
  );
  if (!documentNumber.ok) return documentNumber;

  const documentCountry = normalizeRequiredText(
    record.identityDocumentCountry,
    "Identity document country",
    100
  );
  if (!documentCountry.ok) return documentCountry;

  const issuingCity = normalizeRequiredText(
    record.identityDocumentIssuingCity,
    "Identity document issuing city",
    100
  );
  if (!issuingCity.ok) return issuingCity;

  const issueDate = normalizeDateOnly(
    record.identityDocumentIssueDate,
    "Identity document issue date"
  );
  if (!issueDate.ok) return issueDate;

  const expirationDate = normalizeDateOnly(
    record.identityDocumentExpirationDate,
    "Identity document expiration date"
  );
  if (!expirationDate.ok) return expirationDate;

  if (expirationDate.value < issueDate.value) {
    return {
      ok: false,
      error: "Identity document expiration date must be on or after the issue date",
    };
  }

  return {
    ok: true,
    value: {
      identityDocumentType: rawDocumentType as HostelIdentityDocumentType,
      identityDocumentNumber: documentNumber.value,
      identityDocumentCountry: documentCountry.value,
      identityDocumentIssuingCity: issuingCity.value,
      identityDocumentIssueDate: issueDate.value,
      identityDocumentExpirationDate: expirationDate.value,
    },
  };
}

export function isMissingHostelCheckInTable(
  error: MaybeSupabaseError | null | undefined
): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("participant_hostel_check_ins")
  );
}

function toBatches(values: string[]): string[][] {
  const uniqueValues = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  const batches: string[][] = [];
  for (let index = 0; index < uniqueValues.length; index += PARTICIPANT_BATCH_SIZE) {
    batches.push(uniqueValues.slice(index, index + PARTICIPANT_BATCH_SIZE));
  }
  return batches;
}

export async function loadHostelCheckInStatuses(
  service: SupabaseClient,
  participantIds: string[]
): Promise<Map<string, HostelCheckInStatus>> {
  const batches = toBatches(participantIds);
  const statusByParticipant = new Map<string, HostelCheckInStatus>();
  for (const participantId of participantIds) {
    statusByParticipant.set(participantId, "not_applicable");
  }
  if (batches.length === 0) return statusByParticipant;

  const [assignmentResults, checkInResults] = await Promise.all([
    Promise.all(
      batches.map((batch) =>
        service
          .from("partecipanti_stanze")
          .select("partecipante_id")
          .in("partecipante_id", batch)
      )
    ),
    Promise.all(
      batches.map((batch) =>
        service
          .from("participant_hostel_check_ins")
          .select("participant_id,completed_at")
          .in("participant_id", batch)
      )
    ),
  ]);

  const assignedParticipantIds = new Set<string>();
  for (const result of assignmentResults) {
    if (result.error) throw new Error(result.error.message);
    for (const row of result.data ?? []) {
      const participantId = String(row.partecipante_id ?? "").trim();
      if (participantId) assignedParticipantIds.add(participantId);
    }
  }

  const completedParticipantIds = new Set<string>();
  for (const result of checkInResults) {
    if (result.error) {
      if (isMissingHostelCheckInTable(result.error)) continue;
      throw new Error(result.error.message);
    }
    for (const row of result.data ?? []) {
      const participantId = String(row.participant_id ?? "").trim();
      if (participantId && row.completed_at) completedParticipantIds.add(participantId);
    }
  }

  for (const participantId of assignedParticipantIds) {
    statusByParticipant.set(
      participantId,
      completedParticipantIds.has(participantId) ? "completed" : "pending"
    );
  }

  return statusByParticipant;
}

export function buildHostelCheckInGroupSummary(
  participants: Array<{ id: string; group: string }>,
  statusByParticipant: ReadonlyMap<string, HostelCheckInStatus>
): HostelCheckInGroupRow[] {
  const rowsByGroup = new Map<string, HostelCheckInGroupRow>();

  for (const participant of participants) {
    const status = statusByParticipant.get(participant.id) ?? "not_applicable";
    if (status === "not_applicable") continue;

    const group = participant.group.trim() || "-";
    const row = rowsByGroup.get(group) ?? {
      group,
      completed: 0,
      pending: 0,
      total: 0,
    };
    row.total += 1;
    if (status === "completed") row.completed += 1;
    if (status === "pending") row.pending += 1;
    rowsByGroup.set(group, row);
  }

  return [...rowsByGroup.values()].sort((a, b) => {
    if (a.group === "-") return 1;
    if (b.group === "-") return -1;
    return a.group.localeCompare(b.group);
  });
}
