import {
  DIFFICOLTA_ACCESSIBILITA_OPTIONS,
  parseStoredDifficoltaAccessibilita,
} from "../partecipante/constants.ts";

export const ACCESSIBILITY_FILTERS = [
  "seeing",
  "hearing",
  "walking",
  "self_care",
  "concentration",
  "communicating",
  "wheelchair",
  "accessible_accommodation",
  "assistance",
] as const;

export type AccessibilityFilter = (typeof ACCESSIBILITY_FILTERS)[number];

export type AccessibilityParticipantRow = {
  disabilita_accessibilita?: boolean | null;
  difficolta_accessibilita?: string | null;
};

export const ACCESSIBILITY_OPTION_BY_FILTER: Record<
  AccessibilityFilter,
  (typeof DIFFICOLTA_ACCESSIBILITA_OPTIONS)[number]
> = {
  seeing: DIFFICOLTA_ACCESSIBILITA_OPTIONS[0],
  hearing: DIFFICOLTA_ACCESSIBILITA_OPTIONS[1],
  walking: DIFFICOLTA_ACCESSIBILITA_OPTIONS[2],
  self_care: DIFFICOLTA_ACCESSIBILITA_OPTIONS[3],
  concentration: DIFFICOLTA_ACCESSIBILITA_OPTIONS[4],
  communicating: DIFFICOLTA_ACCESSIBILITA_OPTIONS[5],
  wheelchair: DIFFICOLTA_ACCESSIBILITA_OPTIONS[6],
  accessible_accommodation: DIFFICOLTA_ACCESSIBILITA_OPTIONS[7],
  assistance: DIFFICOLTA_ACCESSIBILITA_OPTIONS[8],
};

const accessibilityFilterSet = new Set<string>(ACCESSIBILITY_FILTERS);

export function parseAccessibilityFilter(
  value: string | null | undefined,
): AccessibilityFilter | null {
  const normalized = (value ?? "").trim();
  return accessibilityFilterSet.has(normalized)
    ? (normalized as AccessibilityFilter)
    : null;
}

export function hasAccessibilityDeclaration(
  row: AccessibilityParticipantRow,
): boolean {
  return Boolean(
    row.disabilita_accessibilita || row.difficolta_accessibilita?.trim(),
  );
}

export function matchesAccessibilityFilter(
  row: AccessibilityParticipantRow,
  filter: AccessibilityFilter,
): boolean {
  return parseStoredDifficoltaAccessibilita(
    row.difficolta_accessibilita,
  ).includes(ACCESSIBILITY_OPTION_BY_FILTER[filter]);
}

export function buildAccessibilitySummary(
  rows: AccessibilityParticipantRow[],
): Record<AccessibilityFilter, number> {
  const summary = Object.fromEntries(
    ACCESSIBILITY_FILTERS.map((filter) => [filter, 0]),
  ) as Record<AccessibilityFilter, number>;

  for (const row of rows) {
    for (const filter of ACCESSIBILITY_FILTERS) {
      if (matchesAccessibilityFilter(row, filter)) summary[filter] += 1;
    }
  }

  return summary;
}

export function describeAccessibility(
  row: AccessibilityParticipantRow,
): string {
  const selections = parseStoredDifficoltaAccessibilita(
    row.difficolta_accessibilita,
  );
  if (selections.length > 0) return selections.join("; ");
  return row.difficolta_accessibilita?.trim() || "Accessibility need indicated";
}
