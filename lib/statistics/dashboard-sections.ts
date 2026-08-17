export const STATISTICS_SECTION_KEYS = [
  "registrations",
  "trend",
  "daily-presence",
  "event-arrivals",
  "hostel-check-in",
  "operator-accommodation",
  "staff-availability",
  "accessibility",
  "food-needs",
  "duplicates",
] as const;

export type StatisticsSectionKey = (typeof STATISTICS_SECTION_KEYS)[number];

export const STATISTICS_SECTION_GROUPS = [
  {
    key: "participation",
    sections: ["registrations", "trend", "daily-presence"],
  },
  {
    key: "operations",
    sections: ["event-arrivals", "hostel-check-in", "operator-accommodation"],
  },
  {
    key: "needs",
    sections: ["staff-availability", "accessibility", "food-needs"],
  },
  {
    key: "quality",
    sections: ["duplicates"],
  },
] as const satisfies ReadonlyArray<{
  key: string;
  sections: readonly StatisticsSectionKey[];
}>;

export function parseStatisticsSection(
  value: string | string[] | null | undefined
): StatisticsSectionKey {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (candidate === "overview") {
    return "registrations";
  }

  return STATISTICS_SECTION_KEYS.includes(candidate as StatisticsSectionKey)
    ? (candidate as StatisticsSectionKey)
    : "registrations";
}
