import type {
  AccommodationGroupSummary,
  AccommodationGroupSummaryStatus,
} from "./group-allocations.ts";
import type { AccommodationRoom } from "./inventory.ts";

export type AccommodationGroupStatusTone =
  | "neutral"
  | "warning"
  | "success"
  | "info";

export function getAccommodationGroupStatusTone(
  status: AccommodationGroupSummaryStatus
): AccommodationGroupStatusTone {
  switch (status) {
    case "under_allocated":
      return "warning";
    case "exactly_allocated":
      return "success";
    case "over_allocated":
      return "info";
    case "unassigned":
    default:
      return "neutral";
  }
}

export function getAccommodationGroupStatusRank(
  status: AccommodationGroupSummaryStatus
): number {
  switch (status) {
    case "under_allocated":
      return 0;
    case "unassigned":
      return 1;
    case "over_allocated":
      return 2;
    case "exactly_allocated":
    default:
      return 3;
  }
}

export function matchesAccommodationGroupSearch(
  summary: AccommodationGroupSummary,
  searchTerm: string
): boolean {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;

  const haystack = [summary.groupName, summary.groupId]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
}

export function sortAccommodationGroupSummaries(
  summaries: AccommodationGroupSummary[]
): AccommodationGroupSummary[] {
  return [...summaries].sort((a, b) => {
    const byStatus =
      getAccommodationGroupStatusRank(a.status) -
      getAccommodationGroupStatusRank(b.status);
    if (byStatus !== 0) return byStatus;

    const byWarnings = b.warnings.length - a.warnings.length;
    if (byWarnings !== 0) return byWarnings;

    const byNeed = b.needsAccommodationCount - a.needsAccommodationCount;
    if (byNeed !== 0) return byNeed;

    return a.groupName.localeCompare(b.groupName);
  });
}

export function buildAccommodationRoomOptionLabel(room: AccommodationRoom): string {
  const parts = [room.internalCode, room.hotel?.name ?? ""].filter(Boolean);

  const suffix =
    room.assignedGroupCount > 0
      ? ` · ${room.assignedGroupCount} group${room.assignedGroupCount === 1 ? "" : "s"}`
      : "";

  return `${parts.join(" · ")}${suffix}`;
}
