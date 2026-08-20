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
  filterGroupLeaderRoomsForSelectedGroup,
  formatGroupLeaderRoomAvailability,
  getGroupLeaderRoomBedRowCount,
  getGroupLeaderRoomEarlyArrivalOccupants,
  getGroupLeaderRoomFreeBedCount,
  getGroupLeaderRoomLateDepartureOccupants,
  getGroupLeaderRoomOccupancy,
  getGroupLeaderRoomRequiredAvailableFrom,
  getGroupLeaderRoomRequiredAvailableTo,
  getGroupLeaderRoomShorteningSuggestion,
  getGroupLeaderSharedRooms,
  isGroupLeaderRomeCity,
  matchesGroupLeaderParticipantSearch,
  matchesGroupLeaderRoomAvailabilityFilter,
  matchesGroupLeaderRoomAvailabilityWarningFilter,
  matchesGroupLeaderRoomCodeFilter,
  matchesGroupLeaderRoomOccupantGroup,
  matchesGroupLeaderRoomOccupantSearch,
  type RoomAvailabilityFilter,
  type RoomAvailabilityWarningFilter,
} from "@/lib/capogruppo/room-assignment-presentation";
import { RoomEnsuiteBathroomIcon } from "./room-ensuite-bathroom-icon";

type RoomScope = {
  groupId: string;
  roomId: string;
};

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

type Notice = {
  tone: "success" | "warning" | "error";
  message: string;
};

const ALL_GROUPS_ID = "__all_groups__";
const ROME_GROUPS_ID = "__rome_groups__";
const ALL_HOSTELS_ID = "__all_hostels__";

function participantBelongsToGroup(
  participant: GroupLeaderParticipant,
  groupId: string
): boolean {
  return participant.groupId === groupId || participant.groupLabel === groupId;
}

function resolveParticipantGroupId(
  participant: GroupLeaderParticipant,
  groups: GroupLeaderRoomAssignmentGroup[]
): string | null {
  return (
    groups.find((group) => participantBelongsToGroup(participant, group.id))?.id ??
    null
  );
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

function sortParticipants<T extends { firstName: string | null; lastName: string | null }>(
  participants: T[]
): T[] {
  return [...participants].sort((a, b) => {
    const bySurname = (a.lastName ?? "").localeCompare(b.lastName ?? "");
    if (bySurname !== 0) return bySurname;
    return (a.firstName ?? "").localeCompare(b.firstName ?? "");
  });
}

export function DesktopRoomAssignmentWorkspace({
  apiBasePath = "/api/alloggi/room-assignments",
}: {
  apiBasePath?: string;
}) {
  const { t, formatDate, formatNumber } = useI18n();
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
  const [roomAvailabilityFilter, setRoomAvailabilityFilter] =
    useState<RoomAvailabilityFilter>("all");
  const [roomAvailabilityWarningFilter, setRoomAvailabilityWarningFilter] =
    useState<RoomAvailabilityWarningFilter>("all");
  const [roomCodeFilter, setRoomCodeFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [targetRoomId, setTargetRoomId] = useState("");
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [savingParticipantId, setSavingParticipantId] = useState<string | null>(null);
  const [savingSelectedParticipants, setSavingSelectedParticipants] = useState(false);
  const [unassignedDialogOpen, setUnassignedDialogOpen] = useState(false);
  const [unassignedDialogSearch, setUnassignedDialogSearch] = useState("");
  const [nonRoomDialogOpen, setNonRoomDialogOpen] = useState(false);
  const [nonRoomSearch, setNonRoomSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredRoomCodeFilter = useDeferredValue(roomCodeFilter);
  const deferredUnassignedDialogSearch = useDeferredValue(unassignedDialogSearch);
  const deferredNonRoomSearch = useDeferredValue(nonRoomSearch);
  const hasSearch = deferredSearchTerm.trim().length > 0;
  const ensuiteBathroomLabels = useMemo(
    () => ({
      available: t("groupLeader.roomAssignment.rooms.ensuite.available"),
      unavailable: t("groupLeader.roomAssignment.rooms.ensuite.unavailable"),
      unknown: t("groupLeader.roomAssignment.rooms.ensuite.unknown"),
    }),
    [t]
  );

  const loadData = useCallback(
    async (showLoadingState = true) => {
      if (showLoadingState) setLoading(true);
      setError(null);

      try {
        const response = await fetch(apiBasePath, { cache: "no-store" });
        const json = (await response.json()) as RoomAssignmentResponse;

        if (!response.ok) {
          throw new Error(json.error || t("groupLeader.roomAssignment.status.loadError"));
        }

        const nextGroups = json.groups ?? [];
        const nextParticipants = json.participants ?? [];
        const nextRomeGroupIds = new Set(
          nextParticipants
            .filter((participant) => isGroupLeaderRomeCity(participant.city))
            .map((participant) => resolveParticipantGroupId(participant, nextGroups))
            .filter((groupId): groupId is string => Boolean(groupId))
        );
        setGroups(nextGroups);
        setParticipants(nextParticipants);
        setRooms(json.rooms ?? []);
        setRoomScopes(json.roomScopes ?? []);
        setAssignments(json.assignments ?? []);
        setRoomOccupants(json.roomOccupants ?? []);
        setNonRoomParticipants(json.nonRoomParticipants ?? []);
        setShowGroupColumn(Boolean(json.showGroupColumn));
        setCanAssignAcrossGroups(Boolean(json.canAssignAcrossGroups));
        setSelectedGroupId((current) => {
          const currentIsValid =
            (current === ALL_GROUPS_ID && nextGroups.length > 1) ||
            (current === ROME_GROUPS_ID && nextRomeGroupIds.size > 1) ||
            nextGroups.some((group) => group.id === current);
          if (currentIsValid) return current;
          return nextGroups.length > 1 ? ALL_GROUPS_ID : (nextGroups[0]?.id ?? "");
        });
      } catch (loadError) {
        setError((loadError as Error).message);
      } finally {
        if (showLoadingState) setLoading(false);
      }
    },
    [apiBasePath, t]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!unassignedDialogOpen && !nonRoomDialogOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setUnassignedDialogOpen(false);
      setNonRoomDialogOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nonRoomDialogOpen, unassignedDialogOpen]);

  const isCombinedView = selectedGroupId === ALL_GROUPS_ID;
  const isRomeAggregateView = selectedGroupId === ROME_GROUPS_ID;
  const romeGroupIds = useMemo(
    () =>
      new Set(
        participants
          .filter((participant) => isGroupLeaderRomeCity(participant.city))
          .map((participant) => resolveParticipantGroupId(participant, groups))
          .filter((groupId): groupId is string => Boolean(groupId))
      ),
    [groups, participants]
  );
  const showRomeAggregateOption = romeGroupIds.size > 1;

  const participantsForSelectedGroup = useMemo(
    () =>
      sortParticipants(
        participants.filter((participant) =>
          isCombinedView
            ? true
            : isRomeAggregateView
              ? isGroupLeaderRomeCity(participant.city)
            : selectedGroupId
              ? participantBelongsToGroup(participant, selectedGroupId)
              : false
        )
      ),
    [isCombinedView, isRomeAggregateView, participants, selectedGroupId]
  );

  const nonRoomParticipantsForSelectedGroup = useMemo(
    () =>
      sortParticipants(
        nonRoomParticipants.filter((participant) =>
          isCombinedView
            ? true
            : isRomeAggregateView
              ? isGroupLeaderRomeCity(participant.city)
            : selectedGroupId
              ? participantBelongsToGroup(participant, selectedGroupId)
              : false
        )
      ),
    [isCombinedView, isRomeAggregateView, nonRoomParticipants, selectedGroupId]
  );

  const scopedRoomIds = useMemo(
    () =>
      new Set(
        canAssignAcrossGroups
          ? rooms.map((room) => room.id)
          : roomScopes
              .filter(
                (scope) =>
                  isCombinedView ||
                  (isRomeAggregateView
                    ? romeGroupIds.has(scope.groupId)
                    : scope.groupId === selectedGroupId)
              )
              .map((scope) => scope.roomId)
      ),
    [
      canAssignAcrossGroups,
      isCombinedView,
      isRomeAggregateView,
      romeGroupIds,
      roomScopes,
      rooms,
      selectedGroupId,
    ]
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
    selectedHostelId === ALL_HOSTELS_ID || selectedHostelIsAvailable
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
          buildGroupLeaderRoomOptionLabel(a).localeCompare(
            buildGroupLeaderRoomOptionLabel(b)
          )
        ),
    [activeHostelId, rooms, scopedRoomIds]
  );

  const assignmentByParticipantId = useMemo(
    () => new Map(assignments.map((assignment) => [assignment.participantId, assignment])),
    [assignments]
  );

  const roomOccupantsByRoomId = useMemo(() => {
    const occupantsByRoomId = new Map<string, GroupLeaderVisibleRoomOccupant[]>();
    for (const occupant of roomOccupants) {
      const occupants = occupantsByRoomId.get(occupant.roomId) ?? [];
      occupants.push(occupant);
      occupantsByRoomId.set(occupant.roomId, occupants);
    }
    for (const [roomId, occupants] of occupantsByRoomId) {
      occupantsByRoomId.set(roomId, sortParticipants(occupants));
    }
    return occupantsByRoomId;
  }, [roomOccupants]);

  const roomsVisibleForSelectedGroup = useMemo(
    () =>
      filterGroupLeaderRoomsForSelectedGroup({
        rooms: roomsForSelectedGroup,
        occupantsByRoomId: roomOccupantsByRoomId,
        canAssignAcrossGroups,
        isCombinedView,
        matchesSelectedGroup: (occupant) =>
          isRomeAggregateView
            ? isGroupLeaderRomeCity(occupant.city)
            : matchesGroupLeaderRoomOccupantGroup(occupant, selectedGroupId),
      }),
    [
      canAssignAcrossGroups,
      isCombinedView,
      isRomeAggregateView,
      roomOccupantsByRoomId,
      roomsForSelectedGroup,
      selectedGroupId,
    ]
  );

  const roomsByParticipantId = useMemo(() => {
    const scopedRoomIdsByGroupId = new Map<string, Set<string>>();
    for (const scope of roomScopes) {
      const roomIds = scopedRoomIdsByGroupId.get(scope.groupId) ?? new Set<string>();
      roomIds.add(scope.roomId);
      scopedRoomIdsByGroupId.set(scope.groupId, roomIds);
    }

    return new Map(
      participantsForSelectedGroup.map((participant) => {
        const participantGroupId = resolveParticipantGroupId(participant, groups);
        const participantRoomIds = participantGroupId
          ? scopedRoomIdsByGroupId.get(participantGroupId)
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

  const roomsMatchingFilters = useMemo(
    () =>
      roomsVisibleForSelectedGroup.filter((room) => {
        const occupants = roomOccupantsByRoomId.get(room.id) ?? [];
        const occupantCount = occupants.length;
        const hasExtensionWarning =
          getGroupLeaderRoomRequiredAvailableFrom(room, occupants) !== null ||
          getGroupLeaderRoomRequiredAvailableTo(room, occupants) !== null;
        const hasShorteningWarning =
          getGroupLeaderRoomShorteningSuggestion(room, occupants) !== null;
        return (
          matchesGroupLeaderRoomAvailabilityFilter(
            room,
            occupantCount,
            roomAvailabilityFilter
          ) &&
          matchesGroupLeaderRoomAvailabilityWarningFilter(
            hasExtensionWarning,
            hasShorteningWarning,
            roomAvailabilityWarningFilter
          ) &&
          matchesGroupLeaderRoomCodeFilter(room, deferredRoomCodeFilter)
        );
      }),
    [
      deferredRoomCodeFilter,
      roomAvailabilityFilter,
      roomAvailabilityWarningFilter,
      roomOccupantsByRoomId,
      roomsVisibleForSelectedGroup,
    ]
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

  const roomsForDisplay = useMemo(() => {
    if (!hasSearch) return roomsMatchingFilters;
    return [...roomsMatchingFilters].sort((a, b) => {
      const aMatches = (roomOccupantsByRoomId.get(a.id) ?? []).some((occupant) =>
        matchingRoomOccupantIds.has(occupant.participantId)
      );
      const bMatches = (roomOccupantsByRoomId.get(b.id) ?? []).some((occupant) =>
        matchingRoomOccupantIds.has(occupant.participantId)
      );
      return Number(bMatches) - Number(aMatches);
    });
  }, [hasSearch, matchingRoomOccupantIds, roomOccupantsByRoomId, roomsMatchingFilters]);

  const unassignedParticipantsInScope = useMemo(
    () =>
      participantsForSelectedGroup.filter(
        (participant) =>
          !assignmentByParticipantId.has(participant.id) &&
          (activeHostelId === ALL_HOSTELS_ID ||
            (roomsByParticipantId.get(participant.id)?.length ?? 0) > 0)
      ),
    [
      activeHostelId,
      assignmentByParticipantId,
      participantsForSelectedGroup,
      roomsByParticipantId,
    ]
  );

  const visibleUnassignedParticipants = useMemo(
    () =>
      unassignedParticipantsInScope.filter((participant) =>
        matchesGroupLeaderParticipantSearch(participant, deferredSearchTerm)
      ),
    [deferredSearchTerm, unassignedParticipantsInScope]
  );

  const visibleUnassignedDialogParticipants = useMemo(
    () =>
      unassignedParticipantsInScope.filter((participant) =>
        matchesGroupLeaderParticipantSearch(
          participant,
          deferredUnassignedDialogSearch
        )
      ),
    [deferredUnassignedDialogSearch, unassignedParticipantsInScope]
  );

  const selectedParticipantIdSet = useMemo(
    () => new Set(selectedParticipantIds),
    [selectedParticipantIds]
  );
  const selectedParticipants = useMemo(
    () =>
      unassignedParticipantsInScope.filter((participant) =>
        selectedParticipantIdSet.has(participant.id)
      ),
    [selectedParticipantIdSet, unassignedParticipantsInScope]
  );
  const selectedParticipantRooms = useMemo(
    () =>
      getGroupLeaderSharedRooms(
        selectedParticipants.map((participant) => participant.id),
        roomsByParticipantId
      ),
    [roomsByParticipantId, selectedParticipants]
  );

  useEffect(() => {
    const selectableParticipantIds = new Set(
      unassignedParticipantsInScope.map((participant) => participant.id)
    );
    setSelectedParticipantIds((current) => {
      const next = current.filter((participantId) =>
        selectableParticipantIds.has(participantId)
      );
      return next.length === current.length ? current : next;
    });
  }, [unassignedParticipantsInScope]);

  useEffect(() => {
    if (selectedParticipants.length === 0) {
      setTargetRoomId("");
      return;
    }
    const targetRoomIsAvailable = selectedParticipantRooms.some(
      (room) =>
        room.id === targetRoomId &&
        getGroupLeaderRoomFreeBedCount(
          room,
          roomOccupantsByRoomId.get(room.id)?.length ?? 0
        ) >= selectedParticipants.length
    );
    if (targetRoomIsAvailable) return;
    const firstRoomWithSpace = selectedParticipantRooms.find(
      (room) =>
        getGroupLeaderRoomFreeBedCount(
          room,
          roomOccupantsByRoomId.get(room.id)?.length ?? 0
        ) >= selectedParticipants.length
    );
    setTargetRoomId(firstRoomWithSpace?.id ?? "");
  }, [
    roomOccupantsByRoomId,
    selectedParticipantRooms,
    selectedParticipants.length,
    targetRoomId,
  ]);

  const visibleRoomIds = useMemo(
    () => new Set(roomsMatchingFilters.map((room) => room.id)),
    [roomsMatchingFilters]
  );
  const assignedCount = participantsForSelectedGroup.filter((participant) => {
    const assignment = assignmentByParticipantId.get(participant.id);
    return assignment ? visibleRoomIds.has(assignment.roomId) : false;
  }).length;
  const totalVisibleBeds = roomsMatchingFilters.reduce(
    (sum, room) => sum + room.capacity,
    0
  );
  const occupiedVisibleBeds = roomsMatchingFilters.reduce(
    (sum, room) =>
      sum +
      getGroupLeaderRoomOccupancy(
        room,
        roomOccupantsByRoomId.get(room.id)?.length ?? 0
      ),
    0
  );
  const freeVisibleBeds = roomsMatchingFilters.reduce(
    (sum, room) =>
      sum +
      getGroupLeaderRoomFreeBedCount(
        room,
        roomOccupantsByRoomId.get(room.id)?.length ?? 0
      ),
    0
  );

  const visibleNonRoomDialogParticipants = useMemo(
    () =>
      nonRoomParticipantsForSelectedGroup.filter((participant) =>
        matchesGroupLeaderParticipantSearch(participant, deferredNonRoomSearch)
      ),
    [deferredNonRoomSearch, nonRoomParticipantsForSelectedGroup]
  );

  async function saveAssignment(participantId: string, roomId: string | null) {
    const response = await fetch(apiBasePath, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, roomId }),
    });
    const json = (await response.json()) as RoomAssignmentMutationResponse;
    if (!response.ok) {
      throw new Error(json.error || t("groupLeader.roomAssignment.status.saveError"));
    }
    return json;
  }

  async function handleAssignmentChange(participantId: string, roomId: string | null) {
    setSavingParticipantId(participantId);
    setError(null);
    setNotice(null);

    try {
      const json = await saveAssignment(participantId, roomId);

      await loadData(false);
      setEditingParticipantId(null);
      setSelectedParticipantIds((current) =>
        current.filter((selectedId) => selectedId !== participantId)
      );

      const startAvailabilityWarning = (json.warnings ?? []).find(
        (warning) => warning.code === "room_availability_starts_after_arrival"
      );
      const endAvailabilityWarning = (json.warnings ?? []).find(
        (warning) => warning.code === "room_availability_ends_before_departure"
      );
      setNotice(
        startAvailabilityWarning && endAvailabilityWarning
          ? {
              tone: "warning",
              message: t(
                "groupLeader.roomAssignment.status.savedWithBothAvailabilityWarnings",
                {
                  fromDate:
                    typeof startAvailabilityWarning.meta?.arrivalDate === "string"
                      ? formatDate(startAvailabilityWarning.meta.arrivalDate)
                      : "-",
                  toDate:
                    typeof endAvailabilityWarning.meta?.departureDate === "string"
                      ? formatDate(endAvailabilityWarning.meta.departureDate)
                      : "-",
                }
              ),
            }
          : startAvailabilityWarning
          ? {
              tone: "warning",
              message: t(
                "groupLeader.roomAssignment.status.savedWithAvailabilityWarning",
                {
                  date:
                    typeof startAvailabilityWarning.meta?.availableFrom === "string"
                      ? formatDate(startAvailabilityWarning.meta.availableFrom)
                      : "-",
                }
              ),
            }
          : endAvailabilityWarning
            ? {
                tone: "warning",
                message: t(
                  "groupLeader.roomAssignment.status.savedWithEndAvailabilityWarning",
                  {
                    date:
                      typeof endAvailabilityWarning.meta?.availableTo === "string"
                        ? formatDate(endAvailabilityWarning.meta.availableTo)
                        : "-",
                  }
                ),
              }
          : {
              tone: "success",
              message: roomId
                ? t("groupLeader.roomAssignment.status.saved")
                : t("groupLeader.roomAssignment.status.unassigned"),
            }
      );
    } catch (saveError) {
      setNotice({ tone: "error", message: (saveError as Error).message });
    } finally {
      setSavingParticipantId(null);
    }
  }

  async function handleSelectedParticipantsAssignment(roomId: string) {
    if (!roomId || selectedParticipants.length === 0) return;

    setSavingSelectedParticipants(true);
    setError(null);
    setNotice(null);
    const completedParticipantIds: string[] = [];
    let availabilityWarningRequiredFrom: string | null = null;
    let availabilityWarningRequiredTo: string | null = null;

    try {
      for (const participant of selectedParticipants) {
        try {
          const json = await saveAssignment(participant.id, roomId);
          completedParticipantIds.push(participant.id);
          const startAvailabilityWarning = (json.warnings ?? []).find(
            (warning) => warning.code === "room_availability_starts_after_arrival"
          );
          if (
            typeof startAvailabilityWarning?.meta?.arrivalDate === "string" &&
            (!availabilityWarningRequiredFrom ||
              startAvailabilityWarning.meta.arrivalDate < availabilityWarningRequiredFrom)
          ) {
            availabilityWarningRequiredFrom = startAvailabilityWarning.meta.arrivalDate;
          }
          const endAvailabilityWarning = (json.warnings ?? []).find(
            (warning) => warning.code === "room_availability_ends_before_departure"
          );
          if (
            typeof endAvailabilityWarning?.meta?.departureDate === "string" &&
            (!availabilityWarningRequiredTo ||
              endAvailabilityWarning.meta.departureDate > availabilityWarningRequiredTo)
          ) {
            availabilityWarningRequiredTo = endAvailabilityWarning.meta.departureDate;
          }
        } catch (assignmentError) {
          throw new Error(
            `${buildParticipantName(participant)}: ${(assignmentError as Error).message}`
          );
        }
      }

      setNotice(
        availabilityWarningRequiredFrom && availabilityWarningRequiredTo
          ? {
              tone: "warning",
              message: t(
                "accommodation.roomAssignmentTest.status.bulkSavedWithBothAvailabilityWarnings",
                {
                  count: formatNumber(completedParticipantIds.length),
                  fromDate: formatDate(availabilityWarningRequiredFrom),
                  toDate: formatDate(availabilityWarningRequiredTo),
                }
              ),
            }
          : availabilityWarningRequiredFrom
          ? {
              tone: "warning",
              message: t(
                "accommodation.roomAssignmentTest.status.bulkSavedWithAvailabilityWarning",
                {
                  count: formatNumber(completedParticipantIds.length),
                  date: formatDate(availabilityWarningRequiredFrom),
                }
              ),
            }
          : availabilityWarningRequiredTo
            ? {
                tone: "warning",
                message: t(
                  "accommodation.roomAssignmentTest.status.bulkSavedWithEndAvailabilityWarning",
                  {
                    count: formatNumber(completedParticipantIds.length),
                    date: formatDate(availabilityWarningRequiredTo),
                  }
                ),
              }
          : {
              tone: "success",
              message: t("accommodation.roomAssignmentTest.status.bulkSaved", {
                count: formatNumber(completedParticipantIds.length),
              }),
            }
      );
    } catch (assignmentError) {
      setNotice({
        tone: "error",
        message:
          completedParticipantIds.length > 0
            ? t("accommodation.roomAssignmentTest.status.bulkPartial", {
                count: formatNumber(completedParticipantIds.length),
                error: (assignmentError as Error).message,
              })
            : (assignmentError as Error).message,
      });
    } finally {
      if (completedParticipantIds.length > 0) {
        await loadData(false);
        const completedIds = new Set(completedParticipantIds);
        setSelectedParticipantIds((current) =>
          current.filter((participantId) => !completedIds.has(participantId))
        );
      }
      setSavingSelectedParticipants(false);
    }
  }

  function toggleParticipant(participant: GroupLeaderParticipant) {
    setSelectedParticipantIds((current) =>
      current.includes(participant.id)
        ? current.filter((participantId) => participantId !== participant.id)
        : [...current, participant.id]
    );
  }

  return (
    <section className="space-y-4" data-testid="desktop-room-assignment-workspace">
      {error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {notice ? (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm font-medium ${
            notice.tone === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : notice.tone === "warning"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs underline underline-offset-2">
            {t("accommodation.roomAssignmentTest.dismiss")}
          </button>
        </div>
      ) : null}

      <section className="sticky top-0 z-20 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-[minmax(12rem,1.2fr)_minmax(11rem,1fr)_minmax(10rem,.8fr)_minmax(11rem,.9fr)_minmax(12rem,1fr)_minmax(14rem,1.2fr)_auto] 2xl:items-end">
          <label className="block text-xs font-semibold text-slate-600">
            {t("groupLeader.roomAssignment.filters.group")}
            <select
              data-testid="group-room-view-filter"
              value={selectedGroupId}
              onChange={(event) => {
                setSelectedGroupId(event.target.value);
                setSelectedHostelId(ALL_HOSTELS_ID);
                setSelectedParticipantIds([]);
              }}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
            >
              {groups.length > 1 ? (
                <option value={ALL_GROUPS_ID}>
                  {t("groupLeader.roomAssignment.filters.allGroups", {
                    count: formatNumber(groups.length),
                  })}
                </option>
              ) : null}
              {showRomeAggregateOption ? (
                <option value={ROME_GROUPS_ID}>
                  {t("groupLeader.roomAssignment.filters.allRomeGroups", {
                    count: formatNumber(romeGroupIds.size),
                  })}
                </option>
              ) : null}
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            {t("groupLeader.roomAssignment.filters.hostel")}
            <select
              data-testid="hostel-room-view-filter"
              value={activeHostelId}
              onChange={(event) => {
                setSelectedHostelId(event.target.value);
                setSelectedParticipantIds([]);
              }}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
            >
              <option value={ALL_HOSTELS_ID}>
                {t("groupLeader.roomAssignment.filters.allHostels", {
                  count: formatNumber(hostelsForSelectedGroup.length),
                })}
              </option>
              {hostelsForSelectedGroup.map((hostel) => (
                <option key={hostel.id} value={hostel.id}>{hostel.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            {t("groupLeader.roomAssignment.filters.availability")}
            <select
              data-testid="room-availability-filter"
              value={roomAvailabilityFilter}
              onChange={(event) => setRoomAvailabilityFilter(event.target.value as RoomAvailabilityFilter)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
            >
              <option value="all">{t("groupLeader.roomAssignment.filters.allRooms")}</option>
              <option value="available">{t("groupLeader.roomAssignment.filters.availableRooms")}</option>
              <option value="empty">{t("groupLeader.roomAssignment.filters.emptyRooms")}</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            {t("groupLeader.roomAssignment.filters.availabilityWarning")}
            <select
              data-testid="room-availability-warning-filter"
              value={roomAvailabilityWarningFilter}
              onChange={(event) =>
                setRoomAvailabilityWarningFilter(
                  event.target.value as RoomAvailabilityWarningFilter
                )
              }
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
            >
              <option value="all">{t("groupLeader.roomAssignment.filters.allWarnings")}</option>
              <option value="extend">{t("groupLeader.roomAssignment.filters.extendWarning")}</option>
              <option value="shorten">{t("groupLeader.roomAssignment.filters.shortenWarning")}</option>
              <option value="any">{t("groupLeader.roomAssignment.filters.anyWarning")}</option>
              <option value="both">{t("groupLeader.roomAssignment.filters.bothWarnings")}</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            {t("groupLeader.roomAssignment.filters.roomCode")}
            <input
              data-testid="room-code-filter"
              type="search"
              value={roomCodeFilter}
              onChange={(event) => setRoomCodeFilter(event.target.value)}
              placeholder={t("groupLeader.roomAssignment.filters.roomCodePlaceholder")}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
            />
          </label>

          <label className="block text-xs font-semibold text-slate-600">
            {t("groupLeader.roomAssignment.filters.search")}
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t("groupLeader.roomAssignment.filters.searchPlaceholder")}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900"
            />
          </label>

          <div className="grid grid-cols-5 gap-1.5 lg:col-span-2 2xl:col-span-1" aria-label={t("groupLeader.roomAssignment.summary.title")}>
            {[
              [t("groupLeader.roomAssignment.summary.rooms"), roomsMatchingFilters.length, "text-slate-800"],
              [t("accommodation.roomAssignmentTest.summary.beds"), totalVisibleBeds, "text-indigo-800"],
              [t("groupLeader.roomAssignment.summary.assigned"), assignedCount, "text-emerald-800"],
              [t("accommodation.roomAssignmentTest.summary.freeBeds"), freeVisibleBeds, "text-emerald-800"],
            ].map(([label, value, color]) => (
              <div key={String(label)} className="rounded-md bg-slate-50 px-2 py-1.5 text-center ring-1 ring-inset ring-slate-200">
                <p className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
                <p className={`text-base font-black leading-5 ${color}`}>{formatNumber(Number(value))}</p>
              </div>
            ))}
            <button
              type="button"
              data-testid="unassigned-summary-button"
              aria-haspopup="dialog"
              aria-expanded={unassignedDialogOpen}
              onClick={() => setUnassignedDialogOpen(true)}
              className="rounded-md bg-slate-50 px-2 py-1.5 text-center ring-1 ring-inset ring-slate-200 transition hover:bg-amber-50 hover:ring-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-slate-500">
                {t("groupLeader.roomAssignment.summary.unassigned")}
              </span>
              <span className="block text-base font-black leading-5 text-amber-800">
                {formatNumber(unassignedParticipantsInScope.length)}
              </span>
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] 2xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{t("accommodation.roomAssignmentTest.rack.title")}</h2>
              <p className="text-[11px] text-slate-500">
                {t("accommodation.roomAssignmentTest.rack.subtitle", {
                  occupied: formatNumber(occupiedVisibleBeds),
                  total: formatNumber(totalVisibleBeds),
                })}
              </p>
            </div>
            {selectedParticipants.length > 0 ? (
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-800 ring-1 ring-inset ring-indigo-200">
                {t("accommodation.roomAssignmentTest.rack.selectedPeople", {
                  count: formatNumber(selectedParticipants.length),
                })}
              </span>
            ) : null}
          </div>

          <div className="max-h-[calc(100vh-12rem)] overflow-auto">
            {loading ? (
              <p className="p-5 text-sm text-slate-500">{t("common.loading")}</p>
            ) : roomsForDisplay.length === 0 ? (
              <p className="m-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                {t("groupLeader.roomAssignment.rooms.noFilterMatches")}
              </p>
            ) : (
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-[11px]">
                <caption className="sr-only">{t("accommodation.roomAssignmentTest.rack.title")}</caption>
                <thead className="sticky top-0 z-10 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-[0_1px_0_#cbd5e1]">
                  <tr>
                    <th className="w-36 px-3 py-2">{t("accommodation.roomAssignmentTest.table.hostel")}</th>
                    <th className="w-40 px-3 py-2">{t("accommodation.roomAssignmentTest.table.room")}</th>
                    <th className="w-16 px-2 py-2 text-center">{t("accommodation.roomAssignmentTest.table.bed")}</th>
                    <th className="min-w-48 px-3 py-2">{t("accommodation.roomAssignmentTest.table.person")}</th>
                    <th className="w-36 px-3 py-2">{t("accommodation.roomAssignmentTest.table.group")}</th>
                    <th className="w-40 px-3 py-2">{t("accommodation.roomAssignmentTest.table.stay")}</th>
                    <th className="w-52 px-3 py-2">{t("accommodation.roomAssignmentTest.table.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {roomsForDisplay.flatMap((room) => {
                    const occupants = roomOccupantsByRoomId.get(room.id) ?? [];
                    const occupancy = getGroupLeaderRoomOccupancy(room, occupants.length);
                    const freeBeds = getGroupLeaderRoomFreeBedCount(room, occupants.length);
                    const rowCount = getGroupLeaderRoomBedRowCount(room, occupants.length);
                    const earlyArrivalOccupants =
                      getGroupLeaderRoomEarlyArrivalOccupants(room, occupants);
                    const earlyArrivalIds = new Set(
                      earlyArrivalOccupants.map((occupant) => occupant.participantId)
                    );
                    const requiredAvailableFrom =
                      getGroupLeaderRoomRequiredAvailableFrom(room, occupants);
                    const lateDepartureOccupants =
                      getGroupLeaderRoomLateDepartureOccupants(room, occupants);
                    const lateDepartureIds = new Set(
                      lateDepartureOccupants.map((occupant) => occupant.participantId)
                    );
                    const requiredAvailableTo =
                      getGroupLeaderRoomRequiredAvailableTo(room, occupants);
                    const shorteningSuggestion =
                      getGroupLeaderRoomShorteningSuggestion(room, occupants);
                    const roomHasSearchMatch =
                      hasSearch && occupants.some((occupant) => matchingRoomOccupantIds.has(occupant.participantId));
                    const realRoomNumber = room.realRoomNumber?.trim();
                    const roomTone =
                      occupancy > room.capacity
                        ? "bg-red-50 text-red-800"
                        : occupancy === room.capacity
                          ? "bg-emerald-50 text-emerald-800"
                          : occupancy === 0
                            ? "bg-slate-50 text-slate-700"
                            : "bg-amber-50 text-amber-800";

                    return Array.from({ length: rowCount }, (_, bedIndex) => {
                      const occupant = occupants[bedIndex] ?? null;
                      const unresolvedOccupied = !occupant && bedIndex < occupancy;
                      const isFree = !occupant && !unresolvedOccupied;
                      const participantName = occupant ? buildParticipantName(occupant) : null;
                      const participantRooms = occupant
                        ? (roomsByParticipantId.get(occupant.participantId) ?? [])
                        : [];
                      const isSearchMatch =
                        Boolean(occupant) &&
                        hasSearch &&
                        matchingRoomOccupantIds.has(occupant.participantId);
                      const canAssignSelectedHere =
                        isFree &&
                        selectedParticipants.length > 0 &&
                        freeBeds >= selectedParticipants.length &&
                        selectedParticipantRooms.some((candidate) => candidate.id === room.id);
                      const roomRowBorderClass =
                        bedIndex === rowCount - 1
                          ? "border-b-2 border-slate-400"
                          : "border-b border-slate-200";

                      return (
                        <tr
                          key={`${room.id}:${bedIndex}`}
                          data-testid="room-bed-row"
                          data-room-id={room.id}
                          data-empty={isFree ? "true" : "false"}
                          className={`${isSearchMatch ? "bg-indigo-50" : isFree ? "bg-emerald-50/35" : "bg-white"}`}
                        >
                          {bedIndex === 0 ? (
                            <>
                              <td rowSpan={rowCount} className={`border-b-2 border-r border-slate-400 px-3 py-2 align-top ${roomHasSearchMatch ? "bg-indigo-50" : "bg-white"}`}>
                                <p className="font-semibold text-slate-800">{room.hotel?.name ?? "-"}</p>
                              </td>
                              <td rowSpan={rowCount} className={`border-b-2 border-r border-slate-400 px-3 py-2 align-top ${roomHasSearchMatch ? "bg-indigo-50" : "bg-white"}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span className="font-black text-slate-900">{room.internalCode}</span>
                                    <RoomEnsuiteBathroomIcon
                                      value={room.hasEnsuiteBathroom}
                                      labels={ensuiteBathroomLabels}
                                    />
                                  </span>
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${roomTone}`}>{occupancy}/{room.capacity}</span>
                                </div>
                                <p className="mt-1 flex flex-wrap items-baseline gap-x-1 text-[10px] text-slate-500">
                                  {realRoomNumber ? (
                                    <>
                                      <span
                                        data-testid="room-real-number"
                                        className="whitespace-nowrap font-semibold text-slate-700"
                                      >
                                        {t("accommodation.roomAssignmentTest.table.realRoomNumber", {
                                          number: realRoomNumber,
                                        })}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                    </>
                                  ) : null}
                                  <span>{buildPolicyLabel(room.genderPolicy, t)}</span>
                                </p>
                                <p className="mt-0.5 whitespace-nowrap text-[9px] text-slate-400">{formatGroupLeaderRoomAvailability(room)}</p>
                                {(earlyArrivalOccupants.length > 0 &&
                                  requiredAvailableFrom &&
                                  room.availableFrom) ||
                                (lateDepartureOccupants.length > 0 &&
                                  requiredAvailableTo &&
                                  room.availableTo) ? (
                                  <div
                                    data-testid="room-availability-extension-alert"
                                    className="mt-1.5 rounded-md border border-amber-300 bg-amber-100 px-2 py-1 text-[9px] font-semibold leading-tight text-amber-900"
                                  >
                                    <p className="font-black uppercase tracking-wide">
                                      {t("accommodation.roomAssignmentTest.table.extendAvailability")}
                                    </p>
                                    {earlyArrivalOccupants.length > 0 &&
                                    requiredAvailableFrom &&
                                    room.availableFrom ? (
                                      <p className="mt-0.5 font-medium">
                                        {t("accommodation.roomAssignmentTest.table.earlyArrivals", {
                                          count: formatNumber(earlyArrivalOccupants.length),
                                          requiredDate: formatDate(requiredAvailableFrom),
                                          availableDate: formatDate(room.availableFrom),
                                        })}
                                      </p>
                                    ) : null}
                                    {lateDepartureOccupants.length > 0 &&
                                    requiredAvailableTo &&
                                    room.availableTo ? (
                                      <p className="mt-0.5 font-medium">
                                        {t("accommodation.roomAssignmentTest.table.lateDepartures", {
                                          count: formatNumber(lateDepartureOccupants.length),
                                          requiredDate: formatDate(requiredAvailableTo),
                                          availableDate: formatDate(room.availableTo),
                                        })}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                                {shorteningSuggestion ? (
                                  <div
                                    data-testid="room-availability-shortening-alert"
                                    className="mt-1.5 rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-[9px] font-semibold leading-tight text-sky-950"
                                  >
                                    <p className="font-black uppercase tracking-wide">
                                      {t("accommodation.roomAssignmentTest.table.shortenAvailability")}
                                    </p>
                                    {shorteningSuggestion.availableFrom &&
                                    shorteningSuggestion.availableTo &&
                                    room.availableFrom &&
                                    room.availableTo ? (
                                      <p className="mt-0.5 font-medium">
                                        {t("accommodation.roomAssignmentTest.table.shortenBoth", {
                                          requiredFrom: formatDate(shorteningSuggestion.availableFrom),
                                          requiredTo: formatDate(shorteningSuggestion.availableTo),
                                          currentFrom: formatDate(room.availableFrom),
                                          currentTo: formatDate(room.availableTo),
                                        })}
                                      </p>
                                    ) : shorteningSuggestion.availableFrom && room.availableFrom ? (
                                      <p className="mt-0.5 font-medium">
                                        {t("accommodation.roomAssignmentTest.table.shortenFrom", {
                                          requiredDate: formatDate(shorteningSuggestion.availableFrom),
                                          currentDate: formatDate(room.availableFrom),
                                        })}
                                      </p>
                                    ) : shorteningSuggestion.availableTo && room.availableTo ? (
                                      <p className="mt-0.5 font-medium">
                                        {t("accommodation.roomAssignmentTest.table.shortenTo", {
                                          requiredDate: formatDate(shorteningSuggestion.availableTo),
                                          currentDate: formatDate(room.availableTo),
                                        })}
                                      </p>
                                    ) : null}
                                  </div>
                                ) : null}
                                <div className="mt-1.5 h-1 overflow-hidden rounded bg-slate-200">
                                  <div
                                    className={`h-full ${occupancy >= room.capacity ? "bg-emerald-500" : "bg-indigo-500"}`}
                                    style={{ width: `${Math.min(100, room.capacity > 0 ? (occupancy / room.capacity) * 100 : 0)}%` }}
                                  />
                                </div>
                                {freeBeds > 0 ? (
                                  <p className="mt-1 text-[9px] font-semibold text-emerald-700">{t("accommodation.roomAssignmentTest.table.freeBeds", { count: formatNumber(freeBeds) })}</p>
                                ) : null}
                              </td>
                            </>
                          ) : null}

                          <td className={`${roomRowBorderClass} border-r px-2 py-1.5 text-center font-mono text-[10px] text-slate-500`}>{bedIndex + 1}</td>
                          <td className={`${roomRowBorderClass} border-r px-3 py-1.5`}>
                            {occupant ? (
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 shrink-0 rounded-full ${occupant.sexCategory === "male" ? "bg-sky-400" : occupant.sexCategory === "female" ? "bg-pink-400" : "bg-slate-400"}`} />
                                <div className="min-w-0">
                                  <p className={`truncate font-semibold ${isSearchMatch ? "text-indigo-900" : "text-slate-900"}`}>{participantName}</p>
                                  <p className="truncate text-[9px] text-slate-500">
                                    {[
                                      occupant.age == null ? null : t("groupLeader.roomAssignment.participants.ageValue", { age: formatNumber(occupant.age) }),
                                      buildSexLabel(occupant.sex, occupant.sexCategory, t),
                                    ].filter(Boolean).join(" · ")}
                                  </p>
                                </div>
                              </div>
                            ) : unresolvedOccupied ? (
                              <span className="font-medium text-slate-500">{t("accommodation.roomAssignmentTest.table.hiddenOccupant")}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                                <span className="h-2 w-2 rounded-full border border-emerald-400 bg-white" />
                                {t("accommodation.roomAssignmentTest.table.emptyBed")}
                              </span>
                            )}
                          </td>
                          <td className={`${roomRowBorderClass} border-r px-3 py-1.5 text-slate-600`}>
                            {occupant ? occupant.displayGroup : "—"}
                          </td>
                          <td className={`${roomRowBorderClass} border-r px-3 py-1.5 text-[10px] text-slate-600`}>
                            {occupant ? (
                              <>
                                <span className="whitespace-nowrap">{occupant.arrivalDate ? formatDate(occupant.arrivalDate) : "-"} → {occupant.departureDate ? formatDate(occupant.departureDate) : "-"}</span>
                                {earlyArrivalIds.has(occupant.participantId) ? (
                                  <span className="mt-0.5 block font-semibold text-amber-700">{t("groupLeader.roomAssignment.rooms.earlyArrivalBadge")}</span>
                                ) : null}
                                {lateDepartureIds.has(occupant.participantId) ? (
                                  <span className="mt-0.5 block font-semibold text-amber-700">{t("groupLeader.roomAssignment.rooms.lateDepartureBadge")}</span>
                                ) : null}
                              </>
                            ) : "—"}
                          </td>
                          <td className={`${roomRowBorderClass} px-3 py-1.5`}>
                            {occupant?.canManage ? (
                              editingParticipantId === occupant.participantId ? (
                                <div className="flex items-center gap-1">
                                  <label className="sr-only" htmlFor={`dense-move-${occupant.participantId}`}>{t("groupLeader.roomAssignment.rooms.moveParticipant", { name: participantName ?? "-" })}</label>
                                  <select
                                    id={`dense-move-${occupant.participantId}`}
                                    value={room.id}
                                    onChange={(event) => void handleAssignmentChange(occupant.participantId, event.target.value)}
                                    disabled={savingParticipantId === occupant.participantId}
                                    className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px]"
                                  >
                                    {participantRooms.map((candidate) => {
                                      const candidateFreeBeds = getGroupLeaderRoomFreeBedCount(candidate, roomOccupantsByRoomId.get(candidate.id)?.length ?? 0);
                                      return (
                                        <option key={candidate.id} value={candidate.id} disabled={candidate.id !== room.id && candidateFreeBeds === 0}>
                                          {candidate.internalCode} · {candidate.hotel?.name ?? ""} ({candidateFreeBeds})
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <button type="button" onClick={() => void handleAssignmentChange(occupant.participantId, null)} disabled={savingParticipantId === occupant.participantId} className="rounded border border-red-200 bg-red-50 px-1.5 py-1 text-[10px] font-semibold text-red-700 disabled:opacity-50">{t("groupLeader.roomAssignment.rooms.remove")}</button>
                                  <button type="button" onClick={() => setEditingParticipantId(null)} className="rounded px-1.5 py-1 text-[10px] text-slate-500 hover:bg-slate-100">×</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingParticipantId(occupant.participantId)}
                                    disabled={savingParticipantId === occupant.participantId || savingSelectedParticipants}
                                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {t("accommodation.roomAssignmentTest.actions.move")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleAssignmentChange(occupant.participantId, null)}
                                    disabled={savingParticipantId === occupant.participantId || savingSelectedParticipants}
                                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {t("groupLeader.roomAssignment.rooms.remove")}
                                  </button>
                                </div>
                              )
                            ) : occupant ? (
                              <span className="text-[9px] font-semibold uppercase text-slate-400">{t("groupLeader.roomAssignment.rooms.readOnly")}</span>
                            ) : isFree ? (
                              <button
                                type="button"
                                disabled={!canAssignSelectedHere || savingParticipantId !== null || savingSelectedParticipants}
                                onClick={() => {
                                  void handleSelectedParticipantsAssignment(room.id);
                                }}
                                className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                              >
                                {selectedParticipants.length > 0 ? t("accommodation.roomAssignmentTest.actions.assignHere") : t("accommodation.roomAssignmentTest.actions.selectPerson")}
                              </button>
                            ) : null}
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <aside className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-4 lg:self-start">
          <div className="border-b border-slate-200 bg-amber-50 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-amber-950">{t("groupLeader.roomAssignment.participants.title")}</h2>
                <p className="text-[10px] text-amber-800">{t("accommodation.roomAssignmentTest.queue.subtitle")}</p>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-amber-900 ring-1 ring-inset ring-amber-200">{formatNumber(unassignedParticipantsInScope.length)}</span>
            </div>
          </div>

          <div className="border-b border-slate-200 p-3">
            {selectedParticipants.length > 0 ? (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-600">
                      {t("accommodation.roomAssignmentTest.queue.selectedPeople", {
                        count: formatNumber(selectedParticipants.length),
                      })}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-tight text-indigo-950">
                      {selectedParticipants.map(buildParticipantName).join(", ")}
                    </p>
                  </div>
                  <button type="button" onClick={() => { setSelectedParticipantIds([]); setTargetRoomId(""); }} className="rounded px-1.5 py-0.5 text-xs text-indigo-500 hover:bg-indigo-100" aria-label={t("accommodation.roomAssignmentTest.queue.clearSelection")}>×</button>
                </div>
                <label className="mt-2 block text-[10px] font-semibold text-indigo-900">
                  {t("groupLeader.roomAssignment.participants.assignment")}
                  <select disabled={selectedParticipantRooms.length === 0} value={targetRoomId} onChange={(event) => setTargetRoomId(event.target.value)} className="mt-1 w-full rounded border border-indigo-200 bg-white px-2 py-1.5 text-[10px] text-slate-900 disabled:bg-indigo-100/60">
                    {selectedParticipantRooms.map((room) => {
                      const freeBeds = getGroupLeaderRoomFreeBedCount(room, roomOccupantsByRoomId.get(room.id)?.length ?? 0);
                      return <option key={room.id} value={room.id} disabled={freeBeds < selectedParticipants.length}>{room.internalCode} · {room.hotel?.name ?? ""} ({freeBeds})</option>;
                    })}
                  </select>
                </label>
                {selectedParticipantRooms.length === 0 ? (
                  <p className="mt-1.5 text-[10px] font-semibold text-amber-800">
                    {t("accommodation.roomAssignmentTest.queue.noSharedRooms")}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={!targetRoomId || savingParticipantId !== null || savingSelectedParticipants}
                  onClick={() => void handleSelectedParticipantsAssignment(targetRoomId)}
                  className="mt-2 w-full rounded bg-indigo-600 px-2 py-1.5 text-[10px] font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingSelectedParticipants
                    ? t("groupLeader.roomAssignment.participants.saving")
                    : t("accommodation.roomAssignmentTest.actions.assignPeople", {
                        count: formatNumber(selectedParticipants.length),
                      })}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-[10px] text-slate-500">
                {t("accommodation.roomAssignmentTest.queue.selectHint")}
              </div>
            )}
          </div>

          <div className="max-h-[calc(100vh-25rem)] min-h-48 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-xs text-slate-500">{t("common.loading")}</p>
            ) : unassignedParticipantsInScope.length === 0 ? (
              <p className="p-5 text-center text-xs font-medium text-emerald-700">{t("groupLeader.roomAssignment.participants.allAssigned")}</p>
            ) : visibleUnassignedParticipants.length === 0 ? (
              <p className="p-5 text-center text-xs text-slate-500">{t("groupLeader.roomAssignment.participants.noUnassignedSearchResults")}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {visibleUnassignedParticipants.map((participant) => {
                  const isSelected = selectedParticipantIdSet.has(participant.id);
                  return (
                    <li key={participant.id}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => toggleParticipant(participant)}
                        className={`w-full px-3 py-2 text-left transition ${isSelected ? "bg-indigo-50 ring-1 ring-inset ring-indigo-200" : "hover:bg-slate-50"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`truncate text-[11px] font-bold ${isSelected ? "text-indigo-950" : "text-slate-900"}`}>
                              {buildParticipantName(participant)}
                              {participant.age == null
                                ? null
                                : ` (${formatNumber(participant.age)})`}
                            </p>
                            {(isCombinedView || showGroupColumn) ? <p className="truncate text-[9px] font-semibold text-sky-700">{participant.displayGroup}</p> : null}
                            <p className="mt-0.5 truncate text-[9px] text-slate-500">{buildSexLabel(participant.sex, participant.sexCategory, t)} · {participant.arrivalDate ? formatDate(participant.arrivalDate) : "-"} → {participant.departureDate ? formatDate(participant.departureDate) : "-"}</p>
                          </div>
                          <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border text-[9px] font-black ${isSelected ? "border-indigo-600 bg-indigo-600 text-white ring-2 ring-indigo-100" : "border-slate-300 bg-white text-transparent"}`}>✓</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {nonRoomParticipantsForSelectedGroup.length > 0 ? (
            <div className="border-t border-slate-200 bg-slate-50 p-3">
              <button type="button" onClick={() => setNonRoomDialogOpen(true)} className="text-left text-[10px] font-semibold text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900">
                {t("accommodation.roomAssignmentTest.nonRoom.open", { count: formatNumber(nonRoomParticipantsForSelectedGroup.length) })}
              </button>
            </div>
          ) : null}
        </aside>
      </div>

      {unassignedDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setUnassignedDialogOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="unassigned-dialog-title"
            className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="unassigned-dialog-title" className="text-lg font-bold text-slate-900">
                  {t("accommodation.roomAssignmentTest.unassigned.title")}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t("accommodation.roomAssignmentTest.unassigned.subtitle", {
                    count: formatNumber(unassignedParticipantsInScope.length),
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUnassignedDialogOpen(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {t("accommodation.roomAssignmentTest.unassigned.close")}
              </button>
            </header>
            <div className="border-b border-slate-200 px-5 py-3">
              <input
                type="search"
                value={unassignedDialogSearch}
                onChange={(event) => setUnassignedDialogSearch(event.target.value)}
                placeholder={t("accommodation.roomAssignmentTest.unassigned.searchPlaceholder")}
                className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
                autoFocus
              />
            </div>
            <div className="overflow-auto">
              {visibleUnassignedDialogParticipants.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">
                  {t("accommodation.roomAssignmentTest.unassigned.empty")}
                </p>
              ) : (
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-2">{t("accommodation.roomAssignmentTest.unassigned.firstName")}</th>
                      <th className="px-4 py-2">{t("accommodation.roomAssignmentTest.unassigned.lastName")}</th>
                      <th className="px-4 py-2">{t("accommodation.roomAssignmentTest.table.group")}</th>
                      <th className="px-4 py-2">{t("accommodation.roomAssignmentTest.unassigned.arrival")}</th>
                      <th className="px-4 py-2">{t("accommodation.roomAssignmentTest.unassigned.departure")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visibleUnassignedDialogParticipants.map((participant) => (
                      <tr key={participant.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-semibold text-slate-900">{participant.firstName ?? "-"}</td>
                        <td className="px-4 py-2 font-semibold text-slate-900">{participant.lastName ?? "-"}</td>
                        <td className="px-4 py-2 text-slate-600">{participant.displayGroup}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-slate-600">{participant.arrivalDate ? formatDate(participant.arrivalDate) : "-"}</td>
                        <td className="whitespace-nowrap px-4 py-2 text-slate-600">{participant.departureDate ? formatDate(participant.departureDate) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {nonRoomDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNonRoomDialogOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="non-room-dialog-title" className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 id="non-room-dialog-title" className="text-lg font-bold text-slate-900">{t("groupLeader.roomAssignment.nonRoom.title")}</h2>
                <p className="mt-1 text-xs text-slate-500">{t("groupLeader.roomAssignment.nonRoom.subtitle")}</p>
              </div>
              <button type="button" onClick={() => setNonRoomDialogOpen(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">{t("accommodation.roomAssignmentTest.nonRoom.close")}</button>
            </header>
            <div className="border-b border-slate-200 px-5 py-3">
              <input type="search" value={nonRoomSearch} onChange={(event) => setNonRoomSearch(event.target.value)} placeholder={t("groupLeader.roomAssignment.filters.searchPlaceholder")} className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" autoFocus />
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-4 py-2">{t("accommodation.roomAssignmentTest.table.person")}</th>
                    <th className="px-4 py-2">{t("accommodation.roomAssignmentTest.table.group")}</th>
                    <th className="px-4 py-2">{t("accommodation.roomAssignmentTest.nonRoom.reason")}</th>
                    <th className="px-4 py-2">{t("accommodation.roomAssignmentTest.table.stay")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleNonRoomDialogParticipants.map((participant) => (
                    <tr key={participant.id}>
                      <td className="px-4 py-2 font-semibold text-slate-900">{buildParticipantName(participant)}</td>
                      <td className="px-4 py-2 text-slate-600">{participant.displayGroup}</td>
                      <td className="px-4 py-2"><span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-800">{participant.reason === "operator_hotel" ? t("groupLeader.roomAssignment.nonRoom.operatorHotel") : t("groupLeader.roomAssignment.nonRoom.autonomous")}</span></td>
                      <td className="px-4 py-2 whitespace-nowrap text-slate-600">{participant.arrivalDate ? formatDate(participant.arrivalDate) : "-"} → {participant.departureDate ? formatDate(participant.departureDate) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}
