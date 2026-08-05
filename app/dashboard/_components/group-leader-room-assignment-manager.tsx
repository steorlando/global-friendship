"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { AccommodationRoom, RoomGenderPolicy } from "@/lib/alloggi/inventory";
import type {
  GroupLeaderParticipant,
  GroupLeaderParticipantRoomAssignment,
  GroupLeaderNonRoomParticipant,
  GroupLeaderRoomAssignmentGroup,
  GroupLeaderRoomAssignmentWarning,
  GroupLeaderVisibleRoomOccupant,
} from "@/lib/capogruppo/room-assignments";
import {
  buildGroupLeaderRoomOptionLabel,
  formatGroupLeaderRoomAvailability,
  matchesGroupLeaderParticipantSearch,
  matchesGroupLeaderRoomOccupantSearch,
} from "@/lib/capogruppo/room-assignment-presentation";

type RoomScope = {
  groupId: string;
  roomId: string;
};

const ALL_GROUPS_ID = "__all_groups__";
const ALL_HOSTELS_ID = "__all_hostels__";

type RoomAssignmentResponse = {
  groups?: GroupLeaderRoomAssignmentGroup[];
  showGroupColumn?: boolean;
  canAssignAcrossGroups?: boolean;
  participants?: GroupLeaderParticipant[];
  rooms?: AccommodationRoom[];
  roomScopes?: RoomScope[];
  assignments?: GroupLeaderParticipantRoomAssignment[];
  roomOccupants?: GroupLeaderVisibleRoomOccupant[];
  nonRoomParticipants?: GroupLeaderNonRoomParticipant[];
  error?: string;
};

type RoomAssignmentMutationResponse = {
  ok?: boolean;
  assignment?: GroupLeaderParticipantRoomAssignment | null;
  warnings?: GroupLeaderRoomAssignmentWarning[];
  error?: string;
};

type RowFeedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

function buildSexLabel(
  sex: string | null,
  sexCategory: GroupLeaderParticipant["sexCategory"],
  t: (key: string) => string
): string {
  if (sexCategory === "male") return t("groupLeader.roomAssignment.sex.male");
  if (sexCategory === "female") return t("groupLeader.roomAssignment.sex.female");
  return sex?.trim() || t("groupLeader.roomAssignment.sex.unknown");
}

function buildPolicyLabel(policy: RoomGenderPolicy, t: (key: string) => string): string {
  return t(`accommodation.inventory.policy.${policy}`);
}

function buildParticipantAvatarClassName(
  sexCategory: GroupLeaderParticipant["sexCategory"]
): string {
  if (sexCategory === "male") {
    return "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200";
  }
  if (sexCategory === "female") {
    return "bg-pink-100 text-pink-800 ring-1 ring-inset ring-pink-200";
  }
  return "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200";
}

function participantBelongsToGroup(participant: GroupLeaderParticipant, groupId: string): boolean {
  return participant.groupId === groupId || participant.groupLabel === groupId;
}

function buildParticipantName(participant: {
  firstName: string | null;
  lastName: string | null;
  email?: string | null;
}): string {
  return (
    [participant.firstName, participant.lastName].filter(Boolean).join(" ").trim() ||
    participant.email ||
    "-"
  );
}

function buildParticipantInitials(participant: {
  firstName: string | null;
  lastName: string | null;
}): string {
  const parts = [participant.firstName, participant.lastName]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim());

  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((value) => value.charAt(0).toLocaleUpperCase())
    .join("");
}

export type GroupLeaderRoomAssignmentManagerProps = {
  apiBasePath?: string;
  showHostelFilter?: boolean;
};

export function GroupLeaderRoomAssignmentManager({
  apiBasePath = "/api/capogruppo/room-assignments",
  showHostelFilter = false,
}: GroupLeaderRoomAssignmentManagerProps = {}) {
  const { t, formatNumber, formatDate } = useI18n();
  const [groups, setGroups] = useState<GroupLeaderRoomAssignmentGroup[]>([]);
  const [participants, setParticipants] = useState<GroupLeaderParticipant[]>([]);
  const [rooms, setRooms] = useState<AccommodationRoom[]>([]);
  const [roomScopes, setRoomScopes] = useState<RoomScope[]>([]);
  const [assignments, setAssignments] = useState<GroupLeaderParticipantRoomAssignment[]>([]);
  const [roomOccupants, setRoomOccupants] = useState<GroupLeaderVisibleRoomOccupant[]>([]);
  const [nonRoomParticipants, setNonRoomParticipants] = useState<
    GroupLeaderNonRoomParticipant[]
  >([]);
  const [showGroupColumn, setShowGroupColumn] = useState(false);
  const [canAssignAcrossGroups, setCanAssignAcrossGroups] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedHostelId, setSelectedHostelId] = useState(ALL_HOSTELS_ID);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingParticipantId, setSavingParticipantId] = useState<string | null>(null);
  const [rowFeedback, setRowFeedback] = useState<Record<string, RowFeedback>>({});
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const hasSearch = deferredSearchTerm.trim().length > 0;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(apiBasePath, {
        cache: "no-store",
      });
      const json = (await response.json()) as RoomAssignmentResponse;

      if (!response.ok) {
        throw new Error(json.error || t("groupLeader.roomAssignment.status.loadError"));
      }

      const nextGroups = json.groups ?? [];
      const nextParticipants = json.participants ?? [];
      const nextRooms = json.rooms ?? [];
      const nextRoomScopes = json.roomScopes ?? [];
      const nextAssignments = json.assignments ?? [];
      const nextRoomOccupants = json.roomOccupants ?? [];
      const nextNonRoomParticipants = json.nonRoomParticipants ?? [];

      setGroups(nextGroups);
      setParticipants(nextParticipants);
      setRooms(nextRooms);
      setRoomScopes(nextRoomScopes);
      setAssignments(nextAssignments);
      setRoomOccupants(nextRoomOccupants);
      setNonRoomParticipants(nextNonRoomParticipants);
      setShowGroupColumn(Boolean(json.showGroupColumn));
      setCanAssignAcrossGroups(Boolean(json.canAssignAcrossGroups));
      setSelectedGroupId((current) => {
        const currentIsValid =
          (current === ALL_GROUPS_ID && nextGroups.length > 1) ||
          nextGroups.some((group) => group.id === current);

        if (currentIsValid) return current;
        return nextGroups.length > 1 ? ALL_GROUPS_ID : (nextGroups[0]?.id ?? "");
      });
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const isCombinedView = selectedGroupId === ALL_GROUPS_ID;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  const participantsForSelectedGroup = useMemo(() => {
    return participants
      .filter((participant) =>
        isCombinedView
          ? true
          : selectedGroupId
            ? participantBelongsToGroup(participant, selectedGroupId)
            : false
      )
      .sort((a, b) => {
        const bySurname = (a.lastName ?? "").localeCompare(b.lastName ?? "");
        if (bySurname !== 0) return bySurname;
        return (a.firstName ?? "").localeCompare(b.firstName ?? "");
      });
  }, [isCombinedView, participants, selectedGroupId]);

  const matchingParticipantIds = useMemo(
    () =>
      new Set(
        participantsForSelectedGroup
          .filter((participant) =>
            matchesGroupLeaderParticipantSearch(participant, deferredSearchTerm)
          )
          .map((participant) => participant.id)
      ),
    [deferredSearchTerm, participantsForSelectedGroup]
  );

  const nonRoomParticipantsForSelectedGroup = useMemo(() => {
    return nonRoomParticipants
      .filter((participant) =>
        isCombinedView
          ? true
          : selectedGroupId
            ? participantBelongsToGroup(participant, selectedGroupId)
            : false
      )
      .sort((a, b) => {
        const bySurname = (a.lastName ?? "").localeCompare(b.lastName ?? "");
        if (bySurname !== 0) return bySurname;
        return (a.firstName ?? "").localeCompare(b.firstName ?? "");
      });
  }, [isCombinedView, nonRoomParticipants, selectedGroupId]);

  const matchingNonRoomParticipantIds = useMemo(
    () =>
      new Set(
        nonRoomParticipantsForSelectedGroup
          .filter((participant) =>
            matchesGroupLeaderParticipantSearch(participant, deferredSearchTerm)
          )
          .map((participant) => participant.id)
      ),
    [deferredSearchTerm, nonRoomParticipantsForSelectedGroup]
  );

  const visibleNonRoomParticipants = useMemo(
    () =>
      nonRoomParticipantsForSelectedGroup.filter((participant) =>
        matchingNonRoomParticipantIds.has(participant.id)
      ),
    [matchingNonRoomParticipantIds, nonRoomParticipantsForSelectedGroup]
  );

  const matchingRoomOccupantIds = useMemo(
    () =>
      new Set(
        roomOccupants
          .filter((occupant) =>
            matchesGroupLeaderRoomOccupantSearch(occupant, deferredSearchTerm)
          )
          .map((occupant) => occupant.participantId)
      ),
    [deferredSearchTerm, roomOccupants]
  );

  const scopedRoomIds = useMemo(
    () =>
      new Set(
        canAssignAcrossGroups
          ? rooms.map((room) => room.id)
          : roomScopes
              .filter((scope) => isCombinedView || scope.groupId === selectedGroupId)
              .map((scope) => scope.roomId)
      ),
    [canAssignAcrossGroups, isCombinedView, roomScopes, rooms, selectedGroupId]
  );

  const hostelsForSelectedGroup = useMemo(() => {
    const hostelsById = new Map<string, string>();

    for (const room of rooms) {
      if (!scopedRoomIds.has(room.id)) continue;
      hostelsById.set(room.hotelId, room.hotel?.name?.trim() || room.hotelId);
    }

    return [...hostelsById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rooms, scopedRoomIds]);

  const selectedHostelIsAvailable = hostelsForSelectedGroup.some(
    (hostel) => hostel.id === selectedHostelId
  );
  const activeHostelId =
    showHostelFilter &&
    (selectedHostelId === ALL_HOSTELS_ID || selectedHostelIsAvailable)
      ? selectedHostelId
      : ALL_HOSTELS_ID;

  const roomsForSelectedGroup = useMemo(
    () =>
      rooms
        .filter(
          (room) =>
            scopedRoomIds.has(room.id) &&
            (activeHostelId === ALL_HOSTELS_ID || room.hotelId === activeHostelId)
        )
        .sort((a, b) =>
          buildGroupLeaderRoomOptionLabel(a).localeCompare(buildGroupLeaderRoomOptionLabel(b))
        ),
    [activeHostelId, rooms, scopedRoomIds]
  );

  const assignmentByParticipantId = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.participantId, assignment])),
    [assignments]
  );

  const roomOccupantsByRoomId = useMemo(() => {
    const occupants = new Map<string, GroupLeaderVisibleRoomOccupant[]>();

    for (const occupant of roomOccupants) {
      const visibleRoomOccupants = occupants.get(occupant.roomId) ?? [];
      visibleRoomOccupants.push(occupant);
      occupants.set(occupant.roomId, visibleRoomOccupants);
    }

    return occupants;
  }, [roomOccupants]);

  const roomsByParticipantId = useMemo(() => {
    const scopedRoomIdsByGroupId = new Map<string, Set<string>>();
    for (const scope of roomScopes) {
      const groupRoomIds = scopedRoomIdsByGroupId.get(scope.groupId) ?? new Set<string>();
      groupRoomIds.add(scope.roomId);
      scopedRoomIdsByGroupId.set(scope.groupId, groupRoomIds);
    }

    return new Map(
      participantsForSelectedGroup.map((participant) => {
        const participantGroup = groups.find((group) =>
          participantBelongsToGroup(participant, group.id)
        );
        const participantRoomIds = participantGroup
          ? scopedRoomIdsByGroupId.get(participantGroup.id)
          : undefined;

        return [
          participant.id,
          canAssignAcrossGroups
            ? roomsForSelectedGroup
            : participantRoomIds
            ? roomsForSelectedGroup.filter((room) => participantRoomIds.has(room.id))
            : [],
        ];
      })
    );
  }, [
    canAssignAcrossGroups,
    groups,
    participantsForSelectedGroup,
    roomScopes,
    roomsForSelectedGroup,
  ]);

  const roomsForDisplay = useMemo(() => {
    if (!hasSearch) return roomsForSelectedGroup;

    return [...roomsForSelectedGroup].sort((a, b) => {
      const roomAHasMatch = (roomOccupantsByRoomId.get(a.id) ?? []).some((participant) =>
        matchingRoomOccupantIds.has(participant.participantId)
      );
      const roomBHasMatch = (roomOccupantsByRoomId.get(b.id) ?? []).some((participant) =>
        matchingRoomOccupantIds.has(participant.participantId)
      );

      return Number(roomBHasMatch) - Number(roomAHasMatch);
    });
  }, [hasSearch, matchingRoomOccupantIds, roomOccupantsByRoomId, roomsForSelectedGroup]);

  const unassignedParticipants = useMemo(
    () =>
      participantsForSelectedGroup.filter(
        (participant) =>
          !assignmentByParticipantId.has(participant.id) &&
          (activeHostelId === ALL_HOSTELS_ID ||
            (roomsByParticipantId.get(participant.id)?.length ?? 0) > 0) &&
          matchingParticipantIds.has(participant.id)
      ),
    [
      assignmentByParticipantId,
      matchingParticipantIds,
      participantsForSelectedGroup,
      roomsByParticipantId,
      activeHostelId,
    ]
  );

  const visibleRoomIds = useMemo(
    () => new Set(roomsForSelectedGroup.map((room) => room.id)),
    [roomsForSelectedGroup]
  );
  const assignedCount = participantsForSelectedGroup.filter((participant) => {
    const assignment = assignmentByParticipantId.get(participant.id);
    return assignment ? visibleRoomIds.has(assignment.roomId) : false;
  }).length;
  const unassignedCount = participantsForSelectedGroup.filter(
    (participant) =>
      !assignmentByParticipantId.has(participant.id) &&
      (activeHostelId === ALL_HOSTELS_ID ||
        (roomsByParticipantId.get(participant.id)?.length ?? 0) > 0)
  ).length;
  const matchingVisibleRoomOccupantIds = useMemo(
    () =>
      new Set(
        roomOccupants
          .filter(
            (occupant) =>
              visibleRoomIds.has(occupant.roomId) &&
              matchingRoomOccupantIds.has(occupant.participantId)
          )
          .map((occupant) => occupant.participantId)
      ),
    [matchingRoomOccupantIds, roomOccupants, visibleRoomIds]
  );
  const matchingSearchResultIds = useMemo(
    () =>
      new Set([
        ...unassignedParticipants.map((participant) => participant.id),
        ...matchingVisibleRoomOccupantIds,
        ...matchingNonRoomParticipantIds,
      ]),
    [matchingNonRoomParticipantIds, matchingVisibleRoomOccupantIds, unassignedParticipants]
  );

  async function handleAssignmentChange(participantId: string, nextRoomId: string) {
    setSavingParticipantId(participantId);
    setError(null);
    setRowFeedback((current) => {
      const next = { ...current };
      delete next[participantId];
      return next;
    });

    try {
      const response = await fetch(apiBasePath, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          roomId: nextRoomId || null,
        }),
      });

      const json = (await response.json()) as RoomAssignmentMutationResponse;
      if (!response.ok) {
        throw new Error(json.error || t("groupLeader.roomAssignment.status.saveError"));
      }

      await loadData();
      setRowFeedback((current) => ({
        ...current,
        [participantId]:
          json.warnings && json.warnings.length > 0
            ? {
                tone: "warning",
                message: json.warnings.map((warning) => warning.message).join(" "),
              }
            : {
                tone: "success",
                message: nextRoomId
                  ? t("groupLeader.roomAssignment.status.saved")
                  : t("groupLeader.roomAssignment.status.unassigned"),
              },
      }));
    } catch (saveError) {
      setRowFeedback((current) => ({
        ...current,
        [participantId]: {
          tone: "error",
          message: (saveError as Error).message,
        },
      }));
    } finally {
      setSavingParticipantId(null);
    }
  }

  function renderFeedback(participantId: string) {
    const feedback = rowFeedback[participantId];
    if (!feedback) return null;

    return (
      <p
        role={feedback.tone === "error" ? "alert" : "status"}
        className={`mt-2 text-xs ${
          feedback.tone === "error"
            ? "text-red-700"
            : feedback.tone === "warning"
              ? "text-amber-700"
              : "text-emerald-700"
        }`}
      >
        {feedback.message}
      </p>
    );
  }

  return (
    <section className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div
          className={`grid gap-5 xl:items-end ${
            showHostelFilter
              ? "xl:grid-cols-[minmax(12rem,16rem)_minmax(12rem,16rem)_minmax(16rem,1fr)_auto]"
              : "xl:grid-cols-[minmax(14rem,18rem)_minmax(18rem,1fr)_auto]"
          }`}
        >
          <label className="block text-sm font-medium text-slate-700">
            {t("groupLeader.roomAssignment.filters.group")}
            <select
              data-testid="group-room-view-filter"
              value={selectedGroupId}
              onChange={(event) => {
                setSelectedGroupId(event.target.value);
                setSelectedHostelId(ALL_HOSTELS_ID);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
            >
              {groups.length > 1 ? (
                <option value={ALL_GROUPS_ID}>
                  {t("groupLeader.roomAssignment.filters.allGroups", {
                    count: formatNumber(groups.length),
                  })}
                </option>
              ) : null}
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          {showHostelFilter ? (
            <label className="block text-sm font-medium text-slate-700">
              {t("groupLeader.roomAssignment.filters.hostel")}
              <select
                data-testid="hostel-room-view-filter"
                value={activeHostelId}
                onChange={(event) => setSelectedHostelId(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              >
                <option value={ALL_HOSTELS_ID}>
                  {t("groupLeader.roomAssignment.filters.allHostels", {
                    count: formatNumber(hostelsForSelectedGroup.length),
                  })}
                </option>
                {hostelsForSelectedGroup.map((hostel) => (
                  <option key={hostel.id} value={hostel.id}>
                    {hostel.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block text-sm font-medium text-slate-700">
            {t("groupLeader.roomAssignment.filters.search")}
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
              placeholder={t("groupLeader.roomAssignment.filters.searchPlaceholder")}
            />
          </label>

          <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label={t("groupLeader.roomAssignment.summary.title")}>
            <article className="rounded-lg bg-slate-100 px-3 py-2.5 text-center">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                {t("groupLeader.roomAssignment.summary.rooms")}
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {formatNumber(roomsForSelectedGroup.length)}
              </p>
            </article>
            <article className="rounded-lg bg-emerald-50 px-3 py-2.5 text-center">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-700">
                {t("groupLeader.roomAssignment.summary.assigned")}
              </p>
              <p className="mt-1 text-xl font-bold text-emerald-900">
                {formatNumber(assignedCount)}
              </p>
            </article>
            <article className="rounded-lg bg-amber-50 px-3 py-2.5 text-center">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-amber-700">
                {t("groupLeader.roomAssignment.summary.unassigned")}
              </p>
              <p className="mt-1 text-xl font-bold text-amber-900">
                {formatNumber(unassignedCount)}
              </p>
            </article>
          </div>
        </div>

        {hasSearch ? (
          <p className="mt-3 text-sm text-slate-500" aria-live="polite">
            {t("groupLeader.roomAssignment.filters.searchResults", {
              count: formatNumber(matchingSearchResultIds.size),
            })}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            {t("groupLeader.roomAssignment.rooms.mapTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isCombinedView
              ? t("groupLeader.roomAssignment.rooms.combinedMapSubtitle", {
                  count: formatNumber(groups.length),
                })
              : selectedGroup?.name
              ? t("groupLeader.roomAssignment.rooms.mapSubtitle", {
                  group: selectedGroup.name,
                })
              : t("groupLeader.roomAssignment.rooms.empty")}
          </p>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">{t("common.loading")}</p>
        ) : roomsForDisplay.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
            {t("groupLeader.roomAssignment.rooms.empty")}
          </p>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {roomsForDisplay.map((room) => {
              const roomOccupants = roomOccupantsByRoomId.get(room.id) ?? [];
              const totalOccupancy = Math.max(room.assignedParticipantCount, roomOccupants.length);
              const occupancyPercentage = Math.min(
                100,
                room.capacity > 0 ? (totalOccupancy / room.capacity) * 100 : 0
              );
              const hasMatchingOccupant =
                hasSearch &&
                roomOccupants.some((participant) =>
                  matchingRoomOccupantIds.has(participant.participantId)
                );

              return (
                <article
                  key={room.id}
                  data-testid="room-card"
                  data-room-id={room.id}
                  data-hostel-id={room.hotelId}
                  className={`overflow-hidden rounded-xl border bg-white ${
                    hasMatchingOccupant
                      ? "border-indigo-400 ring-2 ring-indigo-100"
                      : "border-slate-200"
                  }`}
                >
                  <div className="border-b border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-bold text-slate-900">{room.internalCode}</h3>
                          {hasMatchingOccupant ? (
                            <span className="rounded-full bg-indigo-100 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-indigo-700">
                              {t("groupLeader.roomAssignment.rooms.searchMatch")}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-slate-600">
                          {room.hotel?.name ?? "-"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200">
                        {formatNumber(totalOccupancy)} / {formatNumber(room.capacity)}
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${
                          totalOccupancy >= room.capacity ? "bg-emerald-500" : "bg-indigo-500"
                        }`}
                        style={{ width: `${occupancyPercentage}%` }}
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>
                        {t("groupLeader.roomAssignment.rooms.meta", {
                          capacity: room.capacity,
                          policy: buildPolicyLabel(room.genderPolicy, t),
                        })}
                      </span>
                      <span>
                        {t("groupLeader.roomAssignment.rooms.availability", {
                          dates: formatGroupLeaderRoomAvailability(room),
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        {t("groupLeader.roomAssignment.rooms.occupants")}
                      </h4>
                      <span className="text-xs font-medium text-slate-500">
                        {t("groupLeader.roomAssignment.rooms.visibleOccupancy", {
                          count: formatNumber(roomOccupants.length),
                        })}
                      </span>
                    </div>

                    {roomOccupants.length === 0 ? (
                      <p className="mt-3 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">
                        {t("groupLeader.roomAssignment.rooms.noOccupants")}
                      </p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {roomOccupants.map((participant) => {
                          const participantName = buildParticipantName(participant);
                          const isSearchMatch =
                            hasSearch && matchingRoomOccupantIds.has(participant.participantId);
                          const participantRooms =
                            roomsByParticipantId.get(participant.participantId) ?? [];
                          const participantMeta = [
                            participant.age == null
                              ? null
                              : t("groupLeader.roomAssignment.participants.ageValue", {
                                  age: formatNumber(participant.age),
                                }),
                            buildSexLabel(participant.sex, participant.sexCategory, t),
                          ].filter(Boolean);

                          return (
                            <li
                              key={`${participant.roomId}:${participant.participantId}`}
                              data-testid="room-occupant"
                              data-group={participant.displayGroup}
                              data-manageable={participant.canManage ? "true" : "false"}
                              className={`rounded-lg border p-3 ${
                                isSearchMatch
                                  ? "border-indigo-300 bg-indigo-50"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span
                                  data-testid="participant-avatar"
                                  data-sex-category={participant.sexCategory ?? "unknown"}
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${buildParticipantAvatarClassName(
                                    participant.sexCategory
                                  )}`}
                                >
                                  {buildParticipantInitials(participant)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-slate-900">{participantName}</p>
                                  {isCombinedView || !participant.canManage ? (
                                    <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-800">
                                      {participant.displayGroup}
                                    </span>
                                  ) : null}
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {participantMeta.join(" · ")}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {participant.arrivalDate
                                      ? formatDate(participant.arrivalDate)
                                      : "-"}
                                    {" → "}
                                    {participant.departureDate
                                      ? formatDate(participant.departureDate)
                                      : "-"}
                                  </p>
                                </div>
                              </div>

                              {participant.canManage ? (
                                <>
                                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                    <label
                                      className="sr-only"
                                      htmlFor={`room-${participant.participantId}`}
                                    >
                                      {t("groupLeader.roomAssignment.rooms.moveParticipant", {
                                        name: participantName,
                                      })}
                                    </label>
                                    <select
                                      id={`room-${participant.participantId}`}
                                      value={room.id}
                                      onChange={(event) =>
                                        void handleAssignmentChange(
                                          participant.participantId,
                                          event.target.value
                                        )
                                      }
                                      disabled={savingParticipantId === participant.participantId}
                                      className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {participantRooms.map((availableRoom) => (
                                        <option key={availableRoom.id} value={availableRoom.id}>
                                          {buildGroupLeaderRoomOptionLabel(availableRoom)}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleAssignmentChange(participant.participantId, "")
                                      }
                                      disabled={savingParticipantId === participant.participantId}
                                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {savingParticipantId === participant.participantId
                                        ? t("groupLeader.roomAssignment.participants.saving")
                                        : t("groupLeader.roomAssignment.rooms.remove")}
                                    </button>
                                  </div>
                                  {renderFeedback(participant.participantId)}
                                </>
                              ) : (
                                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <p className="text-xs font-semibold text-slate-700">
                                    {t("groupLeader.roomAssignment.rooms.readOnly")}
                                  </p>
                                  <p className="mt-0.5 text-xs text-slate-500">
                                    {t("groupLeader.roomAssignment.rooms.readOnlyHint")}
                                  </p>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              {t("groupLeader.roomAssignment.participants.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("groupLeader.roomAssignment.participants.unassignedSubtitle")}
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">
            {t("groupLeader.roomAssignment.participants.unassignedCount", {
              count: formatNumber(unassignedCount),
            })}
          </span>
        </div>

        {loading ? (
          <p className="mt-5 text-sm text-slate-500">{t("common.loading")}</p>
        ) : unassignedCount === 0 ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center">
            <p className="font-semibold text-emerald-900">
              {t("groupLeader.roomAssignment.participants.allAssigned")}
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              {t("groupLeader.roomAssignment.participants.allAssignedSubtitle")}
            </p>
          </div>
        ) : unassignedParticipants.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            {t("groupLeader.roomAssignment.participants.noUnassignedSearchResults")}
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-slate-200 rounded-xl border border-slate-200">
            {unassignedParticipants.map((participant) => {
              const participantName = buildParticipantName(participant);
              const participantRooms = roomsByParticipantId.get(participant.id) ?? [];
              const participantMeta = [
                participant.age == null
                  ? null
                  : t("groupLeader.roomAssignment.participants.ageValue", {
                      age: formatNumber(participant.age),
                    }),
                buildSexLabel(participant.sex, participant.sexCategory, t),
              ].filter(Boolean);

              return (
                <li
                  key={participant.id}
                  data-testid="unassigned-participant"
                  data-group={participant.displayGroup}
                  className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,24rem)] lg:items-center"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      data-testid="participant-avatar"
                      data-sex-category={participant.sexCategory ?? "unknown"}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${buildParticipantAvatarClassName(
                        participant.sexCategory
                      )}`}
                    >
                      {buildParticipantInitials(participant)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{participantName}</p>
                      {isCombinedView && showGroupColumn ? (
                        <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-800">
                          {participant.displayGroup}
                        </span>
                      ) : null}
                      <p className="mt-0.5 text-xs text-slate-500">
                        {participantMeta.join(" · ")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {participant.arrivalDate ? formatDate(participant.arrivalDate) : "-"}
                        {" → "}
                        {participant.departureDate ? formatDate(participant.departureDate) : "-"}
                      </p>
                      {participant.sexCategory === null ? (
                        <p className="mt-1 text-xs text-amber-700">
                          {t("groupLeader.roomAssignment.participants.sexNeedsCheck")}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label className="sr-only" htmlFor={`assign-${participant.id}`}>
                      {t("groupLeader.roomAssignment.participants.chooseRoomFor", {
                        name: participantName,
                      })}
                    </label>
                    <select
                      id={`assign-${participant.id}`}
                      value=""
                      onChange={(event) =>
                        void handleAssignmentChange(participant.id, event.target.value)
                      }
                      disabled={savingParticipantId === participant.id}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="" disabled>
                        {savingParticipantId === participant.id
                          ? t("groupLeader.roomAssignment.participants.saving")
                          : t("groupLeader.roomAssignment.participants.chooseRoom")}
                      </option>
                      {participantRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {buildGroupLeaderRoomOptionLabel(room)}
                        </option>
                      ))}
                    </select>
                    {renderFeedback(participant.id)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {nonRoomParticipantsForSelectedGroup.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {t("groupLeader.roomAssignment.nonRoom.title")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t("groupLeader.roomAssignment.nonRoom.subtitle")}
              </p>
            </div>
            <span className="rounded-full bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700">
              {t("groupLeader.roomAssignment.nonRoom.count", {
                count: formatNumber(nonRoomParticipantsForSelectedGroup.length),
              })}
            </span>
          </div>

          {visibleNonRoomParticipants.length === 0 ? (
            <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">
              {t("groupLeader.roomAssignment.nonRoom.noSearchResults")}
            </p>
          ) : (
            <ul className="mt-5 grid gap-3 lg:grid-cols-2">
              {visibleNonRoomParticipants.map((participant) => {
                const participantName = buildParticipantName(participant);
                const participantMeta = [
                  participant.age == null
                    ? null
                    : t("groupLeader.roomAssignment.participants.ageValue", {
                        age: formatNumber(participant.age),
                      }),
                  buildSexLabel(participant.sex, participant.sexCategory, t),
                ].filter(Boolean);

                return (
                  <li
                    key={participant.id}
                    data-testid="non-room-participant"
                    data-group={participant.displayGroup}
                    data-reason={participant.reason}
                    className="rounded-xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        data-testid="participant-avatar"
                        data-sex-category={participant.sexCategory ?? "unknown"}
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${buildParticipantAvatarClassName(
                          participant.sexCategory
                        )}`}
                      >
                        {buildParticipantInitials(participant)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{participantName}</p>
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[0.65rem] font-semibold text-violet-800">
                            {participant.reason === "operator_hotel"
                              ? t("groupLeader.roomAssignment.nonRoom.operatorHotel")
                              : t("groupLeader.roomAssignment.nonRoom.autonomous")}
                          </span>
                        </div>
                        {isCombinedView && showGroupColumn ? (
                          <span className="mt-1 inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] font-semibold text-sky-800">
                            {participant.displayGroup}
                          </span>
                        ) : null}
                        <p className="mt-1 text-xs text-slate-500">
                          {participantMeta.join(" · ")}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {participant.arrivalDate ? formatDate(participant.arrivalDate) : "-"}
                          {" → "}
                          {participant.departureDate
                            ? formatDate(participant.departureDate)
                            : "-"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {t("groupLeader.roomAssignment.nonRoom.readOnly")}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}
    </section>
  );
}
