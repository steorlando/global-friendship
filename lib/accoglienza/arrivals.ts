import {
  isAutonomousAccommodation,
  isOperatorRegistrationType,
  normalizeOperatorAccommodationPreference,
} from "../partecipante/constants.ts";

export const ARRIVAL_QR_PREFIX = "gf-arrival:";

export type ArrivalAccommodationType = "Hotel" | "Ostello" | "Autonomo";

export type ArrivalParticipant = {
  id: string;
  personalCode: string;
  firstName: string;
  lastName: string;
  country: string;
  group: string;
  groupLeaders: string[];
  arrivalDate: string | null;
  accommodationType: ArrivalAccommodationType;
  accommodationLocation: string | null;
  arrivedAt: string | null;
};

export type ArrivalGroupSummaryRow = {
  group: string;
  arrived: number;
  notArrived: number;
  total: number;
};

export type ReceptionGroupLeaderContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  groups: string[];
  isRomeSubgroup: boolean;
  romeSubgroups: string[];
};

export type ReceptionGroupHostelRow = {
  group: string;
  hostels: Array<{
    name: string;
    count: number;
  }>;
  assignedCount: number;
  unassignedCount: number;
  hostelParticipantCount: number;
};

export type ReceptionHostelArrivalDayRow = {
  arrivalDate: string | null;
  hostels: Array<{
    name: string;
    count: number;
  }>;
  assignedCount: number;
  unassignedCount: number;
  total: number;
};

export function buildArrivalQrPayload(token: string): string {
  return `${ARRIVAL_QR_PREFIX}${token.trim().toLowerCase()}`;
}

export function parseArrivalQrPayload(value: string): string | null {
  const normalized = value.trim();
  const candidate = normalized.toLowerCase().startsWith(ARRIVAL_QR_PREFIX)
    ? normalized.slice(ARRIVAL_QR_PREFIX.length)
    : normalized;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    candidate
  )
    ? candidate.toLowerCase()
    : null;
}

export function isReceptionRomeCity(city: string | null | undefined): boolean {
  const normalizedCity = (city ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  return normalizedCity === "roma" || normalizedCity === "rome";
}

export function resolveReceptionGroupName(input: {
  group: string | null | undefined;
  city: string | null | undefined;
}): string {

  if (isReceptionRomeCity(input.city)) {
    return "Roma";
  }

  return input.group?.trim() || "-";
}

export function isReceptionRomeSubgroupContact(input: {
  profileRoma: boolean | null | undefined;
  linkedGroupIds: string[];
  romeGroupIds: ReadonlySet<string>;
}): boolean {
  return (
    input.profileRoma === true ||
    (input.linkedGroupIds.length > 0 &&
      input.linkedGroupIds.every((groupId) => input.romeGroupIds.has(groupId)))
  );
}

export function resolveArrivalAccommodationType(input: {
  accommodation: string | null | undefined;
  accommodationShort: string | null | undefined;
  registrationType: string | null | undefined;
  operatorAccommodationPreference: string | null | undefined;
}): ArrivalAccommodationType {
  if (
    isAutonomousAccommodation(input.accommodationShort) ||
    isAutonomousAccommodation(input.accommodation)
  ) {
    return "Autonomo";
  }

  if (
    isOperatorRegistrationType(input.registrationType) &&
    normalizeOperatorAccommodationPreference(input.operatorAccommodationPreference) ===
      "Hotel"
  ) {
    return "Hotel";
  }

  return "Ostello";
}

export function buildArrivalGroupSummary(
  participants: ReadonlyArray<{
    group: string;
    arrivedAt: string | null;
  }>
): ArrivalGroupSummaryRow[] {
  const rows = new Map<string, ArrivalGroupSummaryRow>();

  for (const participant of participants) {
    const group = participant.group.trim() || "-";
    const row = rows.get(group) ?? {
      group,
      arrived: 0,
      notArrived: 0,
      total: 0,
    };

    row.total += 1;
    if (participant.arrivedAt) row.arrived += 1;
    else row.notArrived += 1;
    rows.set(group, row);
  }

  return [...rows.values()].sort((a, b) => {
    if (a.group === "-") return 1;
    if (b.group === "-") return -1;
    return a.group.localeCompare(b.group);
  });
}

export function buildReceptionGroupHostelRows(
  participants: ReadonlyArray<
    Pick<ArrivalParticipant, "group" | "accommodationType" | "accommodationLocation">
  >
): ReceptionGroupHostelRow[] {
  const rows = new Map<
    string,
    {
      hostelCounts: Map<string, number>;
      unassignedCount: number;
      hostelParticipantCount: number;
    }
  >();

  for (const participant of participants) {
    const group = participant.group.trim() || "-";
    const row = rows.get(group) ?? {
      hostelCounts: new Map<string, number>(),
      unassignedCount: 0,
      hostelParticipantCount: 0,
    };

    if (participant.accommodationType === "Ostello") {
      row.hostelParticipantCount += 1;
      const hostel = participant.accommodationLocation?.trim();
      if (hostel) {
        row.hostelCounts.set(hostel, (row.hostelCounts.get(hostel) ?? 0) + 1);
      } else {
        row.unassignedCount += 1;
      }
    }

    rows.set(group, row);
  }

  return [...rows.entries()]
    .map(([group, row]) => {
      const hostels = [...row.hostelCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      return {
        group,
        hostels,
        assignedCount: hostels.reduce((sum, hostel) => sum + hostel.count, 0),
        unassignedCount: row.unassignedCount,
        hostelParticipantCount: row.hostelParticipantCount,
      };
    })
    .sort((a, b) => {
      if (a.group === "-") return 1;
      if (b.group === "-") return -1;
      return a.group.localeCompare(b.group);
    });
}

export function buildReceptionHostelArrivalDayRows(
  participants: ReadonlyArray<
    Pick<
      ArrivalParticipant,
      "arrivalDate" | "accommodationType" | "accommodationLocation"
    >
  >
): ReceptionHostelArrivalDayRow[] {
  const rows = new Map<
    string,
    {
      arrivalDate: string | null;
      hostelCounts: Map<string, number>;
      unassignedCount: number;
      total: number;
    }
  >();

  for (const participant of participants) {
    if (participant.accommodationType !== "Ostello") continue;

    const arrivalDate = participant.arrivalDate?.trim() || null;
    const key = arrivalDate ?? "__missing_date__";
    const row = rows.get(key) ?? {
      arrivalDate,
      hostelCounts: new Map<string, number>(),
      unassignedCount: 0,
      total: 0,
    };
    row.total += 1;

    const hostel = participant.accommodationLocation?.trim();
    if (hostel) {
      row.hostelCounts.set(hostel, (row.hostelCounts.get(hostel) ?? 0) + 1);
    } else {
      row.unassignedCount += 1;
    }
    rows.set(key, row);
  }

  return [...rows.values()]
    .map((row) => {
      const hostels = [...row.hostelCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

      return {
        arrivalDate: row.arrivalDate,
        hostels,
        assignedCount: hostels.reduce((sum, hostel) => sum + hostel.count, 0),
        unassignedCount: row.unassignedCount,
        total: row.total,
      };
    })
    .sort((a, b) => {
      if (!a.arrivalDate) return 1;
      if (!b.arrivalDate) return -1;
      return a.arrivalDate.localeCompare(b.arrivalDate);
    });
}
