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
