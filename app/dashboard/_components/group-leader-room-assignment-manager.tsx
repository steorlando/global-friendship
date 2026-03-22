"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { AccommodationRoom, RoomGenderPolicy } from "@/lib/alloggi/inventory";
import type {
  GroupLeaderParticipant,
  GroupLeaderParticipantRoomAssignment,
  GroupLeaderRoomAssignmentGroup,
  GroupLeaderRoomAssignmentWarning,
} from "@/lib/capogruppo/room-assignments";
import {
  buildGroupLeaderRoomOptionLabel,
  formatGroupLeaderRoomAvailability,
  matchesGroupLeaderParticipantSearch,
} from "@/lib/capogruppo/room-assignment-presentation";

type RoomScope = {
  groupId: string;
  roomId: string;
};

type RoomAssignmentResponse = {
  groups?: GroupLeaderRoomAssignmentGroup[];
  showGroupColumn?: boolean;
  participants?: GroupLeaderParticipant[];
  rooms?: AccommodationRoom[];
  roomScopes?: RoomScope[];
  assignments?: GroupLeaderParticipantRoomAssignment[];
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

function participantBelongsToGroup(participant: GroupLeaderParticipant, groupId: string): boolean {
  return participant.groupId === groupId || participant.groupLabel === groupId;
}

export type GroupLeaderRoomAssignmentManagerProps = {
  apiBasePath?: string;
};

export function GroupLeaderRoomAssignmentManager({
  apiBasePath = "/api/capogruppo/room-assignments",
}: GroupLeaderRoomAssignmentManagerProps = {}) {
  const { t, formatNumber, formatDate } = useI18n();
  const [groups, setGroups] = useState<GroupLeaderRoomAssignmentGroup[]>([]);
  const [participants, setParticipants] = useState<GroupLeaderParticipant[]>([]);
  const [rooms, setRooms] = useState<AccommodationRoom[]>([]);
  const [roomScopes, setRoomScopes] = useState<RoomScope[]>([]);
  const [assignments, setAssignments] = useState<GroupLeaderParticipantRoomAssignment[]>([]);
  const [showGroupColumn, setShowGroupColumn] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingParticipantId, setSavingParticipantId] = useState<string | null>(null);
  const [rowFeedback, setRowFeedback] = useState<Record<string, RowFeedback>>({});
  const deferredSearchTerm = useDeferredValue(searchTerm);

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

      setGroups(nextGroups);
      setParticipants(nextParticipants);
      setRooms(nextRooms);
      setRoomScopes(nextRoomScopes);
      setAssignments(nextAssignments);
      setShowGroupColumn(Boolean(json.showGroupColumn));
      setSelectedGroupId((current) =>
        current && nextGroups.some((group) => group.id === current)
          ? current
          : (nextGroups[0]?.id ?? "")
      );
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiBasePath, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;

  const participantsForSelectedGroup = useMemo(() => {
    return participants
      .filter((participant) =>
        selectedGroupId ? participantBelongsToGroup(participant, selectedGroupId) : false
      )
      .filter((participant) => matchesGroupLeaderParticipantSearch(participant, deferredSearchTerm))
      .sort((a, b) => {
        const byAssigned =
          Number(Boolean(assignments.find((item) => item.participantId === b.id))) -
          Number(Boolean(assignments.find((item) => item.participantId === a.id)));
        if (byAssigned !== 0) return byAssigned;

        const bySurname = (a.lastName ?? "").localeCompare(b.lastName ?? "");
        if (bySurname !== 0) return bySurname;
        return (a.firstName ?? "").localeCompare(b.firstName ?? "");
      });
  }, [assignments, deferredSearchTerm, participants, selectedGroupId]);

  const scopedRoomIds = useMemo(
    () =>
      new Set(
        roomScopes
          .filter((scope) => scope.groupId === selectedGroupId)
          .map((scope) => scope.roomId)
      ),
    [roomScopes, selectedGroupId]
  );

  const roomsForSelectedGroup = useMemo(
    () =>
      rooms
        .filter((room) => scopedRoomIds.has(room.id))
        .sort((a, b) =>
          buildGroupLeaderRoomOptionLabel(a).localeCompare(buildGroupLeaderRoomOptionLabel(b))
        ),
    [rooms, scopedRoomIds]
  );

  const assignmentByParticipantId = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.participantId, assignment])),
    [assignments]
  );

  const participantIdsForSelectedGroup = useMemo(
    () => new Set(participantsForSelectedGroup.map((participant) => participant.id)),
    [participantsForSelectedGroup]
  );

  const assignedCount = participantsForSelectedGroup.filter((participant) =>
    assignmentByParticipantId.has(participant.id)
  ).length;
  const unassignedCount = participantsForSelectedGroup.length - assignedCount;

  const assignedOccupancyByRoomId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of assignments) {
      if (!participantIdsForSelectedGroup.has(assignment.participantId)) continue;
      counts.set(assignment.roomId, (counts.get(assignment.roomId) ?? 0) + 1);
    }
    return counts;
  }, [assignments, participantIdsForSelectedGroup]);

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

  return (
    <section className="space-y-6">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("groupLeader.roomAssignment.summary.groups")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(groups.length)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("groupLeader.roomAssignment.summary.rooms")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(roomsForSelectedGroup.length)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("groupLeader.roomAssignment.summary.assigned")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(assignedCount)}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {t("groupLeader.roomAssignment.summary.unassigned")}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {formatNumber(unassignedCount)}
          </p>
        </article>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <label className="block text-sm font-medium text-slate-700">
            {t("groupLeader.roomAssignment.filters.group")}
            <select
              value={selectedGroupId}
              onChange={(event) => setSelectedGroupId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            {t("groupLeader.roomAssignment.filters.search")}
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder={t("groupLeader.roomAssignment.filters.searchPlaceholder")}
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {t("groupLeader.roomAssignment.rooms.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {selectedGroup?.name
                ? t("groupLeader.roomAssignment.rooms.subtitle", {
                    group: selectedGroup.name,
                  })
                : t("groupLeader.roomAssignment.rooms.empty")}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">{t("common.loading")}</p>
        ) : roomsForSelectedGroup.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
            {t("groupLeader.roomAssignment.rooms.empty")}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {roomsForSelectedGroup.map((room) => (
              <article
                key={room.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <p className="font-semibold text-slate-900">{room.internalCode}</p>
                <p className="mt-1 text-sm text-slate-600">{room.hotel?.name ?? "-"}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {t("groupLeader.roomAssignment.rooms.meta", {
                    capacity: room.capacity,
                    policy: buildPolicyLabel(room.genderPolicy, t),
                  })}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t("groupLeader.roomAssignment.rooms.availability", {
                    dates: formatGroupLeaderRoomAvailability(room),
                  })}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {t("groupLeader.roomAssignment.rooms.occupancy", {
                    assigned: assignedOccupancyByRoomId.get(room.id) ?? 0,
                    capacity: room.capacity,
                  })}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {t("groupLeader.roomAssignment.participants.title")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t("groupLeader.roomAssignment.participants.subtitle")}
            </p>
          </div>
          <p className="text-sm text-slate-500">
            {t("groupLeader.roomAssignment.participants.filteredCount", {
              shown: formatNumber(participantsForSelectedGroup.length),
              total: formatNumber(
                participants.filter((participant) =>
                  selectedGroupId ? participantBelongsToGroup(participant, selectedGroupId) : false
                ).length
              ),
            })}
          </p>
        </div>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">{t("common.loading")}</p>
        ) : participantsForSelectedGroup.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            {t("groupLeader.roomAssignment.participants.empty")}
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {showGroupColumn ? (
                    <th className="px-4 py-3 font-semibold">
                      {t("participants.table.header.group")}
                    </th>
                  ) : null}
                  <th className="px-4 py-3 font-semibold">
                    {t("participants.table.header.firstName")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("participants.table.header.lastName")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("groupLeader.roomAssignment.participants.age")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("groupLeader.roomAssignment.participants.sex")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("participants.table.header.arrivalDate")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("participants.table.header.departureDate")}
                  </th>
                  <th className="px-4 py-3 font-semibold">
                    {t("groupLeader.roomAssignment.participants.assignment")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {participantsForSelectedGroup.map((participant) => {
                  const assignment = assignmentByParticipantId.get(participant.id) ?? null;
                  const currentRoomId = assignment?.roomId ?? "";
                  const feedback = rowFeedback[participant.id] ?? null;

                  return (
                    <tr key={participant.id} className="align-top">
                      {showGroupColumn ? (
                        <td className="px-4 py-3 text-slate-700">{participant.displayGroup}</td>
                      ) : null}
                      <td className="px-4 py-3 text-slate-900">{participant.firstName ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-900">{participant.lastName ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {participant.age == null ? "-" : formatNumber(participant.age)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div>{buildSexLabel(participant.sex, participant.sexCategory, t)}</div>
                        {participant.sexCategory === null ? (
                          <div className="mt-1 text-xs text-amber-700">
                            {t("groupLeader.roomAssignment.participants.sexNeedsCheck")}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {participant.arrivalDate
                          ? formatDate(participant.arrivalDate)
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {participant.departureDate
                          ? formatDate(participant.departureDate)
                          : "-"}
                      </td>
                      <td className="min-w-[18rem] px-4 py-3">
                        <select
                          value={currentRoomId}
                          onChange={(event) =>
                            void handleAssignmentChange(participant.id, event.target.value)
                          }
                          disabled={savingParticipantId === participant.id}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <option value="">
                            {t("groupLeader.roomAssignment.participants.unassignedOption")}
                          </option>
                          {roomsForSelectedGroup.map((room) => (
                            <option key={room.id} value={room.id}>
                              {buildGroupLeaderRoomOptionLabel(room)}
                            </option>
                          ))}
                        </select>
                        <p className="mt-2 text-xs text-slate-500">
                          {assignment
                            ? t("groupLeader.roomAssignment.participants.currentRoom", {
                                room:
                                  buildGroupLeaderRoomOptionLabel(
                                    roomsForSelectedGroup.find((room) => room.id === assignment.roomId) ??
                                      rooms.find((room) => room.id === assignment.roomId) ??
                                      {
                                        id: assignment.roomId,
                                        hotelId: "",
                                        hotel: null,
                                        legacyName: assignment.roomId,
                                        internalCode: assignment.roomId,
                                        realRoomNumber: null,
                                        capacity: 0,
                                        genderPolicy: "mixed",
                                        availableFrom: null,
                                        availableTo: null,
                                        createdAt: "",
                                        updatedAt: "",
                                        assignedGroupCount: 0,
                                        assignedParticipantCount: 0,
                                      }
                                  ),
                              })
                            : t("groupLeader.roomAssignment.participants.noRoom")}
                        </p>
                        {feedback ? (
                          <p
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
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
