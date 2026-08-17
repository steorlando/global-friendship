import {
  isAutonomousAccommodation,
  isOperatorRegistrationType,
  normalizeOperatorAccommodationPreference,
} from "../partecipante/constants.ts";

export type DailyPresenceParticipant = {
  id: string;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio_short: string | null;
  alloggio: string | null;
  tipo_iscrizione: string | null;
  preferenza_alloggio_operatore: string | null;
  assigned_hostel_name: string | null;
};

export type DailyPresenceMatrixRow = {
  key: string;
  kind: "hostel" | "external" | "unassigned" | "total";
  label: string | null;
  counts: number[];
};

export type DailyPresenceMatrix = {
  days: string[];
  rows: DailyPresenceMatrixRow[];
};

function parseDateOnly(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isExternalAccommodation(participant: DailyPresenceParticipant): boolean {
  const autonomous = [participant.alloggio_short, participant.alloggio].some(
    isAutonomousAccommodation,
  );
  if (autonomous) return true;

  return (
    isOperatorRegistrationType(participant.tipo_iscrizione) &&
    normalizeOperatorAccommodationPreference(
      participant.preferenza_alloggio_operatore,
    ) === "Hotel"
  );
}

function uniqueHostelNames(
  configuredHostelNames: readonly string[],
  participants: readonly DailyPresenceParticipant[],
): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const rawName of configuredHostelNames) {
    const name = rawName.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  const unexpectedAssignedNames = participants
    .flatMap((participant) => {
      const name = participant.assigned_hostel_name?.trim();
      return name && !seen.has(name) ? [name] : [];
    })
    .sort((a, b) => a.localeCompare(b));

  for (const name of unexpectedAssignedNames) {
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  return names;
}

export function buildDailyPresenceMatrix(
  participants: readonly DailyPresenceParticipant[],
  configuredHostelNames: readonly string[],
): DailyPresenceMatrix {
  const validParticipants = participants.flatMap((participant) => {
    const arrival = parseDateOnly(participant.data_arrivo);
    const departure = parseDateOnly(participant.data_partenza);
    if (!arrival || !departure || departure < arrival) return [];
    return [{ participant, arrival, departure }];
  });

  const daySet = new Set<string>();
  for (const { arrival, departure } of validParticipants) {
    for (let current = arrival; current <= departure; current = addDays(current, 1)) {
      daySet.add(formatDateOnly(current));
    }
  }
  const days = [...daySet].sort((a, b) => a.localeCompare(b));
  const dayIndex = new Map(days.map((day, index) => [day, index] as const));
  const hostelNames = uniqueHostelNames(configuredHostelNames, participants);

  const hostelCounts = new Map(
    hostelNames.map((name) => [name, Array(days.length).fill(0) as number[]]),
  );
  const externalCounts = Array(days.length).fill(0) as number[];
  const unassignedCounts = Array(days.length).fill(0) as number[];
  const totalCounts = Array(days.length).fill(0) as number[];

  for (const { participant, arrival, departure } of validParticipants) {
    const assignedHostelName = participant.assigned_hostel_name?.trim() || null;
    const categoryCounts = isExternalAccommodation(participant)
      ? externalCounts
      : assignedHostelName
        ? hostelCounts.get(assignedHostelName) ?? unassignedCounts
        : unassignedCounts;

    for (let current = arrival; current <= departure; current = addDays(current, 1)) {
      const index = dayIndex.get(formatDateOnly(current));
      if (index === undefined) continue;
      categoryCounts[index] += 1;
      totalCounts[index] += 1;
    }
  }

  return {
    days,
    rows: [
      ...hostelNames.map((hostelName) => ({
        key: `hostel:${hostelName}`,
        kind: "hostel" as const,
        label: hostelName,
        counts: hostelCounts.get(hostelName) ?? Array(days.length).fill(0),
      })),
      {
        key: "external",
        kind: "external",
        label: null,
        counts: externalCounts,
      },
      {
        key: "unassigned",
        kind: "unassigned",
        label: null,
        counts: unassignedCounts,
      },
      {
        key: "total",
        kind: "total",
        label: null,
        counts: totalCounts,
      },
    ],
  };
}
