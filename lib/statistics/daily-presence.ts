import {
  isAutonomousAccommodation,
  isOperatorRegistrationType,
  normalizeOperatorAccommodationPreference,
} from "../partecipante/constants.ts";

export type DailyPresenceParticipant = {
  id: string;
  citta: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  partecipa_intero_evento: boolean | null;
  presenza_dettaglio: Record<string, unknown> | null;
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

export type DailyPresenceOptions = {
  eventStartDate: string;
  eventEndDate: string;
  hostCity: string;
};

type ResolvedPresence = {
  participant: DailyPresenceParticipant;
  days: Date[];
  forceExternal: boolean;
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

function normalizeForMatch(value: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function dateRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let current = start; current <= end; current = addDays(current, 1)) {
    days.push(current);
  }
  return days;
}

function isSelectedPresenceDetail(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value !== "string") return false;
  return ["true", "1", "yes", "y", "on"].includes(value.trim().toLowerCase());
}

function detailKeyMatchesDay(key: string, day: Date): boolean {
  const dayOfMonth = String(day.getUTCDate());
  return new RegExp(`(^|\\D)${dayOfMonth}(?:st|nd|rd|th)?(?:\\D|$)`, "i").test(key);
}

function resolvePresence(
  participant: DailyPresenceParticipant,
  options: DailyPresenceOptions,
): ResolvedPresence | null {
  const arrival = parseDateOnly(participant.data_arrivo);
  const departure = parseDateOnly(participant.data_partenza);
  if (arrival && departure && departure >= arrival) {
    return {
      participant,
      days: dateRange(arrival, departure),
      forceExternal: false,
    };
  }

  const participantCity = normalizeForMatch(participant.citta);
  const hostCity = normalizeForMatch(options.hostCity);
  if (!participantCity || participantCity !== hostCity) return null;

  const eventStart = parseDateOnly(options.eventStartDate);
  const eventEnd = parseDateOnly(options.eventEndDate);
  if (!eventStart || !eventEnd || eventEnd < eventStart) return null;

  const eventDays = dateRange(eventStart, eventEnd);
  const days = participant.partecipa_intero_evento === true
    ? eventDays
    : eventDays.filter((day) =>
        Object.entries(participant.presenza_dettaglio ?? {}).some(
          ([key, value]) =>
            key.trim().toLowerCase() !== "general" &&
            isSelectedPresenceDetail(value) &&
            detailKeyMatchesDay(key, day),
        ),
      );

  if (days.length === 0) return null;
  return { participant, days, forceExternal: true };
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
  options: DailyPresenceOptions,
): DailyPresenceMatrix {
  const validParticipants = participants.flatMap((participant) => {
    const resolved = resolvePresence(participant, options);
    return resolved ? [resolved] : [];
  });

  const daySet = new Set<string>();
  for (const resolved of validParticipants) {
    for (const day of resolved.days) {
      daySet.add(formatDateOnly(day));
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

  for (const { participant, days: participantDays, forceExternal } of validParticipants) {
    const assignedHostelName = participant.assigned_hostel_name?.trim() || null;
    const categoryCounts = forceExternal || isExternalAccommodation(participant)
      ? externalCounts
      : assignedHostelName
        ? hostelCounts.get(assignedHostelName) ?? unassignedCounts
        : unassignedCounts;

    for (const day of participantDays) {
      const index = dayIndex.get(formatDateOnly(day));
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
