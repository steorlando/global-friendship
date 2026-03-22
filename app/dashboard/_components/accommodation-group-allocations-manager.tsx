"use client";

import {
  FormEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useI18n } from "@/lib/i18n/provider";
import {
  buildAccommodationRoomOptionLabel,
  getAccommodationGroupStatusTone,
  matchesAccommodationGroupSearch,
  sortAccommodationGroupSummaries,
} from "@/lib/alloggi/group-allocation-presentation";
import type {
  AccommodationGroupSummaryStatus,
  AccommodationGroupSummaryWarning,
} from "@/lib/alloggi/group-allocations";
import type { RoomGenderPolicy } from "@/lib/alloggi/inventory";

type Group = {
  id: string;
  name: string;
};

type Room = {
  id: string;
  hotelId: string;
  hotel: {
    id: string;
    name: string;
    address: string | null;
    googleMapsUrl: string | null;
    createdAt: string;
    roomCount: number;
  } | null;
  legacyName: string;
  internalCode: string;
  realRoomNumber: string | null;
  capacity: number;
  genderPolicy: RoomGenderPolicy;
  availableFrom: string | null;
  availableTo: string | null;
  createdAt: string;
  updatedAt: string;
  assignedGroupCount: number;
  assignedParticipantCount: number;
};

type Allocation = {
  groupId: string;
  roomId: string;
  createdAt: string | null;
  createdBy: string | null;
  room: Room | null;
};

type Summary = {
  groupId: string;
  groupName: string;
  needsAccommodationCount: number;
  maleNeedCount: number;
  femaleNeedCount: number;
  unknownNeedCount: number;
  assignedCapacity: number;
  assignedRoomCount: number;
  status: AccommodationGroupSummaryStatus;
  warnings: AccommodationGroupSummaryWarning[];
  shortageDates: string[];
  maxDailyShortage: number;
  participantsMissingStayDates: number;
  earliestArrival: string | null;
  latestDeparture: string | null;
};

type GroupRoomsResponse = {
  groups?: Group[];
  rooms?: Room[];
  allocations?: Allocation[];
  error?: string;
};

type SummaryResponse = {
  summaries?: Summary[];
  error?: string;
};

type MutationResponse = {
  ok?: boolean;
  allocation?: Allocation;
  groupId?: string;
  roomId?: string;
  error?: string;
};

const STATUS_FILTERS: Array<AccommodationGroupSummaryStatus | "all"> = [
  "all",
  "under_allocated",
  "unassigned",
  "exactly_allocated",
  "over_allocated",
];

function formatRoomAvailability(room: Room) {
  if (room.availableFrom && room.availableTo) {
    return `${room.availableFrom} -> ${room.availableTo}`;
  }
  if (room.availableFrom) {
    return `${room.availableFrom} ->`;
  }
  if (room.availableTo) {
    return `-> ${room.availableTo}`;
  }
  return "-";
}

function buildStatusBadgeClasses(status: AccommodationGroupSummaryStatus): string {
  switch (getAccommodationGroupStatusTone(status)) {
    case "warning":
      return "bg-amber-100 text-amber-800";
    case "success":
      return "bg-emerald-100 text-emerald-800";
    case "info":
      return "bg-sky-100 text-sky-800";
    case "neutral":
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatGroupNeedBreakdown(summary: Summary): string {
  const parts = [`${summary.maleNeedCount} M`, `${summary.femaleNeedCount} F`];
  if (summary.unknownNeedCount > 0) {
    parts.push(`${summary.unknownNeedCount} ?`);
  }
  return parts.join(" - ");
}

function findRoomIdFromQuery(rooms: Room[], query: string): string | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;

  const exactLabelMatch = rooms.find(
    (room) => buildAccommodationRoomOptionLabel(room).toLowerCase() === normalized
  );
  if (exactLabelMatch) return exactLabelMatch.id;

  const exactCodeMatch = rooms.find(
    (room) => room.internalCode.toLowerCase() === normalized
  );
  return exactCodeMatch?.id ?? null;
}

function findRoomById(rooms: Room[], roomId: string): Room | null {
  return rooms.find((room) => room.id === roomId) ?? null;
}

export function AccommodationGroupAllocationsManager() {
  const { t, formatNumber } = useI18n();
  const [groups, setGroups] = useState<Group[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [roomToAssignId, setRoomToAssignId] = useState<string>("");
  const [roomToAssignQuery, setRoomToAssignQuery] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<AccommodationGroupSummaryStatus | "all">(
    "all"
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [removingRoomId, setRemovingRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [groupRoomsRes, summariesRes] = await Promise.all([
        fetch("/api/alloggi/group-rooms", { cache: "no-store" }),
        fetch("/api/alloggi/group-room-summary", { cache: "no-store" }),
      ]);

      const groupRoomsJson = (await groupRoomsRes.json()) as GroupRoomsResponse;
      const summariesJson = (await summariesRes.json()) as SummaryResponse;

      if (!groupRoomsRes.ok) {
        throw new Error(groupRoomsJson.error || t("accommodation.groupAllocations.status.loadError"));
      }
      if (!summariesRes.ok) {
        throw new Error(summariesJson.error || t("accommodation.groupAllocations.status.loadError"));
      }

      const nextGroups = groupRoomsJson.groups ?? [];
      const nextRooms = groupRoomsJson.rooms ?? [];
      const nextAllocations = groupRoomsJson.allocations ?? [];
      const nextSummaries = sortAccommodationGroupSummaries(summariesJson.summaries ?? []);

      setGroups(nextGroups);
      setRooms(nextRooms);
      setAllocations(nextAllocations);
      setSummaries(nextSummaries);
      setSelectedGroupId((current) =>
        current && nextSummaries.some((summary) => summary.groupId === current)
          ? current
          : (nextSummaries[0]?.groupId ?? "")
      );
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const displayedSummaries = useMemo(() => {
    return summaries.filter((summary) => {
      const matchesStatus = statusFilter === "all" || summary.status === statusFilter;
      const matchesSearch = matchesAccommodationGroupSearch(summary, deferredSearchTerm);
      return matchesStatus && matchesSearch;
    });
  }, [deferredSearchTerm, statusFilter, summaries]);

  useEffect(() => {
    if (displayedSummaries.length === 0) return;
    if (displayedSummaries.some((summary) => summary.groupId === selectedGroupId)) return;
    setSelectedGroupId(displayedSummaries[0]?.groupId ?? "");
  }, [displayedSummaries, selectedGroupId]);

  const selectedSummary =
    displayedSummaries.find((summary) => summary.groupId === selectedGroupId) ??
    displayedSummaries[0] ??
    summaries.find((summary) => summary.groupId === selectedGroupId) ??
    null;

  const selectedAllocations = useMemo(
    () =>
      allocations
        .filter((allocation) => allocation.groupId === selectedSummary?.groupId)
        .sort((a, b) =>
          (a.room?.internalCode ?? "").localeCompare(b.room?.internalCode ?? "")
        ),
    [allocations, selectedSummary?.groupId]
  );

  const availableRoomOptions = useMemo(() => {
    const alreadyAssigned = new Set(selectedAllocations.map((allocation) => allocation.roomId));
    return [...rooms]
      .filter((room) => !alreadyAssigned.has(room.id))
      .sort((a, b) => buildAccommodationRoomOptionLabel(a).localeCompare(buildAccommodationRoomOptionLabel(b)));
  }, [rooms, selectedAllocations]);

  const selectedRoomPreviewLabel = useMemo(() => {
    if (!roomToAssignId) return "";
    const selectedRoom =
      findRoomById(availableRoomOptions, roomToAssignId) ??
      findRoomById(rooms, roomToAssignId);
    return selectedRoom ? buildAccommodationRoomOptionLabel(selectedRoom) : roomToAssignId;
  }, [availableRoomOptions, roomToAssignId, rooms]);

  useEffect(() => {
    setRoomToAssignId((current) => {
      if (current && availableRoomOptions.some((room) => room.id === current)) {
        return current;
      }
      return availableRoomOptions[0]?.id ?? "";
    });
    setRoomToAssignQuery("");
  }, [availableRoomOptions]);

  const topCounters = useMemo(() => {
    const groupsWithNeed = summaries.filter((summary) => summary.needsAccommodationCount > 0);
    const warnings = summaries.filter((summary) => summary.warnings.length > 0).length;
    const underAllocated = summaries.filter(
      (summary) => summary.status === "under_allocated" || summary.status === "unassigned"
    ).length;
    return {
      groupCount: groups.length,
      groupsWithNeed: groupsWithNeed.length,
      warningCount: warnings,
      underAllocated,
    };
  }, [groups.length, summaries]);

  function getStatusLabel(status: AccommodationGroupSummaryStatus) {
    return t(`accommodation.groupAllocations.statusLabel.${status}`);
  }

  function formatWarning(warning: AccommodationGroupSummaryWarning) {
    switch (warning.code) {
      case "missing_room_assignments":
        return t("accommodation.groupAllocations.warning.missingRoomAssignments");
      case "nominal_capacity_shortage":
        return t("accommodation.groupAllocations.warning.nominalCapacityShortage", {
          shortage: Number(warning.meta?.shortage ?? 0),
        });
      case "room_shared_across_groups":
        return t("accommodation.groupAllocations.warning.roomSharedAcrossGroups", {
          count: Number(warning.meta?.sharedRoomCount ?? 0),
        });
      case "room_availability_starts_late":
        return t("accommodation.groupAllocations.warning.roomAvailabilityStartsLate", {
          roomDate: String(warning.meta?.earliestRoomAvailableFrom ?? "-"),
          participantDate: String(warning.meta?.earliestArrival ?? "-"),
        });
      case "room_availability_ends_early":
        return t("accommodation.groupAllocations.warning.roomAvailabilityEndsEarly", {
          roomDate: String(warning.meta?.latestRoomAvailableTo ?? "-"),
          participantDate: String(warning.meta?.latestDeparture ?? "-"),
        });
      case "daily_capacity_shortage":
        return t("accommodation.groupAllocations.warning.dailyCapacityShortage", {
          days: Number(warning.meta?.shortageDays ?? 0),
          shortage: Number(warning.meta?.maxDailyShortage ?? 0),
        });
      case "participants_missing_stay_dates":
        return t("accommodation.groupAllocations.warning.participantsMissingStayDates", {
          count: Number(warning.meta?.participantsMissingStayDates ?? 0),
        });
      default:
        return warning.message;
    }
  }

  async function handleAssignRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSummary?.groupId) return;

    const resolvedRoomId =
      roomToAssignId || findRoomIdFromQuery(availableRoomOptions, roomToAssignQuery);
    if (!resolvedRoomId) {
      setError(t("accommodation.groupAllocations.status.selectValidRoom"));
      setSuccess(null);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/alloggi/group-rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedSummary.groupId,
          roomId: resolvedRoomId,
        }),
      });

      const json = (await response.json()) as MutationResponse;
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.groupAllocations.status.saveError"));
      }

      await loadData();
      setSelectedGroupId(selectedSummary.groupId);
      setSuccess(t("accommodation.groupAllocations.status.roomAssigned"));
    } catch (assignError) {
      setError((assignError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnassignRoom(roomId: string) {
    if (!selectedSummary?.groupId) return;
    const confirmed = window.confirm(
      t("accommodation.groupAllocations.actions.unassignConfirm")
    );
    if (!confirmed) return;

    setRemovingRoomId(roomId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/alloggi/group-rooms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedSummary.groupId,
          roomId,
        }),
      });

      const json = (await response.json()) as MutationResponse;
      if (!response.ok) {
        throw new Error(json.error || t("accommodation.groupAllocations.status.deleteError"));
      }

      await loadData();
      setSelectedGroupId(selectedSummary.groupId);
      setSuccess(t("accommodation.groupAllocations.status.roomUnassigned"));
    } catch (unassignError) {
      setError((unassignError as Error).message);
    } finally {
      setRemovingRoomId(null);
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.groupAllocations.summary.groups")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(topCounters.groupCount)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.groupAllocations.summary.withNeed")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(topCounters.groupsWithNeed)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.groupAllocations.summary.actionNeeded")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(topCounters.underAllocated)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("accommodation.groupAllocations.summary.warnings")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(topCounters.warningCount)}
          </p>
        </article>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {t("accommodation.groupAllocations.table.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("accommodation.groupAllocations.table.subtitle")}
              </p>
            </div>
            <p className="text-sm text-slate-500">
              {t("accommodation.groupAllocations.table.filteredCount", {
                shown: displayedSummaries.length,
                total: summaries.length,
              })}
            </p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <label className="block text-sm font-medium text-slate-700">
              {t("accommodation.groupAllocations.filters.search")}
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                placeholder={t("accommodation.groupAllocations.filters.searchPlaceholder")}
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              {t("accommodation.groupAllocations.filters.status")}
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as AccommodationGroupSummaryStatus | "all"
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status === "all"
                      ? t("common.all")
                      : getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-slate-500">{t("common.loading")}</p>
          ) : displayedSummaries.length === 0 ? (
            <p className="mt-6 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              {t("accommodation.groupAllocations.table.empty")}
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">
                      {t("participants.table.header.group")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.groupAllocations.table.need")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.groupAllocations.table.capacity")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.groupAllocations.table.rooms")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.groupAllocations.table.status")}
                    </th>
                    <th className="px-4 py-3 font-semibold">
                      {t("accommodation.groupAllocations.table.warnings")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {displayedSummaries.map((summary) => (
                    <tr
                      key={summary.groupId}
                      className={`cursor-pointer align-top transition hover:bg-slate-50 ${
                        selectedSummary?.groupId === summary.groupId ? "bg-indigo-50/70" : ""
                      }`}
                      onClick={() => setSelectedGroupId(summary.groupId)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{summary.groupName}</p>
                        <p className="mt-1 text-xs text-slate-500">{summary.groupId}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatGroupNeedBreakdown(summary)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatNumber(summary.assignedCapacity)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatNumber(summary.assignedRoomCount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${buildStatusBadgeClasses(summary.status)}`}
                        >
                          {getStatusLabel(summary.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatNumber(summary.warnings.length)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {selectedSummary ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedSummary.groupName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedSummary.groupId}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${buildStatusBadgeClasses(selectedSummary.status)}`}
                >
                  {getStatusLabel(selectedSummary.status)}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("accommodation.groupAllocations.detail.need")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatNumber(selectedSummary.needsAccommodationCount)}
                  </p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("accommodation.groupAllocations.detail.capacity")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatNumber(selectedSummary.assignedCapacity)}
                  </p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("accommodation.groupAllocations.detail.rooms")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatNumber(selectedSummary.assignedRoomCount)}
                  </p>
                </article>
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t("accommodation.groupAllocations.detail.warnings")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {formatNumber(selectedSummary.warnings.length)}
                  </p>
                </article>
              </div>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {t("accommodation.groupAllocations.detail.assignTitle")}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("accommodation.groupAllocations.detail.assignSubtitle")}
                    </p>
                  </div>
                </div>

                {availableRoomOptions.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-500">
                    {t("accommodation.groupAllocations.detail.noAssignableRooms")}
                  </p>
                ) : (
                  <form className="mt-4 space-y-3" onSubmit={handleAssignRoom}>
                    <label className="block text-sm font-medium text-slate-700">
                      {t("accommodation.groupAllocations.detail.roomSelect")}
                      <input
                        list="accommodation-group-room-options"
                        value={roomToAssignQuery}
                        onChange={(event) => {
                          const nextQuery = event.target.value;
                          setRoomToAssignQuery(nextQuery);
                          const matchedRoomId =
                            findRoomIdFromQuery(availableRoomOptions, nextQuery);
                          if (matchedRoomId) {
                            setRoomToAssignId(matchedRoomId);
                          }
                        }}
                        onBlur={() => {
                          window.setTimeout(() => {
                            const matchedRoomId =
                              findRoomIdFromQuery(availableRoomOptions, roomToAssignQuery);
                            if (matchedRoomId) {
                              const matchedRoom = findRoomById(
                                availableRoomOptions,
                                matchedRoomId
                              );
                              setRoomToAssignId(matchedRoomId);
                              if (matchedRoom) {
                                setRoomToAssignQuery("");
                              }
                              return;
                            }

                            setRoomToAssignQuery("");
                          }, 120);
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                        placeholder={t(
                          "accommodation.groupAllocations.detail.roomSelectPlaceholder"
                        )}
                      />
                      <datalist id="accommodation-group-room-options">
                        {availableRoomOptions.map((room) => (
                          <option key={room.id} value={buildAccommodationRoomOptionLabel(room)} />
                        ))}
                      </datalist>
                      {selectedRoomPreviewLabel ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {t("accommodation.groupAllocations.detail.selectedRoom", {
                            room: selectedRoomPreviewLabel,
                          })}
                        </p>
                      ) : null}
                    </label>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving
                        ? t("accommodation.groupAllocations.actions.assigning")
                        : t("accommodation.groupAllocations.actions.assign")}
                    </button>
                  </form>
                )}
              </section>

              <section>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {t("accommodation.groupAllocations.detail.assignedRooms")}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {t("accommodation.groupAllocations.detail.assignedRoomsSubtitle")}
                    </p>
                  </div>
                </div>

                {selectedAllocations.length === 0 ? (
                  <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                    {t("accommodation.groupAllocations.detail.noAssignedRooms")}
                  </p>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {selectedAllocations.map((allocation) => (
                      <li
                        key={`${allocation.groupId}-${allocation.roomId}`}
                        className="rounded-lg border border-slate-200 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-900">
                              {allocation.room?.internalCode ?? allocation.roomId}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {allocation.room?.hotel?.name ?? "-"}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {t("accommodation.groupAllocations.detail.roomMeta", {
                                capacity: allocation.room?.capacity ?? 0,
                                policy: t(
                                  `accommodation.inventory.policy.${allocation.room?.genderPolicy ?? "mixed"}`
                                ),
                              })}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {t("accommodation.groupAllocations.detail.roomAvailability", {
                                dates: allocation.room ? formatRoomAvailability(allocation.room) : "-",
                              })}
                            </p>
                            {allocation.room && allocation.room.assignedGroupCount > 1 ? (
                              <p className="mt-1 text-xs text-amber-700">
                                {t("accommodation.groupAllocations.detail.sharedRoom", {
                                  count: allocation.room.assignedGroupCount,
                                })}
                              </p>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUnassignRoom(allocation.roomId)}
                            disabled={removingRoomId === allocation.roomId}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {removingRoomId === allocation.roomId
                              ? t("accommodation.groupAllocations.actions.removing")
                              : t("accommodation.groupAllocations.actions.unassign")}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  {t("accommodation.groupAllocations.detail.warningTitle")}
                </h3>
                {selectedSummary.warnings.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">
                    {t("accommodation.groupAllocations.detail.noWarnings")}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {selectedSummary.warnings.map((warning) => (
                      <li
                        key={`${selectedSummary.groupId}-${warning.code}`}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                      >
                        {formatWarning(warning)}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {loading
                ? t("common.loading")
                : t("accommodation.groupAllocations.detail.noGroupSelected")}
            </p>
          )}
        </section>
      </div>
    </section>
  );
}
